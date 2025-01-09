import { Decompiler } from 'decompiler';
import * as Expr from '../expressions';
import * as Op from '../opcodes';
import * as Reg from '../registers';
import { extractBits } from '../utils';
import { Instruction } from './base';

export class div1 extends Instruction {
    static is(instruction: Instruction): instruction is div1 {
        return instruction.code === Op.Code.div1;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.div1,
            codeStr: 'div1',
            machineCode: rawCode,
            operands: [rs, rt],
            reads: [rs, rt],
            writes: [
                { type: Reg.Type.EE, id: Reg.EE.LO1 },
                { type: Reg.Type.EE, id: Reg.EE.HI1 }
            ]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        // LO1 = lhs / rhs
        // HI1 = lhs % rhs

        const quotient = new Expr.Div(lhs, rhs);
        const remainder = new Expr.Mod(lhs, rhs);
        decomp.setRegister(this.writes[0], quotient);
        decomp.setRegister(this.writes[1], remainder);

        return null;
    }
}

export class divu1 extends Instruction {
    static is(instruction: Instruction): instruction is divu1 {
        return instruction.code === Op.Code.divu1;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.divu1,
            codeStr: 'divu1',
            machineCode: rawCode,
            operands: [rs, rt],
            reads: [rs, rt],
            writes: [
                { type: Reg.Type.EE, id: Reg.EE.LO1 },
                { type: Reg.Type.EE, id: Reg.EE.HI1 }
            ]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        // LO1 = lhs / rhs
        // HI1 = lhs % rhs

        const quotient = new Expr.Div(lhs, rhs, true);
        const remainder = new Expr.Mod(lhs, rhs);
        decomp.setRegister(this.writes[0], quotient);
        decomp.setRegister(this.writes[1], remainder);

        return null;
    }
}

export class madd extends Instruction {
    static is(instruction: Instruction): instruction is madd {
        return instruction.code === Op.Code.madd;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.madd,
            codeStr: 'madd',
            machineCode: rawCode,
            operands: rd.id === Reg.EE.ZERO ? [rs, rt] : [rd, rs, rt],
            reads: [rs, rt, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const imm32 = Expr.Imm.u32(32);
        const immU32Max = Expr.Imm.u32(0xffffffff);

        // addVal = ((HI & 0xFFFFFFFF) << 32) | (LO & 0xFFFFFFFF)
        // result = addVal + (lhs * rhs)
        // LO = i64(result & 0xFFFFFFFF)
        // HI = i64((result >> 32) & 0xFFFFFFFF)

        const prevLo = new Expr.BitwiseAnd(decomp.getRegister(this.reads[2]), immU32Max, 32);
        const prevHi = new Expr.BitwiseAnd(decomp.getRegister(this.reads[3]), immU32Max, 32);
        const addVal = new Expr.ConcatBits(Expr.Imm.u32(64), Expr.Imm.u32(32), [prevLo, prevHi]);

        const result = new Expr.Add(addVal, new Expr.Mul(lhs, rhs, false, 64), false, 64);
        const lo = new Expr.PrimitiveCast(new Expr.BitwiseAnd(result, immU32Max, 32), 'i64');
        const hi = new Expr.PrimitiveCast(
            new Expr.BitwiseAnd(new Expr.ShiftRight(result, imm32).parenthesize(), immU32Max),
            'i64'
        );

        decomp.setRegister(this.writes[0], lo);
        decomp.setRegister(this.writes[1], lo);
        decomp.setRegister(this.writes[2], hi);

        return null;
    }
}

export class madd1 extends Instruction {
    static is(instruction: Instruction): instruction is madd1 {
        return instruction.code === Op.Code.madd1;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.madd1,
            codeStr: 'madd1',
            machineCode: rawCode,
            operands: rd.id === Reg.EE.ZERO ? [rs, rt] : [rd, rs, rt],
            reads: [rs, rt, { type: Reg.Type.EE, id: Reg.EE.LO1 }, { type: Reg.Type.EE, id: Reg.EE.HI1 }],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO1 }, { type: Reg.Type.EE, id: Reg.EE.HI1 }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const imm32 = Expr.Imm.u32(32);
        const immU32Max = Expr.Imm.u32(0xffffffff);

        // addVal = ((HI1 & 0xFFFFFFFF) << 32) | (LO1 & 0xFFFFFFFF)
        // result = addVal + (lhs * rhs)
        // LO1 = i64(result & 0xFFFFFFFF)
        // HI1 = i64((result >> 32) & 0xFFFFFFFF)

        const prevLo1 = new Expr.BitwiseAnd(decomp.getRegister(this.reads[2]), immU32Max, 32);
        const prevHi1 = new Expr.BitwiseAnd(decomp.getRegister(this.reads[3]), immU32Max, 32);
        const addVal = new Expr.ConcatBits(Expr.Imm.u32(64), Expr.Imm.u32(32), [prevLo1, prevHi1]);

        const result = new Expr.Add(addVal, new Expr.Mul(lhs, rhs, false, 64), false, 64);
        const lo1 = new Expr.PrimitiveCast(new Expr.BitwiseAnd(result, immU32Max, 32), 'i64');
        const hi1 = new Expr.PrimitiveCast(
            new Expr.BitwiseAnd(new Expr.ShiftRight(result, imm32).parenthesize(), immU32Max),
            'i64'
        );

        decomp.setRegister(this.writes[0], lo1);
        decomp.setRegister(this.writes[1], lo1);
        decomp.setRegister(this.writes[2], hi1);
        return null;
    }
}

export class maddu extends Instruction {
    static is(instruction: Instruction): instruction is maddu {
        return instruction.code === Op.Code.maddu;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.maddu,
            codeStr: 'maddu',
            machineCode: rawCode,
            operands: rd.id === Reg.EE.ZERO ? [rs, rt] : [rd, rs, rt],
            reads: [rs, rt, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const imm32 = Expr.Imm.u32(32);
        const immU32Max = Expr.Imm.u32(0xffffffff);

        // addVal = ((HI & 0xFFFFFFFF) << 32) | (LO & 0xFFFFFFFF)
        // result = addVal + (lhs * rhs)
        // LO = u64(result & 0xFFFFFFFF)
        // HI = u64((result >> 32) & 0xFFFFFFFF)

        const prevLo = new Expr.BitwiseAnd(decomp.getRegister(this.reads[2]), immU32Max, 32);
        const prevHi = new Expr.BitwiseAnd(decomp.getRegister(this.reads[3]), immU32Max, 32);
        const addVal = new Expr.ConcatBits(Expr.Imm.u32(64), Expr.Imm.u32(32), [prevLo, prevHi]);

        const result = new Expr.Add(addVal, new Expr.Mul(lhs, rhs, true, 64), true, 64);
        const lo = new Expr.PrimitiveCast(new Expr.BitwiseAnd(result, immU32Max, 32), 'u64');
        const hi = new Expr.PrimitiveCast(
            new Expr.BitwiseAnd(new Expr.ShiftRight(result, imm32).parenthesize(), immU32Max),
            'u64'
        );

        decomp.setRegister(this.writes[0], lo);
        decomp.setRegister(this.writes[1], lo);
        decomp.setRegister(this.writes[2], hi);
        return null;
    }
}

export class maddu1 extends Instruction {
    static is(instruction: Instruction): instruction is maddu1 {
        return instruction.code === Op.Code.maddu1;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.maddu1,
            codeStr: 'maddu1',
            machineCode: rawCode,
            operands: rd.id === Reg.EE.ZERO ? [rs, rt] : [rd, rs, rt],
            reads: [rs, rt, { type: Reg.Type.EE, id: Reg.EE.LO1 }, { type: Reg.Type.EE, id: Reg.EE.HI1 }],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO1 }, { type: Reg.Type.EE, id: Reg.EE.HI1 }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const imm32 = Expr.Imm.u32(32);
        const immU32Max = Expr.Imm.u32(0xffffffff);

        // addVal = ((HI & 0xFFFFFFFF) << 32) | (LO & 0xFFFFFFFF)
        // result = addVal + (lhs * rhs)
        // LO1 = u64(result & 0xFFFFFFFF)
        // HI1 = u64((result >> 32) & 0xFFFFFFFF)

        const prevLo1 = new Expr.BitwiseAnd(decomp.getRegister(this.reads[2]), immU32Max, 32);
        const prevHi1 = new Expr.BitwiseAnd(decomp.getRegister(this.reads[3]), immU32Max, 32);
        const addVal = new Expr.ConcatBits(Expr.Imm.u32(64), Expr.Imm.u32(32), [prevLo1, prevHi1]);

        const result = new Expr.Add(addVal, new Expr.Mul(lhs, rhs, true, 64), true, 64);
        const lo1 = new Expr.PrimitiveCast(new Expr.BitwiseAnd(result, immU32Max, 32), 'u64');
        const hi1 = new Expr.PrimitiveCast(
            new Expr.BitwiseAnd(new Expr.ShiftRight(result, imm32).parenthesize(), immU32Max),
            'u64'
        );

        decomp.setRegister(this.writes[0], lo1);
        decomp.setRegister(this.writes[1], lo1);
        decomp.setRegister(this.writes[2], hi1);
        return null;
    }
}

export class mfhi1 extends Instruction {
    static is(instruction: Instruction): instruction is mfhi1 {
        return instruction.code === Op.Code.mfhi1;
    }

    constructor(address: number, rawCode: number) {
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.mfhi1,
            codeStr: 'mfhi1',
            machineCode: rawCode,
            operands: [rd],
            reads: [{ type: Reg.Type.EE, id: Reg.EE.HI1 }],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const hi1 = decomp.getRegister(this.reads[0]);

        decomp.setRegister(this.writes[0], hi1);
        return null;
    }
}

export class mflo1 extends Instruction {
    static is(instruction: Instruction): instruction is mflo1 {
        return instruction.code === Op.Code.mflo1;
    }

    constructor(address: number, rawCode: number) {
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.mflo1,
            codeStr: 'mflo1',
            machineCode: rawCode,
            operands: [rd],
            reads: [{ type: Reg.Type.EE, id: Reg.EE.LO1 }],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lo1 = decomp.getRegister(this.reads[0]);

        decomp.setRegister(this.writes[0], lo1);
        return null;
    }
}

export class mthi1 extends Instruction {
    static is(instruction: Instruction): instruction is mthi1 {
        return instruction.code === Op.Code.mthi1;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.mthi1,
            codeStr: 'mthi1',
            machineCode: rawCode,
            operands: [rs],
            reads: [rs],
            writes: [{ type: Reg.Type.EE, id: Reg.EE.HI1 }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        decomp.setRegister(this.writes[0], decomp.getRegister(this.reads[0]));
        return null;
    }
}

export class mtlo1 extends Instruction {
    static is(instruction: Instruction): instruction is mtlo1 {
        return instruction.code === Op.Code.mtlo1;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.mtlo1,
            codeStr: 'mtlo1',
            machineCode: rawCode,
            operands: [rs],
            reads: [rs],
            writes: [{ type: Reg.Type.EE, id: Reg.EE.LO1 }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        decomp.setRegister(this.writes[0], decomp.getRegister(this.reads[0]));
        return null;
    }
}

export class mult1 extends Instruction {
    static is(instruction: Instruction): instruction is mult1 {
        return instruction.code === Op.Code.mult1;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.mult1,
            codeStr: 'mult1',
            machineCode: rawCode,
            operands: rd.id === Reg.EE.ZERO ? [rs, rt] : [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO1 }, { type: Reg.Type.EE, id: Reg.EE.HI1 }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        // result = (lhs * rhs)
        // LO1 = i64(result & 0xFFFFFFFF)
        // HI1 = i64((result >> 32) & 0xFFFFFFFF)

        const result = new Expr.Mul(lhs, rhs, false, 64);
        const lo1 = new Expr.PrimitiveCast(new Expr.BitwiseAnd(result, Expr.Imm.u32(0xffffffff)), 'i64');
        const hi1 = new Expr.PrimitiveCast(
            new Expr.BitwiseAnd(
                new Expr.ShiftRight(result, Expr.Imm.u32(32), 64).parenthesize(),
                Expr.Imm.u32(0xffffffff)
            ),
            'i64'
        );

        decomp.setRegister(this.writes[0], lo1);
        decomp.setRegister(this.writes[1], lo1);
        decomp.setRegister(this.writes[2], hi1);

        return null;
    }
}

export class multu1 extends Instruction {
    static is(instruction: Instruction): instruction is multu1 {
        return instruction.code === Op.Code.multu1;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.multu1,
            codeStr: 'multu1',
            machineCode: rawCode,
            operands: rd.id === Reg.EE.ZERO ? [rs, rt] : [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO1 }, { type: Reg.Type.EE, id: Reg.EE.HI1 }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        // result = (lhs * rhs)
        // LO1 = i64(result & 0xFFFFFFFF)
        // HI1 = i64((result >> 32) & 0xFFFFFFFF)

        const result = new Expr.Mul(lhs, rhs, true, 64);
        const lo1 = new Expr.PrimitiveCast(new Expr.BitwiseAnd(result, Expr.Imm.u32(0xffffffff)), 'u64');
        const hi1 = new Expr.PrimitiveCast(
            new Expr.BitwiseAnd(
                new Expr.ShiftRight(result, Expr.Imm.u32(32), 64).parenthesize(),
                Expr.Imm.u32(0xffffffff)
            ),
            'u64'
        );

        decomp.setRegister(this.writes[0], lo1);
        decomp.setRegister(this.writes[1], lo1);
        decomp.setRegister(this.writes[2], hi1);

        return null;
    }
}

export class plzcw extends Instruction {
    static is(instruction: Instruction): instruction is plzcw {
        return instruction.code === Op.Code.plzcw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.plzcw,
            codeStr: 'plzcw',
            machineCode: rawCode,
            operands: [rd, rs],
            reads: [rs],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('plzcw not implemented');
    }
}

export class pmfhl extends Instruction {
    private m_format: number;

    static is(instruction: Instruction): instruction is pmfhl {
        return instruction.code === Op.Code.pmfhl;
    }

    constructor(address: number, rawCode: number) {
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const fmt = extractBits(rawCode, 6, 5);

        const fmtStr = {
            [0b00011]: 'lh',
            [0b00000]: 'lw',
            [0b00100]: 'sh',
            [0b00010]: 'slw',
            [0b00001]: 'uw'
        }[fmt];

        super({
            address,
            code: Op.Code.pmfhl,
            codeStr: `pmfhl.${fmtStr}`,
            machineCode: rawCode,
            operands: [rd],
            reads: [
                { type: Reg.Type.EE, id: Reg.EE.LO },
                { type: Reg.Type.EE, id: Reg.EE.HI }
            ],
            writes: [rd]
        });

        this.m_format = fmt;
    }

    protected createExpression(): Expr.Expression | null {
        const fmtStr = {
            [0b00011]: 'lh',
            [0b00000]: 'lw',
            [0b00100]: 'sh',
            [0b00010]: 'slw',
            [0b00001]: 'uw'
        }[this.m_format];
        return new Expr.RawString(`${fmtStr} not implemented`);
    }
}

export class pmthl extends Instruction {
    private m_format: number;

    static is(instruction: Instruction): instruction is pmfhl {
        return instruction.code === Op.Code.pmfhl;
    }

    constructor(address: number, rawCode: number) {
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const fmt = extractBits(rawCode, 6, 5);

        const fmtStr = {
            [0b00000]: 'lw'
        }[fmt];

        super({
            address,
            code: Op.Code.pmfhl,
            codeStr: `pmfhl.${fmtStr}`,
            machineCode: rawCode,
            operands: [rd],
            reads: [
                { type: Reg.Type.EE, id: Reg.EE.LO },
                { type: Reg.Type.EE, id: Reg.EE.HI }
            ],
            writes: [rd]
        });

        this.m_format = fmt;
    }

    protected createExpression(): Expr.Expression | null {
        const fmtStr = {
            [0b00000]: 'lw'
        }[this.m_format];
        return new Expr.RawString(`${fmtStr} not implemented`);
    }
}

export class psllh extends Instruction {
    static is(instruction: Instruction): instruction is psllh {
        return instruction.code === Op.Code.psllh;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        // operand is actually 5 bits wide, but docs say to just use lower 4 bits???
        const sa = extractBits(rawCode, 6, 4);

        super({
            address,
            code: Op.Code.psllh,
            codeStr: 'psllh',
            machineCode: rawCode,
            operands: [rd, rt, sa],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('psllh not implemented');
    }
}

export class psllw extends Instruction {
    static is(instruction: Instruction): instruction is psllw {
        return instruction.code === Op.Code.psllw;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const sa = extractBits(rawCode, 6, 5);

        super({
            address,
            code: Op.Code.psllw,
            codeStr: 'psllw',
            machineCode: rawCode,
            operands: [rd, rt, sa],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('psllw not implemented');
    }
}

export class psrah extends Instruction {
    static is(instruction: Instruction): instruction is psrah {
        return instruction.code === Op.Code.psrah;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const sa = extractBits(rawCode, 6, 5);

        super({
            address,
            code: Op.Code.psrah,
            codeStr: 'psrah',
            machineCode: rawCode,
            operands: [rd, rt, sa],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('psrah not implemented');
    }
}

export class psraw extends Instruction {
    static is(instruction: Instruction): instruction is psraw {
        return instruction.code === Op.Code.psraw;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const sa = extractBits(rawCode, 6, 5);

        super({
            address,
            code: Op.Code.psraw,
            codeStr: 'psraw',
            machineCode: rawCode,
            operands: [rd, rt, sa],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('psraw not implemented');
    }
}

export class psrlh extends Instruction {
    static is(instruction: Instruction): instruction is psrlh {
        return instruction.code === Op.Code.psrlh;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const sa = extractBits(rawCode, 6, 5);

        super({
            address,
            code: Op.Code.psrlh,
            codeStr: 'psrlh',
            machineCode: rawCode,
            operands: [rd, rt, sa],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('psrlh not implemented');
    }
}

export class psrlw extends Instruction {
    static is(instruction: Instruction): instruction is psrlw {
        return instruction.code === Op.Code.psrlw;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };
        const sa = extractBits(rawCode, 6, 5);

        super({
            address,
            code: Op.Code.psrlw,
            codeStr: 'psrlw',
            machineCode: rawCode,
            operands: [rd, rt, sa],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('psrlw not implemented');
    }
}
