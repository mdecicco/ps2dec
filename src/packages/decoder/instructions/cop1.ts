import { Decompiler, Expr } from 'decompiler';
import * as Op from '../opcodes';
import * as Reg from '../registers';
import { branchTarget, extractBits, extractSignedBits } from '../utils';
import { Instruction } from './base';

export class abs_s extends Instruction {
    static is(instruction: Instruction): instruction is abs_s {
        return instruction.code === Op.Code.abs_s;
    }

    constructor(address: number, rawCode: number) {
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };
        const fd: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 6, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.abs_s,
            codeStr: 'abs.s',
            machineCode: rawCode,
            operands: [fd, fs],
            reads: [fs],
            writes: [fd, { type: Reg.Type.COP1, id: Reg.COP1.O }, { type: Reg.Type.COP1, id: Reg.COP1.U }]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        decomp.setRegister(this.writes[0], new Expr.Abs(decomp.getRegister(this.reads[0])));

        const f = Expr.Imm.bool(false);
        decomp.setRegister(this.writes[1], f);
        decomp.setRegister(this.writes[2], f);
        return new Expr.Null();
    }
}

export class add_s extends Instruction {
    static is(instruction: Instruction): instruction is add_s {
        return instruction.code === Op.Code.add_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };
        const fd: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 6, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.add_s,
            codeStr: 'add.s',
            machineCode: rawCode,
            operands: [fd, fs, ft],
            reads: [fs, ft],
            writes: [
                fd,
                { type: Reg.Type.COP1, id: Reg.COP1.O },
                { type: Reg.Type.COP1, id: Reg.COP1.U },
                { type: Reg.Type.COP1, id: Reg.COP1.SO },
                { type: Reg.Type.COP1, id: Reg.COP1.SU }
            ]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const result = new Expr.Add(decomp.getRegister(this.reads[0]), decomp.getRegister(this.reads[1]));

        decomp.setRegister(this.writes[0], result);

        const msg = new Expr.RawString('/* Unimplemented result flag from add.s instruction */');
        msg.type = 'bool';
        decomp.setRegister(this.writes[1], msg);
        decomp.setRegister(this.writes[2], msg);
        decomp.setRegister(this.writes[3], msg);
        decomp.setRegister(this.writes[4], msg);
        return new Expr.Null();
    }
}

export class adda_s extends Instruction {
    static is(instruction: Instruction): instruction is adda_s {
        return instruction.code === Op.Code.adda_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.adda_s,
            codeStr: 'adda.s',
            machineCode: rawCode,
            operands: [fs, ft],
            reads: [fs, ft],
            writes: [
                { type: Reg.Type.COP1, id: Reg.COP1.ACC },
                { type: Reg.Type.COP1, id: Reg.COP1.O },
                { type: Reg.Type.COP1, id: Reg.COP1.U },
                { type: Reg.Type.COP1, id: Reg.COP1.SO },
                { type: Reg.Type.COP1, id: Reg.COP1.SU }
            ]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const result = new Expr.Add(decomp.getRegister(this.reads[0]), decomp.getRegister(this.reads[1]));

        decomp.setRegister(this.writes[0], result);

        const msg = new Expr.RawString('/* Unimplemented result flag from adda.s instruction */');
        msg.type = 'bool';
        decomp.setRegister(this.writes[1], msg);
        decomp.setRegister(this.writes[2], msg);
        decomp.setRegister(this.writes[3], msg);
        decomp.setRegister(this.writes[4], msg);
        return new Expr.Null();
    }
}

export class bc1f extends Instruction {
    static is(instruction: Instruction): instruction is bc1f {
        return instruction.code === Op.Code.bc1f;
    }

    constructor(address: number, rawCode: number) {
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bc1f,
            codeStr: 'bc1f',
            machineCode: rawCode,
            operands: [target],
            reads: [{ type: Reg.Type.COP1, id: Reg.COP1.C }],
            writes: [],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const cond = new Expr.Not(decomp.getRegister(this.reads[0]));
        const expr = new Expr.ConditionalBranch(cond, this.operands[0] as number);
        return expr;
    }
}

export class bc1fl extends Instruction {
    static is(instruction: Instruction): instruction is bc1fl {
        return instruction.code === Op.Code.bc1fl;
    }

    constructor(address: number, rawCode: number) {
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bc1fl,
            codeStr: 'bc1fl',
            machineCode: rawCode,
            operands: [target],
            reads: [{ type: Reg.Type.COP1, id: Reg.COP1.C }],
            writes: [],
            isBranch: true,
            isLikelyBranch: true
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const cond = new Expr.Not(decomp.getRegister(this.reads[0]));
        const expr = new Expr.ConditionalBranch(cond, this.operands[0] as number, true);
        return expr;
    }
}

export class bc1t extends Instruction {
    static is(instruction: Instruction): instruction is bc1t {
        return instruction.code === Op.Code.bc1t;
    }

    constructor(address: number, rawCode: number) {
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bc1t,
            codeStr: 'bc1t',
            machineCode: rawCode,
            operands: [target],
            reads: [{ type: Reg.Type.COP1, id: Reg.COP1.C }],
            writes: [],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const cond = decomp.getRegister(this.reads[0]);
        const expr = new Expr.ConditionalBranch(cond, this.operands[0] as number);
        return expr;
    }
}

export class bc1tl extends Instruction {
    static is(instruction: Instruction): instruction is bc1tl {
        return instruction.code === Op.Code.bc1tl;
    }

    constructor(address: number, rawCode: number) {
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bc1tl,
            codeStr: 'bc1tl',
            machineCode: rawCode,
            operands: [target],
            reads: [{ type: Reg.Type.COP1, id: Reg.COP1.C }],
            writes: [],
            isBranch: true,
            isLikelyBranch: true
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const cond = decomp.getRegister(this.reads[0]);
        const expr = new Expr.ConditionalBranch(cond, this.operands[0] as number, true);
        return expr;
    }
}

export class c_eq_s extends Instruction {
    static is(instruction: Instruction): instruction is c_eq_s {
        return instruction.code === Op.Code.c_eq_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.c_eq_s,
            codeStr: 'c.eq.s',
            machineCode: rawCode,
            operands: [fs, ft],
            reads: [fs, ft],
            writes: [{ type: Reg.Type.COP1, id: Reg.COP1.C }]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const result = new Expr.IsEqual(decomp.getRegister(this.reads[0]), decomp.getRegister(this.reads[1]));

        decomp.setRegister(this.writes[0], result);
        return new Expr.Null();
    }
}

export class c_f_s extends Instruction {
    static is(instruction: Instruction): instruction is c_f_s {
        return instruction.code === Op.Code.c_f_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.c_f_s,
            codeStr: 'c.f.s',
            machineCode: rawCode,
            operands: [fs, ft],
            reads: [fs, ft],
            writes: [{ type: Reg.Type.COP1, id: Reg.COP1.C }]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        // const result = new Expr.IsEqual(decomp.getRegister(this.reads[0]), decomp.getRegister(this.reads[1]));

        // The docs explicitly say that it sets the flag to false no matter what???
        // What the heck? Why even have this
        decomp.setRegister(this.writes[0], Expr.Imm.bool(false));
        return new Expr.Null();
    }
}

export class c_le_s extends Instruction {
    static is(instruction: Instruction): instruction is c_le_s {
        return instruction.code === Op.Code.c_le_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.c_le_s,
            codeStr: 'c.le.s',
            machineCode: rawCode,
            operands: [fs, ft],
            reads: [fs, ft],
            writes: [{ type: Reg.Type.COP1, id: Reg.COP1.C }]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const result = new Expr.IsLessOrEqual(decomp.getRegister(this.reads[0]), decomp.getRegister(this.reads[1]));

        decomp.setRegister(this.writes[0], result);
        return new Expr.Null();
    }
}

export class c_lt_s extends Instruction {
    static is(instruction: Instruction): instruction is c_lt_s {
        return instruction.code === Op.Code.c_lt_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.c_lt_s,
            codeStr: 'c.lt.s',
            machineCode: rawCode,
            operands: [fs, ft],
            reads: [fs, ft],
            writes: [{ type: Reg.Type.COP1, id: Reg.COP1.C }]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const result = new Expr.IsLess(decomp.getRegister(this.reads[0]), decomp.getRegister(this.reads[1]));

        decomp.setRegister(this.writes[0], result);
        return new Expr.Null();
    }
}

export class cfc1 extends Instruction {
    static is(instruction: Instruction): instruction is cfc1 {
        return instruction.code === Op.Code.cfc1;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.cfc1,
            codeStr: 'cfc1',
            machineCode: rawCode,
            operands: [rt, fs],
            reads: [fs],
            writes: [rt]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        decomp.setRegister(this.writes[0], decomp.getRegister(this.reads[0]));
        return new Expr.Null();
    }
}

export class ctc1 extends Instruction {
    static is(instruction: Instruction): instruction is ctc1 {
        return instruction.code === Op.Code.ctc1;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.ctc1,
            codeStr: 'ctc1',
            machineCode: rawCode,
            operands: [rt, fs],
            reads: [rt],
            writes: [fs]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        decomp.setRegister(this.writes[0], decomp.getRegister(this.reads[0]));
        return new Expr.Null();
    }
}

export class cvt_s_w extends Instruction {
    static is(instruction: Instruction): instruction is cvt_s_w {
        return instruction.code === Op.Code.cvt_s_w;
    }

    constructor(address: number, rawCode: number) {
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };
        const fd: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 6, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.cvt_s_w,
            codeStr: 'cvt_s_w',
            machineCode: rawCode,
            operands: [fd, fs],
            reads: [fs],
            writes: [fd]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        decomp.setRegister(this.writes[0], new Expr.PrimitiveCast(decomp.getRegister(this.reads[0]), 'f32'));
        return new Expr.Null();
    }
}

export class cvt_w_s extends Instruction {
    static is(instruction: Instruction): instruction is cvt_w_s {
        return instruction.code === Op.Code.cvt_w_s;
    }

    constructor(address: number, rawCode: number) {
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };
        const fd: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 6, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.cvt_w_s,
            codeStr: 'cvt_w_s',
            machineCode: rawCode,
            operands: [fd, fs],
            reads: [fs],
            writes: [fd]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        decomp.setRegister(this.writes[0], new Expr.PrimitiveCast(decomp.getRegister(this.reads[0]), 'i32'));
        return new Expr.Null();
    }
}

export class div_s extends Instruction {
    static is(instruction: Instruction): instruction is div_s {
        return instruction.code === Op.Code.div_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };
        const fd: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 6, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.div_s,
            codeStr: 'div.s',
            machineCode: rawCode,
            operands: [fd, fs, ft],
            reads: [fs, ft],
            writes: [
                fd,
                { type: Reg.Type.COP1, id: Reg.COP1.I },
                { type: Reg.Type.COP1, id: Reg.COP1.D },
                { type: Reg.Type.COP1, id: Reg.COP1.SI },
                { type: Reg.Type.COP1, id: Reg.COP1.SD }
            ]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const fs = decomp.getRegister(this.reads[0]);
        const ft = decomp.getRegister(this.reads[1]);
        const result = new Expr.Div(fs, ft);
        const zero = Expr.Imm.f32(0);

        decomp.setRegister(this.writes[0], result);

        const ftIsZero = new Expr.IsEqual(ft, zero);
        const flagI = new Expr.LogicalAnd(new Expr.IsEqual(fs, zero), ftIsZero);
        const flagD = new Expr.LogicalAnd(new Expr.IsNotEqual(fs, zero), ftIsZero);
        decomp.setRegister(this.writes[1], flagI);
        decomp.setRegister(this.writes[2], flagD);
        decomp.setRegister(this.writes[3], flagI);
        decomp.setRegister(this.writes[4], flagD);

        return new Expr.Null();
    }
}

export class madd_s extends Instruction {
    static is(instruction: Instruction): instruction is madd_s {
        return instruction.code === Op.Code.madd_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };
        const fd: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 6, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.madd_s,
            codeStr: 'madd.s',
            machineCode: rawCode,
            operands: [fd, fs, ft],
            reads: [fs, ft, { type: Reg.Type.COP1, id: Reg.COP1.ACC }],
            writes: [
                fd,
                { type: Reg.Type.COP1, id: Reg.COP1.O },
                { type: Reg.Type.COP1, id: Reg.COP1.U },
                { type: Reg.Type.COP1, id: Reg.COP1.SO },
                { type: Reg.Type.COP1, id: Reg.COP1.SU }
            ]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const fs = decomp.getRegister(this.reads[0]);
        const ft = decomp.getRegister(this.reads[1]);
        const acc = decomp.getRegister(this.reads[2]);

        decomp.setRegister(this.writes[0], new Expr.Add(new Expr.Mul(fs, ft), acc));

        const msg = new Expr.RawString('/* Unimplemented result flag from madd.s instruction */');
        msg.type = 'bool';
        decomp.setRegister(this.writes[1], msg);
        decomp.setRegister(this.writes[2], msg);
        decomp.setRegister(this.writes[3], msg);
        decomp.setRegister(this.writes[4], msg);

        return new Expr.Null();
    }
}

export class madda_s extends Instruction {
    static is(instruction: Instruction): instruction is madda_s {
        return instruction.code === Op.Code.madda_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.madda_s,
            codeStr: 'madda.s',
            machineCode: rawCode,
            operands: [fs, ft],
            reads: [fs, ft, { type: Reg.Type.COP1, id: Reg.COP1.ACC }],
            writes: [
                { type: Reg.Type.COP1, id: Reg.COP1.ACC },
                { type: Reg.Type.COP1, id: Reg.COP1.O },
                { type: Reg.Type.COP1, id: Reg.COP1.U },
                { type: Reg.Type.COP1, id: Reg.COP1.SO },
                { type: Reg.Type.COP1, id: Reg.COP1.SU }
            ]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const fs = decomp.getRegister(this.reads[0]);
        const ft = decomp.getRegister(this.reads[1]);
        const acc = decomp.getRegister(this.reads[2]);

        decomp.setRegister(this.writes[0], new Expr.Add(new Expr.Mul(fs, ft), acc));

        const msg = new Expr.RawString('/* Unimplemented result flag from madd.s instruction */');
        msg.type = 'bool';
        decomp.setRegister(this.writes[1], msg);
        decomp.setRegister(this.writes[2], msg);
        decomp.setRegister(this.writes[3], msg);
        decomp.setRegister(this.writes[4], msg);

        return new Expr.Null();
    }
}

export class max_s extends Instruction {
    static is(instruction: Instruction): instruction is max_s {
        return instruction.code === Op.Code.max_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };
        const fd: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 6, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.max_s,
            codeStr: 'max.s',
            machineCode: rawCode,
            operands: [fd, fs, ft],
            reads: [fs, ft],
            writes: [fd, { type: Reg.Type.COP1, id: Reg.COP1.O }, { type: Reg.Type.COP1, id: Reg.COP1.U }]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const fs = decomp.getRegister(this.reads[0]);
        const ft = decomp.getRegister(this.reads[1]);

        decomp.setRegister(this.writes[0], new Expr.Max([fs, ft]));

        const f = Expr.Imm.bool(false);
        decomp.setRegister(this.writes[1], f);
        decomp.setRegister(this.writes[2], f);

        return new Expr.Null();
    }
}

export class mfc1 extends Instruction {
    static is(instruction: Instruction): instruction is mfc1 {
        return instruction.code === Op.Code.mfc1;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.mfc1,
            codeStr: 'mfc1',
            machineCode: rawCode,
            operands: [rt, fs],
            reads: [fs],
            writes: [rt]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        decomp.setRegister(this.writes[0], decomp.getRegister(this.reads[0]));
        return new Expr.Null();
    }
}

export class min_s extends Instruction {
    static is(instruction: Instruction): instruction is min_s {
        return instruction.code === Op.Code.min_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };
        const fd: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 6, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.min_s,
            codeStr: 'min.s',
            machineCode: rawCode,
            operands: [fd, fs, ft],
            reads: [fs, ft],
            writes: [fd, { type: Reg.Type.COP1, id: Reg.COP1.O }, { type: Reg.Type.COP1, id: Reg.COP1.U }]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const fs = decomp.getRegister(this.reads[0]);
        const ft = decomp.getRegister(this.reads[1]);

        decomp.setRegister(this.writes[0], new Expr.Min([fs, ft]));

        const f = Expr.Imm.bool(false);
        decomp.setRegister(this.writes[1], f);
        decomp.setRegister(this.writes[2], f);

        return new Expr.Null();
    }
}

export class mov_s extends Instruction {
    static is(instruction: Instruction): instruction is mov_s {
        return instruction.code === Op.Code.mov_s;
    }

    constructor(address: number, rawCode: number) {
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };
        const fd: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 6, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.mov_s,
            codeStr: 'mov_s',
            machineCode: rawCode,
            operands: [fs, fd],
            reads: [fs],
            writes: [fd]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        decomp.setRegister(this.writes[0], decomp.getRegister(this.reads[0]));
        return new Expr.Null();
    }
}

export class msub_s extends Instruction {
    static is(instruction: Instruction): instruction is msub_s {
        return instruction.code === Op.Code.msub_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };
        const fd: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 6, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.msub_s,
            codeStr: 'msub.s',
            machineCode: rawCode,
            operands: [fd, fs, ft],
            reads: [fs, ft, { type: Reg.Type.COP1, id: Reg.COP1.ACC }],
            writes: [
                fd,
                { type: Reg.Type.COP1, id: Reg.COP1.O },
                { type: Reg.Type.COP1, id: Reg.COP1.U },
                { type: Reg.Type.COP1, id: Reg.COP1.SO },
                { type: Reg.Type.COP1, id: Reg.COP1.SU }
            ]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const fs = decomp.getRegister(this.reads[0]);
        const ft = decomp.getRegister(this.reads[1]);
        const acc = decomp.getRegister(this.reads[2]);

        decomp.setRegister(this.writes[0], new Expr.Sub(acc, new Expr.Mul(fs, ft)));

        const msg = new Expr.RawString('/* Unimplemented result flag from madd.s instruction */');
        msg.type = 'bool';
        decomp.setRegister(this.writes[1], msg);
        decomp.setRegister(this.writes[2], msg);
        decomp.setRegister(this.writes[3], msg);
        decomp.setRegister(this.writes[4], msg);

        return new Expr.Null();
    }
}

export class msuba_s extends Instruction {
    static is(instruction: Instruction): instruction is msuba_s {
        return instruction.code === Op.Code.msuba_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.msuba_s,
            codeStr: 'msuba.s',
            machineCode: rawCode,
            operands: [fs, ft],
            reads: [fs, ft, { type: Reg.Type.COP1, id: Reg.COP1.ACC }],
            writes: [
                { type: Reg.Type.COP1, id: Reg.COP1.ACC },
                { type: Reg.Type.COP1, id: Reg.COP1.O },
                { type: Reg.Type.COP1, id: Reg.COP1.U },
                { type: Reg.Type.COP1, id: Reg.COP1.SO },
                { type: Reg.Type.COP1, id: Reg.COP1.SU }
            ]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const fs = decomp.getRegister(this.reads[0]);
        const ft = decomp.getRegister(this.reads[1]);
        const acc = decomp.getRegister(this.reads[2]);

        decomp.setRegister(this.writes[0], new Expr.Sub(acc, new Expr.Mul(fs, ft)));

        const msg = new Expr.RawString('/* Unimplemented result flag from madd.s instruction */');
        msg.type = 'bool';
        decomp.setRegister(this.writes[1], msg);
        decomp.setRegister(this.writes[2], msg);
        decomp.setRegister(this.writes[3], msg);
        decomp.setRegister(this.writes[4], msg);

        return new Expr.Null();
    }
}

export class mtc1 extends Instruction {
    static is(instruction: Instruction): instruction is mtc1 {
        return instruction.code === Op.Code.mtc1;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.mtc1,
            codeStr: 'mtc1',
            machineCode: rawCode,
            operands: [rt, fs],
            reads: [rt],
            writes: [fs]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        decomp.setRegister(this.writes[0], decomp.getRegister(this.reads[0]));
        return new Expr.Null();
    }
}

export class mul_s extends Instruction {
    static is(instruction: Instruction): instruction is mul_s {
        return instruction.code === Op.Code.mul_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };
        const fd: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 6, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.mul_s,
            codeStr: 'mul.s',
            machineCode: rawCode,
            operands: [fd, fs, ft],
            reads: [fs, ft],
            writes: [
                fd,
                { type: Reg.Type.COP1, id: Reg.COP1.O },
                { type: Reg.Type.COP1, id: Reg.COP1.U },
                { type: Reg.Type.COP1, id: Reg.COP1.SO },
                { type: Reg.Type.COP1, id: Reg.COP1.SU }
            ]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const fs = decomp.getRegister(this.reads[0]);
        const ft = decomp.getRegister(this.reads[1]);
        const result = new Expr.Mul(fs, ft);

        decomp.setRegister(this.writes[0], result);

        const msg = new Expr.RawString('/* Unimplemented result flag from mul.s instruction */');
        msg.type = 'bool';
        decomp.setRegister(this.writes[1], msg);
        decomp.setRegister(this.writes[2], msg);
        decomp.setRegister(this.writes[3], msg);
        decomp.setRegister(this.writes[4], msg);

        return new Expr.Null();
    }
}

export class mula_s extends Instruction {
    static is(instruction: Instruction): instruction is mula_s {
        return instruction.code === Op.Code.mula_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.mula_s,
            codeStr: 'mula.s',
            machineCode: rawCode,
            operands: [fs, ft],
            reads: [fs, ft],
            writes: [
                { type: Reg.Type.COP1, id: Reg.COP1.ACC },
                { type: Reg.Type.COP1, id: Reg.COP1.O },
                { type: Reg.Type.COP1, id: Reg.COP1.U },
                { type: Reg.Type.COP1, id: Reg.COP1.SO },
                { type: Reg.Type.COP1, id: Reg.COP1.SU }
            ]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const fs = decomp.getRegister(this.reads[0]);
        const ft = decomp.getRegister(this.reads[1]);

        decomp.setRegister(this.writes[0], new Expr.Mul(fs, ft));

        const msg = new Expr.RawString('/* Unimplemented result flag from mula.s instruction */');
        msg.type = 'bool';
        decomp.setRegister(this.writes[1], msg);
        decomp.setRegister(this.writes[2], msg);
        decomp.setRegister(this.writes[3], msg);
        decomp.setRegister(this.writes[4], msg);

        return new Expr.Null();
    }
}

export class neg_s extends Instruction {
    static is(instruction: Instruction): instruction is neg_s {
        return instruction.code === Op.Code.neg_s;
    }

    constructor(address: number, rawCode: number) {
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };
        const fd: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 6, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.neg_s,
            codeStr: 'neg.s',
            machineCode: rawCode,
            operands: [fd, fs],
            reads: [fs],
            writes: [fd, { type: Reg.Type.COP1, id: Reg.COP1.O }, { type: Reg.Type.COP1, id: Reg.COP1.U }]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const fs = decomp.getRegister(this.reads[0]);

        decomp.setRegister(this.writes[0], new Expr.Negate(fs));

        const f = Expr.Imm.bool(false);
        decomp.setRegister(this.writes[1], f);
        decomp.setRegister(this.writes[2], f);

        return new Expr.Null();
    }
}

export class rsqrt_s extends Instruction {
    static is(instruction: Instruction): instruction is rsqrt_s {
        return instruction.code === Op.Code.rsqrt_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };
        const fd: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 6, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.rsqrt_s,
            codeStr: 'rsqrt.s',
            machineCode: rawCode,
            operands: [fd, fs, ft],
            reads: [fs, ft],
            writes: [
                fd,
                { type: Reg.Type.COP1, id: Reg.COP1.I },
                { type: Reg.Type.COP1, id: Reg.COP1.D },
                { type: Reg.Type.COP1, id: Reg.COP1.SI },
                { type: Reg.Type.COP1, id: Reg.COP1.SD }
            ]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const fs = decomp.getRegister(this.reads[0]);
        const ft = decomp.getRegister(this.reads[1]);

        decomp.setRegister(this.writes[0], new Expr.Div(fs, new Expr.Sqrt(ft)));

        const zero = Expr.Imm.f32(0);
        const ftIsNegative = new Expr.IsLess(ft, zero);
        const ftIsZero = new Expr.IsEqual(ft, zero);

        decomp.setRegister(this.writes[1], ftIsNegative);
        decomp.setRegister(this.writes[2], ftIsZero);
        decomp.setRegister(this.writes[3], ftIsNegative);
        decomp.setRegister(this.writes[4], ftIsZero);

        return new Expr.Null();
    }
}

export class sqrt_s extends Instruction {
    static is(instruction: Instruction): instruction is sqrt_s {
        return instruction.code === Op.Code.sqrt_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fd: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 6, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.sqrt_s,
            codeStr: 'sqrt.s',
            machineCode: rawCode,
            operands: [fd, ft],
            reads: [ft],
            writes: [
                fd,
                { type: Reg.Type.COP1, id: Reg.COP1.I },
                { type: Reg.Type.COP1, id: Reg.COP1.D },
                { type: Reg.Type.COP1, id: Reg.COP1.SI }
            ]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const ft = decomp.getRegister(this.reads[0]);

        decomp.setRegister(this.writes[0], new Expr.Sqrt(ft));

        const zero = Expr.Imm.f32(0);
        const ftIsNegative = new Expr.IsLess(ft, zero);

        decomp.setRegister(this.writes[1], ftIsNegative);
        decomp.setRegister(this.writes[2], Expr.Imm.bool(false));
        decomp.setRegister(this.writes[3], ftIsNegative);

        return new Expr.Null();
    }
}

export class sub_s extends Instruction {
    static is(instruction: Instruction): instruction is sub_s {
        return instruction.code === Op.Code.sub_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };
        const fd: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 6, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.sub_s,
            codeStr: 'sub.s',
            machineCode: rawCode,
            operands: [fd, fs, ft],
            reads: [fs, ft],
            writes: [
                fd,
                { type: Reg.Type.COP1, id: Reg.COP1.O },
                { type: Reg.Type.COP1, id: Reg.COP1.U },
                { type: Reg.Type.COP1, id: Reg.COP1.SO },
                { type: Reg.Type.COP1, id: Reg.COP1.SU }
            ]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const result = new Expr.Sub(decomp.getRegister(this.reads[0]), decomp.getRegister(this.reads[1]));

        decomp.setRegister(this.writes[0], result);

        const msg = new Expr.RawString('/* Unimplemented result flag from sub.s instruction */');
        msg.type = 'bool';
        decomp.setRegister(this.writes[1], msg);
        decomp.setRegister(this.writes[2], msg);
        decomp.setRegister(this.writes[3], msg);
        decomp.setRegister(this.writes[4], msg);
        return new Expr.Null();
    }
}

export class suba_s extends Instruction {
    static is(instruction: Instruction): instruction is suba_s {
        return instruction.code === Op.Code.suba_s;
    }

    constructor(address: number, rawCode: number) {
        const ft: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 16, 5) as Reg.COP1 };
        const fs: Reg.Register = { type: Reg.Type.COP1, id: extractBits(rawCode, 11, 5) as Reg.COP1 };

        super({
            address,
            code: Op.Code.suba_s,
            codeStr: 'suba.s',
            machineCode: rawCode,
            operands: [fs, ft],
            reads: [fs, ft],
            writes: [
                { type: Reg.Type.COP1, id: Reg.COP1.ACC },
                { type: Reg.Type.COP1, id: Reg.COP1.O },
                { type: Reg.Type.COP1, id: Reg.COP1.U },
                { type: Reg.Type.COP1, id: Reg.COP1.SO },
                { type: Reg.Type.COP1, id: Reg.COP1.SU }
            ]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const result = new Expr.Sub(decomp.getRegister(this.reads[0]), decomp.getRegister(this.reads[1]));

        decomp.setRegister(this.writes[0], result);

        const msg = new Expr.RawString('/* Unimplemented result flag from suba.s instruction */');
        msg.type = 'bool';
        decomp.setRegister(this.writes[1], msg);
        decomp.setRegister(this.writes[2], msg);
        decomp.setRegister(this.writes[3], msg);
        decomp.setRegister(this.writes[4], msg);
        return new Expr.Null();
    }
}
