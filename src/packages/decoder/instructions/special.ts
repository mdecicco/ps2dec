import { Decompiler } from 'decompiler';
import * as Expr from '../expressions';
import * as Op from '../opcodes';
import * as Reg from '../registers';
import { extractBits } from '../utils';
import { Instruction } from './base';

export class add extends Instruction {
    static is(instruction: Instruction): instruction is add {
        return instruction.code === Op.Code.add;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.add,
            codeStr: 'add',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        const expr = new Expr.Add(lhs, rhs);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class addu extends Instruction {
    static is(instruction: Instruction): instruction is addu {
        return instruction.code === Op.Code.addu;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.addu,
            codeStr: 'addu',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        const expr = new Expr.Add(lhs, rhs, true);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class and extends Instruction {
    static is(instruction: Instruction): instruction is and {
        return instruction.code === Op.Code.and;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.and,
            codeStr: 'and',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        const expr = new Expr.BitwiseAnd(lhs, rhs);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class break_ extends Instruction {
    static is(instruction: Instruction): instruction is break_ {
        return instruction.code === Op.Code.break;
    }

    constructor(address: number, rawCode: number) {
        const code: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 6, 20) as Reg.EE };

        super({
            address,
            code: Op.Code.break,
            codeStr: 'break',
            machineCode: rawCode,
            operands: [code],
            reads: [],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        return new Expr.Break();
    }
}

export class dadd extends Instruction {
    static is(instruction: Instruction): instruction is dadd {
        return instruction.code === Op.Code.dadd;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.dadd,
            codeStr: 'dadd',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        const expr = new Expr.Add(lhs, rhs, false, 64);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class daddu extends Instruction {
    static is(instruction: Instruction): instruction is daddu {
        return instruction.code === Op.Code.daddu;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.daddu,
            codeStr: 'daddu',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        const expr = new Expr.Add(lhs, rhs, true, 64);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class div extends Instruction {
    static is(instruction: Instruction): instruction is div {
        return instruction.code === Op.Code.div;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.div,
            codeStr: 'div',
            machineCode: rawCode,
            operands: [rs, rt],
            reads: [rs, rt],
            writes: [
                { type: Reg.Type.EE, id: Reg.EE.LO },
                { type: Reg.Type.EE, id: Reg.EE.HI }
            ]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[0] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[1] as Reg.Register);

        // LO = lhs / rhs
        // HI = lhs % rhs

        const quotient = new Expr.Div(lhs, rhs);
        const remainder = new Expr.Mod(lhs, rhs);
        decomp.setRegister(this.writes[0], quotient);
        decomp.setRegister(this.writes[1], remainder);

        return null;
    }
}

export class divu extends Instruction {
    static is(instruction: Instruction): instruction is divu {
        return instruction.code === Op.Code.divu;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.divu,
            codeStr: 'divu',
            machineCode: rawCode,
            operands: [rs, rt],
            reads: [rs, rt],
            writes: [
                { type: Reg.Type.EE, id: Reg.EE.LO },
                { type: Reg.Type.EE, id: Reg.EE.HI }
            ]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        // LO = lhs / rhs
        // HI = lhs % rhs

        const quotient = new Expr.Div(lhs, rhs, true);
        const remainder = new Expr.Mod(lhs, rhs, true);
        decomp.setRegister(this.writes[0], quotient);
        decomp.setRegister(this.writes[1], remainder);

        return null;
    }
}

export class dsll extends Instruction {
    static is(instruction: Instruction): instruction is dsll {
        return instruction.code === Op.Code.dsll;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const sa = extractBits(rawCode, 6, 5);

        super({
            address,
            code: Op.Code.dsll,
            codeStr: 'dsll',
            machineCode: rawCode,
            operands: [rd, rt, sa],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.u32(this.operands[2] as number);

        const expr = new Expr.ShiftLeft(lhs, rhs, 64);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class dsll32 extends Instruction {
    static is(instruction: Instruction): instruction is dsll32 {
        return instruction.code === Op.Code.dsll32;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const sa = extractBits(rawCode, 6, 5);

        super({
            address,
            code: Op.Code.dsll32,
            codeStr: 'dsll32',
            machineCode: rawCode,
            operands: [rd, rt, sa],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.u32((this.operands[2] as number) + 32);

        const expr = new Expr.ShiftLeft(lhs, rhs, 64);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class dsllv extends Instruction {
    static is(instruction: Instruction): instruction is dsllv {
        return instruction.code === Op.Code.dsllv;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.dsllv,
            codeStr: 'dsllv',
            machineCode: rawCode,
            operands: [rd, rt, rs],
            reads: [rt, rs],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        const expr = new Expr.ShiftLeft(lhs, rhs, 64);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class dsra extends Instruction {
    static is(instruction: Instruction): instruction is dsra {
        return instruction.code === Op.Code.dsra;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const sa = extractBits(rawCode, 6, 5);

        super({
            address,
            code: Op.Code.dsra,
            codeStr: 'dsra',
            machineCode: rawCode,
            operands: [rd, rt, sa],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.u32(this.operands[2] as number);

        const expr = new Expr.ShiftRight(lhs, rhs, 64, true);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class dsra32 extends Instruction {
    static is(instruction: Instruction): instruction is dsra32 {
        return instruction.code === Op.Code.dsra32;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const sa = extractBits(rawCode, 6, 5);

        super({
            address,
            code: Op.Code.dsra32,
            codeStr: 'dsra32',
            machineCode: rawCode,
            operands: [rd, rt, sa],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.u32((this.operands[2] as number) + 32);

        const expr = new Expr.ShiftRight(lhs, rhs, 64, true);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class dsrav extends Instruction {
    static is(instruction: Instruction): instruction is dsrav {
        return instruction.code === Op.Code.dsrav;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.dsrav,
            codeStr: 'dsrav',
            machineCode: rawCode,
            operands: [rd, rt, rs],
            reads: [rt, rs],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        const expr = new Expr.ShiftRight(lhs, rhs, 64, true);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class dsrl extends Instruction {
    static is(instruction: Instruction): instruction is dsrl {
        return instruction.code === Op.Code.dsrl;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const sa = extractBits(rawCode, 6, 5);

        super({
            address,
            code: Op.Code.dsrl,
            codeStr: 'dsrl',
            machineCode: rawCode,
            operands: [rd, rt, sa],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.u32(this.operands[2] as number);

        const expr = new Expr.ShiftRight(lhs, rhs, 64);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class dsrl32 extends Instruction {
    static is(instruction: Instruction): instruction is dsrl32 {
        return instruction.code === Op.Code.dsrl32;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const sa = extractBits(rawCode, 6, 5);

        super({
            address,
            code: Op.Code.dsrl32,
            codeStr: 'dsrl32',
            machineCode: rawCode,
            operands: [rd, rt, sa],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.u32((this.operands[2] as number) + 32);

        const expr = new Expr.ShiftRight(lhs, rhs, 64);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class dsrlv extends Instruction {
    static is(instruction: Instruction): instruction is dsrlv {
        return instruction.code === Op.Code.dsrlv;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.dsrlv,
            codeStr: 'dsrlv',
            machineCode: rawCode,
            operands: [rd, rt, rs],
            reads: [rt, rs],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        const expr = new Expr.ShiftRight(lhs, rhs, 64);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class dsub extends Instruction {
    static is(instruction: Instruction): instruction is dsub {
        return instruction.code === Op.Code.dsub;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.dsub,
            codeStr: 'dsub',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        const expr = new Expr.Sub(lhs, rhs, false, 64);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class dsubu extends Instruction {
    static is(instruction: Instruction): instruction is dsubu {
        return instruction.code === Op.Code.dsubu;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.dsubu,
            codeStr: 'dsubu',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        const expr = new Expr.Sub(lhs, rhs, true, 64);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class jalr extends Instruction {
    static is(instruction: Instruction): instruction is jalr {
        return instruction.code === Op.Code.jalr;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.jalr,
            codeStr: 'jalr',
            machineCode: rawCode,
            operands: rd.id === Reg.EE.RA ? [rs] : [rd, rs],
            reads: [rs],
            writes: [rd],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const target = decomp.getRegister(this.reads[0]);
        const returnAddress = Expr.Imm.u32(this.address + 8);
        decomp.setRegister(this.writes[0], returnAddress);
        return new Expr.IndirectCall(target);
    }
}

export class jr extends Instruction {
    static is(instruction: Instruction): instruction is jr {
        return instruction.code === Op.Code.jr;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.jr,
            codeStr: 'jr',
            machineCode: rawCode,
            operands: [rs],
            reads: [rs],
            writes: [],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        if (Reg.compare(this.reads[0], { type: Reg.Type.EE, id: Reg.EE.RA })) {
            const decomp = Decompiler.current;
            const returnLoc = decomp.cache.func.returnLocation;
            if (returnLoc) {
                if ('reg' in returnLoc) {
                    return new Expr.RawString(`return ${decomp.getRegister(returnLoc.reg)}`);
                }
                return new Expr.RawString(`return ${decomp.getStack(returnLoc.offset)}`);
            }

            return new Expr.RawString(`return`);
        }

        const decomp = Decompiler.current;
        const target = decomp.getRegister(this.reads[0]);
        return new Expr.UnconditionalBranch(target);
    }
}

export class mfhi extends Instruction {
    static is(instruction: Instruction): instruction is mfhi {
        return instruction.code === Op.Code.mfhi;
    }

    constructor(address: number, rawCode: number) {
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.mfhi,
            codeStr: 'mfhi',
            machineCode: rawCode,
            operands: [rd],
            reads: [{ type: Reg.Type.EE, id: Reg.EE.HI }],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const hi = decomp.getRegister(this.reads[0]);

        decomp.setRegister(this.writes[0], hi);
        return null;
    }
}

export class mflo extends Instruction {
    static is(instruction: Instruction): instruction is mflo {
        return instruction.code === Op.Code.mflo;
    }

    constructor(address: number, rawCode: number) {
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.mflo,
            codeStr: 'mflo',
            machineCode: rawCode,
            operands: [rd],
            reads: [{ type: Reg.Type.EE, id: Reg.EE.LO }],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lo = decomp.getRegister(this.reads[0]);

        decomp.setRegister(this.writes[0], lo);
        return null;
    }
}

export class movn extends Instruction {
    static is(instruction: Instruction): instruction is movn {
        return instruction.code === Op.Code.movn;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.movn,
            codeStr: 'movn',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const checkVar = decomp.getRegister(this.reads[1]);
        const truthy = decomp.getRegister(this.reads[0]);
        const falsy = decomp.getRegister(this.writes[0]);

        const cond = new Expr.IsNotEqual(checkVar, Expr.Imm.u32(0));
        const expr = new Expr.Ternary(cond, truthy, falsy);
        decomp.setRegister(this.writes[0], expr);
        return expr;
    }
}

export class movz extends Instruction {
    static is(instruction: Instruction): instruction is movz {
        return instruction.code === Op.Code.movz;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.movz,
            codeStr: 'movz',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            // Instruction doesn't actually read rd. This is just a workaround to make the decompiler
            // generate the correct expression.
            //
            // Actual behavior is:
            // if (rt == 0) rd = rs;
            //
            // But we have to represent it as
            // rd = rt == 0 ? rs : rd
            reads: [rt, rs, rd],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const checkVar = decomp.getRegister(this.reads[0]);
        const truthy = decomp.getRegister(this.reads[1]);
        const falsy = decomp.getRegister(this.reads[2]);

        const cond = new Expr.IsEqual(checkVar, Expr.Imm.u32(0));
        const expr = new Expr.Ternary(cond, truthy, falsy);
        decomp.setRegister(this.writes[0], expr);
        return expr;
    }
}

export class mthi extends Instruction {
    static is(instruction: Instruction): instruction is mthi {
        return instruction.code === Op.Code.mthi;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.mthi,
            codeStr: 'mthi',
            machineCode: rawCode,
            operands: [rs],
            reads: [rs],
            writes: [{ type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        decomp.setRegister(this.writes[0], decomp.getRegister(this.reads[0]));
        return null;
    }
}

export class mtlo extends Instruction {
    static is(instruction: Instruction): instruction is mtlo {
        return instruction.code === Op.Code.mtlo;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.mtlo,
            codeStr: 'mtlo',
            machineCode: rawCode,
            operands: [rs],
            reads: [rs],
            writes: [{ type: Reg.Type.EE, id: Reg.EE.LO }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        decomp.setRegister(this.writes[0], decomp.getRegister(this.reads[0]));
        return null;
    }
}

export class mult extends Instruction {
    static is(instruction: Instruction): instruction is mult {
        return instruction.code === Op.Code.mult;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.mult,
            codeStr: 'mult',
            machineCode: rawCode,
            operands: rd.id === Reg.EE.ZERO ? [rs, rt] : [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        // result = (lhs * rhs)
        // LO = result & 0xFFFFFFFF
        // HI = (result >> 32) & 0xFFFFFFFF

        const result = new Expr.Mul(lhs, rhs);
        const lo = new Expr.PrimitiveCast(new Expr.BitwiseAnd(result, Expr.Imm.u32(0xffffffff)), 'i64');
        const hi = new Expr.PrimitiveCast(
            new Expr.BitwiseAnd(
                new Expr.ShiftRight(result, Expr.Imm.u32(32), 64).parenthesize(),
                Expr.Imm.u32(0xffffffff)
            ),
            'i64'
        );

        decomp.setRegister(this.writes[0], lo);
        decomp.setRegister(this.writes[1], lo);
        decomp.setRegister(this.writes[2], hi);

        return null;
    }
}

export class multu extends Instruction {
    static is(instruction: Instruction): instruction is multu {
        return instruction.code === Op.Code.multu;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.multu,
            codeStr: 'multu',
            machineCode: rawCode,
            operands: rd.id === Reg.EE.ZERO ? [rs, rt] : [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        // result = (lhs * rhs)
        // LO = result & 0xFFFFFFFF
        // HI = (result >> 32) & 0xFFFFFFFF

        const result = new Expr.Mul(lhs, rhs, true);
        const lo = new Expr.PrimitiveCast(new Expr.BitwiseAnd(result, Expr.Imm.u32(0xffffffff)), 'u64');
        const hi = new Expr.PrimitiveCast(
            new Expr.BitwiseAnd(
                new Expr.ShiftRight(result, Expr.Imm.u32(32), 64).parenthesize(),
                Expr.Imm.u32(0xffffffff)
            ),
            'u64'
        );

        decomp.setRegister(this.writes[0], lo);
        decomp.setRegister(this.writes[1], lo);
        decomp.setRegister(this.writes[2], hi);

        return null;
    }
}

export class nor extends Instruction {
    static is(instruction: Instruction): instruction is nor {
        return instruction.code === Op.Code.nor;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.nor,
            codeStr: 'nor',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const result = new Expr.Invert(new Expr.BitwiseOr(lhs, rhs));
        decomp.setRegister(this.writes[0], result);

        return result;
    }
}

export class or extends Instruction {
    static is(instruction: Instruction): instruction is or {
        return instruction.code === Op.Code.or;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.or,
            codeStr: 'or',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const result = new Expr.BitwiseOr(lhs, rhs);
        decomp.setRegister(this.writes[0], result);

        return result;
    }
}

export class sll extends Instruction {
    static is(instruction: Instruction): instruction is sll {
        return instruction.code === Op.Code.sll;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const sa = extractBits(rawCode, 6, 5);

        super({
            address,
            code: Op.Code.sll,
            codeStr: 'sll',
            machineCode: rawCode,
            operands: [rd, rt, sa],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.u32(this.operands[2] as number);

        const expr = new Expr.ShiftLeft(lhs, rhs, 32, true);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class sllv extends Instruction {
    static is(instruction: Instruction): instruction is sllv {
        return instruction.code === Op.Code.sllv;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.sllv,
            codeStr: 'sllv',
            machineCode: rawCode,
            operands: [rd, rt, rs],
            reads: [rt, rs],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        const expr = new Expr.ShiftLeft(lhs, rhs, 32, true);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class slt extends Instruction {
    static is(instruction: Instruction): instruction is slt {
        return instruction.code === Op.Code.slt;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.slt,
            codeStr: 'slt',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const expr = new Expr.IsLess(lhs, rhs);
        decomp.setRegister(this.writes[0], expr);
        return expr;
    }
}

export class sltu extends Instruction {
    static is(instruction: Instruction): instruction is sltu {
        return instruction.code === Op.Code.sltu;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.sltu,
            codeStr: 'sltu',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const expr = new Expr.IsLess(lhs, rhs, true);
        decomp.setRegister(this.writes[0], expr);
        return expr;
    }
}

export class sra extends Instruction {
    static is(instruction: Instruction): instruction is sra {
        return instruction.code === Op.Code.sra;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const sa = extractBits(rawCode, 6, 5);

        super({
            address,
            code: Op.Code.sra,
            codeStr: 'sra',
            machineCode: rawCode,
            operands: [rd, rt, sa],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.u32(this.operands[2] as number);

        const expr = new Expr.ShiftRight(lhs, rhs, 32, true);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class srav extends Instruction {
    static is(instruction: Instruction): instruction is srav {
        return instruction.code === Op.Code.srav;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.srav,
            codeStr: 'srav',
            machineCode: rawCode,
            operands: [rd, rt, rs],
            reads: [rt, rs],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        const expr = new Expr.ShiftRight(lhs, rhs, 32, true);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class srl extends Instruction {
    static is(instruction: Instruction): instruction is srl {
        return instruction.code === Op.Code.srl;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const sa = extractBits(rawCode, 6, 5);

        super({
            address,
            code: Op.Code.srl,
            codeStr: 'srl',
            machineCode: rawCode,
            operands: [rd, rt, sa],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.u32(this.operands[2] as number);

        const expr = new Expr.ShiftRight(lhs, rhs, 32, true);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class srlv extends Instruction {
    static is(instruction: Instruction): instruction is srlv {
        return instruction.code === Op.Code.srlv;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.srlv,
            codeStr: 'srlv',
            machineCode: rawCode,
            operands: [rd, rt, rs],
            reads: [rt, rs],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        const expr = new Expr.ShiftRight(lhs, rhs, 32, true);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class sub extends Instruction {
    static is(instruction: Instruction): instruction is sub {
        return instruction.code === Op.Code.sub;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.sub,
            codeStr: 'sub',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        const expr = new Expr.Sub(lhs, rhs);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class subu extends Instruction {
    static is(instruction: Instruction): instruction is sub {
        return instruction.code === Op.Code.subu;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.subu,
            codeStr: 'subu',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = decomp.getRegister(this.operands[2] as Reg.Register);

        const expr = new Expr.Sub(lhs, rhs, true);
        decomp.setRegister(this.operands[0] as Reg.Register, expr);
        return expr;
    }
}

export class sync extends Instruction {
    static is(instruction: Instruction): instruction is sync {
        return instruction.code === Op.Code.sync;
    }

    constructor(address: number, rawCode: number) {
        const stype = extractBits(rawCode, 6, 5);

        super({
            address,
            code: Op.Code.sync,
            codeStr: stype & 0b10000 ? 'sync.l' : 'sync.p',
            machineCode: rawCode,
            operands: [stype],
            reads: [],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        return null;
    }
}

export class syscall extends Instruction {
    static is(instruction: Instruction): instruction is syscall {
        return instruction.code === Op.Code.syscall;
    }

    constructor(address: number, rawCode: number) {
        const code = extractBits(rawCode, 6, 20);

        super({
            address,
            code: Op.Code.syscall,
            codeStr: 'syscall',
            machineCode: rawCode,
            operands: [code],
            reads: [],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const code = this.operands[0] as number;
        return new Expr.RawString(`syscall(0x${code.toString(16)})`);
    }
}

export class teq extends Instruction {
    static is(instruction: Instruction): instruction is teq {
        return instruction.code === Op.Code.teq;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const code = extractBits(rawCode, 6, 10);

        super({
            address,
            code: Op.Code.teq,
            codeStr: 'teq',
            machineCode: rawCode,
            operands: [rs, rt, code],
            reads: [rs, rt],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const code = this.operands[0] as number;
        const cond = new Expr.IsEqual(decomp.getRegister(this.reads[0]), decomp.getRegister(this.reads[1]));

        return new Expr.ConditionalExpr(cond, new Expr.RawString(`trap(0x${code.toString(16)})`));
    }
}

export class tge extends Instruction {
    static is(instruction: Instruction): instruction is tge {
        return instruction.code === Op.Code.tge;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const code = extractBits(rawCode, 6, 10);

        super({
            address,
            code: Op.Code.tge,
            codeStr: 'tge',
            machineCode: rawCode,
            operands: [rs, rt, code],
            reads: [rs, rt],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const code = this.operands[0] as number;
        const cond = new Expr.IsGreaterOrEqual(decomp.getRegister(this.reads[0]), decomp.getRegister(this.reads[1]));

        return new Expr.ConditionalExpr(cond, new Expr.RawString(`trap(0x${code.toString(16)})`));
    }
}

export class tgeu extends Instruction {
    static is(instruction: Instruction): instruction is tgeu {
        return instruction.code === Op.Code.tgeu;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const code = extractBits(rawCode, 6, 10);

        super({
            address,
            code: Op.Code.tgeu,
            codeStr: 'tgeu',
            machineCode: rawCode,
            operands: [rs, rt, code],
            reads: [rs, rt],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const code = this.operands[0] as number;
        const cond = new Expr.IsGreaterOrEqual(
            decomp.getRegister(this.reads[0]),
            decomp.getRegister(this.reads[1]),
            true
        );

        return new Expr.ConditionalExpr(cond, new Expr.RawString(`trap(0x${code.toString(16)})`));
    }
}

export class tlt extends Instruction {
    static is(instruction: Instruction): instruction is tlt {
        return instruction.code === Op.Code.tlt;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const code = extractBits(rawCode, 6, 10);

        super({
            address,
            code: Op.Code.tlt,
            codeStr: 'tlt',
            machineCode: rawCode,
            operands: [rs, rt, code],
            reads: [rs, rt],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const code = this.operands[0] as number;
        const cond = new Expr.IsLess(decomp.getRegister(this.reads[0]), decomp.getRegister(this.reads[1]));

        return new Expr.ConditionalExpr(cond, new Expr.RawString(`trap(0x${code.toString(16)})`));
    }
}

export class tltu extends Instruction {
    static is(instruction: Instruction): instruction is tltu {
        return instruction.code === Op.Code.tltu;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const code = extractBits(rawCode, 6, 10);

        super({
            address,
            code: Op.Code.tltu,
            codeStr: 'tltu',
            machineCode: rawCode,
            operands: [rs, rt, code],
            reads: [rs, rt],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const code = this.operands[0] as number;
        const cond = new Expr.IsLess(decomp.getRegister(this.reads[0]), decomp.getRegister(this.reads[1]), true);

        return new Expr.ConditionalExpr(cond, new Expr.RawString(`trap(0x${code.toString(16)})`));
    }
}

export class tne extends Instruction {
    static is(instruction: Instruction): instruction is tne {
        return instruction.code === Op.Code.tne;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const code = extractBits(rawCode, 6, 10);

        super({
            address,
            code: Op.Code.tne,
            codeStr: 'tne',
            machineCode: rawCode,
            operands: [rs, rt, code],
            reads: [rs, rt],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const code = this.operands[0] as number;
        const cond = new Expr.IsNotEqual(decomp.getRegister(this.reads[0]), decomp.getRegister(this.reads[1]));

        return new Expr.ConditionalExpr(cond, new Expr.RawString(`trap(0x${code.toString(16)})`));
    }
}

export class xor extends Instruction {
    static is(instruction: Instruction): instruction is xor {
        return instruction.code === Op.Code.xor;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.xor,
            codeStr: 'xor',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const expr = new Expr.BitwiseXOr(lhs, rhs);
        decomp.setRegister(this.writes[0], expr);
        return expr;
    }
}

export class mfsa extends Instruction {
    static is(instruction: Instruction): instruction is mfsa {
        return instruction.code === Op.Code.mfsa;
    }

    constructor(address: number, rawCode: number) {
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.mfsa,
            codeStr: 'mfsa',
            machineCode: rawCode,
            operands: [rd],
            reads: [{ type: Reg.Type.EE, id: Reg.EE.SA }],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const sa = decomp.getRegister(this.reads[0]);

        decomp.setRegister(this.writes[0], sa);
        return null;
    }
}

export class mtsa extends Instruction {
    static is(instruction: Instruction): instruction is mtsa {
        return instruction.code === Op.Code.mtsa;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.mtsa,
            codeStr: 'mtsa',
            machineCode: rawCode,
            operands: [rs],
            reads: [rs],
            writes: [{ type: Reg.Type.EE, id: Reg.EE.SA }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        decomp.setRegister(this.writes[0], decomp.getRegister(this.reads[0]));
        return null;
    }
}
