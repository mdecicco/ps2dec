import { Decompiler } from 'decompiler';
import { TypeSystem } from 'typesys';

import * as Expr from '../expressions';
import * as Op from '../opcodes';
import * as Reg from '../registers';
import { extractBits } from '../utils';
import { Instruction } from './base';

export class pand extends Instruction {
    static is(instruction: Instruction): instruction is pand {
        return instruction.code === Op.Code.pand;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pand,
            codeStr: 'pand',
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

        decomp.setRegister(this.writes[0], new Expr.BitwiseAnd(lhs, rhs, 128));

        return null;
    }
}

export class pcpyld extends Instruction {
    static is(instruction: Instruction): instruction is pcpyld {
        return instruction.code === Op.Code.pcpyld;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pcpyld,
            codeStr: 'pcpyld',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const a = new Expr.ShiftLeft(decomp.getRegister(this.reads[0]), Expr.Imm.u64(64), 128);
        const b = new Expr.BitwiseAnd(decomp.getRegister(this.reads[1]), Expr.Imm.u64(0xffffffffffffffffn), 128);

        decomp.setRegister(this.writes[0], new Expr.BitwiseOr(a, b, 128));

        return null;
    }
}

export class pdivbw extends Instruction {
    static is(instruction: Instruction): instruction is pdivbw {
        return instruction.code === Op.Code.pdivbw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pdivbw,
            codeStr: 'pdivbw',
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

        const loElems: Expr.Expression[] = [];
        const hiElems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(32);
        let bitIndex = 0;
        for (let i = 0; i < 4; i++) {
            const lhs = new Expr.GetBits(rs, Expr.Imm.u32(bitIndex), elemWidth);
            const rhs = new Expr.GetBits(rt, Expr.Imm.u32(bitIndex), elemWidth);
            const quotient = new Expr.Div(lhs, rhs);
            const remainder = new Expr.Mod(lhs, rhs);
            loElems.push(quotient);
            hiElems.push(remainder);
            bitIndex += 32;
        }

        decomp.setRegister(this.writes[0], new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, loElems));
        decomp.setRegister(this.writes[1], new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, hiElems));

        return null;
    }
}

export class pdivw extends Instruction {
    static is(instruction: Instruction): instruction is pdivw {
        return instruction.code === Op.Code.pdivw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pdivw,
            codeStr: 'pdivw',
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

        const imm64 = Expr.Imm.u64(64);
        const imm128 = Expr.Imm.u64(128);

        const mask = Expr.Imm.u128(0xffffffff);
        const lhsA = new Expr.BitwiseAnd(rs, mask, 128);
        const lhsB = new Expr.BitwiseAnd(new Expr.ShiftRight(rs, imm64, 128), mask, 128);
        const rhsA = new Expr.BitwiseAnd(rt, mask, 128);
        const rhsB = new Expr.BitwiseAnd(new Expr.ShiftRight(rt, imm64, 128), mask, 128);

        const i64 = TypeSystem.get().getType('i64');
        const quotientA = new Expr.PrimitiveCast(new Expr.Div(lhsA, rhsA, false, 32), i64);
        const remainderA = new Expr.PrimitiveCast(new Expr.Mod(lhsA, rhsA, false, 32), i64);
        const quotientB = new Expr.PrimitiveCast(new Expr.Div(lhsB, rhsB, false, 32), i64);
        const remainderB = new Expr.PrimitiveCast(new Expr.Mod(lhsB, rhsB, false, 32), i64);

        decomp.setRegister(this.writes[0], new Expr.ConcatBits(imm128, imm64, [quotientB, quotientA]));
        decomp.setRegister(this.writes[1], new Expr.ConcatBits(imm128, imm64, [remainderB, remainderA]));

        return null;
    }
}

export class pexeh extends Instruction {
    static is(instruction: Instruction): instruction is pexeh {
        return instruction.code === Op.Code.pexeh;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pexeh,
            codeStr: 'pexeh',
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

        let tmp = elems[0];
        elems[0] = elems[2];
        elems[2] = tmp;

        tmp = elems[4];
        elems[4] = elems[6];
        elems[6] = tmp;

        decomp.setRegister(this.writes[0], new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems));

        return null;
    }
}

export class pexew extends Instruction {
    static is(instruction: Instruction): instruction is pexew {
        return instruction.code === Op.Code.pexew;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pexew,
            codeStr: 'pexew',
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

        let tmp = elems[0];
        elems[0] = elems[2];
        elems[2] = tmp;

        decomp.setRegister(this.writes[0], new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems));

        return null;
    }
}

export class phmadh extends Instruction {
    static is(instruction: Instruction): instruction is phmadh {
        return instruction.code === Op.Code.phmadh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.phmadh,
            codeStr: 'phmadh',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const rs = decomp.getRegister(this.reads[0]);
        const rt = decomp.getRegister(this.reads[1]);
        const prevLo = decomp.getRegister(this.writes[1]);
        const prevHi = decomp.getRegister(this.writes[2]);

        const totalWidth = Expr.Imm.u32(128);
        const elemWidth = Expr.Imm.u32(32);
        const extractWidth = Expr.Imm.u32(16);

        const destElems: Expr.Expression[] = [];
        const loElems: Expr.Expression[] = [];
        const hiElems: Expr.Expression[] = [];

        const prod0 = new Expr.Add(
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(16), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(16), extractWidth)
            ),
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(0), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(0), extractWidth)
            ),
            false,
            32
        );
        const prod1 = new Expr.Add(
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(48), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(48), extractWidth)
            ),
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(32), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(32), extractWidth)
            ),
            false,
            32
        );
        const prod2 = new Expr.Add(
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(80), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(80), extractWidth)
            ),
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(64), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(64), extractWidth)
            ),
            false,
            32
        );
        const prod3 = new Expr.Add(
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(112), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(112), extractWidth)
            ),
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(96), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(96), extractWidth)
            ),
            false,
            32
        );

        destElems.push(prod0);
        destElems.push(prod1);
        destElems.push(prod2);
        destElems.push(prod3);

        loElems.push(prod0);
        loElems.push(new Expr.GetBits(prevLo, Expr.Imm.u32(32), Expr.Imm.u32(32)));
        loElems.push(prod2);
        loElems.push(new Expr.GetBits(prevLo, Expr.Imm.u32(96), Expr.Imm.u32(32)));

        hiElems.push(prod1);
        hiElems.push(new Expr.GetBits(prevHi, Expr.Imm.u32(32), Expr.Imm.u32(32)));
        hiElems.push(prod3);
        hiElems.push(new Expr.GetBits(prevHi, Expr.Imm.u32(96), Expr.Imm.u32(32)));

        decomp.setRegister(this.writes[0], new Expr.ConcatBits(totalWidth, elemWidth, destElems));
        decomp.setRegister(this.writes[1], new Expr.ConcatBits(totalWidth, elemWidth, loElems));
        decomp.setRegister(this.writes[2], new Expr.ConcatBits(totalWidth, elemWidth, hiElems));

        return null;
    }
}

export class phmsbh extends Instruction {
    static is(instruction: Instruction): instruction is phmsbh {
        return instruction.code === Op.Code.phmsbh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.phmsbh,
            codeStr: 'phmsbh',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const rs = decomp.getRegister(this.reads[0]);
        const rt = decomp.getRegister(this.reads[1]);
        const prevLo = decomp.getRegister(this.writes[1]);
        const prevHi = decomp.getRegister(this.writes[2]);

        const totalWidth = Expr.Imm.u32(128);
        const elemWidth = Expr.Imm.u32(32);
        const extractWidth = Expr.Imm.u32(16);

        const destElems: Expr.Expression[] = [];
        const loElems: Expr.Expression[] = [];
        const hiElems: Expr.Expression[] = [];

        const prod0 = new Expr.Sub(
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(16), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(16), extractWidth)
            ),
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(0), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(0), extractWidth)
            ),
            false,
            32
        );
        const prod1 = new Expr.Sub(
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(48), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(48), extractWidth)
            ),
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(32), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(32), extractWidth)
            ),
            false,
            32
        );
        const prod2 = new Expr.Sub(
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(80), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(80), extractWidth)
            ),
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(64), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(64), extractWidth)
            ),
            false,
            32
        );
        const prod3 = new Expr.Sub(
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(112), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(112), extractWidth)
            ),
            new Expr.Mul(
                new Expr.GetBits(rs, Expr.Imm.u32(96), extractWidth),
                new Expr.GetBits(rt, Expr.Imm.u32(96), extractWidth)
            ),
            false,
            32
        );

        destElems.push(prod0);
        destElems.push(prod1);
        destElems.push(prod2);
        destElems.push(prod3);

        loElems.push(prod0);
        loElems.push(new Expr.GetBits(prevLo, Expr.Imm.u32(32), Expr.Imm.u32(32)));
        loElems.push(prod2);
        loElems.push(new Expr.GetBits(prevLo, Expr.Imm.u32(96), Expr.Imm.u32(32)));

        hiElems.push(prod1);
        hiElems.push(new Expr.GetBits(prevHi, Expr.Imm.u32(32), Expr.Imm.u32(32)));
        hiElems.push(prod3);
        hiElems.push(new Expr.GetBits(prevHi, Expr.Imm.u32(96), Expr.Imm.u32(32)));

        decomp.setRegister(this.writes[0], new Expr.ConcatBits(totalWidth, elemWidth, destElems));
        decomp.setRegister(this.writes[1], new Expr.ConcatBits(totalWidth, elemWidth, loElems));
        decomp.setRegister(this.writes[2], new Expr.ConcatBits(totalWidth, elemWidth, hiElems));

        return null;
    }
}

export class pinth extends Instruction {
    static is(instruction: Instruction): instruction is pinth {
        return instruction.code === Op.Code.pinth;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pinth,
            codeStr: 'pinth',
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
        for (let bitIdx = 0; bitIdx < 64; bitIdx += 16) {
            const byteA = new Expr.GetBits(rs, Expr.Imm.u32(64 + bitIdx), elemWidth);
            const byteB = new Expr.GetBits(rt, Expr.Imm.u32(bitIdx), elemWidth);

            elems.push(byteB, byteA);
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return null;
    }
}

export class pmaddh extends Instruction {
    static is(instruction: Instruction): instruction is pmaddh {
        return instruction.code === Op.Code.pmaddh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pmaddh,
            codeStr: 'pmaddh',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('pmaddh not implemented');
    }
}

export class pmaddw extends Instruction {
    static is(instruction: Instruction): instruction is pmaddw {
        return instruction.code === Op.Code.pmaddw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pmaddw,
            codeStr: 'pmaddw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('pmaddw not implemented');
    }
}

export class pmfhi extends Instruction {
    static is(instruction: Instruction): instruction is pmfhi {
        return instruction.code === Op.Code.pmfhi;
    }

    constructor(address: number, rawCode: number) {
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pmfhi,
            codeStr: 'pmfhi',
            machineCode: rawCode,
            operands: [rd],
            reads: [{ type: Reg.Type.EE, id: Reg.EE.HI }],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        decomp.setRegister(this.writes[0], decomp.getRegister(this.reads[0]));
        return null;
    }
}

export class pmflo extends Instruction {
    static is(instruction: Instruction): instruction is pmflo {
        return instruction.code === Op.Code.pmflo;
    }

    constructor(address: number, rawCode: number) {
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pmflo,
            codeStr: 'pmflo',
            machineCode: rawCode,
            operands: [rd],
            reads: [{ type: Reg.Type.EE, id: Reg.EE.LO }],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        decomp.setRegister(this.writes[0], decomp.getRegister(this.reads[0]));
        return null;
    }
}

export class pmsubh extends Instruction {
    static is(instruction: Instruction): instruction is pmsubh {
        return instruction.code === Op.Code.pmsubh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pmsubh,
            codeStr: 'pmsubh',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('pmsubh not implemented');
    }
}

export class pmsubw extends Instruction {
    static is(instruction: Instruction): instruction is pmsubw {
        return instruction.code === Op.Code.pmsubw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pmsubw,
            codeStr: 'pmsubw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('pmsubw not implemented');
    }
}

export class pmulth extends Instruction {
    static is(instruction: Instruction): instruction is pmulth {
        return instruction.code === Op.Code.pmulth;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pmulth,
            codeStr: 'pmulth',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('pmulth not implemented');
    }
}

export class pmultw extends Instruction {
    static is(instruction: Instruction): instruction is pmultw {
        return instruction.code === Op.Code.pmultw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pmultw,
            codeStr: 'pmultw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('pmultw not implemented');
    }
}

export class prevh extends Instruction {
    static is(instruction: Instruction): instruction is prevh {
        return instruction.code === Op.Code.prevh;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.prevh,
            codeStr: 'prevh',
            machineCode: rawCode,
            operands: [rd, rt],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('prevh not implemented');
    }
}

export class prot3w extends Instruction {
    static is(instruction: Instruction): instruction is prot3w {
        return instruction.code === Op.Code.prot3w;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.prot3w,
            codeStr: 'prot3w',
            machineCode: rawCode,
            operands: [rd, rt],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('prot3w not implemented');
    }
}

export class psllvw extends Instruction {
    static is(instruction: Instruction): instruction is psllvw {
        return instruction.code === Op.Code.psllvw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.psllvw,
            codeStr: 'psllvw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('psllvw not implemented');
    }
}

export class psrlvw extends Instruction {
    static is(instruction: Instruction): instruction is psrlvw {
        return instruction.code === Op.Code.psrlvw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.psrlvw,
            codeStr: 'psrlvw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('psrlvw not implemented');
    }
}

export class pxor extends Instruction {
    static is(instruction: Instruction): instruction is pxor {
        return instruction.code === Op.Code.pxor;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pxor,
            codeStr: 'pxor',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('pxor not implemented');
    }
}
