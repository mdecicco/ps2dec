import { Expr, i, Op, Reg } from 'decoder';
import { Location, VersionedLocation } from 'types';

import { ASTAnalyzer } from './analysis/ast';
import { ControlFlowAnalyzer } from './analysis/flow';
import { Value } from './analysis/vardb';
import { CodeBuilder } from './codegen/codebuilder';
import { DecompilerCache, IDataSource } from './input';

export class Decompiler {
    private static m_instance: Decompiler;
    private static m_dataSource: IDataSource;
    private static m_instanceStack: DecompilerInstance[];

    static initialize(dataSource: IDataSource) {
        if (Decompiler.m_instance) return;

        Decompiler.m_instance = new Decompiler();
        Decompiler.m_dataSource = dataSource;
        Decompiler.m_instanceStack = [];
    }

    static get dataSource() {
        if (!Decompiler.m_dataSource) throw new Error('Decompiler not initialized');
        return Decompiler.m_dataSource;
    }

    static findFunctionByAddress(address: number) {
        if (!Decompiler.m_dataSource) throw new Error('Decompiler not initialized');
        return Decompiler.dataSource.findFunctionByAddress(address);
    }

    static findFunctionById(id: number) {
        if (!Decompiler.m_dataSource) throw new Error('Decompiler not initialized');
        return Decompiler.dataSource.findFunctionById(id);
    }

    static getInstructionAtAddress(address: number) {
        if (!Decompiler.m_dataSource) throw new Error('Decompiler not initialized');
        return Decompiler.dataSource.getInstructionAtAddress(address);
    }

    static getCacheForFunctionId(id: number) {
        if (!Decompiler.m_dataSource) throw new Error('Decompiler not initialized');
        return Decompiler.dataSource.getCacheForFunctionId(id);
    }

    static decompile(functionId: number) {
        if (!Decompiler.m_dataSource) throw new Error('Decompiler not initialized');

        const instance = new DecompilerInstance();
        let result: CodeBuilder | null = null;
        Decompiler.m_instanceStack.push(instance);
        try {
            result = instance.decompile(functionId);
            Decompiler.m_instanceStack.pop();
        } catch (e) {
            Decompiler.m_instanceStack.pop();
            throw e;
        }

        return result;
    }

    static get current() {
        if (!Decompiler.m_dataSource) throw new Error('Decompiler not initialized');
        if (Decompiler.m_instanceStack.length === 0) throw new Error('No active decompiler instance');

        return Decompiler.m_instanceStack[Decompiler.m_instanceStack.length - 1];
    }
}

export class DecompilerInstance {
    private m_didSetRegister: boolean;
    private m_instructionMap: Map<number, i.Instruction>;
    private m_ignoredAddresses: Set<number>;
    private m_currentInstruction!: i.Instruction;
    private m_cache!: DecompilerCache;
    private m_defsLocked: boolean;

    constructor() {
        this.m_didSetRegister = false;
        this.m_instructionMap = new Map();
        this.m_ignoredAddresses = new Set();
        this.m_defsLocked = false;
    }

    get currentAddress() {
        return this.currentInstruction ? this.currentInstruction.address : 0;
    }

    set currentAddress(address: number) {
        this.m_currentInstruction = this.getInstruction(address);
    }

    set currentInstruction(instr: i.Instruction) {
        this.m_currentInstruction = instr;
    }

    get currentInstruction(): i.Instruction {
        if (!this.m_currentInstruction) {
            throw new Error('Current instruction not set');
        }

        return this.m_currentInstruction;
    }

    get cache() {
        return this.m_cache;
    }

    get vars() {
        return this.m_cache.vars;
    }

    get defsLocked() {
        return this.m_defsLocked;
    }

    set defsLocked(value: boolean) {
        this.m_defsLocked = value;
    }

    get didSetRegister() {
        const didSet = this.m_didSetRegister;
        this.m_didSetRegister = false;
        return didSet;
    }

    set didSetRegister(value: boolean) {
        this.m_didSetRegister = value;
    }

    private reset(): void {
        this.m_didSetRegister = false;
        this.m_defsLocked = false;
        this.m_currentInstruction = this.m_cache.code.instructions[0];
        this.m_instructionMap.clear();
        this.m_ignoredAddresses.clear();

        this.analyzeStack(this.m_cache.code.instructions, this.m_cache);

        this.m_cache.code.instructions.forEach(inst => this.m_instructionMap.set(inst.address, inst));
    }

    isAddressIgnored(address: number) {
        return this.m_ignoredAddresses.has(address);
    }

    getInstruction(address: number): i.Instruction {
        const instr = this.m_instructionMap.get(address);
        if (!instr) throw new Error(`Invalid address 0x${address.toString(16).padStart(8, '0')}`);
        return instr;
    }

    analyzeStack(code: i.Instruction[], cache: DecompilerCache) {
        if (code.length === 0) return;

        const sp: Reg.Register = { type: Reg.Type.EE, id: Reg.EE.SP };

        let stackAdjustIdx = -1;
        for (let i = 0; i < code.length; i++) {
            const op = code[i];
            if (op.code !== Op.Code.addiu) continue;

            if (Reg.compare(op.writes[0], sp) && Reg.compare(op.reads[0], sp) && typeof op.operands[2] === 'number') {
                stackAdjustIdx = i;
                cache.stackSize = -op.operands[2];
                cache.backedUpRegisters = [];
                break;
            }
        }

        if (stackAdjustIdx === -1) return;

        cache.stackSize = -code[0].operands[2] as number;
        this.m_ignoredAddresses.add(code[0].address);

        const writtenRegs = new Set<string>();

        // Determine stack size, backed up registers, remove register backup/restore instructions
        for (let idx = stackAdjustIdx; idx < code.length; idx++) {
            const op = code[idx];

            if (op.code === Op.Code.sq || op.code === Op.Code.sd) {
                const mem = op.operands[1] as Op.MemOperand;

                if (Reg.compare(mem.base, sp)) {
                    // if this register hasn't been written to yet, it's a backup
                    const key = Reg.key(mem.base);
                    if (!writtenRegs.has(key) && !cache.backedUpRegisters.some(b => Reg.compare(b.reg, mem.base))) {
                        cache.backedUpRegisters.push({
                            reg: op.reads[0],
                            offset: mem.offset
                        });
                    }

                    this.m_ignoredAddresses.add(op.address);
                    continue;
                }
            }

            if (op.code === Op.Code.lq || op.code === Op.Code.ld) {
                const mem = op.operands[1] as Op.MemOperand;

                if (Reg.compare(mem.base, sp)) {
                    // If this register was backed up, it's probably a restore
                    if (
                        cache.backedUpRegisters.some(b => Reg.compare(b.reg, op.writes[0]) && b.offset === mem.offset)
                    ) {
                        // Assume so
                        this.m_ignoredAddresses.add(op.address);
                        continue;
                    }
                }
            }

            if (op.code === Op.Code.addiu && Reg.compare(op.writes[0], sp) && Reg.compare(op.reads[0], sp)) {
                const offset = op.operands[2] as number;
                if (offset === cache.stackSize) {
                    // Restoring the stack pointer, probably before a jr $ra
                    this.m_ignoredAddresses.add(op.address);
                    continue;
                }
            }
        }
    }

    decompile(functionId: number) {
        let cache = Decompiler.getCacheForFunctionId(functionId);
        if (!cache) {
            const func = Decompiler.findFunctionById(functionId);
            if (!func) throw new Error(`Failed to find function with id ${functionId}`);

            cache = new DecompilerCache(functionId);
        }

        this.defsLocked = false;
        this.m_currentInstruction = cache.code.instructions[0];
        this.m_cache = cache;
        this.reset();
        cache.code.initialize();
        this.analyzeStack(this.m_cache.code.instructions, this.m_cache);
        this.m_cache.code.rebuildValues();

        const flow = new ControlFlowAnalyzer(this.m_cache.code);
        flow.analyze();

        const ast = flow.buildAST();

        const analyzer = new ASTAnalyzer(this.m_cache.code);
        analyzer.analyze(ast);

        const builder = new CodeBuilder(this.m_cache.code);
        builder.pushAddress(cache.func.address);
        builder.functionHeader(cache.func);
        flow.generate(ast, builder);
        builder.functionFooter();
        builder.popAddress();
        return builder;
    }

    promote(location: Location | VersionedLocation, name?: string): Value {
        if (typeof location !== 'number' && 'version' in location) {
            return this.vars.promote(location, name);
        }

        return this.vars.promote(location, this.currentAddress, name);
    }

    setRegister(reg: Reg.Register, value: Expr.Expression): void {
        if (this.m_defsLocked) return;

        if (Reg.compare(reg, { type: Reg.Type.EE, id: Reg.EE.ZERO })) return;
        if (Reg.compare(reg, { type: Reg.Type.EE, id: Reg.EE.SP })) return;
        if (Reg.compare(reg, { type: Reg.Type.COP2_VI, id: Reg.COP2.Integer.VI0 })) return;

        const reduced = value.reduce();

        const def = this.m_cache.code.getDef(this.currentInstruction, reg);
        this.m_cache.code.setValueOf(def, reduced);

        if (reduced instanceof Expr.Variable) {
            // Existing variable being moved to another location, just extend its locations
            reduced.value.addSSALocation(reg, def.version);
        }
    }

    getRegister(reg: Reg.Register, atAddress?: number): Expr.Expression {
        const instr = atAddress ? this.getInstruction(atAddress) : this.currentInstruction;
        const use = this.m_cache.code.getUse(instr, reg);

        const variable = this.m_cache.vars.getVariable(use);

        if (variable) {
            const result = new Expr.Variable(variable);
            result.address = instr.address;
            result.location = { value: use.value, version: use.version };
            return result;
        }

        return this.m_cache.code.getValueOf(use);
    }

    setStack(offset: number, value: Expr.Expression) {
        if (this.m_defsLocked) return;

        const reduced = value.reduce();

        const def = this.m_cache.code.getDef(this.currentInstruction, offset);
        this.m_cache.code.setValueOf(def, reduced);

        // console.log(`${formatVersionedLocation(def)} <- ${reduced}`, reduced);

        if (reduced instanceof Expr.Variable) {
            // Existing variable being moved to another location, just extend its locations
            reduced.value.addSSALocation(offset, def.version);
        }
    }

    getStack(offset: number, atAddress?: number): Expr.Expression {
        const instr = atAddress ? this.getInstruction(atAddress) : this.currentInstruction;
        const use = this.m_cache.code.getUse(instr, offset);

        const variable = this.m_cache.vars.getVariable(use);
        if (variable) {
            const result = new Expr.Variable(variable);
            result.address = instr.address;
            result.location = { value: use.value, version: use.version };
            return result;
        }

        return this.m_cache.code.getValueOf(use);
    }
}
