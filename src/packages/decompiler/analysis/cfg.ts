import { i } from 'decoder';
import { Decompiler } from '../decompiler';
import { findBlockBoundaries } from './blocks';

export class BasicBlock {
    cfg: ControlFlowGraph;
    startAddress: number;
    endAddress: number;
    startAddressHex: string;
    endAddressHex: string;
    instructions: i.Instruction[];
    successors: BasicBlock[];
    predecessors: BasicBlock[];
    branchInstruction: i.Instruction | null;

    constructor(cfg: ControlFlowGraph, startAddress: number, endAddress: number, instructions: i.Instruction[]) {
        this.cfg = cfg;
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
            if (instr.isBranch && !instr.isUnconditionalBranch) {
                this.branchInstruction = instr;
                return;
            }
        }
    }

    isLoopHeader(): boolean {
        return this.canFlowTo(this);
    }

    canFlowTo(block: BasicBlock, seen: Set<number> = new Set()): boolean {
        if (seen.has(this.startAddress)) {
            // Already visited this block and didn't return true, so it won't return true this time either
            return false;
        }

        seen.add(this.startAddress);

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

            if (instr.isBranch && !instr.isLikelyBranch) {
                if (!foundStart) foundStart = this.instructions[i + 1] === startFrom;
                if (foundStart) {
                    const result = callback(this.instructions[i + 1]);
                    if (result === true) return;
                }
                i++;
            }

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
            const prevInstr = i > 0 ? this.instructions[i - 1] : null;

            if (prevInstr && prevInstr.isBranch && !prevInstr.isLikelyBranch) {
                if (!foundStart) foundStart = prevInstr === startFrom;
                if (foundStart) {
                    const result = callback(prevInstr);
                    if (result === true) return;
                }
                i--;
            }

            if (!foundStart) foundStart = instr === startFrom;
            if (foundStart) {
                const result = callback(instr);
                if (result === true) return;
            }
        }
    }

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
        const visited = new Set<number>();

        while (workList.length > 0) {
            const block = workList.shift();
            if (!block) continue;

            if (visited.has(block.startAddress)) continue;
            visited.add(block.startAddress);

            if (callback(block)) {
                workList.push(...block.successors);
            }
        }
    }

    /**
     * Walk backward through the CFG starting from this block, calling the callback for each block.
     * If the callback returns true, the walk will continue to the block's predecessors.
     */
    walkBackward(callback: (block: BasicBlock) => boolean): void {
        const workList: BasicBlock[] = [this];
        const visited = new Set<number>();

        while (workList.length > 0) {
            const block = workList.shift();
            if (!block) continue;

            if (visited.has(block.startAddress)) continue;
            visited.add(block.startAddress);

            if (callback(block)) {
                workList.push(...block.predecessors);
            }
        }
    }
}

export class ControlFlowGraph {
    private blocks: BasicBlock[] = [];
    private entryBlock: BasicBlock | null = null;
    private exitBlocks: BasicBlock[] = [];
    private blockMap: Map<number, BasicBlock> = new Map();

    private constructor() {}

    /**
     * Get the entry point of the control flow graph
     */
    getEntryBlock(): BasicBlock | null {
        return this.entryBlock;
    }

    /**
     * Get all exit points from the control flow graph
     */
    getExitBlocks(): BasicBlock[] {
        return [...this.exitBlocks];
    }

    /**
     * Get all basic blocks in the graph
     */
    getAllBlocks(): BasicBlock[] {
        return [...this.blocks];
    }

    getBlock(address: number): BasicBlock | null {
        return this.blockMap.get(address) || null;
    }

    private static createBasicBlocks(
        input: i.Instruction[],
        boundaries: Set<number>,
        cfg: ControlFlowGraph
    ): BasicBlock[] {
        const blocks: BasicBlock[] = [];
        const boundaryAddresses = Array.from(boundaries).sort((a, b) => a - b);

        const decomp = Decompiler.get();

        // Create blocks between each boundary
        for (let i = 0; i < boundaryAddresses.length; i++) {
            const startAddress = boundaryAddresses[i];
            const endAddress = boundaryAddresses[i + 1] ?? Infinity;

            // Find all instructions in this range
            const instructions = input.filter(instr => instr.address >= startAddress && instr.address < endAddress);

            if (instructions.length > 0) {
                const block = new BasicBlock(
                    cfg,
                    startAddress,
                    instructions[instructions.length - 1].address,
                    instructions
                );
                blocks.push(block);
                instructions.forEach(instr => cfg.blockMap.set(instr.address, block));
            }
        }

        return blocks;
    }

    private static linkBlocks(blocks: BasicBlock[]): void {
        // Create a map for quick block lookup by address
        const blockMap = new Map<number, BasicBlock>();
        blocks.forEach(block => blockMap.set(block.startAddress, block));

        for (const block of blocks) {
            const lastInstr = block.instructions[block.instructions.length - 1];
            const lastAddr = block.instructions[block.instructions.length - 1].address;

            // Find the branch instruction (if any) - it will be the second-to-last instruction if present
            let branchInstr: i.Instruction | undefined;
            let branchAddr: number | undefined;

            if (block.instructions.length >= 2) {
                const secondLastInstr = block.instructions[block.instructions.length - 2];
                if (secondLastInstr.isBranch) {
                    branchInstr = secondLastInstr;
                    branchAddr = secondLastInstr.address;
                }
            }

            // If no branch was found in second-to-last position, check last position
            if (!branchInstr && lastInstr.isBranch) {
                branchInstr = lastInstr;
                branchAddr = lastAddr;
            }

            if (branchInstr) {
                // For conditional branches, add both paths
                // Target will always be the last operand
                const target = branchInstr.operands[branchInstr.operands.length - 1] as number;
                const targetBlock = blockMap.get(target);
                if (targetBlock) {
                    block.successors.push(targetBlock);
                    targetBlock.predecessors.push(block);
                }

                // Add fall-through path for non-unconditional branches
                if (!i.j.is(branchInstr) && !i.b.is(branchInstr)) {
                    // Fall through to the next block after the delay slot
                    const nextAddr = lastAddr + 4;
                    const nextBlock = blockMap.get(nextAddr);
                    if (nextBlock) {
                        block.successors.push(nextBlock);
                        nextBlock.predecessors.push(block);
                    }
                }
            } else if (i.jr.is(lastInstr)) {
                // JR is special as we can't statically determine its target
                // Don't add any successors
            } else {
                // For non-branch instructions, fall through to the next block
                const nextAddr = lastAddr + 4;
                const nextBlock = blockMap.get(nextAddr);
                if (nextBlock) {
                    block.successors.push(nextBlock);
                    nextBlock.predecessors.push(block);
                }
            }
        }
    }

    static build(input: i.Instruction[]): ControlFlowGraph {
        const graph = new ControlFlowGraph();

        // 1. First pass: Identify basic block boundaries
        const boundaries = findBlockBoundaries(input);

        // 2. Second pass: Create basic blocks
        graph.blocks = this.createBasicBlocks(input, boundaries, graph);

        // 3. Third pass: Link blocks together
        this.linkBlocks(graph.blocks);

        // 4. Fourth pass: Identify entry/exit points
        if (graph.blocks.length > 0) {
            graph.entryBlock = graph.blocks[0];
            graph.exitBlocks = graph.blocks.filter(
                block => block.successors.length === 0 || i.jr.is(block.instructions[block.instructions.length - 1])
            );
        }

        return graph;
    }

    debugPrint(): void {
        // First pass: Collect information about block positions and connections
        const blockInfo = new Map<BasicBlock, { index: number; height: number }>();
        let currentLine = 0;

        this.blocks.forEach((block, blockIndex) => {
            // Each block needs: address line + instructions + blank line
            const height = 2 + block.instructions.length;
            blockInfo.set(block, { index: blockIndex, height });
            currentLine += height;
        });

        // Second pass: Generate the output
        const output: string[] = [];
        currentLine = 0;

        this.blocks.forEach((block, blockIndex) => {
            const info = blockInfo.get(block)!;
            const blockStart = currentLine;

            // Block header with address range
            output.push(
                `Block ${blockIndex}: 0x${block.startAddress.toString(16).padStart(8, '0')} - 0x${block.endAddress
                    .toString(16)
                    .padStart(8, '0')}`
            );

            const decomp = Decompiler.get();

            // Instructions
            block.instructions.forEach(instr => {
                if (decomp.isAddressIgnored(instr.address)) return;
                output.push(`    0x${instr.address.toString(16).padStart(8, '0')}: ${instr}`);
            });

            // Add connections
            if (block.successors.length > 0) {
                const successorIndices = block.successors.map(s => blockInfo.get(s)!.index).join(', ');
                output.push(`    → Block${block.successors.length > 1 ? 's' : ''} ${successorIndices}`);
            }

            // Add blank line between blocks
            output.push('');

            currentLine += info.height;
        });

        // Print the graph
        console.log('\nControl Flow Graph:');
        console.log('=================\n');
        console.log(output.join('\n'));

        // Print summary
        console.log('\nSummary:');
        console.log('========');
        console.log(`Entry block: Block ${blockInfo.get(this.entryBlock!)?.index}`);
        console.log(`Exit blocks: ${this.exitBlocks.map(b => `Block ${blockInfo.get(b)?.index}`).join(', ')}`);
    }
}
