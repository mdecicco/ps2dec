import * as Expr from 'decompiler/expr/base';
import { Value } from 'decompiler/value';
import * as i from 'instructions';
import { Op, Reg } from 'types';
import { BasicBlock, ControlFlowGraph } from './cfg';
import { DominatorInfo } from './dominators';
import { SSADef, SSAForm } from './ssa';

export enum LoopType {
    Unknown,
    For,
    While,
    DoWhile
}

export interface InductionVariable {
    register: Reg.Register;
    initVersion: number; // SSA version at initialization
    initInstruction: i.Instruction;
    stepVersion: number; // SSA version after increment/decrement
    stepInstruction: i.Instruction;
    variable: Value | null;
}

export interface LoopCondition {
    instruction: i.Instruction;
}

export interface Loop {
    header: BasicBlock;
    backEdge: BasicBlock;
    blocks: Set<BasicBlock>;
    exits: Set<BasicBlock>;
    parent: Loop | null;
    children: Loop[];
    type: LoopType;
    inductionVar?: InductionVariable;
    condition?: LoopCondition;
}

export class SSALoopAnalyzer {
    private m_cfg: ControlFlowGraph;
    private m_dominators: DominatorInfo;
    private m_ssa: SSAForm;
    private m_loops: Loop[] = [];

    constructor(cfg: ControlFlowGraph, dominators: DominatorInfo, ssa: SSAForm) {
        this.m_cfg = cfg;
        this.m_dominators = dominators;
        this.m_ssa = ssa;
    }

    /**
     * Find all natural loops in the CFG.
     * A natural loop is formed when:
     * 1. There is an edge B -> H where H dominates B (the back edge)
     * 2. The loop consists of H and all nodes that can reach B without going through H
     */
    findLoops(): Loop[] {
        // Find all back edges
        for (const block of this.m_cfg.getAllBlocks()) {
            for (const succ of block.successors) {
                // If successor dominates this block, it's a back edge
                if (this.m_dominators.dominates(succ, block)) {
                    const loop = this.buildLoop(succ, block);
                    this.m_loops.push(loop);
                }
            }
        }

        // Build loop nesting forest
        this.buildLoopNesting();

        return this.m_loops;
    }

    /**
     * Build a loop from a back edge.
     * @param header The loop header (target of back edge)
     * @param backEdge The back edge source
     */
    private buildLoop(header: BasicBlock, backEdge: BasicBlock): Loop {
        const loop: Loop = {
            header,
            backEdge,
            blocks: new Set([header]),
            exits: new Set(),
            parent: null,
            children: [],
            type: LoopType.Unknown
        };

        // Work backwards from back edge to find all blocks in loop
        const worklist = [backEdge];
        while (worklist.length > 0) {
            const block = worklist.pop()!;
            if (loop.blocks.has(block)) continue;

            loop.blocks.add(block);
            for (const pred of block.predecessors) {
                if (!loop.blocks.has(pred) && pred !== header) {
                    worklist.push(pred);
                }
            }
        }

        // Find loop exits
        for (const block of loop.blocks) {
            for (const succ of block.successors) {
                if (!loop.blocks.has(succ)) {
                    loop.exits.add(succ);
                }
            }
        }

        this.classifyLoop(loop);
        return loop;
    }

    /**
     * Build the loop nesting forest.
     * A loop L1 is nested in loop L2 if:
     * 1. All blocks in L1 are also in L2
     * 2. L1's header is different from L2's header
     */
    private buildLoopNesting(): void {
        // Sort loops by size (larger loops first)
        this.m_loops.sort((a, b) => b.blocks.size - a.blocks.size);

        for (let i = 0; i < this.m_loops.length; i++) {
            const outer = this.m_loops[i];

            // Find the smallest enclosing loop
            let parent: Loop | null = null;
            let parentSize = Infinity;

            for (let j = 0; j < i; j++) {
                const potential = this.m_loops[j];
                if (
                    potential.blocks.size < parentSize &&
                    potential.header !== outer.header &&
                    this.isLoopNested(outer, potential)
                ) {
                    parent = potential;
                    parentSize = potential.blocks.size;
                }
            }

            if (parent) {
                outer.parent = parent;
                parent.children.push(outer);
            }
        }
    }

    /**
     * Check if inner loop is nested within outer loop
     */
    private isLoopNested(inner: Loop, outer: Loop): boolean {
        for (const block of inner.blocks) {
            if (!outer.blocks.has(block)) return false;
        }
        return true;
    }

    debugPrint(): void {
        console.log('Loops found:');
        for (const loop of this.m_loops) {
            if (!loop.parent) {
                // Only print top-level loops
                this.printLoop(loop, 0);
            }
        }
    }

    private printLoop(loop: Loop, depth: number): void {
        const indent = '  '.repeat(depth);
        console.log(`${indent}Loop header: 0x${loop.header.startAddress.toString(16)}`);
        console.log(`${indent}Back edge: 0x${loop.backEdge.startAddress.toString(16)}`);
        console.log(`${indent}Type: ${LoopType[loop.type]}`);

        if (loop.condition) {
            let expr = loop.condition.instruction.toExpression();
            if (expr instanceof Expr.ConditionalBranch) expr = expr.condition;
            console.log(`${indent}Condition: ${expr}`);
        }

        if (loop.inductionVar) {
            console.log(`${indent}Induction variable: ${Reg.formatRegister(loop.inductionVar.register)}`);
            console.log(`${indent}  Init: ${loop.inductionVar.initVersion}`);
            console.log(`${indent}  Step: ${loop.inductionVar.stepVersion}`);
        }

        console.log(
            `${indent}Blocks: ${Array.from(loop.blocks)
                .map(b => '0x' + b.startAddress.toString(16))
                .join(', ')}`
        );
        console.log(
            `${indent}Exits: ${Array.from(loop.exits)
                .map(b => '0x' + b.startAddress.toString(16))
                .join(', ')}`
        );

        for (const child of loop.children) {
            console.log(`${indent}Nested loop:`);
            this.printLoop(child, depth + 1);
        }
    }

    /**
     * Analyze a loop to determine its type and induction variable
     */
    private classifyLoop(loop: Loop): void {
        const headerBranch = loop.header.instructions.find(i => i.isBranch);
        const backEdgeBranch = loop.backEdge.instructions.find(i => i.isBranch);

        // Check all possible patterns, preferring more specific ones
        if (headerBranch && this.isLoopCondition(headerBranch, loop)) {
            // First try to identify a for loop
            const inductionVar = this.findInductionVariable(loop);
            if (inductionVar) {
                loop.inductionVar = inductionVar;
                loop.type = LoopType.For;
                return;
            }

            // If not a for loop, it's a while loop
            loop.type = LoopType.While;
            return;
        }

        // If no header condition, check for do-while
        if (backEdgeBranch && this.isLoopCondition(backEdgeBranch, loop)) {
            loop.type = LoopType.DoWhile;
            return;
        }
    }

    /**
     * Check if an instruction is the loop condition
     */
    private isLoopCondition(instr: i.Instruction, loop: Loop): boolean {
        if (!instr.isBranch) return false;

        // Target will always be the last operand
        const target = instr.operands[instr.operands.length - 1] as number;
        const targetBlock = this.m_cfg.getBlock(target);
        if (!targetBlock || !loop.blocks.has(targetBlock)) return false;

        loop.condition = {
            instruction: instr
        };
        return true;
    }

    /**
     * Find the induction variable for a loop
     */
    private findInductionVariable(loop: Loop): InductionVariable | null {
        if (!loop.condition) return null;
        const branch = loop.condition.instruction;

        // Find all increment/decrement patterns in the loop
        const candidates = new Map<
            string,
            {
                reg: Reg.Register;
                def: SSADef; // Just need the SSA def, not the value
                distance: number;
                stepInstruction: i.Instruction;
            }
        >();

        for (const block of loop.blocks) {
            for (const instr of block.instructions) {
                if (instr.code === Op.Code.addiu || instr.code === Op.Code.addi) {
                    const def = this.m_ssa.getDef(instr, instr.writes[0], false);
                    if (!def) continue;

                    const reg = def.location as Reg.Register;
                    const distance = this.findDistanceToBranch(instr, branch, reg, loop);
                    if (distance >= 0) {
                        const regKey = Reg.key(reg);
                        if (!candidates.has(regKey) || candidates.get(regKey)!.distance > distance) {
                            candidates.set(regKey, { reg, def, distance, stepInstruction: instr });
                        }
                    }
                }
            }
        }

        // Find candidate with shortest path to branch
        let bestReg: Reg.Register | null = null;
        let bestDef: SSADef | null = null;
        let bestInit: { def: SSADef; instr: i.Instruction } | null = null;
        let bestStep: i.Instruction | null = null;
        let shortestDistance = Infinity;

        for (const [k, { reg, def, distance, stepInstruction }] of candidates) {
            if (distance < shortestDistance) {
                const init = this.findInitialization(reg, loop);
                if (init) {
                    bestReg = reg;
                    bestDef = def;
                    bestInit = init;
                    bestStep = stepInstruction;
                    shortestDistance = distance;
                }
            }
        }

        if (!bestReg || !bestDef || !bestInit || !bestStep) return null;

        return {
            register: bestReg,
            initVersion: bestInit.def.version,
            initInstruction: bestInit.instr,
            stepVersion: bestDef.version,
            stepInstruction: bestStep,
            variable: null
        };
    }

    /**
     * Find the shortest path from an instruction to the branch through data flow
     * Returns -1 if no path exists, otherwise returns the number of steps
     */
    private findDistanceToBranch(
        from: i.Instruction,
        branch: i.Instruction,
        trackReg: Reg.Register,
        loop: Loop,
        seen: Set<string> = new Set()
    ): number {
        // Direct use in branch
        if (branch.reads.some(r => Reg.compare(r, trackReg))) {
            return 0;
        }

        // Find all instructions between from and branch that use trackReg
        const block = this.m_cfg.getBlock(from.address)!;
        let distance = 0;
        let foundPath = false;

        // Look at instructions after 'from' in this block
        let startIdx = block.instructions.indexOf(from) + 1;
        for (let i = startIdx; i < block.instructions.length; i++) {
            const instr = block.instructions[i];
            if (instr === branch) break;

            // If this instruction reads our tracked register
            if (instr.reads.some(r => Reg.compare(r, trackReg))) {
                // Mark this reg as seen to prevent cycles
                const key = `${instr.address}_${Reg.key(trackReg)}`;
                if (seen.has(key)) continue;
                seen.add(key);

                // Check if any written registers reach the branch
                for (const write of instr.writes) {
                    const subDistance = this.findDistanceToBranch(instr, branch, write, loop, seen);
                    if (subDistance >= 0) {
                        foundPath = true;
                        distance = Math.min(distance, subDistance + 1);
                    }
                }
            }
        }

        return foundPath ? distance : -1;
    }

    /**
     * Find initialization of a register before a loop
     */
    private findInitialization(reg: Reg.Register, loop: Loop): { def: SSADef; instr: i.Instruction } | null {
        // First try to get initial value through phi node
        const headerInstr = loop.header.instructions[0];
        const init = this.m_ssa.getInitialDef(headerInstr, reg);
        if (init) return init;

        // Fall back to walking predecessors
        const worklist = [...loop.header.predecessors];
        const seen = new Set<BasicBlock>();

        while (worklist.length > 0) {
            const block = worklist.pop()!;
            if (seen.has(block)) continue;
            seen.add(block);

            // Look for definitions in this block
            for (const instr of block.instructions) {
                const def = this.m_ssa.getDef(instr, reg, false);
                if (def) return { def, instr };
            }

            // Add predecessors to worklist
            worklist.push(...block.predecessors);
        }

        return null;
    }
}
