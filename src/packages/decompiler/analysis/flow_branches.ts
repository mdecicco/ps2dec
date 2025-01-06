import { i, Op } from 'decoder';
import { BasicBlock, ControlFlowGraph } from './cfg';
import { DominatorInfo } from './dominators';
import { SSAForm } from './ssa';

export interface IfStatement {
    condition: i.Instruction;
    thenBlocks: Set<BasicBlock>;
    elseBlocks: Set<BasicBlock>;
    joinBlock: BasicBlock; // Where paths converge
}

export interface BranchChain {
    branches: IfStatement[];
    joinBlock: BasicBlock;
}

export interface BranchAnalysisResult {
    branches: IfStatement[];
    chains: BranchChain[];
}

export class SSABranchAnalyzer {
    private m_cfg: ControlFlowGraph;
    private m_dominators: DominatorInfo;
    private m_ssa: SSAForm;
    private m_loopBranches: Set<i.Instruction>;

    constructor(cfg: ControlFlowGraph, dominators: DominatorInfo, ssa: SSAForm, loopBranches: i.Instruction[] = []) {
        this.m_cfg = cfg;
        this.m_dominators = dominators;
        this.m_ssa = ssa;
        this.m_loopBranches = new Set(loopBranches);
    }

    findBranches(): BranchAnalysisResult {
        // First collect all individual branches
        const allBranches: IfStatement[] = [];
        for (const block of this.m_cfg.getAllBlocks()) {
            const branch = this.findBranchInstruction(block);
            if (!branch) continue;

            const ifStmt = this.findIfPattern(branch);
            if (ifStmt) {
                allBranches.push(ifStmt);
            }
        }

        // Then group related branches
        const chains = this.findBranchChains(allBranches);
        return {
            branches: allBranches,
            chains
        };
    }

    private findBranchInstruction(block: BasicBlock): i.Instruction | null {
        const ignoredBranches = new Set([Op.Code.b, Op.Code.j, Op.Code.jal, Op.Code.jalr, Op.Code.jr]);

        // iterate the instructions manually in reverse since the branch
        // instruction is either the last or second to last instruction
        for (let i = block.instructions.length - 1; i >= 0; i--) {
            const instr = block.instructions[i];
            if (!instr.isBranch) continue;

            // Don't consider unconditional branches
            if (ignoredBranches.has(instr.code)) continue;

            // Check if this is a loop branch
            if (this.m_loopBranches.has(instr)) continue;

            return instr;
        }

        return null;
    }

    private findIfPattern(branch: i.Instruction): IfStatement | null {
        const block = this.m_cfg.getBlock(branch.address)!;
        const thenTarget = branch.operands[branch.operands.length - 1] as number;
        const thenBlock = this.m_cfg.getBlock(thenTarget);
        const elseBlock = block.successors.find(b => b !== thenBlock);

        if (!thenBlock || !elseBlock) return null;

        // Find where the paths converge using dominance frontier
        const joinBlock = this.findJoinBlock(thenBlock, elseBlock);
        if (!joinBlock) return null;

        return {
            condition: branch,
            thenBlocks: this.collectBlocksUntil(thenBlock, joinBlock),
            elseBlocks: this.collectBlocksUntil(elseBlock, joinBlock),
            joinBlock
        };
    }

    private findJoinBlock(thenBlock: BasicBlock, elseBlock: BasicBlock): BasicBlock | null {
        // For each block, count how many of our paths reach it
        const pathCounts = new Map<BasicBlock, number>();
        const seen = new Set<BasicBlock>();

        // Helper to traverse paths
        const traverse = (start: BasicBlock) => {
            const worklist = [start];
            while (worklist.length > 0) {
                const block = worklist.pop()!;
                if (seen.has(block)) continue;
                seen.add(block);

                // Count this path
                pathCounts.set(block, (pathCounts.get(block) || 0) + 1);

                // Continue traversal
                worklist.push(...block.successors);
            }
        };

        // Traverse from both paths
        seen.clear();
        traverse(thenBlock);
        seen.clear();
        traverse(elseBlock);

        // Find earliest block with all paths converging
        let bestBlock: BasicBlock | null = null;
        for (const [block, count] of pathCounts) {
            if (count === 2) {
                // Both paths reach this block
                if (!bestBlock || block.startAddress < bestBlock.startAddress) {
                    bestBlock = block;
                }
            }
        }

        return bestBlock;
    }

    private collectBlocksUntil(start: BasicBlock, end: BasicBlock): Set<BasicBlock> {
        const blocks = new Set<BasicBlock>();
        const worklist = [start];

        while (worklist.length > 0) {
            const block = worklist.pop()!;
            if (block === end || blocks.has(block)) continue;

            blocks.add(block);
            worklist.push(...block.successors);
        }

        return blocks;
    }

    private findBranchChains(branches: IfStatement[]): BranchChain[] {
        const chains: BranchChain[] = [];
        const processed = new Set<IfStatement>();

        for (const branch of branches) {
            if (processed.has(branch)) continue;

            // Find all branches that share this join point
            const related = branches.filter(b => !processed.has(b) && b.joinBlock === branch.joinBlock);

            if (related.length > 1) {
                chains.push({
                    branches: related,
                    joinBlock: branch.joinBlock
                });
                related.forEach(b => processed.add(b));
            }
        }

        return chains;
    }
}
