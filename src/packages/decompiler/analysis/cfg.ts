import { i, Op, Reg } from 'decoder';
import { Func, Method } from 'typesys';
import { compareLocations, LocationSet } from 'utils';

import { Location } from 'types';
import { instructionReads, instructionWrites } from '../common';
import { DominatorInfo } from './dominators';

export class BasicBlock {
    private m_dominatesMap: Map<BasicBlock, boolean>;

    cfg: ControlFlowGraph;
    id: number;
    startAddress: number;
    endAddress: number;
    startAddressHex: string;
    endAddressHex: string;
    instructions: i.Instruction[];
    successors: BasicBlock[];
    predecessors: BasicBlock[];
    branchInstruction: i.Instruction | null;

    constructor(
        id: number,
        cfg: ControlFlowGraph,
        startAddress: number,
        endAddress: number,
        instructions: i.Instruction[]
    ) {
        this.m_dominatesMap = new Map();

        this.cfg = cfg;
        this.id = id;
        this.startAddress = startAddress;
        this.endAddress = endAddress;
        this.startAddressHex = `0x${startAddress.toString(16).padStart(8, '0')}`;
        this.endAddressHex = `0x${endAddress.toString(16).padStart(8, '0')}`;
        this.instructions = instructions;
        this.successors = [];
        this.predecessors = [];
        this.branchInstruction = null;
        this.findBranchInstruction();
    }

    private findBranchInstruction(): void {
        for (let i = this.instructions.length - 1; i >= 0; i--) {
            const instr = this.instructions[i];
            if (!instr.isBranch) continue;

            const target = instr.operands[instr.operands.length - 1];
            if (typeof target !== 'number') {
                // Indirect branch, likely a call

                if (instr.code === Op.Code.jr) {
                    // This is a block-terminating instruction, so it counts
                    this.branchInstruction = instr;
                    return;
                }

                continue;
            }

            if (target < this.cfg.rangeStart || target > this.cfg.rangeEnd) {
                // Target is another function, not control flow within this function
                continue;
            }

            this.branchInstruction = instr;
            return;
        }
    }

    /**
     * Check if this block dominates another block
     *
     * A block dominates another if all paths from the entry block
     * to the other block must pass through this block.
     */
    dominates(block: BasicBlock): boolean {
        const cached = this.m_dominatesMap.get(block);
        if (cached !== undefined) return cached;

        const result = this.cfg.dominatorInfo.dominates(this, block);
        this.m_dominatesMap.set(block, result);
        return result;
    }

    /**
     * Check if this block strictly dominates another block
     *
     * A block strictly dominates another if it dominates it and it is not the same block.
     */
    strictlyDominates(block: BasicBlock): boolean {
        return this !== block && this.dominates(block);
    }

    /**
     * Get the dominance frontier for this block
     *
     * The dominance frontier is the set of blocks that:
     * 1. This block doesn't strictly dominate
     * 2. Have a predecessor that this block dominates
     */
    get dominanceFrontier(): Set<BasicBlock> {
        return this.cfg.dominatorInfo.getDominanceFrontier(this);
    }

    /**
     * Get the immediate dominator for this block
     *
     * The immediate dominator is the block that strictly dominates this block.
     */
    get immediateDominator(): BasicBlock | null {
        return this.cfg.dominatorInfo.getImmediateDominator(this);
    }

    /**
     * Check if this block can flow to another block
     */
    canFlowTo(block: BasicBlock, seen: Set<BasicBlock> = new Set()): boolean {
        if (seen.has(this)) {
            // Already visited this block and didn't return true, so it won't return true this time either
            return false;
        }

        seen.add(this);

        for (const successor of this.successors) {
            if (successor === block) return true;
            if (successor.canFlowTo(block, seen)) return true;
        }

        return false;
    }

    /**
     * Iterate over the instructions in the block, calling the callback for each instruction.
     * If the callback returns true, the iteration will stop.
     *
     * @param callback - The callback to call for each instruction.
     * @param startFrom - The instruction to start from. If not provided, the iteration will start from the first instruction.
     */
    each(callback: (instr: i.Instruction) => any, startFrom?: i.Instruction): void {
        let foundStart = startFrom ? false : true;
        for (let i = 0; i < this.instructions.length; i++) {
            const instr = this.instructions[i];

            if (!foundStart) foundStart = instr === startFrom;
            if (foundStart) {
                const result = callback(instr);
                if (result === true) return;
            }
        }
    }

    /**
     * Iterate over the instructions in the block in reverse order, calling the callback for each instruction.
     * If the callback returns true, the iteration will stop.
     *
     * @param callback - The callback to call for each instruction.
     * @param startFrom - The instruction to start from. If not provided, the iteration will start from the last instruction.
     */
    reverseEach(callback: (instr: i.Instruction) => any, startFrom?: i.Instruction): void {
        let foundStart = startFrom ? false : true;
        for (let i = this.instructions.length - 1; i >= 0; i--) {
            const instr = this.instructions[i];

            if (!foundStart) foundStart = instr === startFrom;
            if (foundStart) {
                const result = callback(instr);
                if (result === true) return;
            }
        }
    }

    /**
     * Iterate over the instructions in the block, calling the callback for each instruction.
     * If the callback returns a value, the iteration will stop and the value will be returned.
     *
     * @param callback - The callback to call for each instruction.
     * @param startFrom - The instruction to start from. If not provided, the iteration will start from the first instruction.
     * @returns The value returned by the callback, or null if no value was returned.
     */
    extract<T>(callback: (instr: i.Instruction) => T | null | undefined, startFrom?: i.Instruction): T | null {
        let foundStart = startFrom ? false : true;
        for (let i = 0; i < this.instructions.length; i++) {
            const instr = this.instructions[i];

            if (instr.isBranch && !instr.isLikelyBranch) {
                if (!foundStart) foundStart = this.instructions[i + 1] === startFrom;
                if (foundStart) {
                    const result = callback(this.instructions[i + 1]);
                    if (result) return result;
                }
                i++;
            }

            if (!foundStart) foundStart = instr === startFrom;
            if (foundStart) {
                const result = callback(instr);
                if (result) return result;
            }
        }

        return null;
    }

    /**
     * Iterate over the instructions in the block in reverse order, calling the callback for each instruction.
     * If the callback returns a value, the iteration will stop and the value will be returned.
     *
     * @param callback - The callback to call for each instruction.
     * @param startFrom - The instruction to start from. If not provided, the iteration will start from the last instruction.
     * @returns The value returned by the callback, or null if no value was returned.
     */
    reverseExtract<T>(callback: (instr: i.Instruction) => T | null | undefined, startFrom?: i.Instruction): T | null {
        let foundStart = startFrom ? false : true;
        for (let i = this.instructions.length - 1; i >= 0; i--) {
            const instr = this.instructions[i];
            const prevInstr = i > 0 ? this.instructions[i - 1] : null;

            if (prevInstr && prevInstr.isBranch && !prevInstr.isLikelyBranch) {
                if (!foundStart) foundStart = prevInstr === startFrom;
                if (foundStart) {
                    const result = callback(prevInstr);
                    if (result) return result;
                }
                i--;
            }

            if (!foundStart) foundStart = instr === startFrom;
            if (foundStart) {
                const result = callback(instr);
                if (result) return result;
            }
        }

        return null;
    }

    /**
     * Walk forward through the CFG starting from this block, calling the callback for each block.
     * If the callback returns true, the walk will continue to the block's successors.
     */
    walkForward(callback: (block: BasicBlock) => boolean): void {
        const workList: BasicBlock[] = [this];
        const visited = new Set<BasicBlock>();

        while (workList.length > 0) {
            const block = workList.shift();
            if (!block) continue;

            if (visited.has(block)) continue;
            visited.add(block);

            if (callback(block)) {
                workList.push(...block.successors);
            } else return;
        }
    }

    /**
     * Walk backward through the CFG starting from this block, calling the callback for each block.
     * If the callback returns true, the walk will continue to the block's predecessors.
     */
    walkBackward(callback: (block: BasicBlock) => boolean): void {
        const workList: BasicBlock[] = [this];
        const visited = new Set<BasicBlock>();

        while (workList.length > 0) {
            const block = workList.shift();
            if (!block) continue;

            if (visited.has(block)) continue;
            visited.add(block);

            if (callback(block)) {
                workList.push(...block.predecessors);
            } else return;
        }
    }
}

export class ControlFlowGraph {
    private m_domInfo!: DominatorInfo;
    private m_blocks: BasicBlock[];
    private m_entryBlock: BasicBlock | null;
    private m_exitBlocks: BasicBlock[];
    private m_blockMap: Map<number, BasicBlock>;
    private m_rangeStart: number;
    private m_rangeEnd: number;

    private constructor() {
        this.m_blocks = [];
        this.m_entryBlock = null;
        this.m_exitBlocks = [];
        this.m_blockMap = new Map();
        this.m_rangeStart = 0;
        this.m_rangeEnd = 0;
    }

    /**
     * Get the start address of the control flow graph
     */
    get rangeStart(): number {
        return this.m_rangeStart;
    }

    /**
     * Get the end address of the control flow graph
     */
    get rangeEnd(): number {
        return this.m_rangeEnd;
    }

    /**
     * Get the dominator information for the control flow graph
     */
    get dominatorInfo(): DominatorInfo {
        return this.m_domInfo;
    }

    /**
     * Get the entry point of the control flow graph
     */
    getEntryBlock(): BasicBlock | null {
        return this.m_entryBlock;
    }

    /**
     * Get all exit points from the control flow graph
     */
    getExitBlocks(): BasicBlock[] {
        return [...this.m_exitBlocks];
    }

    /**
     * Get all basic blocks in the graph
     */
    getAllBlocks(): BasicBlock[] {
        return [...this.m_blocks];
    }

    getBlock(address: number): BasicBlock | null {
        return this.m_blockMap.get(address) || null;
    }

    postProcess(currentFunc: Func | Method): void {
        // Attempt to remove as many delay slot blocks as possible
        let didChange = false;

        const isDelaySlotBlock = (b: BasicBlock) => {
            if (b.instructions.length !== 1) return false;
            if (b.successors.length !== 1) return false;
            if (b.predecessors.length !== 1) return false;
            if (!b.predecessors[0].branchInstruction) return false;
            return true;
        };

        const removeBlocks: Set<BasicBlock> = new Set();

        const removeDelayBlock = (b: BasicBlock) => {
            const pred = b.predecessors[0];
            const succ = b.successors[0];
            pred.successors = pred.successors.map(predSucc => (predSucc !== b ? predSucc : succ));
            succ.predecessors = succ.predecessors.map(succPred => (succPred !== b ? succPred : pred));
            removeBlocks.add(b);
        };

        const findAnyUse = (
            b: BasicBlock,
            inheritRemaining: LocationSet,
            seen: Set<BasicBlock> = new Set<BasicBlock>()
        ): boolean => {
            if (inheritRemaining.size === 0) return false;
            if (seen.has(b)) return false;
            seen.add(b);

            const ownRemainingDefs = new LocationSet(inheritRemaining.values);
            let foundUse = false;
            b.each(i => {
                const uses = instructionReads(currentFunc, i);
                uses.forEach(use => {
                    if (ownRemainingDefs.has(use)) {
                        foundUse = true;
                        return true;
                    }
                });

                const defs = instructionWrites(currentFunc, i);
                defs.forEach(def => {
                    ownRemainingDefs.delete(def);
                });

                if (ownRemainingDefs.size === 0) return true;
            });

            if (ownRemainingDefs.size === 0) return false;
            if (foundUse) return true;

            return b.successors.some(s => findAnyUse(s, ownRemainingDefs));
        };

        do {
            didChange = false;

            for (let i = 0; i < this.m_blocks.length; i++) {
                const block = this.m_blocks[i];
                if (removeBlocks.has(block)) continue;

                const inst = block.instructions[0];

                if (block.instructions.length === 1 && block.successors.length === 1) {
                    const succ = block.successors[0];
                    if (
                        succ.predecessors.every(
                            p =>
                                p.instructions.length > 0 &&
                                p.successors.length === 1 &&
                                p.instructions[p.instructions.length - 1].rawMachineCode === inst.rawMachineCode
                        )
                    ) {
                        // Every incoming path for the successor is a block that ends with an identical instruction
                        // Replace/update all the predecessors and add the instruction to the successor

                        succ.instructions.unshift(inst);

                        const newPreds = new Set<BasicBlock>();
                        succ.predecessors.forEach(sibling => {
                            if (sibling.instructions.length === 1) {
                                // The identical instruction is the only instruction, just remove the block
                                removeBlocks.add(sibling);
                                sibling.predecessors.forEach(sPred => {
                                    newPreds.add(sPred);

                                    // replace links from sibling's predecessor -> sibling
                                    // with links from sibling's predecessor -> block's (and sibling's) successor
                                    sPred.successors = sPred.successors.map(s => (s === sibling ? succ : s));
                                });
                            } else {
                                // The identical instruction is the last instruction in this sibling, but the others must be preserved
                                sibling.instructions.pop();

                                // preserve the link
                                newPreds.add(sibling);
                            }
                        });

                        succ.predecessors = Array.from(newPreds.values());
                        didChange = true;
                        continue;
                    }
                }

                if (!isDelaySlotBlock(block)) continue;

                const pred = block.predecessors[0];
                const succ = block.successors[0];

                if (inst.code === Op.Code.nop) {
                    // useless delay instruction

                    removeDelayBlock(block);
                    didChange = true;
                    continue;
                }

                let instWrites: Location[] | null = null;

                if (pred.successors.length === 2 && pred.branchInstruction && !pred.branchInstruction.isLikelyBranch) {
                    if (pred.successors.every(ps => ps.instructions[0].rawMachineCode === inst.rawMachineCode)) {
                        // all of parent's successors start with the same instruction, see if we can move it to above the branch
                        // instruction

                        instWrites = instructionWrites(currentFunc, inst);
                        const branchUses = instructionReads(currentFunc, pred.branchInstruction);

                        if (!branchUses.some(u => instWrites!.some(w => compareLocations(u, w)))) {
                            // branch instruction doesn't use anything defined by the delay slot, the delay slot can be
                            // moved above the branch
                            // 1. remove the first instruction from the parent's successors
                            // 2. eliminate the delay slot block
                            // 3. insert the delay slot instruction before the branch

                            pred.successors.forEach(ps => ps.instructions.shift());
                            removeDelayBlock(block);
                            pred.instructions.splice(pred.instructions.length - 2, 0, inst);
                            didChange = true;
                        }
                    }
                }

                if (instWrites === null) instWrites = instructionWrites(currentFunc, inst);

                if (!findAnyUse(succ, new LocationSet(instWrites))) {
                    // delay instruction is useless, no definitions made by it are used

                    removeDelayBlock(block);
                    didChange = true;
                    continue;
                }

                if (succ.predecessors.length === 1) {
                    // cool, just add this instruction to the successor

                    succ.instructions.unshift(inst);
                    removeDelayBlock(block);
                    didChange = true;
                    continue;
                }
            }
        } while (didChange);

        if (removeBlocks.size > 0) {
            this.m_blockMap.clear();

            let idx = 0;
            this.m_blocks = this.m_blocks.filter(b => {
                if (removeBlocks.has(b)) return false;
                b.id = idx++;

                b.instructions.forEach(instr => {
                    this.m_blockMap.set(instr.address, b);
                });

                return true;
            });

            this.m_domInfo = new DominatorInfo(this);
        }
    }

    /**
     * Walk forward through the CFG starting from this block, calling the callback for each block.
     * If the callback returns true, the walk will continue to the block's successors.
     */
    walkForward(callback: (block: BasicBlock) => boolean): void {
        if (!this.m_entryBlock) return;

        const workList: BasicBlock[] = [this.m_entryBlock];
        const visited = new Set<BasicBlock>();

        while (workList.length > 0) {
            const block = workList.shift();
            if (!block) continue;

            if (visited.has(block)) continue;

            if (block.predecessors.some(p => !visited.has(p) && !block.dominates(p))) {
                if (workList.length === 0) {
                    throw new Error(
                        `ControlFlowGraph.walkForward: Block ${block.startAddressHex} with unprocessed predecessors is the only remaining block in the worklist`
                    );
                }
                continue;
            }

            visited.add(block);

            if (callback(block)) {
                workList.push(...block.successors);
            } else return;
        }
    }

    private static createBasicBlocks(input: i.Instruction[], cfg: ControlFlowGraph): BasicBlock[] {
        const blocks: BasicBlock[] = [];

        // First instruction always starts a block
        let currentBlock = {
            instructions: [] as i.Instruction[],
            startAddress: cfg.rangeStart,
            endAddress: cfg.rangeStart
        };

        const branchTargets = new Set<number>();
        for (const instr of input) {
            if (!instr.isBranch) continue;

            const target = instr.operands[instr.operands.length - 1];
            if (typeof target !== 'number') continue;

            branchTargets.add(target);
        }

        for (let idx = 0; idx < input.length; idx++) {
            const instr = input[idx];

            if (branchTargets.has(instr.address)) {
                // branch target, terminate block and start new one
                if (currentBlock.instructions.length > 0) {
                    blocks.push(
                        new BasicBlock(
                            blocks.length,
                            cfg,
                            currentBlock.startAddress,
                            instr.address,
                            currentBlock.instructions
                        )
                    );
                }

                currentBlock = {
                    instructions: [],
                    startAddress: instr.address,
                    endAddress: instr.address
                };
            }

            if (!instr.isBranch) {
                currentBlock.instructions.push(instr);
                currentBlock.endAddress += 4;
                continue;
            }

            // Target will always be the last operand
            const target = instr.operands[instr.operands.length - 1];

            if (typeof target !== 'number') {
                // Indirect branch, likely a call
                currentBlock.instructions.push(input[idx + 1]); // Delay slot
                currentBlock.instructions.push(instr);
                currentBlock.endAddress += 8;
                idx++; // Don't add the delay slot again

                if (Op.isRegister(target) && Reg.compare(target, { type: Reg.Type.EE, id: Reg.EE.RA })) {
                    // Function return end block
                    blocks.push(
                        new BasicBlock(
                            blocks.length,
                            cfg,
                            currentBlock.startAddress,
                            currentBlock.endAddress,
                            currentBlock.instructions
                        )
                    );

                    currentBlock = {
                        instructions: [],
                        startAddress: currentBlock.endAddress,
                        endAddress: currentBlock.endAddress
                    };
                }

                continue;
            }

            if (target < cfg.rangeStart || target > cfg.rangeEnd) {
                // Target is another function, not control flow within this function
                currentBlock.instructions.push(input[idx + 1]); // Delay slot
                currentBlock.instructions.push(instr);
                currentBlock.endAddress += 8;
                idx++; // Don't add the delay slot again
                continue;
            }

            // last instruction in the current block

            const delayInstr = input[idx + 1];

            if (!delayInstr) {
                console.log(`No delay slot @ ${instr.toString(true)}`);
            }

            currentBlock.instructions.push(instr);
            currentBlock.endAddress += 4;

            // add current block
            blocks.push(
                new BasicBlock(
                    blocks.length,
                    cfg,
                    currentBlock.startAddress,
                    currentBlock.endAddress,
                    currentBlock.instructions
                )
            );

            // create delay slot block for truthy path
            blocks.push(new BasicBlock(blocks.length, cfg, delayInstr.address, delayInstr.address + 4, [delayInstr]));

            if (instr.isLikelyBranch || instr.isUnconditionalBranch) {
                // Likely branches should not include the delay slot in the fallthrough path
                // Unconditional branches have no fallthrough path
                currentBlock = {
                    instructions: [],
                    startAddress: delayInstr.address + 4,
                    endAddress: delayInstr.address + 4
                };
            } else {
                // Clone the delay instruction to break the strict equivalence between the delay instruction
                // in the fallthrough path and the original delay instruction in the truthy path
                const clonedDelay = Object.assign(Object.create(Object.getPrototypeOf(delayInstr)), delayInstr);

                // Regular branches should include the delay slot in the fallthrough path since the delay
                // slot should always be executed
                currentBlock = {
                    instructions: [clonedDelay],

                    // Technically the delay slot is included in the block, but we can't have a second block
                    // with the address of the delay slot...
                    startAddress: delayInstr.address + 4,
                    endAddress: delayInstr.address + 4
                };
            }

            // Don't add the delay slot again
            idx++;
        }

        if (currentBlock.instructions.length > 0) {
            blocks.push(
                new BasicBlock(
                    blocks.length,
                    cfg,
                    currentBlock.startAddress,
                    currentBlock.endAddress,
                    currentBlock.instructions
                )
            );
        }

        return blocks;
    }

    private static linkBlocks(blocks: BasicBlock[]): void {
        // Create a map for quick block lookup by address
        const blockMap = new Map<number, BasicBlock>();
        blocks.forEach(block => blockMap.set(block.startAddress, block));

        const ignoreBlocks = new Set<BasicBlock>();

        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            if (ignoreBlocks.has(block)) continue;
            let nextBlockIdx = i + 1;

            if (block.branchInstruction) {
                // For conditional branches, add both paths
                // Target will always be the last operand
                const target = block.branchInstruction.operands[block.branchInstruction.operands.length - 1];
                if (typeof target !== 'number') {
                    // indirect branch, won't be coming back so don't add fallthrough path (jalr will not be a block's branch instruction)
                    continue;
                }

                const targetBlock = blockMap.get(target);

                if (targetBlock) {
                    // Have to flow to delay slot block first
                    const delaySlotBlock = blockMap.get(block.branchInstruction.address + 4);
                    if (delaySlotBlock) {
                        block.successors.push(delaySlotBlock);
                        delaySlotBlock.predecessors.push(block);
                        delaySlotBlock.successors.push(targetBlock);
                        targetBlock.predecessors.push(delaySlotBlock);
                        ignoreBlocks.add(delaySlotBlock);

                        // Fallthrough path must not include the delay slot block
                        nextBlockIdx++;
                    } else {
                        throw new Error('Delay slot block not found');
                    }
                }

                // No fallthrough path for unconditional branches
                if (block.branchInstruction.isUnconditionalBranch) continue;
            }

            if (nextBlockIdx < blocks.length) {
                // Add fallthrough path to the next block
                block.successors.push(blocks[nextBlockIdx]);
                blocks[nextBlockIdx].predecessors.push(block);
            }
        }
    }

    static build(input: i.Instruction[]): ControlFlowGraph {
        const graph = new ControlFlowGraph();

        graph.m_rangeStart = input[0].address;
        graph.m_rangeEnd = graph.m_rangeEnd;

        for (const instr of input) {
            const addr = instr.address;
            if (addr < graph.m_rangeStart) graph.m_rangeStart = addr;
            if (addr > graph.m_rangeEnd) graph.m_rangeEnd = addr;
        }

        graph.m_blocks = ControlFlowGraph.createBasicBlocks(input, graph);
        ControlFlowGraph.linkBlocks(graph.m_blocks);

        graph.m_blocks.forEach(block => {
            block.instructions.forEach(instr => {
                graph.m_blockMap.set(instr.address, block);
            });
        });

        if (graph.m_blocks.length > 0) {
            graph.m_entryBlock = graph.m_blocks[0];
            graph.m_exitBlocks = graph.m_blocks.filter(block => {
                if (block.successors.length === 0) return true;

                // todo: this shouldn't be necessary
                const lastInstr = block.instructions[block.instructions.length - 1];
                if (lastInstr.code !== Op.Code.jr) return false;

                // Returns from function
                return Reg.compare(lastInstr.reads[0], { type: Reg.Type.EE, id: Reg.EE.RA });
            });
        }

        graph.m_domInfo = new DominatorInfo(graph);

        return graph;
    }

    debugPrint(): void {
        const output: string[] = [];
        this.m_blocks.forEach((block, blockIndex) => {
            // Block header with address range
            output.push(`Block ${block.id}: ${block.startAddressHex} - ${block.endAddressHex}`);

            // Instructions
            block.instructions.forEach(instr => {
                output.push(`    0x${instr.address.toString(16).padStart(8, '0')}: ${instr}`);
            });

            // Add connections
            if (block.predecessors.length > 0) {
                const predecessorIndices = block.predecessors.map(p => p.id).join(', ');
                output.push(`    ← Block${block.predecessors.length > 1 ? 's' : ''} ${predecessorIndices}`);
            }

            if (block.successors.length > 0) {
                const successorIndices = block.successors.map(s => s.id).join(', ');
                output.push(`    → Block${block.successors.length > 1 ? 's' : ''} ${successorIndices}`);
            }

            // Add blank line between blocks
            output.push('');
        });

        // Print the graph
        console.log('\nControl Flow Graph:');
        console.log('=================\n');
        console.log(output.join('\n'));

        // Print summary
        console.log('\nSummary:');
        console.log('========');
        console.log(`Entry block: Block ${this.m_entryBlock?.id}`);
        console.log(`Exit blocks: ${this.m_exitBlocks.map(b => b.id).join(', ')}`);
    }
}
