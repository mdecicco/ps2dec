import { i, Op, Reg } from 'decoder';
import { Decompiler } from '../decompiler';

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
            if (!instr.isBranch) continue;

            const target = instr.operands[instr.operands.length - 1];
            if (typeof target !== 'number') {
                // Indirect branch, likely a call
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
                        new BasicBlock(cfg, currentBlock.startAddress, instr.address, currentBlock.instructions)
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

            if (instr.isLikelyBranch) {
                // Delay slot belongs only to one path from here, so it must
                // be in its own block

                currentBlock.instructions.push(instr);
                currentBlock.endAddress += 4;

                blocks.push(
                    new BasicBlock(cfg, currentBlock.startAddress, currentBlock.endAddress, currentBlock.instructions)
                );

                blocks.push(new BasicBlock(cfg, delayInstr.address, delayInstr.address + 4, [delayInstr]));

                currentBlock = {
                    instructions: [],
                    startAddress: delayInstr.address + 4,
                    endAddress: delayInstr.address + 4
                };

                idx++; // Don't add the delay slot again
            } else {
                currentBlock.instructions.push(delayInstr); // Delay slot
                currentBlock.instructions.push(instr);
                currentBlock.endAddress += 8;
                idx++; // Don't add the delay slot again

                blocks.push(
                    new BasicBlock(cfg, currentBlock.startAddress, currentBlock.endAddress, currentBlock.instructions)
                );

                currentBlock = {
                    instructions: [],
                    startAddress: currentBlock.endAddress,
                    endAddress: currentBlock.endAddress
                };
            }
        }

        if (currentBlock.instructions.length > 0) {
            blocks.push(
                new BasicBlock(cfg, currentBlock.startAddress, currentBlock.endAddress, currentBlock.instructions)
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

            if (block.branchInstruction) {
                // For conditional branches, add both paths
                // Target will always be the last operand
                const target = block.branchInstruction.operands[block.branchInstruction.operands.length - 1] as number;
                const targetBlock = blockMap.get(target);
                let nextBlockIdx = i + 1;

                if (targetBlock) {
                    if (block.branchInstruction.isLikelyBranch) {
                        // Have to flow to delay slot block first
                        const delaySlotBlock = blockMap.get(block.branchInstruction.address + 4);
                        if (delaySlotBlock) {
                            block.successors.push(delaySlotBlock);
                            delaySlotBlock.predecessors.push(block);
                            delaySlotBlock.successors.push(targetBlock);
                            ignoreBlocks.add(delaySlotBlock);

                            // Fallthrough path must not include the delay slot block
                            nextBlockIdx++;
                        } else {
                            throw new Error('Delay slot block not found');
                        }
                    } else {
                        // Just flow to target block
                        block.successors.push(targetBlock);
                        targetBlock.predecessors.push(block);
                    }
                }

                // Add fall-through path for non-unconditional branches
                if (!block.branchInstruction.isUnconditionalBranch) {
                    // Fall through to the next block after the delay slot
                    if (nextBlockIdx < blocks.length) {
                        block.successors.push(blocks[nextBlockIdx]);
                        blocks[nextBlockIdx].predecessors.push(block);
                    }
                }
            } else if (i < blocks.length - 1) {
                // For non-branch instructions, fall through to the next block
                block.successors.push(blocks[i + 1]);
                blocks[i + 1].predecessors.push(block);
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

        graph.m_blocks.forEach(block => {
            block.instructions.forEach(instr => {
                graph.m_blockMap.set(instr.address, block);
            });
        });

        ControlFlowGraph.linkBlocks(graph.m_blocks);

        if (graph.m_blocks.length > 0) {
            graph.m_entryBlock = graph.m_blocks[0];
            graph.m_exitBlocks = graph.m_blocks.filter(block => {
                if (block.successors.length === 0) return true;
                const lastInstr = block.instructions[block.instructions.length - 1];
                if (lastInstr.code !== Op.Code.jr) return false;

                // Returns from function
                return Reg.compare(lastInstr.reads[0], { type: Reg.Type.EE, id: Reg.EE.RA });
            });
        }

        return graph;
    }

    debugPrint(): void {
        // First pass: Collect information about block positions and connections
        const blockInfo = new Map<BasicBlock, { index: number; height: number }>();
        let currentLine = 0;

        this.m_blocks.forEach((block, blockIndex) => {
            // Each block needs: address line + instructions + blank line
            const height = 2 + block.instructions.length;
            blockInfo.set(block, { index: blockIndex, height });
            currentLine += height;
        });

        // Second pass: Generate the output
        const output: string[] = [];
        currentLine = 0;

        this.m_blocks.forEach((block, blockIndex) => {
            const info = blockInfo.get(block)!;
            const blockStart = currentLine;

            // Block header with address range
            output.push(`Block ${blockIndex}: ${block.startAddressHex} - ${block.endAddressHex}`);

            const decomp = Decompiler.current;

            // Instructions
            block.instructions.forEach(instr => {
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
        console.log(`Entry block: Block ${blockInfo.get(this.m_entryBlock!)?.index}`);
        console.log(`Exit blocks: ${this.m_exitBlocks.map(b => `Block ${blockInfo.get(b)?.index}`).join(', ')}`);
    }
}
