import { BasicBlock, ControlFlowGraph } from './cfg';

export class DominatorInfo {
    // Maps each block to its immediate dominator
    private m_immediateDominator: Map<BasicBlock, BasicBlock> = new Map();
    // Maps each block to the set of blocks in its dominance frontier
    private m_dominanceFrontier: Map<BasicBlock, Set<BasicBlock>> = new Map();

    constructor(cfg: ControlFlowGraph) {
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

        const blocks = cfg.getAllBlocks();

        // Initialize dominator sets
        const dominators = new Map<BasicBlock, Set<BasicBlock>>();

        // Entry block is dominated by itself
        dominators.set(entry, new Set([entry]));

        // All other blocks start with empty dominator sets
        for (const block of blocks) {
            if (block !== entry) {
                dominators.set(block, new Set());
            }
        }

        // Iteratively refine dominator sets
        let changed = true;
        while (changed) {
            changed = false;

            // For each block (except entry)
            for (const block of blocks) {
                if (block === entry) continue;

                const newDoms = new Set<BasicBlock>();
                const initialPreds = this.getInitialPredecessors(block, entry);
                const [firstPred, ...restPreds] = initialPreds;

                if (firstPred) {
                    dominators.get(firstPred)!.forEach(d => newDoms.add(d));

                    for (const pred of restPreds) {
                        const predDoms = dominators.get(pred)!;
                        for (const dom of Array.from(newDoms)) {
                            if (!predDoms.has(dom)) {
                                newDoms.delete(dom);
                            }
                        }
                    }
                }

                newDoms.add(block);

                // Check if anything changed
                const oldDoms = dominators.get(block)!;
                if (newDoms.size !== oldDoms.size) {
                    changed = true;
                    dominators.set(block, newDoms);
                } else {
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
        for (const block of blocks) {
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

                // If current idom is dominated by this dominator, this one is further away
                if (dominators.get(idom)!.has(dom)) {
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
        const blocks = cfg.getAllBlocks();

        // The dominance frontier of a node r is the set of all
        // nodes b such that r dominates an immediate predecessor
        // of b, but r does not strictly dominate b

        for (const b of blocks) {
            this.m_dominanceFrontier.set(b, new Set());
            if (b.predecessors.length <= 1) continue;

            for (const pred of b.predecessors) {
                let r: BasicBlock = pred;
                while (r !== this.getImmediateDominator(b)) {
                    // If r dominates a predecessor of b but doesn't dominate b,
                    // then b is in r's dominance frontier

                    const rStrictDominatesB = r !== b && this.dominates(r, b);
                    if (b.predecessors.some(p => this.dominates(r, p)) && !rStrictDominatesB) {
                        this.m_dominanceFrontier.get(r)?.add(b);
                    }

                    const nextR = this.getImmediateDominator(r);
                    if (!nextR) break;

                    r = nextR;
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

    private getInitialPredecessors(block: BasicBlock, entry: BasicBlock): BasicBlock[] {
        const seen = new Set<BasicBlock>();
        const result: BasicBlock[] = [];

        // Helper to check if we can reach a block without going through our target
        const canReachWithoutTarget = (start: BasicBlock, target: BasicBlock): boolean => {
            if (start === target) return false;
            if (start === entry) return true;
            if (seen.has(start)) return false;

            seen.add(start);
            return start.predecessors.some(pred => canReachWithoutTarget(pred, target));
        };

        // Only include predecessors that can be reached from entry without going through block
        for (const pred of block.predecessors) {
            seen.clear();
            if (canReachWithoutTarget(pred, block)) {
                result.push(pred);
            }
        }

        return result;
    }
}
