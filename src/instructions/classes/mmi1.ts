import { extractBits } from 'decoder/utils';
import { Decompiler } from 'decompiler';
import * as Expr from 'decompiler/expr';
import { Op, Reg } from 'types';
import { Instruction } from './base';

export class pabsh extends Instruction {
    static is(instruction: Instruction): instruction is pabsh {
        return instruction.code === Op.Code.pabsh;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pabsh,
            codeStr: 'pabsh',
            machineCode: rawCode,
            operands: [rd, rt],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const v = decomp.getRegister(this.reads[0]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(16);
        let bitIndex = 0;
        for (let i = 0; i < 8; i++) {
            elems.push(new Expr.Abs(new Expr.GetBits(v, Expr.Imm.u32(bitIndex), elemWidth)));
            bitIndex += 16;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return new Expr.Null();
    }
}

export class pabsw extends Instruction {
    static is(instruction: Instruction): instruction is pabsw {
        return instruction.code === Op.Code.pabsw;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pabsw,
            codeStr: 'pabsw',
            machineCode: rawCode,
            operands: [rd, rt],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const v = decomp.getRegister(this.reads[0]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(32);
        let bitIndex = 0;
        for (let i = 0; i < 4; i++) {
            elems.push(new Expr.Abs(new Expr.GetBits(v, Expr.Imm.u32(bitIndex), elemWidth)));
            bitIndex += 32;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return new Expr.Null();
    }
}

export class paddub extends Instruction {
    static is(instruction: Instruction): instruction is paddub {
        return instruction.code === Op.Code.paddub;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.paddub,
            codeStr: 'paddub',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(8);
        const max = Expr.Imm.u32(0xff);
        let bitIndex = 0;
        for (let i = 0; i < 16; i++) {
            elems.push(
                new Expr.Min([
                    new Expr.Add(
                        new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                        new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth),
                        true
                    ),
                    max
                ])
            );
            bitIndex += 8;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return new Expr.Null();
    }
}

export class padduh extends Instruction {
    static is(instruction: Instruction): instruction is padduh {
        return instruction.code === Op.Code.padduh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.padduh,
            codeStr: 'padduh',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(16);
        const max = Expr.Imm.u32(0xffff);
        let bitIndex = 0;
        for (let i = 0; i < 8; i++) {
            elems.push(
                new Expr.Min([
                    new Expr.Add(
                        new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                        new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth),
                        true
                    ),
                    max
                ])
            );
            bitIndex += 16;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return new Expr.Null();
    }
}

export class padduw extends Instruction {
    static is(instruction: Instruction): instruction is padduw {
        return instruction.code === Op.Code.padduw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.padduw,
            codeStr: 'padduw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(32);
        const max = Expr.Imm.u64(0xffffffff);
        let bitIndex = 0;
        for (let i = 0; i < 4; i++) {
            elems.push(
                new Expr.Min([
                    new Expr.Add(
                        new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                        new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth),
                        true,
                        64
                    ),
                    max
                ])
            );
            bitIndex += 32;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return new Expr.Null();
    }
}

export class padsbh extends Instruction {
    static is(instruction: Instruction): instruction is padsbh {
        return instruction.code === Op.Code.padsbh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.padsbh,
            codeStr: 'padsbh',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(16);
        let bitIndex = 0;
        for (let i = 0; i < 4; i++) {
            elems.push(
                new Expr.Sub(
                    new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                    new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth),
                    false,
                    16
                )
            );
            bitIndex += 16;
        }

        for (let i = 0; i < 4; i++) {
            elems.push(
                new Expr.Add(
                    new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                    new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth),
                    false,
                    16
                )
            );
            bitIndex += 16;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return new Expr.Null();
    }
}

export class pceqb extends Instruction {
    static is(instruction: Instruction): instruction is pceqb {
        return instruction.code === Op.Code.pceqb;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pceqb,
            codeStr: 'pceqb',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(8);
        const truthy = Expr.Imm.u32(0xff);
        const falsy = Expr.Imm.u32(0x00);
        let bitIndex = 0;
        for (let i = 0; i < 16; i++) {
            const cond = new Expr.IsEqual(
                new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth)
            );
            elems.push(new Expr.Ternary(cond, truthy, falsy));
            bitIndex += 8;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return new Expr.Null();
    }
}

export class pceqh extends Instruction {
    static is(instruction: Instruction): instruction is pceqh {
        return instruction.code === Op.Code.pceqh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pceqh,
            codeStr: 'pceqh',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(16);
        const truthy = Expr.Imm.u32(0xffff);
        const falsy = Expr.Imm.u32(0x0000);
        let bitIndex = 0;
        for (let i = 0; i < 8; i++) {
            const cond = new Expr.IsEqual(
                new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth)
            );
            elems.push(new Expr.Ternary(cond, truthy, falsy));
            bitIndex += 16;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return new Expr.Null();
    }
}

export class pceqw extends Instruction {
    static is(instruction: Instruction): instruction is pceqw {
        return instruction.code === Op.Code.pceqw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pceqw,
            codeStr: 'pceqw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = decomp.getRegister(this.reads[0]);
        const rhs = decomp.getRegister(this.reads[1]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(32);
        const truthy = Expr.Imm.u64(0xffffffff);
        const falsy = Expr.Imm.u64(0x00000000);
        let bitIndex = 0;
        for (let i = 0; i < 4; i++) {
            const cond = new Expr.IsEqual(
                new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth)
            );
            elems.push(new Expr.Ternary(cond, truthy, falsy));
            bitIndex += 32;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return new Expr.Null();
    }
}

export class pextub extends Instruction {
    static is(instruction: Instruction): instruction is pextub {
        return instruction.code === Op.Code.pextub;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pextub,
            codeStr: 'pextub',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const a = decomp.getRegister(this.reads[0]);
        const b = decomp.getRegister(this.reads[1]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(8);
        for (let i = 64; i < 128; i += 8) {
            const bitIdx = Expr.Imm.u32(i);
            const byteA = new Expr.GetBits(a, bitIdx, elemWidth);
            const byteB = new Expr.GetBits(b, bitIdx, elemWidth);

            elems.push(byteB, byteA);
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return new Expr.Null();
    }
}

export class pextuh extends Instruction {
    static is(instruction: Instruction): instruction is pextuh {
        return instruction.code === Op.Code.pextuh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pextuh,
            codeStr: 'pextuh',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const a = decomp.getRegister(this.reads[0]);
        const b = decomp.getRegister(this.reads[1]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(16);
        for (let i = 64; i < 128; i += 16) {
            const bitIdx = Expr.Imm.u32(i);
            const byteA = new Expr.GetBits(a, bitIdx, elemWidth);
            const byteB = new Expr.GetBits(b, bitIdx, elemWidth);

            elems.push(byteB, byteA);
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return new Expr.Null();
    }
}

export class pextuw extends Instruction {
    static is(instruction: Instruction): instruction is pextuw {
        return instruction.code === Op.Code.pextuw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pextuw,
            codeStr: 'pextuw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const a = decomp.getRegister(this.reads[0]);
        const b = decomp.getRegister(this.reads[1]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(32);
        for (let i = 64; i < 128; i += 32) {
            const bitIdx = Expr.Imm.u32(i);
            const byteA = new Expr.GetBits(a, bitIdx, elemWidth);
            const byteB = new Expr.GetBits(b, bitIdx, elemWidth);

            elems.push(byteB, byteA);
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return new Expr.Null();
    }
}

export class pminh extends Instruction {
    static is(instruction: Instruction): instruction is pminh {
        return instruction.code === Op.Code.pminh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pminh,
            codeStr: 'pminh',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression {
        return new Expr.RawString('pminh not implemented');
    }
}

export class pminw extends Instruction {
    static is(instruction: Instruction): instruction is pminw {
        return instruction.code === Op.Code.pminw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pminw,
            codeStr: 'pminw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression {
        return new Expr.RawString('pminw not implemented');
    }
}

export class psubub extends Instruction {
    static is(instruction: Instruction): instruction is psubub {
        return instruction.code === Op.Code.psubub;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.psubub,
            codeStr: 'psubub',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        return new Expr.RawString('psubub not implemented');
    }
}

export class psubuh extends Instruction {
    static is(instruction: Instruction): instruction is psubuh {
        return instruction.code === Op.Code.psubuh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.psubuh,
            codeStr: 'psubuh',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        return new Expr.RawString('psubuh not implemented');
    }
}

export class psubuw extends Instruction {
    static is(instruction: Instruction): instruction is psubuw {
        return instruction.code === Op.Code.psubuw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.psubuw,
            codeStr: 'psubuw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        return new Expr.RawString('psubuw not implemented');
    }
}

export class qfsrv extends Instruction {
    static is(instruction: Instruction): instruction is qfsrv {
        return instruction.code === Op.Code.qfsrv;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.qfsrv,
            codeStr: 'qfsrv',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt, { type: Reg.Type.EE, id: Reg.EE.SA }],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression {
        return new Expr.RawString('qfsrv not implemented');
    }
}
