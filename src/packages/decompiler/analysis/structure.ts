import { i, Op, Reg } from 'decoder';
import { VersionedLocation } from 'types';
import { compareVersionedLocations, formatVersionedLocation } from 'utils';

import { FunctionCode } from '../input/code';
import { LocationDef } from '../types';
import { BasicBlock, ControlFlowGraph } from './cfg';

import { BlockRegion, IfRegion, InductionVariable, LoopRegion, Region, RegionRef } from '../types';

export class StructureAnalyzer {
    private m_cfg: ControlFlowGraph;
    private m_func: FunctionCode;
    private m_regionMap: Map<BasicBlock, Region>;
    private m_activeLoops: Set<BasicBlock>;

    constructor(func: FunctionCode) {
        this.m_cfg = func.cfg;
        this.m_func = func;
        this.m_regionMap = new Map();
        this.m_activeLoops = new Set();
    }

    get regionMap() {
        return this.m_regionMap;
    }

    //
    // Analysis Entry Point
    //

    analyze(): Region {
        const entry = this.m_cfg.getEntryBlock();
        if (!entry) {
            throw new Error('CFG has no entry block');
        }

        return this.structureRegion(entry);
    }

    //
    // Common
    //

    private structureRegion(header: BasicBlock): Region {
        const existing = this.m_regionMap.get(header);
        if (existing) return existing;

        let region: Region | null = null;

        // First check for loops (most structured)
        region = this.tryIdentifyLoop(header);
        if (region) {
            this.m_regionMap.set(header, region);
            return region;
        }

        // Then check for if-then-else
        region = this.tryIdentifyIf(header);
        if (region) {
            this.m_regionMap.set(header, region);
            return region;
        }

        // Finally, fall back to a block or sequence
        region = this.createBasicRegion(header);
        this.m_regionMap.set(header, region);
        return region;
    }

    private createBasicRegion(header: BasicBlock): Region {
        // If this block has a single successor, create a sequence
        if (header.successors.length === 1) {
            const firstRegion = this.createBlockRegion(header);

            const successor = header.successors[0];
            let nextRegion: Region | null = null;

            if (this.m_activeLoops.has(successor)) {
                if (
                    header.predecessors.length === 1 &&
                    header.predecessors[0].branchInstruction &&
                    header.instructions.length === 1
                ) {
                    // delay slot block for previous branch
                    nextRegion = this.createRegionRef(successor, header.predecessors[0].branchInstruction);
                }

                if (!nextRegion) {
                    throw new Error(`Failed to find branch instruction leading to region ${successor.startAddressHex}`);
                }
            } else {
                nextRegion = this.structureRegion(successor);
            }

            return {
                type: 'sequence',
                header,
                blocks: new Set([header]),
                sequence: [firstRegion, nextRegion]
            };
        }

        return this.createBlockRegion(header);
    }

    private createBlockRegion(block: BasicBlock): BlockRegion {
        return {
            type: 'block',
            header: block,
            blocks: new Set([block]),
            instructions: block.instructions
        };
    }

    //
    // Loops
    //

    private tryIdentifyLoop(header: BasicBlock): Region | null {
        if (this.m_activeLoops.has(header)) {
            // This is a loop header, but it's also whatever other kind of region that it is.
            // If we're here, it's because the loop needs to structure its header region, and
            // it should not try to structure the header as itself (infinite recursion). It
            // should structure the header as whatever kind of region it is otherwise.
            return null;
        }

        const backEdges = header.predecessors.filter(pred => header.dominates(pred));
        if (backEdges.length === 0) return null;

        // Mark loop as active while we process it
        this.m_activeLoops.add(header);

        // Find all blocks in the loop
        const blocks = this.collectLoopBlocks(header, backEdges);
        const condition = this.findLoopCondition(header, blocks, backEdges);
        const body = this.structureLoopBody(header, blocks);

        // Create the loop region
        const loopRegion: LoopRegion = {
            type: 'loop',
            header,
            blocks,
            backEdges,
            condition,
            inductionVar: condition ? this.findInductionVariable(header, condition, blocks) : null,
            body
        };

        // Done processing this loop
        this.m_activeLoops.delete(header);

        return loopRegion;
    }

    private collectLoopBlocks(header: BasicBlock, backEdges: BasicBlock[]): Set<BasicBlock> {
        const blocks = new Set<BasicBlock>();

        // Start from header and walk forward
        header.walkForward(block => {
            // Only include blocks that:
            // 1. Are dominated by the header
            // 2. Can reach a back edge block
            if (header.dominates(block) && this.canReachAny(block, backEdges)) {
                blocks.add(block);
                return true; // Continue walking
            }
            return false; // Stop this path
        });

        return blocks;
    }

    private canReachAny(from: BasicBlock, targets: BasicBlock[]): boolean {
        let canReach = false;

        from.walkForward(block => {
            if (targets.includes(block)) {
                canReach = true;
                return false; // Stop walking, we found what we needed
            }
            return true; // Keep looking
        });

        return canReach;
    }

    private findLoopCondition(
        header: BasicBlock,
        blocks: Set<BasicBlock>,
        backEdges: BasicBlock[]
    ): i.Instruction | null {
        // First check the header block for a condition
        if (header.branchInstruction && header.successors.some(succ => succ === header)) {
            return header.branchInstruction;
        }

        const branchesToHeader: { block: BasicBlock; instruction: i.Instruction }[] = [];
        // Then check blocks with back edges
        for (const block of backEdges) {
            if (block.branchInstruction) {
                if (block.branchInstruction.isUnconditionalBranch) continue;

                branchesToHeader.push({
                    block,
                    instruction: block.branchInstruction
                });
                continue;
            }

            if (block.predecessors.length === 1) {
                const pred = block.predecessors[0];
                if (pred.branchInstruction && pred.branchInstruction.isLikelyBranch) {
                    branchesToHeader.push({
                        block,
                        instruction: pred.branchInstruction
                    });
                    continue;
                }
            }
        }

        if (branchesToHeader.length === 1) {
            return branchesToHeader[0].instruction;
        }

        if (branchesToHeader.length == 0) return null;

        // Find the block that dominates the others
        const dominatingBranch = branchesToHeader.find(branch =>
            branchesToHeader.every(other => branch === other || branch.block.dominates(other.block))
        );

        if (dominatingBranch) return dominatingBranch.instruction;

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

        return branchesToHeader[0].instruction;
    }

    private structureLoopBody(header: BasicBlock, blocks: Set<BasicBlock>): Region {
        // Create regions for all blocks in the loop body
        const bodyBlocks = new Set(Array.from(blocks).filter(b => b !== header));
        const headerBlock = this.structureRegion(header);

        if (bodyBlocks.size === 0) {
            // Empty loop body, just return the header block
            return headerBlock;
        }

        // Structure the body starting from the header's successors
        const successors = header.successors.filter(succ => blocks.has(succ));
        if (successors.length === 1) {
            return {
                type: 'sequence',
                header,
                blocks: new Set([header, successors[0]]),
                sequence: [headerBlock, this.structureRegion(successors[0])]
            };
        }

        bodyBlocks.add(header);

        // Multiple paths in loop body, create a sequence
        return {
            type: 'sequence',
            header: header,
            blocks: bodyBlocks,
            sequence: [headerBlock, ...successors.map(succ => this.structureRegion(succ))]
        };
    }

    private findInductionVariable(
        header: BasicBlock,
        branch: i.Instruction,
        blocks: Set<BasicBlock>
    ): InductionVariable | null {
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
                    const distance = this.findDistanceToBranch(branch, def);
                    console.log(
                        `def ${formatVersionedLocation(def)} distance ${distance} from branch ${branch.toString(true)}`
                    );
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
    private findDistanceToBranch(branch: i.Instruction, location: VersionedLocation): number {
        /*
         * Starting with the uses of the branch, for each location in the worklist:
         * - Check if the use matches the specified location, if so then return its distance
         * - If the use was defined by another instruction, add the definition's uses to the worklist (incrementing the distance)
         *     - (The definition was made using the uses, so the data "flows" from the uses to that definition in some sense)
         */

        const workList: (VersionedLocation & { distance: number })[] = this.m_func
            .getUses(branch)
            .map(use => ({ distance: 0, ...use }));
        const seenLocs = new Set<VersionedLocation>();

        while (workList.length > 0) {
            const loc = workList.pop()!;
            if (seenLocs.has(loc)) continue;
            seenLocs.add(loc);

            if (compareVersionedLocations(loc, location)) {
                return loc.distance;
            }

            const def = this.m_func.getDefOf(loc);
            if (!def.instruction) {
                // Reached an endpoint for this branch of the def-use chain
                continue;
            }

            const defUses = this.m_func.getUses(def.instruction);
            workList.push(...defUses.map(use => ({ distance: loc.distance + 1, ...use })));
        }

        // location has no data flow path that affects the branch instruction
        return -1;
    }

    /**
     * Find initialization of a register before a loop
     */
    private findInitialization(reg: Reg.Register, loopHeader: BasicBlock): LocationDef | null {
        return this.m_func.getDefAt(reg, loopHeader.startAddress);
    }

    //
    // Branches
    //

    private tryIdentifyIf(header: BasicBlock): Region | null {
        if (
            !header.branchInstruction ||
            header.branchInstruction.isUnconditionalBranch ||
            header.successors.length !== 2
        ) {
            return null;
        }

        // target block (then path) should always be first successor
        const targetBlock = header.successors[0];
        const fallthroughBlock = header.successors[1];

        if (!targetBlock || !fallthroughBlock) return null;

        // Check if either path leads to an active loop
        const thenRegion = this.m_activeLoops.has(targetBlock)
            ? this.createRegionRef(targetBlock, header.branchInstruction)
            : this.structureRegion(targetBlock);

        const elseRegion = this.m_activeLoops.has(fallthroughBlock)
            ? this.createRegionRef(fallthroughBlock, header.branchInstruction)
            : this.structureRegion(fallthroughBlock);

        const ifRegion: IfRegion = {
            type: 'if',
            header,
            blocks: new Set([header]),
            condition: header.branchInstruction,
            invertCondition: false,
            thenRegion,
            elseRegion
        };

        // Add blocks from then/else regions
        this.addBlocksFromRegion(ifRegion.blocks, thenRegion);
        this.addBlocksFromRegion(ifRegion.blocks, elseRegion);

        // Handle instructions before the branch
        if (header.instructions[0] !== header.branchInstruction && header.instructions[0].code !== Op.Code.nop) {
            const preIfInstructions = header.instructions.slice(0, header.instructions.length - 1);
            return {
                type: 'sequence',
                header,
                blocks: new Set([header]),
                sequence: [
                    {
                        type: 'block',
                        header,
                        blocks: new Set([header]),
                        instructions: preIfInstructions
                    },
                    ifRegion
                ]
            };
        }

        return ifRegion;
    }

    private addBlocksFromRegion(target: Set<BasicBlock>, region: Region): void {
        target.add(region.header);
        region.blocks.forEach(b => target.add(b));
    }

    private createRegionRef(header: BasicBlock, branchInstr: i.Instruction): RegionRef {
        return {
            type: 'ref',
            header,
            blocks: new Set([header]),
            targetHeader: header,
            branchInstr
        };
    }

    //
    // Debug
    //

    public static debugPrint(region: Region, indent: string = ''): void {
        console.log(`${indent}Type: ${region.type}`);
        console.log(`${indent}Header: ${region.header.startAddressHex}`);

        switch (region.type) {
            case 'block':
                for (const instr of region.instructions) {
                    console.log(`${indent}${instr.toString(true)}`);
                }
                break;
            case 'sequence':
                for (const stmt of region.sequence) {
                    this.debugPrint(stmt, indent + '    ');
                }
                break;
            case 'loop':
                if (region.inductionVar) {
                    console.log(`${indent}Induction variable:`);
                    console.log(`${indent}Variable: ${region.inductionVar.variable?.toString() || 'none'}`);
                    console.log(`${indent}Init:`);
                    console.log(
                        `${indent}    Version: ${formatVersionedLocation({
                            value: region.inductionVar.register,
                            version: region.inductionVar.initVersion
                        })}`
                    );
                    console.log(
                        `${indent}    Instruction: ${
                            region.inductionVar.initInstruction?.toString(true) || 'not found'
                        }`
                    );
                    console.log(`${indent}Step:`);
                    console.log(
                        `${indent}    Version: ${formatVersionedLocation({
                            value: region.inductionVar.register,
                            version: region.inductionVar.stepVersion
                        })}`
                    );
                    console.log(
                        `${indent}    Instruction: ${
                            region.inductionVar.stepInstruction?.toString(true) || 'not found'
                        }`
                    );
                } else {
                    console.log(`${indent}Induction variable: none`);
                }
                console.log(`${indent}Condition: ${region.condition ? region.condition.toString(true) : 'none'}`);
                console.log(`${indent}Body:`);
                this.debugPrint(region.body, indent + '    ');
                break;
            case 'if':
                console.log(`${indent}Condition: ${region.condition.toString(true)}`);
                console.log(`${indent}Then:`);
                if (region.thenRegion) this.debugPrint(region.thenRegion, indent + '    ');
                console.log(`${indent}Else:`);
                if (region.elseRegion) this.debugPrint(region.elseRegion, indent + '    ');
                break;
        }

        console.log('');
    }
}
