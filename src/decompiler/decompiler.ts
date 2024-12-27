import { ASTAnalyzer } from 'decompiler/analysis/ast';
import { DominatorInfo } from 'decompiler/analysis/dominators';
import { SSAControlFlowAnalyzer } from 'decompiler/analysis/flow';
import { Location, SSADefWithValue, SSAForm, VersionedLocation } from 'decompiler/analysis/ssa';
import { DecompVariable, VariableDB } from 'decompiler/analysis/vardb';
import * as Expr from 'decompiler/expr';
import * as i from 'instructions';
import { Op, Reg } from 'types';
import { ControlFlowGraph } from './analysis/cfg';
import { Func, Method } from './typesys';
import { Value } from './value';

type RegisterBackup = {
    reg: Reg.Register;
    offset: number;
};

export class DecompilerCache {
    private m_func: Func | Method;
    values: Value[];
    cfg: ControlFlowGraph | null;
    stackSize: number;
    backedUpRegisters: RegisterBackup[];

    constructor(func: Func | Method) {
        this.m_func = func;
        this.values = [];
        this.cfg = null;
        this.stackSize = 0;
        this.backedUpRegisters = [];
    }

    get func() {
        return this.m_func;
    }
}

export interface IFunctionDatabase {
    findFunctionByAddress: (address: number) => Func | Method | null;
}

export class Decompiler {
    private static instance: Decompiler;
    private m_didSetRegister: boolean;
    private m_funcDb!: IFunctionDatabase;
    private m_instructionMap: Map<number, i.Instruction>;
    private m_ignoredAddresses: Set<number>;
    private m_currentInstruction!: i.Instruction;
    private m_ssaForm!: SSAForm;
    private m_dominators!: DominatorInfo;
    private m_cfg!: ControlFlowGraph;
    private m_flowAnalyzer!: SSAControlFlowAnalyzer;
    private m_variableDB!: VariableDB;
    private m_cache!: DecompilerCache;
    private m_defsLocked: boolean;

    constructor() {
        this.m_didSetRegister = false;
        this.m_instructionMap = new Map();
        this.m_ignoredAddresses = new Set();
        this.m_defsLocked = false;
    }

    static get() {
        if (!Decompiler.instance) {
            Decompiler.instance = new Decompiler();
        }

        return Decompiler.instance;
    }

    get currentAddress() {
        return this.currentInstruction ? this.currentInstruction.address : 0;
    }

    get funcDb() {
        return this.m_funcDb;
    }

    get flowAnalyzer(): SSAControlFlowAnalyzer {
        return this.m_flowAnalyzer;
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

    get ssa(): SSAForm {
        return this.m_ssaForm;
    }

    get cache() {
        return this.m_cache;
    }

    get vars() {
        return this.m_variableDB;
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

    private reset(instructions: i.Instruction[], func: Func | Method): void {
        this.m_didSetRegister = false;
        this.m_currentInstruction = instructions[0];
        this.m_instructionMap.clear();
        this.m_ignoredAddresses.clear();

        this.analyzeStack(instructions, this.m_cache);

        instructions.forEach(inst => this.m_instructionMap.set(inst.address, inst));

        // Create CFG first
        this.m_cfg = ControlFlowGraph.build(instructions);

        // Build dominator info
        this.m_dominators = new DominatorInfo(this.m_cfg);

        // Create SSA form
        if (this.m_ssaForm) this.m_ssaForm.reset(this.m_cfg, this.m_dominators, func);
        else this.m_ssaForm = new SSAForm(this.m_cfg, this.m_dominators, func);

        if (this.m_variableDB) this.m_variableDB.reset();
        else this.m_variableDB = new VariableDB(this.m_ssaForm);

        // Create flow analyzer
        this.m_flowAnalyzer = new SSAControlFlowAnalyzer(this.m_cfg, this.m_dominators, this.m_ssaForm);
    }

    private initialize(instructions: i.Instruction[], func: Func | Method) {
        this.m_ssaForm.addDef(
            instructions[0],
            { type: Reg.Type.EE, id: Reg.EE.PC },
            Expr.Imm.u32(instructions[0].address)
        );
        this.m_ssaForm.addDef(instructions[0], { type: Reg.Type.EE, id: Reg.EE.SP }, new Expr.RawString(`in_sp`));
        this.m_ssaForm.addDef(instructions[0], { type: Reg.Type.EE, id: Reg.EE.RA }, new Expr.RawString(`in_ra`));
        this.m_ssaForm.addDef(instructions[0], { type: Reg.Type.EE, id: Reg.EE.ZERO }, Expr.Imm.i128(0));
        this.m_ssaForm.addDef(instructions[0], { type: Reg.Type.COP2_VI, id: Reg.COP2.Integer.VI0 }, Expr.Imm.i32(0));

        // Handle function parameters
        if (func instanceof Method) {
            const signature = func.signature;
            const value = new DecompVariable(signature.thisType, func.thisValue.name, this.m_ssaForm);
            let def: SSADefWithValue;
            if ('reg' in signature.thisLocation) {
                def = this.m_ssaForm.addDef(instructions[0], signature.thisLocation.reg, new Expr.Variable(value));
            } else {
                def = this.m_ssaForm.addDef(instructions[0], signature.thisLocation.offset, new Expr.Variable(value));
            }

            this.m_variableDB.addVariable(def.location, instructions[0], value);
        }

        const signature = func.signature;
        const args = signature.arguments;
        for (let idx = 0; idx < args.length; idx++) {
            const arg = args[idx];
            const value = new DecompVariable(arg.typeId, func.arguments[idx].name, this.m_ssaForm);
            let def: SSADefWithValue;
            if ('reg' in arg.location) {
                def = this.m_ssaForm.addDef(instructions[0], arg.location.reg, new Expr.Variable(value));
            } else {
                def = this.m_ssaForm.addDef(instructions[0], arg.location.offset, new Expr.Variable(value));
            }

            this.m_variableDB.addVariable(def.location, instructions[0], value);
        }
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
        if (code.length === 0) return [];
        if (code[0].code !== Op.Code.addiu) return code;

        const sp: Reg.Register = { type: Reg.Type.EE, id: Reg.EE.SP };

        if (
            !Reg.compare(code[0].writes[0], sp) ||
            !Reg.compare(code[0].reads[0], sp) ||
            typeof code[0].operands[2] !== 'number'
        ) {
            cache.stackSize = 0;
            cache.backedUpRegisters = [];
            return code;
        }

        cache.stackSize = -code[0].operands[2] as number;
        this.m_ignoredAddresses.add(code[0].address);

        const writtenRegs = new Set<string>();

        // Determine stack size, backed up registers, remove register backup/restore instructions
        for (let idx = 1; idx < code.length; idx++) {
            const op = code[idx];

            if (op.code === Op.Code.sq) {
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

            if (op.code === Op.Code.lq) {
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

    decompile(code: i.Instruction[], cache: DecompilerCache, funcDb: IFunctionDatabase) {
        if (code.length === 0) return;

        this.m_cache = cache;
        this.m_funcDb = funcDb;
        this.reset(code, cache.func);

        this.initialize(code, cache.func);

        this.m_ssaForm.process();
        this.m_flowAnalyzer.analyze();

        const ast = this.m_flowAnalyzer.buildAST();

        const analyzer = new ASTAnalyzer(this.m_ssaForm, this.m_variableDB, this.m_cfg);
        analyzer.analyze(ast);

        /*
        code.forEach(instr => {
            const reads = instr.reads;
            const writes = instr.writes;

            const formatRegister = (reg: Reg.Register, idx: number) => {
                if (idx === 0 && writes.includes(reg)) {
                    const def = this.m_ssaForm.getDef(instr, reg);
                    if (!def) return `${Reg.formatRegister(reg)}`;

                    return `${Reg.formatRegister(reg)}_${def.version}`;
                }

                const use = this.m_ssaForm.getUse(instr, reg);
                if (!use) return `${Reg.formatRegister(reg)}`;

                return `${Reg.formatRegister(reg)}_${use.version}`;
            };

            const formatOperand = (op: Op.Operand, idx: number) => {
                if (typeof op === 'number') {
                    if (op < 0) return `-0x${(-op).toString(16)}`;
                    return `0x${op.toString(16)}`;
                }

                if ('base' in op) {
                    const mem = op as Op.MemOperand;
                    let offset = '';
                    if (mem.offset < 0) offset = `-0x${(-mem.offset).toString(16)}`;
                    else offset = `0x${mem.offset.toString(16)}`;

                    return `${formatRegister(mem.base, idx)}(${offset})`;
                }

                return formatRegister(op, idx);
            };

            const instrParts = instr.toStrings();

            let str = `${instrParts[0].padEnd(10, ' ')} ${instr.operands
                .map((o, idx) => formatOperand(o, idx).padEnd(10, ' '))
                .join(', ')}`;

            const defs = this.m_ssaForm.getAllDefs(instr);
            if (defs.length > 0) {
                const defStrs = defs.map(d => {
                    let dstr = '';
                    if (typeof d.location === 'number') {
                        dstr = `$sp[${d.location.toString(16)}_${d.version}]`;
                    } else {
                        dstr = `${Reg.formatRegister(d.location)}_${d.version}`;
                    }

                    const value = this.m_ssaForm.getValueForVersion(d.location, d.version);
                    if (value) {
                        dstr += ` = ${value}`;
                    }

                    return dstr;
                });
                str = str.padEnd(60, ' ') + `[${defStrs.join(', ')}]`;
            }

            console.log(str);
        });
        */

        this.m_flowAnalyzer.printAST(ast);

        this.m_variableDB.print();

        console.log('done');
    }

    promoteToVariable(location: Location, name?: string): DecompVariable {
        return this.m_variableDB.promote(location, this.m_currentInstruction, name);
    }

    promoteVersionToVariable(location: VersionedLocation, name?: string): DecompVariable {
        return this.m_variableDB.promoteVersion(location, name);
    }

    setRegister(reg: Reg.Register, value: Expr.Expression): void {
        if (this.m_defsLocked) return;

        // console.log(`Setting register ${formatRegister(reg)} to ${value}`);
        if (Reg.compare(reg, { type: Reg.Type.EE, id: Reg.EE.ZERO })) return;
        if (Reg.compare(reg, { type: Reg.Type.EE, id: Reg.EE.SP })) return;
        if (Reg.compare(reg, { type: Reg.Type.COP2_VI, id: Reg.COP2.Integer.VI0 })) return;

        const reduced = value.reduce().clone();

        if (reduced instanceof Expr.Variable) {
            // Existing variable being moved to another register, just extend its locations
            const def = this.m_ssaForm.getMostRecentDefInfo(this.m_currentInstruction, reg, false);
            if (def) {
                reduced.value.addSSALocation(def.location, def.version);
                reduced.location = {
                    value: reg,
                    version: def.version
                };
                this.m_ssaForm.addDef(this.m_currentInstruction, reg, reduced);
                return;
            }
        }

        // Record the definition in SSA form
        const def = this.m_ssaForm.addDef(this.m_currentInstruction, reg, reduced);
        reduced.location = {
            value: reg,
            version: def.version
        };

        // Then, promote the variable
        // const val = this.m_variableDB.promote(reg, this.m_currentInstruction);
        // const decl = new Expr.Variable(val, reduced);
        // decl.address = this.m_currentInstruction.address;
        // decl.location = {
        //     value: reg,
        //     version: def.version
        // };

        // Update the definition with the new variable
        // def.value = decl;
    }

    getRegister(reg: Reg.Register, atAddress?: number): Expr.Expression {
        const instr = atAddress ? Decompiler.get().getInstruction(atAddress) : this.m_currentInstruction;
        const value = this.m_variableDB.getVariable(reg, instr);
        if (value) {
            const expr = new Expr.Variable(value);
            expr.address = instr.address;
            return expr;
        }

        // Check if there is a use in the current instruction
        const use = this.m_ssaForm.getUse(instr, reg);
        if (use) {
            const expr = new Expr.SSAVariable(reg, use.version);
            expr.address = instr.address;
            return expr;
        }

        const val = this.m_ssaForm.getMostRecentDef(instr, reg);
        if (val) return val;

        const expr = new Expr.RawString(`in_${Reg.formatRegister(reg).slice(1)}`);
        expr.address = instr.address;
        return expr;
    }

    setStack(offset: number, value: Expr.Expression) {
        if (this.m_defsLocked) return;

        // console.log(`Setting stack offset 0x${offset.toString(16)} to ${value}`);

        const reduced = value.reduce().clone();

        if (reduced instanceof Expr.Variable) {
            const def = this.m_ssaForm.getMostRecentDefInfo(this.m_currentInstruction, offset, false);
            if (def) {
                reduced.value.addSSALocation(def.location, def.version);
                reduced.location = {
                    value: offset,
                    version: def.version
                };
                this.m_ssaForm.addDef(this.m_currentInstruction, offset, reduced);
                return;
            }
        }

        const def = this.m_ssaForm.addDef(this.m_currentInstruction, offset, reduced);
        reduced.location = {
            value: offset,
            version: def.version
        };
    }

    getStack(offset: number, atAddress?: number): Expr.Expression {
        const instr = atAddress ? Decompiler.get().getInstruction(atAddress) : this.m_currentInstruction;

        const value = this.m_variableDB.getVariable(offset, instr);
        if (value) {
            const expr = new Expr.Variable(value);
            expr.address = instr.address;
            return expr;
        }

        const use = this.m_ssaForm.getUse(instr, offset);
        if (use) {
            const expr = new Expr.SSAVariable(offset, use.version);
            expr.address = instr.address;
            return expr;
        }

        const expr = new Expr.RawString(`in_stack_${offset.toString(16)}`);
        expr.address = instr.address;
        return expr;
    }

    getValueForVersion(location: Location, version: number): Expr.Expression | null {
        const variable = this.m_variableDB.getVariableWithVersion(location, version);
        if (variable) {
            const expr = new Expr.Variable(variable);
            expr.address = this.m_currentInstruction.address;
            return expr;
        }

        return this.m_ssaForm.getValueForVersion(location, version);
    }
}
