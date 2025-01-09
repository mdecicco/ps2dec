import { Decompiler, TypeSystem } from 'decompiler';
import * as Expr from '../expressions';
import * as Op from '../opcodes';
import * as Reg from '../registers';
import { extractBits } from '../utils';
import { Instruction } from './base';

export class pcpyh extends Instruction {
    static is(instruction: Instruction): instruction is pcpyh {
        return instruction.code === Op.Code.pcpyh;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pcpyh,
            codeStr: 'pcpyh',
            machineCode: rawCode,
            operands: [rd, rt],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const v = decomp.getRegister(this.reads[0]);
        const elemWidth = Expr.Imm.u32(16);
        const first = new Expr.GetBits(v, Expr.Imm.u32(0), elemWidth);
        const second = new Expr.GetBits(v, Expr.Imm.u32(64), elemWidth);
        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, [
            first,
            first,
            first,
            first,
            second,
            second,
            second,
            second
        ]);

        decomp.setRegister(this.writes[0], finalValue);

        return null;
    }
}

export class pcpyud extends Instruction {
    static is(instruction: Instruction): instruction is pcpyud {
        return instruction.code === Op.Code.pcpyud;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pcpyud,
            codeStr: 'pcpyud',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const a = new Expr.ShiftRight(decomp.getRegister(this.reads[0]), Expr.Imm.u32(64), 128);
        const b = new Expr.BitwiseAnd(
            decomp.getRegister(this.reads[1]),
            Expr.Imm.u64(0xffffffffffffffff0000000000000000n),
            128
        );

        decomp.setRegister(this.writes[0], new Expr.BitwiseOr(a, b, 128));

        return null;
    }
}

export class pdivuw extends Instruction {
    static is(instruction: Instruction): instruction is pdivuw {
        return instruction.code === Op.Code.pdivuw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pdivuw,
            codeStr: 'pdivuw',
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
        const rs = decomp.getRegister(this.reads[0]);
        const rt = decomp.getRegister(this.reads[1]);

        const imm64 = Expr.Imm.u32(64);
        const imm128 = Expr.Imm.u32(128);

        const mask = Expr.Imm.u32(0xffffffff);
        const lhsA = new Expr.BitwiseAnd(rs, mask, 128);
        const lhsB = new Expr.BitwiseAnd(new Expr.ShiftRight(rs, imm64, 128), mask, 128);
        const rhsA = new Expr.BitwiseAnd(rt, mask, 128);
        const rhsB = new Expr.BitwiseAnd(new Expr.ShiftRight(rt, imm64, 128), mask, 128);

        const u64 = TypeSystem.get().getType('u64');
        const quotientA = new Expr.PrimitiveCast(new Expr.Div(lhsA, rhsA, true, 32), u64);
        const remainderA = new Expr.PrimitiveCast(new Expr.Mod(lhsA, rhsA, true, 32), u64);
        const quotientB = new Expr.PrimitiveCast(new Expr.Div(lhsB, rhsB, true, 32), u64);
        const remainderB = new Expr.PrimitiveCast(new Expr.Mod(lhsB, rhsB, true, 32), u64);

        decomp.setRegister(this.writes[0], new Expr.ConcatBits(imm128, imm64, [quotientB, quotientA]));
        decomp.setRegister(this.writes[1], new Expr.ConcatBits(imm128, imm64, [remainderB, remainderA]));

        return null;
    }
}

export class pexch extends Instruction {
    static is(instruction: Instruction): instruction is pexch {
        return instruction.code === Op.Code.pexch;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pexch,
            codeStr: 'pexch',
            machineCode: rawCode,
            operands: [rd, rt],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const rt = decomp.getRegister(this.reads[0]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(16);
        let bitIndex = 0;
        for (let i = 0; i < 8; i++) {
            const hw = new Expr.GetBits(rt, Expr.Imm.u32(bitIndex), elemWidth);
            elems.push(hw);
            bitIndex += 16;
        }

        let tmp = elems[1];
        elems[1] = elems[2];
        elems[2] = tmp;

        tmp = elems[5];
        elems[5] = elems[6];
        elems[6] = tmp;

        decomp.setRegister(this.writes[0], new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems));

        return null;
    }
}

export class pexcw extends Instruction {
    static is(instruction: Instruction): instruction is pexcw {
        return instruction.code === Op.Code.pexcw;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pexcw,
            codeStr: 'pexcw',
            machineCode: rawCode,
            operands: [rd, rt],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const rt = decomp.getRegister(this.reads[0]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(32);
        let bitIndex = 0;
        for (let i = 0; i < 4; i++) {
            const hw = new Expr.GetBits(rt, Expr.Imm.u32(bitIndex), elemWidth);
            elems.push(hw);
            bitIndex += 32;
        }

        let tmp = elems[1];
        elems[1] = elems[2];
        elems[2] = tmp;

        decomp.setRegister(this.writes[0], new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems));

        return null;
    }
}

export class pinteh extends Instruction {
    static is(instruction: Instruction): instruction is pinteh {
        return instruction.code === Op.Code.pinteh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pinteh,
            codeStr: 'pinteh',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const rs = decomp.getRegister(this.reads[0]);
        const rt = decomp.getRegister(this.reads[1]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(16);
        for (let i = 0; i < 128; i += 32) {
            const bitIdx = Expr.Imm.u32(i);
            const byteA = new Expr.GetBits(rs, bitIdx, elemWidth);
            const byteB = new Expr.GetBits(rt, bitIdx, elemWidth);

            elems.push(byteB, byteA);
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return null;
    }
}

export class pmadduw extends Instruction {
    static is(instruction: Instruction): instruction is pmadduw {
        return instruction.code === Op.Code.pmadduw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pmadduw,
            codeStr: 'pmadduw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('pmadduw not implemented');
    }
}

export class pmthi extends Instruction {
    static is(instruction: Instruction): instruction is pmthi {
        return instruction.code === Op.Code.pmthi;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pmthi,
            codeStr: 'pmthi',
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

export class pmtlo extends Instruction {
    static is(instruction: Instruction): instruction is pmtlo {
        return instruction.code === Op.Code.pmtlo;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pmtlo,
            codeStr: 'pmtlo',
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

export class pmultuw extends Instruction {
    static is(instruction: Instruction): instruction is pmultuw {
        return instruction.code === Op.Code.pmultuw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pmultuw,
            codeStr: 'pmultuw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('pmultuw not implemented');
    }
}

export class pnor extends Instruction {
    static is(instruction: Instruction): instruction is pnor {
        return instruction.code === Op.Code.pnor;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pnor,
            codeStr: 'pnor',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('pnor not implemented');
    }
}

export class por extends Instruction {
    static is(instruction: Instruction): instruction is por {
        return instruction.code === Op.Code.por;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.por,
            codeStr: 'por',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('por not implemented');
    }
}

export class psravw extends Instruction {
    static is(instruction: Instruction): instruction is psravw {
        return instruction.code === Op.Code.psravw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.psravw,
            codeStr: 'psravw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('psravw not implemented');
    }
}
