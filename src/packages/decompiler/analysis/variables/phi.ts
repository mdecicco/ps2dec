import { Decompiler, DecompVariable, VersionedLocation } from 'decompiler';
import { LocationSet } from 'utils';
import * as nodes from '../../ast/nodes';
import { ASTAnalyzerPlugin } from '../ast_plugin';
import { BasicBlock } from '../cfg';

interface PhiNode {
    locations: VersionedLocation[];
    block: BasicBlock;
}

export class PhiVariableAnalyzer extends ASTAnalyzerPlugin {
    analyzeRoot(root: nodes.Node): boolean {
        const decomp = Decompiler.get();
        const phiNodes = this.findPhiNodes();
        let changed = false;

        for (const phi of phiNodes) {
            // Check if any of the locations already have a variable
            let existingVar: DecompVariable | undefined;

            phi.locations.some(loc => {
                const v = decomp.vars.getVariableWithVersion(loc.value, loc.version);
                if (v) {
                    existingVar = v;
                    return true;
                }

                return false;
            });

            if (existingVar) {
                // If one exists, add all other versions to it
                for (const loc of phi.locations) {
                    if (!existingVar.hasSSAVersion(loc.value, loc.version)) {
                        existingVar.addSSALocation(loc.value, loc.version);
                        changed = true;
                    }
                }
            } else {
                // Create new variable starting with first location
                const variable = decomp.promoteVersionToVariable(phi.locations[0]);

                // Add other versions
                for (let i = 1; i < phi.locations.length; i++) {
                    variable.addSSALocation(phi.locations[i].value, phi.locations[i].version);
                }
                changed = true;
            }
        }

        return changed;
    }

    private findPhiNodes(): PhiNode[] {
        const phiNodes: PhiNode[] = [];
        const seenBlocks = new Set<number>();
        const workList = [this.m_cfg.getEntryBlock()];

        while (workList.length > 0) {
            const block = workList.shift()!;
            if (seenBlocks.has(block.startAddress)) continue;
            seenBlocks.add(block.startAddress);

            // A block needs phi nodes if it has multiple predecessors
            if (block.predecessors.length > 1) {
                const phiLocations = this.findPhiLocationsForBlock(block);

                for (const locations of phiLocations) {
                    phiNodes.push({ locations, block });
                }
            }

            workList.push(...block.successors);
        }

        return phiNodes;
    }

    private findPhiLocationsForBlock(block: BasicBlock): VersionedLocation[][] {
        const phiSets: VersionedLocation[][] = [];
        const seenLocations = new LocationSet();

        // Look at all reads in this block
        for (const instr of block.instructions) {
            const uses = this.m_ssa.getUses(instr);
            for (const use of uses) {
                if (seenLocations.has(use.location)) continue;
                seenLocations.add(use.location);

                const def = this.m_ssa.getMostRecentDefInfo(instr, use.location, true);
                if (def && def.block === block) {
                    // If the definition is in this block, we don't need a phi node
                    continue;
                }

                // Get all reaching definitions for this location
                const reachingDefs: VersionedLocation[] = [];

                const workList = [...block.predecessors];
                const seenBlocks = new Set<number>();

                while (workList.length > 0) {
                    const pred = workList.shift()!;
                    if (seenBlocks.has(pred.startAddress)) continue;
                    seenBlocks.add(pred.startAddress);

                    let foundDef = false;

                    pred.reverseEach(instr => {
                        if (foundDef) return;

                        const def = this.m_ssa.getDef(instr, use.location);
                        if (!def) return;

                        reachingDefs.push({
                            value: use.location,
                            version: def.version
                        });

                        foundDef = true;
                    });

                    if (!foundDef) {
                        // If we didn't find a definition in this predecessor, continue searching
                        workList.push(...pred.predecessors);
                    }
                }

                // If we have multiple different reaching definitions, we need a phi
                if (
                    reachingDefs.length > 1 &&
                    reachingDefs.some(d1 => reachingDefs.some(d2 => d1.version !== d2.version))
                ) {
                    phiSets.push(reachingDefs);
                }
            }
        }

        return phiSets;
    }
}
