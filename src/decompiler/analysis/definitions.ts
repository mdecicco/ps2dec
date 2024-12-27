import { Decompiler } from 'decompiler/decompiler';
import { Func, Method } from 'decompiler/typesys';
import * as i from 'instructions';
import { Op, Reg, Register } from 'types';
import { BasicBlock, ControlFlowGraph } from './cfg';
import { DominatorInfo } from './dominators';

/**
 * Represents a variable definition (write to register or stack)
 */
export interface VarDef {
    location: Register | number; // Register or stack offset
    instruction: i.Instruction;
    block: BasicBlock;
}

/**
 * Represents a variable use (read from register or stack)
 */
export interface VarUse {
    location: Register | number;
    instruction: i.Instruction;
    block: BasicBlock;
}

/**
 * Tracks definitions and uses of variables (registers and stack locations)
 * throughout the program, building def-use chains for SSA construction.
 */
export class DefUseChains {
    // Map location (reg/stack) to all its definitions
    private m_definitions: Map<string, VarDef[]> = new Map();

    // Map location to all its uses
    private m_uses: Map<string, VarUse[]> = new Map();

    // Map instruction to all its definitions
    private m_instrDefs: Map<i.Instruction, VarDef[]> = new Map();

    // Map instruction to all its uses
    private m_instrUses: Map<i.Instruction, VarUse[]> = new Map();

    private m_dominators: DominatorInfo;

    private m_cfg: ControlFlowGraph;

    constructor(dominators: DominatorInfo, cfg: ControlFlowGraph) {
        this.m_dominators = dominators;
        this.m_cfg = cfg;
    }

    /**
     * Get a unique key for a register or stack location
     */
    getLocationKey(location: Register | number): string {
        if (typeof location === 'number') {
            return location.toString();
        }

        return Reg.key(location);
    }

    /**
     * Add a definition (write) of a variable
     */
    addDef(location: Register | number, instruction: i.Instruction, block: BasicBlock): void {
        const key = this.getLocationKey(location);
        const def: VarDef = { location, instruction, block };

        const defs = this.m_definitions.get(key);
        if (!defs) this.m_definitions.set(key, [def]);
        else defs.push(def);

        const instrDefs = this.m_instrDefs.get(instruction);
        if (!instrDefs) this.m_instrDefs.set(instruction, [def]);
        else instrDefs.push(def);
    }

    /**
     * Add a use (read) of a variable
     */
    addUse(location: Register | number, instruction: i.Instruction, block: BasicBlock): void {
        const key = this.getLocationKey(location);
        const use: VarUse = { location, instruction, block };

        const uses = this.m_uses.get(key);
        if (!uses) this.m_uses.set(key, [use]);
        else uses.push(use);

        const instrUses = this.m_instrUses.get(instruction);
        if (!instrUses) this.m_instrUses.set(instruction, [use]);
        else instrUses.push(use);
    }

    /**
     * Get all definitions that could reach a use in the given block.
     * A definition can reach a use if:
     * 1. The definition's block dominates the use's block, or
     * 2. There exists a path from the definition to the use without going through
     *    another definition of the same variable
     */
    getDefsReachingUse(block: BasicBlock, location: Register | number): VarDef[] {
        const key = this.getLocationKey(location);
        const defs = this.m_definitions.get(key);
        if (!defs) return [];

        return defs.filter(def => {
            // If def dominates use, check for later definitions
            if (this.m_dominators.dominates(def.block, block)) {
                const laterDef = defs.find(
                    otherDef =>
                        otherDef !== def &&
                        otherDef.block === def.block &&
                        otherDef.instruction.address > def.instruction.address &&
                        this.m_dominators.dominates(otherDef.block, block)
                );
                return !laterDef;
            }

            // Otherwise, check if there's any path from def to use
            // where the definition isn't killed by another definition
            const seen = new Set<BasicBlock>();
            const hasPath = (current: BasicBlock): boolean => {
                if (current === block) return true;
                if (seen.has(current)) return false;
                seen.add(current);

                // Check if this block kills the definition
                const killingDef = defs.find(
                    otherDef =>
                        otherDef !== def &&
                        otherDef.block === current &&
                        otherDef.instruction.address > def.instruction.address
                );
                if (killingDef) return false;

                // Try all paths
                return current.successors.some(succ => hasPath(succ));
            };

            return hasPath(def.block);
        });
    }

    /**
     * Get all uses of a definition
     */
    getUsesOfDef(def: VarDef): VarUse[] {
        const key = this.getLocationKey(def.location);
        return this.m_uses.get(key) || [];
    }

    /**
     * Get all definitions made by an instruction
     */
    getInstructionDefs(instr: i.Instruction): VarDef[] {
        const defs: VarDef[] = [];

        // Determine if the instruction stores to a stack offset
        if (instr.isStore) {
            const mem = instr.operands[instr.operands.length - 1] as Op.MemOperand;
            if (Reg.compare(mem.base, { type: Reg.Type.EE, id: Reg.EE.SP })) {
                defs.push({
                    location: mem.offset,
                    instruction: instr,
                    block: this.m_cfg.getBlock(instr.address)!
                });
            }
        }

        // Determine if the instruction is a call that sets the return location
        if (instr.code === Op.Code.jal) {
            const func = Decompiler.get().funcDb.findFunctionByAddress(instr.operands[0] as number);
            if (func && func.returnLocation) {
                if ('reg' in func.returnLocation) {
                    defs.push({
                        location: func.returnLocation.reg,
                        instruction: instr,
                        block: this.m_cfg.getBlock(instr.address)!
                    });
                } else {
                    defs.push({
                        location: func.returnLocation.offset,
                        instruction: instr,
                        block: this.m_cfg.getBlock(instr.address)!
                    });
                }
            }
        }

        for (const reg of instr.writes) {
            defs.push({
                location: reg,
                instruction: instr,
                block: this.m_cfg.getBlock(instr.address)!
            });
        }
        return defs;
    }

    /**
     * Get all uses made by an instruction
     */
    getInstructionUses(instr: i.Instruction): VarUse[] {
        const uses: VarUse[] = [];

        /*
        // Handle jr $ra as using the return location
        if (instr.code === Op.Code.jr && Reg.compare(instr.reads[0], { type: Reg.Type.EE, id: Reg.EE.RA })) {
            const func = Decompiler.get().cache.func;
            if (func.returnLocation) {
                if ('reg' in func.returnLocation) {
                    uses.push({
                        location: func.returnLocation.reg,
                        instruction: instr,
                        block: this.m_cfg.getBlock(instr.address)!
                    });
                } else {
                    uses.push({
                        location: func.returnLocation.offset,
                        instruction: instr,
                        block: this.m_cfg.getBlock(instr.address)!
                    });
                }
            }
        }
        */

        // Determine if the instruction loads from a stack offset
        if (instr.isLoad) {
            const mem = instr.operands[instr.operands.length - 1] as Op.MemOperand;
            if (Reg.compare(mem.base, { type: Reg.Type.EE, id: Reg.EE.SP })) {
                uses.push({
                    location: mem.offset,
                    instruction: instr,
                    block: this.m_cfg.getBlock(instr.address)!
                });
            }
        }

        for (const reg of instr.reads) {
            uses.push({
                location: reg,
                instruction: instr,
                block: this.m_cfg.getBlock(instr.address)!
            });
        }

        return uses;
    }

    /**
     * Build def-use chains from a control flow graph and function info
     */
    build(cfg: ControlFlowGraph, func: Func | Method): void {
        // Handle special registers first
        const entry = cfg.getEntryBlock();
        if (!entry) return;

        // Initialize special registers at function entry
        this.addDef({ type: Reg.Type.EE, id: Reg.EE.PC }, entry.instructions[0], entry);
        this.addDef({ type: Reg.Type.EE, id: Reg.EE.SP }, entry.instructions[0], entry);
        this.addDef({ type: Reg.Type.EE, id: Reg.EE.RA }, entry.instructions[0], entry);
        this.addDef({ type: Reg.Type.EE, id: Reg.EE.ZERO }, entry.instructions[0], entry);
        this.addDef({ type: Reg.Type.COP2_VI, id: Reg.COP2.Integer.VI0 }, entry.instructions[0], entry);

        // Handle function parameters
        if (func instanceof Method) {
            const signature = func.signature;
            if ('reg' in signature.thisLocation) {
                this.addDef(signature.thisLocation.reg, entry.instructions[0], entry);
            } else {
                this.addDef(signature.thisLocation.offset, entry.instructions[0], entry);
            }
        }

        const signature = func.signature;
        signature.arguments.forEach(arg => {
            if ('reg' in arg.location) {
                this.addDef(arg.location.reg, entry.instructions[0], entry);
            } else {
                this.addDef(arg.location.offset, entry.instructions[0], entry);
            }
        });

        // Process each block's instructions
        for (const block of cfg.getAllBlocks()) {
            for (const instr of block.instructions) {
                // Add definitions for written registers
                instr.writes.forEach(reg => {
                    this.addDef(reg, instr, block);
                });

                // Add uses for read registers
                instr.reads.forEach(reg => {
                    this.addUse(reg, instr, block);
                });

                if (instr.isLoad) {
                    const mem = instr.operands[instr.operands.length - 1] as Op.MemOperand;
                    if (Reg.compare(mem.base, { type: Reg.Type.EE, id: Reg.EE.SP })) {
                        this.addUse(mem.base, instr, block);
                        this.addUse(mem.offset, instr, block);
                    }
                } else if (instr.isStore) {
                    const mem = instr.operands[instr.operands.length - 1] as Op.MemOperand;
                    if (Reg.compare(mem.base, { type: Reg.Type.EE, id: Reg.EE.SP })) {
                        this.addUse(mem.base, instr, block);
                        this.addDef(mem.offset, instr, block);
                    }

                    // NOTE: swl, swr, sdl, sdr technically will load part of the value
                    // in order to construct the value to store. Not sure if that should
                    // be handled here or not since that's how the expression is constructed
                    // and I'm pretty sure that's not how the EE actually works.
                }
            }
        }
    }

    getAllDefinitions(): [string, VarDef[]][] {
        return Array.from(this.m_definitions.entries());
    }

    getDefinitions(key: string): VarDef[] {
        return this.m_definitions.get(key) || [];
    }
}
