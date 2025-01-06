import { i, Reg } from 'decoder';
import { compareLocations, formatVersionedLocation } from 'utils';
import { Decompiler } from '../decompiler';
import * as Expr from '../expr';
import { Func, Method } from '../typesys';
import { BasicBlock, ControlFlowGraph } from './cfg';
import { DefUseChains, VarDef, VarUse } from './definitions';
import { DominatorInfo } from './dominators';

const debug = false;

export interface SSAVersion {
    version: number;
    location: Reg.Register | number;
    block: BasicBlock;
}

export interface SSADef extends VarDef {
    version: number;
}

export interface SSAUse extends VarUse {
    version: number;
}

export interface SSADefWithValue extends SSADef {
    value: Expr.Expression;
}

export type Location = Reg.Register | number;

export type VersionedLocation = { value: Location; version: number };

export class SSAForm {
    private m_dominators: DominatorInfo;
    private m_defUse: DefUseChains;
    private m_versions: Map<string, number> = new Map(); // Current version for each variable
    private m_defs: Map<i.Instruction, SSADef[]> = new Map();
    private m_uses: Map<i.Instruction, SSAUse[]> = new Map();
    private m_defsWithValues: Map<i.Instruction, SSADefWithValue[]> = new Map();
    private m_cfg: ControlFlowGraph;
    private m_reachingDefs: Map<string, SSADefWithValue> = new Map(); // varKey -> most recent def
    private m_func: Func | Method;

    constructor(cfg: ControlFlowGraph, dominators: DominatorInfo, func: Func | Method) {
        this.m_cfg = cfg;
        this.m_dominators = dominators;
        this.m_defUse = new DefUseChains(dominators, cfg);
        this.m_func = func;
    }

    reset(cfg: ControlFlowGraph, dominators: DominatorInfo, func: Func | Method) {
        this.m_cfg = cfg;
        this.m_dominators = dominators;
        this.m_func = func;
        this.m_defs.clear();
        this.m_uses.clear();
        this.m_defsWithValues.clear();
        this.m_reachingDefs.clear();
        this.m_versions.clear();
        this.m_defUse = new DefUseChains(dominators, cfg);
    }

    process() {
        // Build SSA form
        this.m_defUse.build(this.m_cfg, this.m_func);

        this.renameVariables();
    }

    rebuildExpressions(): void {
        const entry = this.m_cfg.getEntryBlock();
        if (!entry) return;

        const processBlock = (block: BasicBlock) => {
            // Process instructions
            block.each(instr => instr.toExpression());

            // Process children in dominator tree
            for (const other of this.m_cfg.getAllBlocks()) {
                if (this.m_dominators.getImmediateDominator(other) === block) {
                    processBlock(other);
                }
            }
        };

        const decomp = Decompiler.get();
        decomp.defsLocked = false;

        // Start from entry block
        processBlock(entry);

        decomp.defsLocked = true;
    }

    private getNextVersion(varKey: string): number {
        const version = (this.m_versions.get(varKey) || 0) + 1;
        this.m_versions.set(varKey, version);
        return version;
    }

    private getCurrentVersion(varKey: string): number {
        return this.m_versions.get(varKey) || 0;
    }

    private renameVariables(): void {
        const entry = this.m_cfg.getEntryBlock();
        if (!entry) return;

        // Recursively rename variables in a block and its children in dominator tree
        const processBlock = (block: BasicBlock) => {
            // Process instructions
            block.each(instr => {
                // Update uses
                const uses = this.m_defUse.getInstructionUses(instr);
                const ssaUses: SSAUse[] = [];
                for (const use of uses) {
                    const varKey = this.m_defUse.getLocationKey(use.location);
                    const version = this.getCurrentVersion(varKey);
                    if (debug) console.log(`${varKey} used at ${instr} with version ${version}`);
                    ssaUses.push({ ...use, version });
                }
                this.m_uses.set(instr, ssaUses);

                // Update definitions
                const defs = this.m_defUse.getInstructionDefs(instr);
                const ssaDefs: SSADef[] = [];
                for (const def of defs) {
                    const varKey = this.m_defUse.getLocationKey(def.location);
                    const version = this.getNextVersion(varKey);
                    if (debug) console.log(`${varKey} defined at ${instr} with version ${version}`);
                    ssaDefs.push({ ...def, version });
                }

                // Preserve any existing defs
                let existingDefs = this.m_defs.get(instr);
                if (existingDefs) {
                    // Only add defs that don't already exist for this register
                    for (const newDef of ssaDefs) {
                        if (
                            !existingDefs.some(d =>
                                Reg.compare(d.location as Reg.Register, newDef.location as Reg.Register)
                            )
                        ) {
                            existingDefs.push(newDef);
                        }
                    }
                } else {
                    this.m_defs.set(instr, ssaDefs);
                }

                if (debug)
                    console.log(
                        '\x1b[33m%s\x1b[0m',
                        `Processing ${instr} at 0x${instr.address.toString(16).padStart(8, '0')}`
                    );
                if (debug) console.log(`  Expression: ${instr.toExpression()}`);
                else instr.toExpression();
            });

            // Process children in dominator tree
            for (const other of this.m_cfg.getAllBlocks()) {
                if (this.m_dominators.getImmediateDominator(other) === block) {
                    processBlock(other);
                }
            }
        };

        // Start from entry block
        processBlock(entry);
    }

    getUse(instr: i.Instruction, location: Location): SSAUse | undefined {
        const uses = this.m_uses.get(instr);
        if (!uses) return undefined;

        return uses.find(use => {
            if (typeof location === 'number') {
                return typeof use.location === 'number' && use.location === location;
            } else {
                return typeof use.location !== 'number' && Reg.compare(use.location, location);
            }
        });
    }

    getUses(instr: i.Instruction): SSAUse[] {
        return this.m_uses.get(instr) || [];
    }

    addDef(instr: i.Instruction, location: Location, value: Expr.Expression): SSADefWithValue {
        let defs = this.m_defs.get(instr);
        let def: SSADef;

        const varKey = this.m_defUse.getLocationKey(location);

        if (!defs) {
            def = {
                location,
                instruction: instr,
                block: this.m_cfg.getBlock(instr.address)!,
                version: this.getNextVersion(varKey)
            };
            this.m_defs.set(instr, [def]);

            if (debug)
                console.log(
                    `  Adding definition for ${
                        typeof location === 'number' ? `stack_${location.toString(16)}` : Reg.formatRegister(location)
                    } at ${instr} with version ${def.version}`
                );
        } else {
            // Try to find existing def
            const maybeDef = defs.find(d => {
                if (typeof location === 'number') {
                    return typeof d.location === 'number' && d.location === location;
                } else {
                    return typeof d.location !== 'number' && Reg.compare(d.location, location);
                }
            });
            if (maybeDef) {
                def = maybeDef;
            } else {
                // Create new def and add to array
                def = {
                    location,
                    instruction: instr,
                    block: this.m_cfg.getBlock(instr.address)!,
                    version: this.getNextVersion(varKey)
                };
                defs.push(def);

                if (debug)
                    console.log(
                        `  Adding definition for ${
                            typeof location === 'number'
                                ? `stack_${location.toString(16)}`
                                : Reg.formatRegister(location)
                        } at ${instr} with version ${def.version}`
                    );
            }
        }

        const defWithValue = {
            ...def,
            value
        };

        let defsWithValues = this.m_defsWithValues.get(instr);
        if (!defsWithValues) {
            defsWithValues = [];
            this.m_defsWithValues.set(instr, defsWithValues);
        }

        // Replace or add the definition
        const idx = defsWithValues.findIndex(d => {
            if (typeof location === 'number') {
                return typeof d.location === 'number' && d.location === location;
            } else {
                return typeof d.location !== 'number' && Reg.compare(d.location, location);
            }
        });

        if (idx >= 0) {
            defsWithValues[idx] = defWithValue;
        } else {
            defsWithValues.push(defWithValue);
        }

        // Track this as the most recent definition for this register
        this.m_reachingDefs.set(varKey, defWithValue);

        return defWithValue;
    }

    getReachingDef(reg: Reg.Register): SSADefWithValue | undefined {
        const varKey = this.m_defUse.getLocationKey(reg);
        return this.m_reachingDefs.get(varKey);
    }

    getDef(instr: i.Instruction, location: Location): SSADefWithValue | null;
    getDef(instr: i.Instruction, location: Location, requireValue: boolean): SSADefWithValue | SSADef | null;
    getDef(instr: i.Instruction, location: Location, requireValue: boolean = true): SSADefWithValue | SSADef | null {
        const defsWithValues = this.m_defsWithValues.get(instr);
        if (defsWithValues) {
            const def = defsWithValues.find(d => {
                if (typeof location === 'number') {
                    return typeof d.location === 'number' && d.location === location;
                } else {
                    return typeof d.location !== 'number' && Reg.compare(d.location, location);
                }
            });
            if (def) return def;
        }

        if (requireValue) return null;

        const defs = this.m_defs.get(instr);
        if (defs) {
            const def = defs.find(d => {
                if (typeof location === 'number') {
                    return typeof d.location === 'number' && d.location === location;
                } else {
                    return typeof d.location !== 'number' && Reg.compare(d.location, location);
                }
            });
            if (def) return def;
        }

        return null;
    }

    getAllDefs(instr: i.Instruction): SSADef[] {
        return this.m_defs.get(instr) || [];
    }

    getAllDefsWithValues(instr: i.Instruction): SSADefWithValue[] {
        return this.m_defsWithValues.get(instr) || [];
    }

    getAllUses(location: Location, version: number): SSAUse[] {
        const result: SSAUse[] = [];
        const seenAddresses = new Set<number>();

        for (const [instr, uses] of this.m_uses) {
            for (const use of uses) {
                if (seenAddresses.has(use.instruction.address)) continue;
                seenAddresses.add(use.instruction.address);

                if (compareLocations(use.location, location) && use.version === version) {
                    result.push(use);
                }
            }
        }

        return result;
    }

    getInitialDef(
        instr: i.Instruction,
        reg: Reg.Register
    ): { def: SSADef | SSADefWithValue; instr: i.Instruction } | null {
        const mostRecentDef = this.getMostRecentDefInfo(instr, reg, true);
        if (mostRecentDef) {
            return { def: mostRecentDef, instr: mostRecentDef.instruction };
        }

        return null;
    }

    getVersionInfo(location: Location, version: number): SSADef | SSADefWithValue | null {
        // Search through all definitions to find one with this version
        for (const [instr, defs] of this.m_defs) {
            const def = defs.find(d => {
                if (d.version !== version) return false;
                if (typeof location === 'number') {
                    return typeof d.location === 'number' && d.location === location;
                } else {
                    return typeof d.location !== 'number' && Reg.compare(d.location, location);
                }
            });

            if (def) {
                // Found the definition, now get its value
                const defsWithValues = this.m_defsWithValues.get(instr);
                if (defsWithValues) {
                    const defWithValue = defsWithValues.find(d => {
                        if (typeof location === 'number') {
                            return typeof d.location === 'number' && d.location === location;
                        } else {
                            return typeof d.location !== 'number' && Reg.compare(d.location, location);
                        }
                    });

                    if (defWithValue) {
                        return defWithValue;
                    }
                }

                return def;
            }
        }

        return null;
    }

    getValueForVersion(location: Location, version: number): Expr.Expression | null {
        if (debug)
            console.log(
                `  Getting value for ${
                    typeof location === 'number' ? `stack_${location.toString(16)}` : Reg.formatRegister(location)
                } at version ${version}`
            );

        // Search through all definitions to find one with this version
        for (const [instr, defs] of this.m_defs) {
            const def = defs.find(d => {
                if (d.version !== version) return false;
                if (typeof location === 'number') {
                    return typeof d.location === 'number' && d.location === location;
                } else {
                    return typeof d.location !== 'number' && Reg.compare(d.location, location);
                }
            });
            if (def) {
                if (debug)
                    console.log(`  Found definition at ${instr} @ 0x${instr.address.toString(16).padStart(8, '0')}`);
                if (debug) console.log(`    Version: ${def.version}`);

                // Found the definition, now get its value
                const defsWithValues = this.m_defsWithValues.get(instr);
                if (defsWithValues) {
                    const defWithValue = defsWithValues.find(d => {
                        if (typeof location === 'number') {
                            return typeof d.location === 'number' && d.location === location;
                        } else {
                            return typeof d.location !== 'number' && Reg.compare(d.location, location);
                        }
                    });

                    if (defWithValue) {
                        if (debug) console.log(`    Value: ${defWithValue.value}`);
                        return defWithValue.value;
                    }

                    if (debug)
                        console.log(
                            `    m_defsWithValues for ${instr} was found, but did not contain the specified Location`
                        );
                }

                if (debug) console.log(`    m_defsWithValues for ${instr} was not found`);
                break; // Found def but no value
            }
        }

        if (debug) console.log(`    No definition found`);
        return null;
    }

    hasUses(instruction: i.Instruction, location: Location): boolean {
        const def = this.getDef(instruction, location);
        if (!def) return false;

        for (const [instr, uses] of this.m_uses) {
            if (instr === instruction) continue;

            for (const use of uses) {
                if (typeof location === 'number') {
                    if (typeof use.location === 'number' && use.location === location && use.version === def.version) {
                        return true;
                    }
                } else {
                    if (
                        typeof use.location !== 'number' &&
                        Reg.compare(use.location, location) &&
                        use.version === def.version
                    ) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    getVersionDef(location: Location, version: number): SSADef | SSADefWithValue {
        for (const [instr, defs] of this.m_defs) {
            const def = defs.find(d => {
                if (d.version !== version || !compareLocations(d.location, location)) return false;
                return true;
            });
            if (!def) continue;

            const defsWithValues = this.m_defsWithValues.get(instr);
            if (defsWithValues) {
                const defWithValue = defsWithValues.find(d => compareLocations(d.location, location));
                if (defWithValue) return defWithValue;
            }

            return def;
        }

        throw new Error(`No definition found for ${formatVersionedLocation({ value: location, version })}`);
    }

    getMostRecentDef(atInstr: i.Instruction, location: Location): Expr.Expression | null {
        // Get the most recent definition of the location before this instruction

        // Search backwards through instructions to find last def
        const seen = new Set<BasicBlock>();

        const homeBlock = this.m_cfg.getBlock(atInstr.address)!;
        const worklist = [homeBlock];

        while (worklist.length > 0) {
            const block = worklist.pop();
            if (!block) break;
            seen.add(block);

            // Check instructions in reverse
            const def = block.reverseExtract(
                instr => {
                    if (instr === atInstr) return;
                    const def = this.getDef(instr, location);
                    if (def && 'value' in def) {
                        return def.value;
                    }
                },
                homeBlock === block ? atInstr : undefined
            );

            if (def) return def;

            // Move to predecessors
            const preds = block.predecessors.filter(p => !seen.has(p));
            worklist.push(...preds);
        }

        if (typeof location === 'number') {
            return new Expr.RawString(`in_stack_${location.toString(16)}`);
        } else {
            return new Expr.RawString(`in_${Reg.formatRegister(location).slice(1)}`);
        }
    }

    getMostRecentDefInfo(
        atInstr: i.Instruction,
        location: Location,
        excludeSelf: boolean = true
    ): SSADef | SSADefWithValue | null {
        // Get the most recent definition of the location before this instruction

        // Search backwards through instructions to find last def
        const homeBlock = this.m_cfg.getBlock(atInstr.address)!;
        let currentBlock = homeBlock;
        const seen = new Set<BasicBlock>();

        while (currentBlock) {
            seen.add(currentBlock);

            // Check instructions in reverse
            const def = currentBlock.reverseExtract(
                instr => {
                    if (excludeSelf && instr === atInstr) return;
                    const def = this.getDef(instr, location, false);
                    if (def) {
                        return def;
                    }
                },
                homeBlock === currentBlock ? atInstr : undefined
            );

            if (def) return def;

            // Move to predecessors
            const pred = currentBlock.predecessors.find(p => !seen.has(p));
            if (!pred) break;
            currentBlock = pred;
        }

        return null;
    }

    getInstructionsUsingLocation(location: Location, version: number): i.Instruction[] {
        const instructions: i.Instruction[] = [];

        for (const [instr, uses] of this.m_uses) {
            for (const use of uses) {
                if (compareLocations(use.location, location) && use.version === version) {
                    instructions.push(instr);
                }
            }
        }

        return instructions.sort((a, b) => a.address - b.address);
    }
}
