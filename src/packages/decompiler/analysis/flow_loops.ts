import { i, Op, Reg } from 'decoder';
import { DecompVariable } from 'decompiler';
import { FunctionCode, LocationDef } from '../input';
import { BasicBlock } from './cfg';
import { DominatorInfo } from './dominators';

export enum LoopType {
    Unknown,
    For,
    While,
    DoWhile
}

export interface InductionVariable {
    register: Reg.Register;
    initVersion: number;
    initInstruction: i.Instruction | null;
    stepVersion: number;
    stepInstruction: i.Instruction;
    variable: DecompVariable | null;
}

export interface LoopCondition {
    instruction: i.Instruction;
}

export interface Loop {
    header: BasicBlock; // Entry point of the loop
    blocks: Set<BasicBlock>; // All blocks in the loop
    backEdges: BasicBlock[]; // Blocks that branch back to header
    exits: BasicBlock[]; // Blocks that branch outside the loop
    parent: Loop | null; // Parent loop if nested
    children: Loop[]; // Nested loops
    type: LoopType;
    inductionVar: InductionVariable | null;
    condition: LoopCondition;
}

export class LoopAnalyzer {
    private m_func: FunctionCode;
    private m_dominators: DominatorInfo;
    private m_loops: Loop[] = [];

    constructor(func: FunctionCode) {
        this.m_func = func;
        this.m_dominators = new DominatorInfo(func.cfg);
    }

    findLoops(): Loop[] {
        const seenBlocks = new Set<BasicBlock>();

        // Process each block looking for loop headers
        for (const block of this.m_func.cfg.getAllBlocks()) {
            // Skip if we've already seen this block as part of another loop
            if (seenBlocks.has(block)) continue;

            // Check if this is a loop header
            const isHeader = block.predecessors.some(pred => this.m_dominators.dominates(block, pred));

            if (isHeader) {
                try {
                    const loop = this.processLoopHeader(block, seenBlocks);
                    if (loop) this.m_loops.push(loop);
                } catch (e) {
                    console.error(`Failed to process loop at 0x${block.startAddress.toString(16)}`, e);
                }
            }
        }

        return this.m_loops;
    }

    private processLoopHeader(header: BasicBlock, seenBlocks: Set<BasicBlock>): Loop | null {
        // Find all blocks that branch back to this header
        const backEdges = header.predecessors.filter(pred => this.m_dominators.dominates(header, pred));

        // Get all blocks in this loop
        const blocks = this.getLoopBlocks(header, backEdges, seenBlocks);

        // Find exits
        const exits = Array.from(blocks).filter(block => block.successors.some(succ => !blocks.has(succ)));

        // Recursively process any nested loops within these blocks
        const children: Loop[] = [];
        for (const block of blocks) {
            if (block === header) continue;

            // Skip if we've already seen this block
            if (seenBlocks.has(block)) continue;

            // Check if this block is a loop header
            const isHeader = block.predecessors.some(pred => this.m_dominators.dominates(block, pred));

            if (isHeader) {
                const nestedLoop = this.processLoopHeader(block, seenBlocks);
                if (nestedLoop) {
                    children.push(nestedLoop);
                }
            }
        }

        const loopCondition = this.determineLoopCondition(header, blocks, exits);
        const { loopType, inductionVar } = this.determineLoopType(header, loopCondition, blocks);

        const loop: Loop = {
            header,
            blocks,
            backEdges,
            exits,
            parent: null,
            children,
            type: loopType,
            condition: loopCondition,
            inductionVar
        };

        children.forEach(child => {
            child.parent = loop;
        });

        return loop;
    }

    private getLoopBlocks(header: BasicBlock, backEdges: BasicBlock[], seenBlocks: Set<BasicBlock>): Set<BasicBlock> {
        const blocks = new Set<BasicBlock>([header, ...backEdges]);
        const worklist = [...backEdges];

        // Mark all these blocks as seen
        blocks.forEach(b => seenBlocks.add(b));

        while (worklist.length > 0) {
            const block = worklist.pop()!;
            for (const pred of block.predecessors) {
                if (blocks.has(pred)) continue;
                if (pred.startAddress < header.startAddress) continue;

                if (pred.canFlowTo(header)) {
                    blocks.add(pred);
                    seenBlocks.add(pred);
                    worklist.push(pred);
                }
            }
        }

        return blocks;
    }

    private determineLoopCondition(header: BasicBlock, blocks: Set<BasicBlock>, exits: BasicBlock[]): LoopCondition {
        // First check the header block (for while/for loops)
        if (header.branchInstruction && header.successors.some(succ => !blocks.has(succ))) {
            return { instruction: header.branchInstruction };
        }

        // Check back edge blocks (for do-while loops)
        const branchesToHeader: { block: BasicBlock; instruction: i.Instruction }[] = [];
        for (const backEdge of exits) {
            if (backEdge.branchInstruction && !backEdge.branchInstruction.isUnconditionalBranch) {
                if (backEdge.successors.includes(header)) {
                    branchesToHeader.push({
                        block: backEdge,
                        instruction: backEdge.branchInstruction
                    });
                }
            }
        }

        if (branchesToHeader.length === 1) {
            return { instruction: branchesToHeader[0].instruction };
        } else if (branchesToHeader.length > 1) {
            // Find the block that dominates the others
            const dominatingBranch = branchesToHeader.find(branch =>
                branchesToHeader.every(
                    other => branch === other || this.m_dominators.dominates(branch.block, other.block)
                )
            );

            if (dominatingBranch) {
                return { instruction: dominatingBranch.instruction };
            }

            // If no clear dominator, count all paths that can reach each branch block
            const blockPaths = new Map<BasicBlock, number>();

            for (const { block: branchBlock } of branchesToHeader) {
                const seen = new Set<BasicBlock>();
                const worklist = [
                    {
                        block: branchBlock,
                        pathCount: 1 // Each path starts with count of 1
                    }
                ];
                let totalPaths = 0;

                while (worklist.length > 0) {
                    const { block: current, pathCount } = worklist.pop()!;

                    if (current === header) {
                        // Found a path to header, add its count
                        totalPaths += pathCount;
                        continue;
                    }

                    if (seen.has(current)) continue;
                    seen.add(current);

                    // For each predecessor, add a new path with the current path count
                    for (const pred of current.predecessors) {
                        if (blocks.has(pred)) {
                            worklist.push({
                                block: pred,
                                pathCount: pathCount
                            });
                        }
                    }
                }

                blockPaths.set(branchBlock, totalPaths);
            }

            branchesToHeader.sort((a, b) => (blockPaths.get(b.block) || 0) - (blockPaths.get(a.block) || 0));

            return { instruction: branchesToHeader[0].instruction };
        }

        throw new Error(`Supposed loop at 0x${header.startAddress.toString(16)} has no branches to header`);
    }

    private determineLoopType(
        header: BasicBlock,
        condition: LoopCondition,
        blocks: Set<BasicBlock>
    ): { loopType: LoopType; inductionVar: InductionVariable | null } {
        try {
            const inductionVar = this.findInductionVariable(header, condition, blocks);
            if (inductionVar) {
                return { loopType: LoopType.For, inductionVar };
            }
        } catch (e) {
            console.warn('Failed to find induction variable for loop', e);
        }

        return { loopType: LoopType.While, inductionVar: null };
    }

    private findInductionVariable(
        header: BasicBlock,
        condition: LoopCondition,
        blocks: Set<BasicBlock>
    ): InductionVariable | null {
        const branch = condition.instruction;

        // Find all increment/decrement patterns in the loop
        const candidates = new Map<
            string,
            {
                reg: Reg.Register;
                def: LocationDef;
                distance: number;
                stepInstruction: i.Instruction;
            }
        >();

        for (const block of blocks) {
            for (const instr of block.instructions) {
                if (instr.code === Op.Code.addiu || instr.code === Op.Code.addi) {
                    const def = this.m_func.getDef(instr, instr.writes[0]);
                    if (!def) continue;

                    const reg = def.value as Reg.Register;
                    const distance = this.findDistanceToBranch(instr, branch, reg, header);
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
        let bestDef: LocationDef | null = null;
        let bestInit: LocationDef | null = null;
        let bestStep: i.Instruction | null = null;
        let shortestDistance = Infinity;

        for (const [k, { reg, def, distance, stepInstruction }] of candidates) {
            if (distance < shortestDistance) {
                const init = this.findInitialization(reg, header);
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
            initVersion: bestInit.version,
            initInstruction: bestInit.instruction,
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
        loopHeader: BasicBlock,
        seen: Set<string> = new Set()
    ): number {
        // Direct use in branch
        if (branch.reads.some(r => Reg.compare(r, trackReg))) {
            return 0;
        }

        // Find all instructions between from and branch that use trackReg
        const block = this.m_func.cfg.getBlock(from.address)!;
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
                    const subDistance = this.findDistanceToBranch(instr, branch, write, loopHeader, seen);
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
    private findInitialization(reg: Reg.Register, loopHeader: BasicBlock): LocationDef | null {
        return this.m_func.getDefAt(reg, loopHeader.startAddress);
    }
}
