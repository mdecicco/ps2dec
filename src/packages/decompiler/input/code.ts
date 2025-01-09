import { Expr, i, Op, Reg } from 'decoder';
import { compareLocations, formatLocation, formatVersionedLocation, LocationMap } from 'utils';
import { BasicBlock, ControlFlowGraph, DecompVariable } from '../analysis';
import { Location, VersionedLocation } from '../common';
import { Decompiler } from '../decompiler';
import { Func, Method } from '../typesys';

export interface Phi {
    location: Location;
    versions: number[];
    definitions: LocationDef[];
    uses: LocationUse[];
    variable: Expr.Variable;
}

export interface LocationDef {
    value: Location;
    version: number;
    instruction: i.Instruction | null;
    block: BasicBlock;
}

export interface LocationUse {
    value: Location;
    version: number;
    instruction: i.Instruction;
    block: BasicBlock;
}

// Version 0 indicates undefined

export class FunctionCode {
    private m_func: Func | Method;
    private m_code: i.Instruction[];
    private m_cfg: ControlFlowGraph;
    private m_entry: BasicBlock;
    private m_currentVersionMap: LocationMap<number>;
    private m_values: LocationMap<Map<number, Expr.Expression>>;
    private m_uses: Map<i.Instruction, LocationUse[]>;
    private m_defs: Map<i.Instruction | null, LocationDef[]>;
    private m_addressVersionMap: Map<number, LocationMap<number>>;
    private m_phis: Map<BasicBlock, Phi[]>;
    private m_arguments: DecompVariable[];
    private m_self: DecompVariable | null;
    private m_isInitialized;

    constructor(functionId: number) {
        const func = Decompiler.findFunctionById(functionId);
        if (!func) throw new Error(`Failed to find function with id ${functionId}`);
        const code: i.Instruction[] = [];
        for (let address = func.address; address < func.endAddress; address += 4) {
            const instr = Decompiler.getInstructionAtAddress(address);
            if (!instr) {
                code.push(new i.nop(address));
                continue;
            }

            code.push(instr);
        }

        const cfg = ControlFlowGraph.build(code);
        const entry = cfg.getEntryBlock();
        if (!entry) throw new Error(`Failed to find entry block for function ${functionId}`);

        this.m_func = func;
        this.m_code = code;
        this.m_cfg = cfg;
        this.m_entry = entry;
        this.m_currentVersionMap = new LocationMap<number>();
        this.m_values = new LocationMap<Map<number, Expr.Expression>>();
        this.m_uses = new Map();
        this.m_defs = new Map();
        this.m_addressVersionMap = new Map();
        this.m_phis = new Map();
        this.m_arguments = [];
        this.m_self = null;
        this.m_isInitialized = false;
    }

    get function() {
        return this.m_func;
    }

    get instructions() {
        return this.m_code;
    }

    get cfg() {
        return this.m_cfg;
    }

    get entry() {
        return this.m_entry;
    }

    get arguments() {
        return this.m_arguments;
    }

    get self() {
        return this.m_self;
    }

    get isInitialized() {
        return this.m_isInitialized;
    }

    initialize() {
        if (this.m_isInitialized) return;

        this.define({ type: Reg.Type.EE, id: Reg.EE.PC }, Expr.Imm.u32(this.m_entry.startAddress));
        this.define({ type: Reg.Type.EE, id: Reg.EE.SP }, new Expr.StackPointer());
        this.define({ type: Reg.Type.EE, id: Reg.EE.RA }, new Expr.RawString(`$ra`));
        this.define({ type: Reg.Type.EE, id: Reg.EE.ZERO }, Expr.Imm.i128(0));
        this.define({ type: Reg.Type.COP2_VI, id: Reg.COP2.Integer.VI0 }, Expr.Imm.i32(0));

        if (this.m_func instanceof Method) {
            const signature = this.m_func.signature;
            const value = Decompiler.current.vars.createVariable(signature.thisType, this.m_func.thisValue.name);
            this.m_self = value;

            let location: Location;
            if ('reg' in signature.thisLocation) location = signature.thisLocation.reg;
            else location = signature.thisLocation.offset;

            this.define(location, new Expr.Variable(value));
            value.addSSALocation(location, 1);
        }

        const signature = this.m_func.signature;
        const args = signature.arguments;
        for (let idx = 0; idx < args.length; idx++) {
            const arg = args[idx];
            const value = Decompiler.current.vars.createVariable(arg.typeId, this.m_func.arguments[idx].name);
            this.m_arguments.push(value);

            let location: Location;
            if ('reg' in arg.location) location = arg.location.reg;
            else location = arg.location.offset;

            this.define(location, new Expr.Variable(value));
            value.addSSALocation(location, 1);
        }

        this.process();
        this.m_isInitialized = true;
    }

    /**
     * Get all definitions made by a specific instruction.
     *
     * @param instruction The instruction to get definitions of
     * @returns The definitions made by the instruction
     */
    getDefs(instruction: i.Instruction, includeValue: true): (LocationDef & { assignedTo: Expr.Expression })[];
    getDefs(instruction: i.Instruction, includeValue: false): LocationDef[];
    getDefs(instruction: i.Instruction): LocationDef[];
    getDefs(instruction: i.Instruction, includeValue?: boolean): LocationDef[] {
        const defs = this.m_defs.get(instruction) || [];
        if (includeValue) {
            return defs.map(def => ({ ...def, assignedTo: this.getValueOf(def) }));
        }

        return defs;
    }

    /**
     * Get all locations used by a specific instruction.
     *
     * @param instruction The instruction to get used locations of
     * @returns All locations used by the instruction
     */
    getUses(instruction: i.Instruction): LocationUse[] {
        return this.m_uses.get(instruction) || [];
    }

    /**
     * Get the definition of a location at a specific instruction.
     *
     * @param instruction The instruction that defines the location
     * @param location The location to get the definition of
     * @returns The definition of the location
     */
    getDef(instruction: i.Instruction, location: Location): LocationDef {
        const defs = this.m_defs.get(instruction);
        if (!defs) throw new Error(`Failed to find definitions for instruction ${instruction}`);

        const def = defs.find(d => compareLocations(d.value, location));
        if (!def) throw new Error(`Failed to find definition for ${formatLocation(location)}`);

        return def;
    }

    /**
     * Get the use of a location at a specific instruction.
     *
     * @param instruction The instruction that uses the location
     * @param location The location to get the use of
     * @returns The use of the location
     */
    getUse(instruction: i.Instruction, location: Location): LocationUse {
        const uses = this.m_uses.get(instruction);
        if (!uses) throw new Error(`Failed to find uses for instruction ${instruction}`);

        const use = uses.find(u => compareLocations(u.value, location));
        if (!use)
            throw new Error(`Failed to find use for ${formatLocation(location)} at ${instruction.toString(true)}`);

        return use;
    }

    /**
     * Get all uses of a location.
     *
     * @param location The location to get uses of
     * @returns The uses of the location
     */
    getUsesOf(location: VersionedLocation): LocationUse[] {
        const out: LocationUse[] = [];

        for (const [instr, uses] of this.m_uses) {
            uses.forEach(use => {
                if (!compareLocations(use.value, location.value)) return;
                if (use.version !== location.version) return;

                out.push(use);
            });
        }

        return out;
    }

    /**
     * Get the definition of a location.
     *
     * @param location The location to get the definition of
     * @returns The definition of the location
     */
    getDefOf(location: VersionedLocation): LocationDef {
        for (const [instr, defs] of this.m_defs) {
            for (const def of defs) {
                if (!compareLocations(def.value, location.value)) continue;
                if (def.version !== location.version) continue;

                return def;
            }
        }

        throw new Error(`Failed to find definition for ${formatVersionedLocation(location)}`);
    }

    /**
     * Get the value of a location.
     *
     * @param location The location to get the value of
     * @returns The value of the location
     */
    getValueOf(location: VersionedLocation): Expr.Expression {
        if (location.version === 0) {
            return this.undefinedValue(location);
        }

        const values = this.m_values.get(location.value)!;
        return values.get(location.version)!;
    }

    /**
     * Set the value of a versioned location.
     *
     * @param location The versioned location to set the value of
     * @param value The value to set the versioned location to
     */
    setValueOf(location: VersionedLocation, value: Expr.Expression) {
        let values = this.m_values.get(location.value);
        if (!values) {
            values = new Map();
            this.m_values.set(location.value, values);
        }

        values.set(location.version, value);
    }

    /**
     * Get the version of a location at a specific address.
     *
     * @param location The location to get the version of
     * @param address The address to get the version at
     * @returns The version of the location at the address
     */
    getVersionAt(location: Location, address: number): number | null {
        const versions = this.m_addressVersionMap.get(address);
        if (!versions) return null;

        return versions.get(location) || null;
    }

    /**
     * Get the definition of a location that reaches a specific address.
     *
     * @param location The location to get the definition of
     * @returns The definition of the location
     */
    getDefAt(location: Location, address: number): LocationDef | null {
        const version = this.getVersionAt(location, address);
        if (!version) return null;

        return this.getDefOf({ value: location, version });
    }

    /**
     * Get the value of a location.
     *
     * @param location The location to get the value of
     * @returns The value of the location
     */
    getValueAt(location: Location, address: number): Expr.Expression {
        const version = this.getVersionAt(location, address);
        if (!version) return this.undefinedValue({ value: location, version: 0 });

        const phi = this.getPhi({ value: location, version });
        if (phi) return phi.variable;

        const values = this.m_values.get(location)!;
        return values.get(version) || this.undefinedValue({ value: location, version });
    }

    /**
     * Set the value of a location at the version associated with a specific address.
     *
     * @param location The location to set the value of
     * @param address The address to set the value at
     * @param value The value to set the location to
     * @returns The version of the location at the address
     */
    setValueAt(location: Location, address: number, value: Expr.Expression): number {
        const version = this.getVersionAt(location, address);
        if (!version) {
            throw new Error(
                `Failed to find version for ${formatLocation(location)} at address 0x${address
                    .toString(16)
                    .padStart(8, '0')}`
            );
        }

        let values = this.m_values.get(location);
        if (!values) {
            values = new Map();
            this.m_values.set(location, values);
        }

        const clone = value.reduce().clone();
        clone.location = { value: location, version };
        values.set(version, clone);
        return version;
    }

    /**
     * Get the phi node that corresponds to a location, if any.
     *
     * @param location The location to get the phi node of
     * @returns The phi node for the location, if any
     */
    getPhi(location: VersionedLocation): Phi | null {
        for (const [block, phis] of this.m_phis) {
            for (const phi of phis) {
                if (!compareLocations(phi.location, location.value)) continue;
                if (phi.versions.includes(location.version)) return phi;
            }
        }

        return null;
    }

    /**
     * Get all phi nodes in a block.
     *
     * @param block The block to get phi nodes of
     * @returns All phi nodes in the block
     */
    getBlockPhis(block: BasicBlock): Phi[] {
        return this.m_phis.get(block) || [];
    }

    /**
     * Rebuild the values of all locations
     */
    rebuildValues() {
        this.m_entry.walkForward(block => {
            block.each(instr => {
                const reads = this.getUses(instr);
                const writes = this.getDefs(instr);
                const defuse = `defs: [${writes.map(d => formatVersionedLocation(d)).join(', ')}] uses: [${reads
                    .map(u => formatVersionedLocation(u))
                    .join(', ')}]`;
                console.log(`generating ${instr.toString(true)} ${defuse}`);
                const expr = instr.generate();

                if (instr.isStore && expr instanceof Expr.Store) {
                    const mem = instr.operands.find(op => Op.isMem(op));
                    if (mem && Reg.compare(mem.base, { type: Reg.Type.EE, id: Reg.EE.SP })) {
                        const def = this.getDef(instr, mem.offset);
                        if (!def) return;

                        this.setValueOf(def, expr.source);
                    }
                }
            });

            return true;
        });
    }

    //
    // Private interface
    //

    private buildDefUse() {
        const blockVersionMap = new Map<BasicBlock, LocationMap<number>>();
        this.m_entry.walkForward(block => {
            let inheritedVersions: LocationMap<number> = this.m_currentVersionMap;

            if (block.predecessors.length > 0) {
                // Merge the versions of the predecessors. We need to know what versions are live
                // at the start of this block since the CFG traversal will be incrementing versions
                // as it descends, and blocks that don't flow to this block may be evaluated before
                // this one, defining versions that cannot reach this block.
                inheritedVersions = new LocationMap<number>();

                block.predecessors.forEach(pred => {
                    const predVersions = blockVersionMap.get(pred);
                    if (!predVersions) return;

                    // If both of the predecessors have a different version for the same location
                    // it doesn't matter which one we use because both should be included in a phi
                    // node. A versioned location that is included in a phi node is treated as the
                    // phi node itself in other areas, but this could be improved in the future by
                    // adding a nullable phi link to the LocationUse and LocationDef types to assign
                    // here.
                    predVersions.entries.forEach(([loc, ver]) => {
                        inheritedVersions.set(loc, ver);
                    });
                });

                if (inheritedVersions.size === 0) inheritedVersions = this.m_currentVersionMap;
            }

            block.instructions.forEach(instr => {
                const versions = new LocationMap<number>();
                for (const [loc, ver] of inheritedVersions.entries) {
                    if (ver === 0) continue;

                    versions.set(loc, ver);
                }

                this.m_addressVersionMap.set(instr.address, versions);

                const reads = this.instructionReads(instr).map(r => ({
                    value: r,
                    version: inheritedVersions.get(r) || 0,
                    instruction: instr,
                    block: block
                }));
                this.m_uses.set(instr, reads);

                const writes = this.instructionWrites(instr).map(w => ({
                    value: w,
                    version: this.incrementVersion(w),
                    instruction: instr,
                    block: block
                }));
                this.m_defs.set(instr, writes);

                if (inheritedVersions !== this.m_currentVersionMap) {
                    writes.forEach(w => {
                        inheritedVersions.set(w.value, w.version);
                    });
                }

                const defuse = `defs: [${writes.map(d => formatVersionedLocation(d)).join(', ')}] uses: [${reads
                    .map(u => formatVersionedLocation(u))
                    .join(', ')}]`;
                console.log(`${instr.toString(true)} ${defuse}`);
            });

            blockVersionMap.set(block, inheritedVersions);

            return true;
        });
    }

    private identifyPhis() {
        for (const [instr, uses] of this.m_uses) {
            for (const use of uses) {
                if (this.getPhi(use)) {
                    // Phi node already exists for this use
                    continue;
                }

                const defs = this.getReachableDefs(use);
                if (defs.length <= 1) {
                    // Only zero or one definitions reach the use, so no phi node is needed
                    continue;
                }

                const value = Decompiler.current.vars.createVariable('undefined');

                const phi: Phi = {
                    location: use.value,
                    versions: defs.map(d => d.version),
                    definitions: defs,
                    uses: [],
                    variable: new Expr.Variable(value)
                };

                defs.forEach(d => {
                    value.addSSALocation(d.value, d.version);

                    const uses = this.getUsesOf(d);
                    if (uses.length === 0) return;

                    phi.uses.push(...uses);
                });

                console.log(`phi found at ${instr.toString(true)}`, value.toString());

                // Determine which block to add the phi node to
                // We want the last block that can flow to every use of the phi

                let lastBlock = this.m_entry;
                this.m_entry.walkForward(block => {
                    const yes = new Set<BasicBlock>();
                    const no = new Set<BasicBlock>();

                    const canReachEveryUse = phi.uses.every(u => {
                        if (u.block === block) return true;
                        if (yes.has(u.block)) return true;
                        if (no.has(u.block)) return false;

                        if (block.canFlowTo(u.block)) {
                            yes.add(u.block);
                            return true;
                        }

                        no.add(u.block);
                        return false;
                    });

                    if (canReachEveryUse) {
                        lastBlock = block;
                        return true;
                    }

                    return false;
                });

                let phis = this.m_phis.get(lastBlock);
                if (!phis) {
                    phis = [];
                    this.m_phis.set(lastBlock, phis);
                }

                phis.push(phi);
            }
        }
    }

    private process() {
        this.buildDefUse();
        this.identifyPhis();
    }

    private define(location: Location, value: Expr.Expression) {
        const currentVersion = this.currentVersion(location);
        if (currentVersion !== 0) {
            throw new Error(`Location ${location} already has an initial definition`);
        }

        this.incrementVersion(location);

        let defs = this.m_defs.get(null);
        if (!defs) {
            defs = [];
            this.m_defs.set(null, defs);
        }

        defs.push({
            value: location,
            version: 1,
            instruction: null,
            block: this.m_entry
        });

        let values = this.m_values.get(location);
        if (!values) {
            values = new Map();
            this.m_values.set(location, values);
        }

        values.set(1, value);
    }

    private getReachableDefs(location: LocationUse): LocationDef[] {
        const entry = this.m_cfg.getEntryBlock();
        const reachable: LocationDef[] = [];

        // Search for a def prior to the use within the block first
        location.block.reverseEach(instr => {
            if (instr === location.instruction) return;

            const defs = this.m_defs.get(instr);
            if (!defs) return;

            return defs.some(def => {
                if (!compareLocations(def.value, location.value)) return false;

                reachable.push(def);
                return true;
            });
        }, location.instruction);

        if (reachable.length > 0) {
            // If there's a def before the use within the same block as the use then
            // only one definition reaches the use.
            return reachable;
        }

        let addedUndefinedDef = false;

        // Otherwise, search for defs in the predecessors
        location.block.walkBackward(pred => {
            if (pred === location.block && !location.block.canFlowTo(location.block)) {
                // If the use's block doesn't flow to itself then there's no need to
                // search for defs there.
                return true;
            }

            let found = false;
            pred.reverseEach(instr => {
                const defs = this.m_defs.get(instr);
                if (!defs) return;

                defs.some(def => {
                    if (!compareLocations(def.value, location.value)) return false;

                    reachable.push(def);
                    found = true;
                    return true;
                });

                if (pred === location.block && instr === location.instruction) {
                    // Can only be here if the use's block flows to itself and
                    // there were no defs prior to the use within this block.
                    // We can exit early because we've already searched beyond
                    // this point
                    return true;
                }

                return found;
            });

            if (found && pred !== location.block) {
                // Don't exit if this is the location's block, we still need to search the predecessors
                return false;
            }

            if (pred === entry && !addedUndefinedDef) {
                // Found a path back to the entry block that does not define the location

                addedUndefinedDef = true;

                // check if it's an input to the function
                const inputDefs = this.m_defs.get(null);
                let foundInputDef = false;
                if (inputDefs) {
                    foundInputDef = inputDefs.some(def => {
                        if (compareLocations(def.value, location.value)) {
                            reachable.push(def);
                            return true;
                        }

                        return false;
                    });
                }

                if (!foundInputDef) {
                    reachable.push({
                        value: location.value,
                        version: 0,
                        instruction: null,
                        block: entry
                    });
                }

                return false;
            }

            return true;
        });

        return reachable;
    }

    private instructionReads(instr: i.Instruction): Location[] {
        const uses: Location[] = [];

        if (instr.isLoad) {
            const mem = instr.operands[instr.operands.length - 1] as Op.MemOperand;
            if (Reg.compare(mem.base, { type: Reg.Type.EE, id: Reg.EE.SP })) {
                uses.push(mem.offset);
            }
        }

        // Determine if the instruction is a call that reads argument locations
        const callTarget = instr.callTarget;
        if (callTarget) {
            callTarget.signature.arguments.forEach(arg => {
                if ('reg' in arg.location) {
                    uses.push(arg.location.reg);
                } else if (Reg.compare(arg.location.base, { type: Reg.Type.EE, id: Reg.EE.SP })) {
                    uses.push(arg.location.offset);
                }
            });
        }

        // If this instruction returns from the function, we need to add the return location
        if (
            instr.isBranch &&
            instr.code === Op.Code.jr &&
            Reg.compare(instr.reads[0], { type: Reg.Type.EE, id: Reg.EE.RA })
        ) {
            const returnLoc = this.m_func.signature.returnLocation;
            if (returnLoc) {
                if ('reg' in returnLoc) {
                    uses.push(returnLoc.reg);
                } else {
                    uses.push(returnLoc.offset);
                }
            }
        }

        for (const reg of instr.reads) {
            uses.push(reg);
        }

        return uses;
    }

    private instructionWrites(instr: i.Instruction): Location[] {
        const defs: Location[] = [];

        // Determine if the instruction stores to a stack offset
        if (instr.isStore) {
            const mem = instr.operands[instr.operands.length - 1] as Op.MemOperand;
            if (Reg.compare(mem.base, { type: Reg.Type.EE, id: Reg.EE.SP })) {
                defs.push(mem.offset);
            }
        }

        // Determine if the instruction is a call that sets the return location
        const callTarget = instr.callTarget;
        if (callTarget && callTarget.returnLocation) {
            if ('reg' in callTarget.returnLocation) {
                defs.push(callTarget.returnLocation.reg);
            } else {
                defs.push(callTarget.returnLocation.offset);
            }
        }

        for (const reg of instr.writes) {
            if (reg.type === Reg.Type.EE) {
                if (reg.id === Reg.EE.SP) {
                    // Don't count stack adjustments
                    continue;
                }

                if (reg.id === Reg.EE.PC) {
                    // Don't count the return address
                    continue;
                }

                if (reg.id === Reg.EE.ZERO) {
                    // Don't count the zero register
                    continue;
                }
            }

            defs.push(reg);
        }

        return defs;
    }

    private currentVersion(location: Location) {
        let version = this.m_currentVersionMap.get(location);
        if (!version) return 0;

        return version;
    }

    private incrementVersion(location: Location) {
        const version = this.currentVersion(location);
        this.m_currentVersionMap.set(location, version + 1);
        return version + 1;
    }

    private undefinedValue(location: VersionedLocation) {
        const expr = new Expr.RawString(`in_${formatVersionedLocation(location)}`);
        expr.location = location;
        return expr;
    }
}
