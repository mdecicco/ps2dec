import { BasicBlock, ControlFlowGraph } from './cfg';

export class DominatorInfo {
    // Maps each block to its immediate dominator
    private m_immediateDominator: Map<BasicBlock, BasicBlock> = new Map();
    // Maps each block to the set of blocks in its dominance frontier
    private m_dominanceFrontier: Map<BasicBlock, Set<BasicBlock>> = new Map();
    // All blocks in the CFG, for convenience
    private m_blocks: BasicBlock[] = [];

    constructor(cfg: ControlFlowGraph) {
        this.m_blocks = cfg.getAllBlocks();
        this.computeDominators(cfg);
        this.computeDominanceFrontiers(cfg);
    }

    /**
     * Compute the dominator tree using the iterative algorithm.
     *
     * A block D dominates block B if every path from the entry block to B must go through D.
     * Every block dominates itself.
     * The immediate dominator of a block B is the closest dominator to B (other than B itself).
     *
     * Algorithm:
     * 1. Start with every block being dominated by all blocks (except entry)
     * 2. Iteratively refine this by keeping only the blocks that are actually dominators
     * 3. Continue until no changes are made
     */
    private computeDominators(cfg: ControlFlowGraph): void {
        const entry = cfg.getEntryBlock();
        if (!entry) return;

        // Initialize dominators set for each block
        // Start with every block being dominated by all blocks (except entry)
        const dominators = new Map<BasicBlock, Set<BasicBlock>>();
        for (const block of this.m_blocks) {
            dominators.set(block, new Set(this.m_blocks));
        }

        // Entry block is only dominated by itself
        dominators.set(entry, new Set([entry]));

        // Iteratively refine dominator sets
        let changed = true;
        while (changed) {
            changed = false;

            // For each block (except entry)
            for (const block of this.m_blocks) {
                if (block === entry) continue;

                // New dominators = intersection of all predecessors' dominators
                const newDoms = new Set<BasicBlock>();

                // A block dominates itself
                newDoms.add(block);

                // Get intersection of all predecessors' dominators
                block.predecessors.forEach((pred, index) => {
                    const predDoms = dominators.get(pred)!;
                    if (index === 0) {
                        // First predecessor - add all its dominators
                        predDoms.forEach(d => newDoms.add(d));
                    } else {
                        // Subsequent predecessors - keep only common dominators
                        for (const dom of newDoms) {
                            if (!predDoms.has(dom)) {
                                newDoms.delete(dom);
                            }
                        }
                    }
                });

                // If dominators changed for this block, mark as changed
                const oldDoms = dominators.get(block)!;
                if (newDoms.size !== oldDoms.size) {
                    changed = true;
                    dominators.set(block, newDoms);
                } else {
                    // Check if sets are actually different
                    for (const dom of newDoms) {
                        if (!oldDoms.has(dom)) {
                            changed = true;
                            dominators.set(block, newDoms);
                            break;
                        }
                    }
                }
            }
        }

        // Convert dominator sets to immediate dominators
        for (const block of this.m_blocks) {
            if (block === entry) continue;

            const doms = dominators.get(block)!;
            let idom: BasicBlock | null = null;

            // Find the immediate dominator (closest dominator to block)
            for (const dom of doms) {
                if (dom === block) continue;
                if (!idom) {
                    idom = dom;
                    continue;
                }

                // If this dominator is dominated by current idom, it's closer to block
                if (dominators.get(dom)!.has(idom)) {
                    idom = dom;
                }
            }

            if (idom) {
                this.m_immediateDominator.set(block, idom);
            }
        }
    }

    /**
     * Compute dominance frontiers for each block.
     *
     * The dominance frontier of a block B is the set of blocks where B's dominance stops.
     * More precisely, it's the set of blocks that:
     * 1. B doesn't strictly dominate
     * 2. Have a predecessor that B dominates
     *
     * These are the places where we'll need to insert phi nodes in SSA form.
     */
    private computeDominanceFrontiers(cfg: ControlFlowGraph): void {
        for (const block of this.m_blocks) {
            this.m_dominanceFrontier.set(block, new Set());

            // If block has multiple predecessors
            if (block.predecessors.length > 1) {
                // Look at each predecessor
                for (const pred of block.predecessors) {
                    // Walk up the dominator tree from predecessor
                    let runner = pred;
                    let iterations = 0;
                    while (runner !== this.getImmediateDominator(block)) {
                        this.m_dominanceFrontier.get(runner)?.add(block);
                        runner = this.getImmediateDominator(runner) ?? runner;

                        iterations++;
                        if (iterations === 100) {
                            cfg.debugPrint();
                            throw new Error('probably malformed CFG');
                        }
                    }
                }
            }
        }
    }

    getDominanceFrontier(block: BasicBlock): Set<BasicBlock> {
        return this.m_dominanceFrontier.get(block) || new Set();
    }

    getImmediateDominator(block: BasicBlock): BasicBlock | null {
        return this.m_immediateDominator.get(block) || null;
    }

    /**
     * Returns true if block a dominates block b.
     * This is done by walking up the dominator tree from b until we either:
     * 1. Find a (a dominates b)
     * 2. Hit the entry block (a doesn't dominate b)
     */
    dominates(a: BasicBlock, b: BasicBlock): boolean {
        if (a === b) return true;

        let runner: BasicBlock | null = b;
        while (runner) {
            runner = this.getImmediateDominator(runner) ?? null;
            if (runner === a) return true;
            if (!runner) return false;
        }
        return false;
    }
}
