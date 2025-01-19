import { Decompiler } from 'decompiler';

import * as Expr from '../expressions';
import * as Op from '../opcodes';
import * as Reg from '../registers';
import { branchTarget, extractBits, extractSignedBits } from '../utils';
import { Instruction } from './base';

export class addi extends Instruction {
    static is(instruction: Instruction): instruction is addi {
        return instruction.code === Op.Code.addi;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const immediate = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.addi,
            codeStr: 'addi',
            machineCode: rawCode,
            operands: [rt, rs, immediate],
            reads: [rs],
            writes: [rt]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.i16(this.operands[2] as number);

        const expr = new Expr.Add(lhs, rhs);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class addiu extends Instruction {
    static is(instruction: Instruction): instruction is addiu {
        return instruction.code === Op.Code.addiu;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const immediate = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.addiu,
            codeStr: 'addiu',
            machineCode: rawCode,
            operands: [rt, rs, immediate],
            reads: [rs],
            writes: [rt]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.i16(this.operands[2] as number);

        const expr = new Expr.Add(lhs, rhs, true);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class andi extends Instruction {
    static is(instruction: Instruction): instruction is andi {
        return instruction.code === Op.Code.andi;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const immediate = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.andi,
            codeStr: 'andi',
            machineCode: rawCode,
            operands: [rt, rs, immediate],
            reads: [rs],
            writes: [rt]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.i32(this.operands[2] as number);

        const expr = new Expr.BitwiseAnd(lhs, rhs);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class beq extends Instruction {
    static is(instruction: Instruction): instruction is beq {
        return instruction.code === Op.Code.beq;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.beq,
            codeStr: 'beq',
            machineCode: rawCode,
            operands: [rs, rt, target],
            reads: [rs, rt],
            writes: [],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[0] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[1] as Reg.Register);

        const cond = new Expr.IsEqual(lhs, rhs);
        const expr = new Expr.ConditionalBranch(cond, this.operands[2] as number);
        return expr;
    }
}

export class beql extends Instruction {
    static is(instruction: Instruction): instruction is beql {
        return instruction.code === Op.Code.beql;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.beql,
            codeStr: 'beql',
            machineCode: rawCode,
            operands: [rs, rt, target],
            reads: [rs, rt],
            writes: [],
            isBranch: true,
            isLikelyBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[0] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[1] as Reg.Register);

        const cond = new Expr.IsEqual(lhs, rhs);
        const expr = new Expr.ConditionalBranch(cond, this.operands[2] as number, true);
        return expr;
    }
}

export class bgtz extends Instruction {
    static is(instruction: Instruction): instruction is bgtz {
        return instruction.code === Op.Code.bgtz;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bgtz,
            codeStr: 'bgtz',
            machineCode: rawCode,
            operands: [rs, target],
            reads: [rs],
            writes: [],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[0] as Reg.Register);
        const rhs = Expr.Imm.i32(0);

        const cond = new Expr.IsGreater(lhs, rhs);
        const expr = new Expr.ConditionalBranch(cond, this.operands[1] as number);
        return expr;
    }
}

export class bgtzl extends Instruction {
    static is(instruction: Instruction): instruction is bgtzl {
        return instruction.code === Op.Code.bgtzl;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bgtzl,
            codeStr: 'bgtzl',
            machineCode: rawCode,
            operands: [rs, target],
            reads: [rs],
            writes: [],
            isBranch: true,
            isLikelyBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[0] as Reg.Register);
        const rhs = Expr.Imm.i32(0);

        const cond = new Expr.IsGreater(lhs, rhs);
        const expr = new Expr.ConditionalBranch(cond, this.operands[1] as number, true);
        return expr;
    }
}

export class blez extends Instruction {
    static is(instruction: Instruction): instruction is blez {
        return instruction.code === Op.Code.blez;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.blez,
            codeStr: 'blez',
            machineCode: rawCode,
            operands: [rs, target],
            reads: [rs],
            writes: [],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[0] as Reg.Register);
        const rhs = Expr.Imm.i32(0);

        const cond = new Expr.IsLessOrEqual(lhs, rhs);
        const expr = new Expr.ConditionalBranch(cond, this.operands[1] as number);
        return expr;
    }
}

export class blezl extends Instruction {
    static is(instruction: Instruction): instruction is blezl {
        return instruction.code === Op.Code.blezl;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.blezl,
            codeStr: 'blezl',
            machineCode: rawCode,
            operands: [rs, target],
            reads: [rs],
            writes: [],
            isBranch: true,
            isLikelyBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[0] as Reg.Register);
        const rhs = Expr.Imm.i32(0);

        const cond = new Expr.IsLessOrEqual(lhs, rhs);
        const expr = new Expr.ConditionalBranch(cond, this.operands[1] as number);
        return expr;
    }
}

export class bne extends Instruction {
    static is(instruction: Instruction): instruction is bne {
        return instruction.code === Op.Code.bne;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bne,
            codeStr: 'bne',
            machineCode: rawCode,
            operands: [rs, rt, target],
            reads: [rs, rt],
            writes: [],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[0] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[1] as Reg.Register);

        const cond = new Expr.IsNotEqual(lhs, rhs);
        const expr = new Expr.ConditionalBranch(cond, this.operands[2] as number);
        return expr;
    }
}

export class bnel extends Instruction {
    static is(instruction: Instruction): instruction is bnel {
        return instruction.code === Op.Code.bnel;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bnel,
            codeStr: 'bnel',
            machineCode: rawCode,
            operands: [rs, rt, target],
            reads: [rs, rt],
            writes: [],
            isBranch: true,
            isLikelyBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[0] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[1] as Reg.Register);

        const cond = new Expr.IsNotEqual(lhs, rhs);
        const expr = new Expr.ConditionalBranch(cond, this.operands[2] as number, true);
        return expr;
    }
}

export class daddi extends Instruction {
    static is(instruction: Instruction): instruction is daddi {
        return instruction.code === Op.Code.daddi;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const immediate = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.daddi,
            codeStr: 'daddi',
            machineCode: rawCode,
            operands: [rt, rs, immediate],
            reads: [rs],
            writes: [rt]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.i32(this.operands[2] as number);

        const expr = new Expr.Add(lhs, rhs, false, 64);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class daddiu extends Instruction {
    static is(instruction: Instruction): instruction is daddiu {
        return instruction.code === Op.Code.daddiu;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const immediate = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.daddiu,
            codeStr: 'daddiu',
            machineCode: rawCode,
            operands: [rt, rs, immediate],
            reads: [rs],
            writes: [rt]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.i32(this.operands[2] as number);

        const expr = new Expr.Add(lhs, rhs, true, 64);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class j extends Instruction {
    static is(instruction: Instruction): instruction is j {
        return instruction.code === Op.Code.j;
    }

    constructor(address: number, rawCode: number) {
        const offset = extractBits(rawCode, 0, 26);
        const target = (address & 0xf0000000) | (offset << 2);

        super({
            address,
            code: Op.Code.j,
            codeStr: 'j',
            machineCode: rawCode,
            operands: [target],
            reads: [],
            writes: [],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const target = Expr.Imm.u32(this.operands[0] as number);
        return new Expr.UnconditionalBranch(target);
    }
}

export class jal extends Instruction {
    static is(instruction: Instruction): instruction is jal {
        return instruction.code === Op.Code.jal;
    }

    constructor(address: number, rawCode: number) {
        const offset = extractBits(rawCode, 0, 26);
        const target = (address & 0xf0000000) | (offset << 2);

        super({
            address,
            code: Op.Code.jal,
            codeStr: 'jal',
            machineCode: rawCode,
            operands: [target],
            reads: [],
            writes: [{ type: Reg.Type.EE, id: Reg.EE.RA }],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const targetAddr = this.operands[0] as number;
        const target = Decompiler.findFunctionByAddress(targetAddr);
        const returnAddress = Expr.Imm.u32(this.address + 8);
        decomp.setRegister(this.writes[0], returnAddress);

        const call = new Expr.Call(targetAddr);
        if (!target || !target.returnLocation) return call;

        if (typeof target.returnLocation === 'number') {
            decomp.setStack(target.returnLocation, call);
        } else {
            decomp.setRegister(target.returnLocation, call);
        }

        return null;
    }
}

export class lb extends Instruction {
    static is(instruction: Instruction): instruction is lb {
        return instruction.code === Op.Code.lb;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.lb,
            codeStr: 'lb',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [base],
            writes: [rt],
            isLoad: true,
            memSize: 1
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;
        const src = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);

        const expr = new Expr.Load(src, 1);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class lbu extends Instruction {
    static is(instruction: Instruction): instruction is lbu {
        return instruction.code === Op.Code.lbu;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.lbu,
            codeStr: 'lbu',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [base],
            writes: [rt],
            isLoad: true,
            memSize: 1
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;
        const src = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);

        const expr = new Expr.Load(src, 1, true);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class ld extends Instruction {
    static is(instruction: Instruction): instruction is ld {
        return instruction.code === Op.Code.ld;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.ld,
            codeStr: 'ld',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [base],
            writes: [rt],
            isLoad: true,
            memSize: 8
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;
        const src = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);

        const expr = new Expr.Load(src, 8);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class ldl extends Instruction {
    static is(instruction: Instruction): instruction is ldl {
        return instruction.code === Op.Code.ldl;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.ldl,
            codeStr: 'ldl',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [rt, base],
            writes: [rt],
            isLoad: true,
            memSize: 8
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const dest = this.writes[0];
        const mem = this.operands[1] as Op.MemOperand;

        // u32 effective_address = base_address + offset;
        // u32 aligned_address = effective_address & ~7;
        // u32 byte_offset = effective_address & 7;
        // u64 loaded_block = *((u64 *)aligned_address);
        // u64 mask = 0xFFFFFFFFFFFFFFFF >> (byte_offset * 8);
        // u64 result = (reg_value & ~mask) | (loaded_block & mask);
        const effectiveAddr = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);
        const alignedAddr = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(~7));
        const byteOffset = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(7));
        const loadedBlock = new Expr.Load(alignedAddr, 8, true);
        const mask = new Expr.ShiftRight(
            Expr.Imm.u64(0xffffffffffffffff),
            new Expr.Mul(byteOffset, Expr.Imm.u32(8), true).parenthesize(),
            64,
            false
        );
        const result = new Expr.BitwiseOr(
            new Expr.BitwiseAnd(decomp.getRegister(dest), new Expr.Invert(mask)).parenthesize(),
            new Expr.BitwiseAnd(loadedBlock, mask).parenthesize()
        );

        decomp.setRegister(dest, result);
        return result;
    }
}

export class ldr extends Instruction {
    static is(instruction: Instruction): instruction is ldr {
        return instruction.code === Op.Code.ldr;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.ldr,
            codeStr: 'ldr',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [rt, base],
            writes: [rt],
            isLoad: true,
            memSize: 8
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const dest = this.writes[0];
        const mem = this.operands[1] as Op.MemOperand;

        // u32 effective_address = base_address + offset;
        // u32 aligned_address = effective_address & ~7;
        // u32 byte_offset = effective_address & 7;
        // u64 loaded_block = *((u64 *)aligned_address);
        // u64 mask = 0xFFFFFFFFFFFFFFFF << (byte_offset * 8);
        // u64 result = (reg_value & ~mask) | (loaded_block & mask);
        const effectiveAddr = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);
        const alignedAddr = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(~7));
        const byteOffset = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(7));
        const loadedBlock = new Expr.Load(alignedAddr, 8, true);
        const mask = new Expr.ShiftLeft(
            Expr.Imm.u64(0xffffffffffffffff),
            new Expr.Mul(byteOffset, Expr.Imm.u32(8), true).parenthesize(),
            64,
            false
        );
        const result = new Expr.BitwiseOr(
            new Expr.BitwiseAnd(decomp.getRegister(dest), new Expr.Invert(mask)).parenthesize(),
            new Expr.BitwiseAnd(loadedBlock, mask).parenthesize()
        );

        decomp.setRegister(dest, result);
        return result;
    }
}

export class lh extends Instruction {
    static is(instruction: Instruction): instruction is lh {
        return instruction.code === Op.Code.lh;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.lh,
            codeStr: 'lh',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [base],
            writes: [rt],
            isLoad: true,
            memSize: 2
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;
        const src = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);

        const expr = new Expr.Load(src, 2);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class lhu extends Instruction {
    static is(instruction: Instruction): instruction is lhu {
        return instruction.code === Op.Code.lhu;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.lhu,
            codeStr: 'lhu',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [base],
            writes: [rt],
            isLoad: true,
            memSize: 2
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;
        const src = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);

        const expr = new Expr.Load(src, 2, true);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class lui extends Instruction {
    static is(instruction: Instruction): instruction is lui {
        return instruction.code === Op.Code.lui;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const immediate = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.lui,
            codeStr: 'lui',
            machineCode: rawCode,
            operands: [rt, immediate],
            reads: [],
            writes: [rt]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const value = new Expr.ShiftLeft(Expr.Imm.i32(this.operands[1] as number), Expr.Imm.u32(16), 32, true);

        decomp.setRegister(this.writes[0], value);

        return value;
    }
}

export class lw extends Instruction {
    static is(instruction: Instruction): instruction is lw {
        return instruction.code === Op.Code.lw;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.lw,
            codeStr: 'lw',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [base],
            writes: [rt],
            isLoad: true,
            memSize: 4
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;
        const src = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);

        const expr = new Expr.Load(src, 4);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class lwl extends Instruction {
    static is(instruction: Instruction): instruction is lwl {
        return instruction.code === Op.Code.lwl;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.lwl,
            codeStr: 'lwl',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [rt, base],
            writes: [rt],
            isLoad: true,
            memSize: 4
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const dest = this.writes[0];
        const mem = this.operands[1] as Op.MemOperand;

        // u32 effective_address = base_address + offset;
        // u32 aligned_address = effective_address & ~3;
        // u32 byte_offset = effective_address & 3;
        // u32 loaded_block = *((u32 *)aligned_address);
        // u32 mask = 0xFFFFFFFF >> (byte_offset * 8);
        // u32 result = (reg_value & ~mask) | (loaded_block & mask);
        const effectiveAddr = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);
        const alignedAddr = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(~3));
        const byteOffset = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(3));
        const loadedBlock = new Expr.Load(alignedAddr, 4, true);
        const mask = new Expr.ShiftRight(
            Expr.Imm.u32(0xffffffff),
            new Expr.Mul(byteOffset, Expr.Imm.u32(8), true).parenthesize(),
            32,
            false
        );
        const result = new Expr.BitwiseOr(
            new Expr.BitwiseAnd(decomp.getRegister(dest), new Expr.Invert(mask)).parenthesize(),
            new Expr.BitwiseAnd(loadedBlock, mask).parenthesize()
        );

        decomp.setRegister(dest, result);
        return result;
    }
}

export class lwr extends Instruction {
    static is(instruction: Instruction): instruction is lwr {
        return instruction.code === Op.Code.lwr;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.lwr,
            codeStr: 'lwr',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [rt, base],
            writes: [rt],
            isLoad: true,
            memSize: 4
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const dest = this.writes[0];
        const mem = this.operands[1] as Op.MemOperand;

        // u32 effective_address = base_address + offset;
        // u32 aligned_address = effective_address & ~3;
        // u32 byte_offset = effective_address & 3;
        // u32 loaded_block = *((u32 *)aligned_address);
        // u32 mask = 0xFFFFFFFF << (byte_offset * 8);
        // u32 result = (reg_value & ~mask) | (loaded_block & mask);
        const effectiveAddr = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);
        const alignedAddr = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(~3));
        const byteOffset = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(3));
        const loadedBlock = new Expr.Load(alignedAddr, 4, true);
        const mask = new Expr.ShiftLeft(
            Expr.Imm.u32(0xffffffff),
            new Expr.Mul(byteOffset, Expr.Imm.u32(8), true).parenthesize(),
            32,
            false
        );
        const result = new Expr.BitwiseOr(
            new Expr.BitwiseAnd(decomp.getRegister(dest), new Expr.Invert(mask)).parenthesize(),
            new Expr.BitwiseAnd(loadedBlock, mask).parenthesize()
        );

        decomp.setRegister(dest, result);
        return result;
    }
}

export class lwu extends Instruction {
    static is(instruction: Instruction): instruction is lwu {
        return instruction.code === Op.Code.lwu;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.lwu,
            codeStr: 'lwu',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [base],
            writes: [rt],
            isLoad: true,
            memSize: 4
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;
        const src = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);

        const expr = new Expr.Load(src, 4, true);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class ori extends Instruction {
    static is(instruction: Instruction): instruction is ori {
        return instruction.code === Op.Code.ori;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const immediate = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.ori,
            codeStr: 'ori',
            machineCode: rawCode,
            operands: [rt, rs, immediate],
            reads: [rs],
            writes: [rt]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = Expr.Imm.i32(this.operands[2] as number);

        const result = new Expr.BitwiseOr(lhs, rhs);
        decomp.setRegister(this.writes[0], result);

        return result;
    }
}

export class pref extends Instruction {
    static is(instruction: Instruction): instruction is pref {
        return instruction.code === Op.Code.pref;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const hint: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.pref,
            codeStr: 'pref',
            machineCode: rawCode,
            operands: [hint, { base, offset }],
            reads: [base],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        return null;
    }
}

export class sb extends Instruction {
    static is(instruction: Instruction): instruction is sb {
        return instruction.code === Op.Code.sb;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.sb,
            codeStr: 'sb',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [rt, base],
            writes: [],
            isStore: true,
            memSize: 1
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;
        const src = decomp.getRegister(this.reads[0]);
        const dest = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);

        const expr = new Expr.Store(src, dest, 1);
        return expr;
    }
}

export class sd extends Instruction {
    static is(instruction: Instruction): instruction is sd {
        return instruction.code === Op.Code.sd;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.sd,
            codeStr: 'sd',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [rt, base],
            writes: [],
            isStore: true,
            memSize: 8
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;
        const src = decomp.getRegister(this.reads[0]);
        const dest = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);

        const expr = new Expr.Store(src, dest, 8);
        return expr;
    }
}

export class sdl extends Instruction {
    static is(instruction: Instruction): instruction is sdl {
        return instruction.code === Op.Code.sdl;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.sdl,
            codeStr: 'sdl',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [rt, base],
            writes: [],
            isStore: true,
            memSize: 8
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;

        // u32 effective_address = base_address + offset;
        // u32 aligned_address = effective_address & ~7;
        // u32 byte_offset = effective_address & 7;
        // u64 shifted_value = value >> (byte_offset * 8);
        // u64 mask = 0xFFFFFFFFFFFFFFFF >> (byte_offset * 8);
        // u64* dest = (u64 *)aligned_address;
        // *dest = (*dest & ~mask) | (shifted_value & mask);
        const effectiveAddr = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);
        const alignedAddr = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(~7));
        const byteOffset = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(7));
        const bitOffset = new Expr.Mul(byteOffset, Expr.Imm.u32(8), true).parenthesize();
        const shiftedValue = new Expr.ShiftRight(decomp.getRegister(this.reads[0]), bitOffset);
        const mask = new Expr.ShiftRight(Expr.Imm.u64(0xffffffffffffffff), bitOffset, 64, false);
        const destValue = new Expr.Load(alignedAddr, 8, true);
        const valueToStore = new Expr.BitwiseOr(
            new Expr.BitwiseAnd(destValue, new Expr.Invert(mask)).parenthesize(),
            new Expr.BitwiseAnd(shiftedValue, mask).parenthesize()
        );

        return new Expr.Store(valueToStore, alignedAddr, 8, true);
    }
}

export class sdr extends Instruction {
    static is(instruction: Instruction): instruction is sdr {
        return instruction.code === Op.Code.sdr;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.sdr,
            codeStr: 'sdr',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [rt, base],
            writes: [],
            isStore: true,
            memSize: 8
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;

        // u32 effective_address = base_address + offset;
        // u32 aligned_address = effective_address & ~7;
        // u32 byte_offset = effective_address & 7;
        // u64 shifted_value = value << (byte_offset * 8);
        // u64 mask = 0xFFFFFFFFFFFFFFFF << (byte_offset * 8);
        // u64* dest = (u64 *)aligned_address;
        // *dest = (*dest & ~mask) | (shifted_value & mask);
        const effectiveAddr = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);
        const alignedAddr = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(~7));
        const byteOffset = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(7));
        const bitOffset = new Expr.Mul(byteOffset, Expr.Imm.u32(8), true).parenthesize();
        const shiftedValue = new Expr.ShiftLeft(decomp.getRegister(this.reads[0]), bitOffset);
        const mask = new Expr.ShiftLeft(Expr.Imm.u64(0xffffffffffffffff), bitOffset, 64, false);
        const destValue = new Expr.Load(alignedAddr, 8, true);
        const valueToStore = new Expr.BitwiseOr(
            new Expr.BitwiseAnd(destValue, mask).parenthesize(),
            new Expr.BitwiseAnd(shiftedValue, new Expr.Invert(mask)).parenthesize()
        );

        return new Expr.Store(valueToStore, alignedAddr, 8, true);
    }
}

export class sh extends Instruction {
    static is(instruction: Instruction): instruction is sh {
        return instruction.code === Op.Code.sh;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.sh,
            codeStr: 'sh',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [rt, base],
            writes: [],
            isStore: true,
            memSize: 2
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;
        const src = decomp.getRegister(this.reads[0]);
        const dest = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);

        const expr = new Expr.Store(src, dest, 2);
        return expr;
    }
}

export class slti extends Instruction {
    static is(instruction: Instruction): instruction is slti {
        return instruction.code === Op.Code.slti;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const immediate = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.slti,
            codeStr: 'slti',
            machineCode: rawCode,
            operands: [rt, rs, immediate],
            reads: [rs],
            writes: [rt]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = Expr.Imm.i32(this.operands[2] as number);

        const expr = new Expr.IsLess(lhs, rhs);
        decomp.setRegister(this.writes[0], expr);
        return expr;
    }
}

export class sltiu extends Instruction {
    static is(instruction: Instruction): instruction is sltiu {
        return instruction.code === Op.Code.sltiu;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const immediate = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.sltiu,
            codeStr: 'sltiu',
            machineCode: rawCode,
            operands: [rt, rs, immediate],
            reads: [rs],
            writes: [rt]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = Expr.Imm.i32(this.operands[2] as number);

        const expr = new Expr.IsLess(lhs, rhs, true);
        decomp.setRegister(this.writes[0], expr);
        return expr;
    }
}

export class sw extends Instruction {
    static is(instruction: Instruction): instruction is sw {
        return instruction.code === Op.Code.sw;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.sw,
            codeStr: 'sw',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [rt, base],
            writes: [],
            isStore: true,
            memSize: 4
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;
        const src = decomp.getRegister(this.reads[0]);
        const dest = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);

        const expr = new Expr.Store(src, dest, 4);
        return expr;
    }
}

export class swl extends Instruction {
    static is(instruction: Instruction): instruction is swl {
        return instruction.code === Op.Code.swl;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.swl,
            codeStr: 'swl',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [rt, base],
            writes: [],
            isStore: true,
            memSize: 4
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;

        // u32 effective_address = base_address + offset;
        // u32 aligned_address = effective_address & ~3;
        // u32 byte_offset = effective_address & 3;
        // u32 shifted_value = value >> (byte_offset * 8);
        // u32 mask = 0xFFFFFFFF >> (byte_offset * 8);
        // u32* dest = (u32 *)aligned_address;
        // *dest = (*dest & ~mask) | (shifted_value & mask);
        const effectiveAddr = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);
        const alignedAddr = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(~3));
        const byteOffset = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(3));
        const bitOffset = new Expr.Mul(byteOffset, Expr.Imm.u32(8), true).parenthesize();
        const shiftedValue = new Expr.ShiftRight(decomp.getRegister(this.reads[0]), bitOffset);
        const mask = new Expr.ShiftRight(Expr.Imm.u32(0xffffffff), bitOffset, 32, false);
        const destValue = new Expr.Load(alignedAddr, 4, true);
        const valueToStore = new Expr.BitwiseOr(
            new Expr.BitwiseAnd(destValue, new Expr.Invert(mask)).parenthesize(),
            new Expr.BitwiseAnd(shiftedValue, mask).parenthesize()
        );

        return new Expr.Store(valueToStore, alignedAddr, 4, true);
    }
}

export class swr extends Instruction {
    static is(instruction: Instruction): instruction is swr {
        return instruction.code === Op.Code.swr;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.swr,
            codeStr: 'swr',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [rt, base],
            writes: [],
            isStore: true,
            memSize: 4
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;

        // u32 effective_address = base_address + offset;
        // u32 aligned_address = effective_address & ~3;
        // u32 byte_offset = effective_address & 3;
        // u32 shifted_value = value << (byte_offset * 8);
        // u32 mask = 0xFFFFFFFF << (byte_offset * 8);
        // u32* dest = (u32 *)aligned_address;
        // *dest = (*dest & ~mask) | (shifted_value & mask);
        const effectiveAddr = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);
        const alignedAddr = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(~3));
        const byteOffset = new Expr.BitwiseAnd(effectiveAddr, Expr.Imm.u32(3));
        const bitOffset = new Expr.Mul(byteOffset, Expr.Imm.u32(8), true).parenthesize();
        const shiftedValue = new Expr.ShiftLeft(decomp.getRegister(this.reads[0]), bitOffset);
        const mask = new Expr.ShiftLeft(Expr.Imm.u32(0xffffffff), bitOffset, 32, false);
        const destValue = new Expr.Load(alignedAddr, 4, true);
        const valueToStore = new Expr.BitwiseOr(
            new Expr.BitwiseAnd(destValue, mask).parenthesize(),
            new Expr.BitwiseAnd(shiftedValue, new Expr.Invert(mask)).parenthesize()
        );

        return new Expr.Store(valueToStore, alignedAddr, 4, true);
    }
}

export class xori extends Instruction {
    static is(instruction: Instruction): instruction is xori {
        return instruction.code === Op.Code.xori;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const immediate = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.xori,
            codeStr: 'xori',
            machineCode: rawCode,
            operands: [rt, rs, immediate],
            reads: [rs],
            writes: [rt]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = Expr.Imm.i32(this.operands[2] as number);

        const expr = new Expr.BitwiseXOr(lhs, rhs);
        decomp.setRegister(this.writes[0], expr);
        return expr;
    }
}

export class lq extends Instruction {
    static is(instruction: Instruction): instruction is lq {
        return instruction.code === Op.Code.lq;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.lq,
            codeStr: 'lq',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [base],
            writes: [rt],
            isLoad: true,
            memSize: 16
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;
        const src = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);

        const expr = new Expr.Load(src, 16);
        decomp.setRegister(this.writes[0], expr);
        return expr;
    }
}

export class sq extends Instruction {
    static is(instruction: Instruction): instruction is sq {
        return instruction.code === Op.Code.sq;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.sq,
            codeStr: 'sq',
            machineCode: rawCode,
            operands: [rt, { base, offset }],
            reads: [rt, base],
            writes: [],
            isStore: true,
            memSize: 16
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;
        const src = decomp.getRegister(this.reads[0]);
        const dest = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);

        const expr = new Expr.Store(src, dest, 8);
        return expr;
    }
}

export class lwc1 extends Instruction {
    static is(instruction: Instruction): instruction is lwc1 {
        return instruction.code === Op.Code.lwc1;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.lwc1,
            codeStr: 'lwc1',
            machineCode: rawCode,
            operands: [ft, { base, offset }],
            reads: [base],
            writes: [ft],
            isLoad: true,
            memSize: 4
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;
        const addr = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset));
        decomp.setRegister(this.writes[0], new Expr.Load(addr, 4));
        return null;
    }
}

export class swc1 extends Instruction {
    static is(instruction: Instruction): instruction is swc1 {
        return instruction.code === Op.Code.swc1;
    }

    constructor(address: number, rawCode: number) {
        const base: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const offset = extractSignedBits(rawCode, 0, 16);

        super({
            address,
            code: Op.Code.swc1,
            codeStr: 'swc1',
            machineCode: rawCode,
            operands: [ft, { base, offset }],
            reads: [ft, base],
            writes: [],
            isStore: true,
            memSize: 4
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const mem = this.operands[1] as Op.MemOperand;
        const src = decomp.getRegister(this.reads[0]);
        const dest = new Expr.Add(decomp.getRegister(mem.base), Expr.Imm.i16(mem.offset), true);

        const expr = new Expr.Store(src, dest, 4);
        return expr;
    }
}
