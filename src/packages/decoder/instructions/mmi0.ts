import { Decompiler } from 'decompiler';

import * as Expr from '../expressions';
import * as Op from '../opcodes';
import * as Reg from '../registers';
import { extractBits } from '../utils';
import { Instruction } from './base';

export class paddb extends Instruction {
    static is(instruction: Instruction): instruction is paddb {
        return instruction.code === Op.Code.paddb;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.paddb,
            codeStr: 'paddb',
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

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(8);
        let bitIndex = 0;
        for (let i = 0; i < 16; i++) {
            elems.push(
                new Expr.Add(
                    new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                    new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth),
                    false,
                    8
                )
            );
            bitIndex += 8;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return null;
    }
}

export class paddh extends Instruction {
    static is(instruction: Instruction): instruction is paddh {
        return instruction.code === Op.Code.paddh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.paddh,
            codeStr: 'paddh',
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

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(16);
        let bitIndex = 0;
        for (let i = 0; i < 8; i++) {
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

        return null;
    }
}

export class paddsb extends Instruction {
    static is(instruction: Instruction): instruction is paddsb {
        return instruction.code === Op.Code.paddsb;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.paddsb,
            codeStr: 'paddsb',
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

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(8);
        const min = Expr.Imm.i32(-128);
        const max = Expr.Imm.i32(127);
        let bitIndex = 0;
        for (let i = 0; i < 16; i++) {
            elems.push(
                new Expr.Clamp(
                    new Expr.Add(
                        new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                        new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth),
                        false
                    ),
                    min,
                    max
                )
            );
            bitIndex += 8;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return null;
    }
}

export class paddsh extends Instruction {
    static is(instruction: Instruction): instruction is paddsh {
        return instruction.code === Op.Code.paddsh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.paddsh,
            codeStr: 'paddsh',
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

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(16);
        const min = Expr.Imm.i32(-32768);
        const max = Expr.Imm.i32(32767);
        let bitIndex = 0;
        for (let i = 0; i < 8; i++) {
            elems.push(
                new Expr.Clamp(
                    new Expr.Add(
                        new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                        new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth),
                        false
                    ),
                    min,
                    max
                )
            );
            bitIndex += 16;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return null;
    }
}

export class paddsw extends Instruction {
    static is(instruction: Instruction): instruction is paddsw {
        return instruction.code === Op.Code.paddsw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.paddsw,
            codeStr: 'paddsw',
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

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(32);
        const min = Expr.Imm.i32(-2147483648);
        const max = Expr.Imm.i32(2147483647);
        let bitIndex = 0;
        for (let i = 0; i < 4; i++) {
            elems.push(
                new Expr.Clamp(
                    new Expr.Add(
                        new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                        new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth),
                        false,
                        64
                    ),
                    min,
                    max
                )
            );
            bitIndex += 32;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return null;
    }
}

export class paddw extends Instruction {
    static is(instruction: Instruction): instruction is paddw {
        return instruction.code === Op.Code.paddw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.paddw,
            codeStr: 'paddw',
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

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(32);
        let bitIndex = 0;
        for (let i = 0; i < 4; i++) {
            elems.push(
                new Expr.Add(
                    new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                    new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth),
                    false
                )
            );
            bitIndex += 32;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return null;
    }
}

export class pcgtb extends Instruction {
    static is(instruction: Instruction): instruction is pcgtb {
        return instruction.code === Op.Code.pcgtb;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pcgtb,
            codeStr: 'pcgtb',
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

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(8);
        const truthy = Expr.Imm.u32(0xff);
        const falsy = Expr.Imm.u32(0x00);
        let bitIndex = 0;
        for (let i = 0; i < 16; i++) {
            const cond = new Expr.IsGreater(
                new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth)
            );
            elems.push(new Expr.Ternary(cond, truthy, falsy));
            bitIndex += 8;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return null;
    }
}

export class pcgth extends Instruction {
    static is(instruction: Instruction): instruction is pcgth {
        return instruction.code === Op.Code.pcgth;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pcgth,
            codeStr: 'pcgth',
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

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(16);
        const truthy = Expr.Imm.u32(0xffff);
        const falsy = Expr.Imm.u32(0x0000);
        let bitIndex = 0;
        for (let i = 0; i < 8; i++) {
            const cond = new Expr.IsGreater(
                new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth)
            );
            elems.push(new Expr.Ternary(cond, truthy, falsy));
            bitIndex += 16;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return null;
    }
}

export class pcgtw extends Instruction {
    static is(instruction: Instruction): instruction is pcgtw {
        return instruction.code === Op.Code.pcgtw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pcgtw,
            codeStr: 'pcgtw',
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

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(32);
        const truthy = Expr.Imm.u32(0xffffffff);
        const falsy = Expr.Imm.u32(0x00000000);
        let bitIndex = 0;
        for (let i = 0; i < 4; i++) {
            const cond = new Expr.IsGreater(
                new Expr.GetBits(lhs, Expr.Imm.u32(bitIndex), elemWidth),
                new Expr.GetBits(rhs, Expr.Imm.u32(bitIndex), elemWidth)
            );
            elems.push(new Expr.Ternary(cond, truthy, falsy));
            bitIndex += 32;
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return null;
    }
}

export class pext5 extends Instruction {
    static is(instruction: Instruction): instruction is pext5 {
        return instruction.code === Op.Code.pext5;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pext5,
            codeStr: 'pext5',
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
        const compWidth = Expr.Imm.u32(5);
        const compShift = Expr.Imm.u32(2);
        const finalBitWidth = Expr.Imm.u32(1);
        const finalBitShift = Expr.Imm.u32(7);
        const expandedCompWidth = Expr.Imm.u32(8);

        for (let bitIndex = 0; bitIndex < 128; bitIndex += 32) {
            const comps: Expr.Expression[] = [];
            for (let cb = 0; cb < 15; cb += 5) {
                comps.push(
                    new Expr.ShiftLeft(new Expr.GetBits(rt, Expr.Imm.u32(bitIndex + cb), compWidth), compShift, 8)
                );
            }

            comps.push(
                new Expr.ShiftLeft(new Expr.GetBits(rt, Expr.Imm.u32(bitIndex + 15), finalBitWidth), finalBitShift, 8)
            );

            elems.push(new Expr.ConcatBits(elemWidth, expandedCompWidth, comps));
        }

        decomp.setRegister(this.writes[0], new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems));

        return null;
    }
}

export class pextlb extends Instruction {
    static is(instruction: Instruction): instruction is pextlb {
        return instruction.code === Op.Code.pextlb;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pextlb,
            codeStr: 'pextlb',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const a = decomp.getRegister(this.reads[0]);
        const b = decomp.getRegister(this.reads[1]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(8);
        for (let i = 0; i < 64; i += 8) {
            const bitIdx = Expr.Imm.u32(i);
            const byteA = new Expr.GetBits(a, bitIdx, elemWidth);
            const byteB = new Expr.GetBits(b, bitIdx, elemWidth);

            elems.push(byteB, byteA);
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return null;
    }
}

export class pextlh extends Instruction {
    static is(instruction: Instruction): instruction is pextlh {
        return instruction.code === Op.Code.pextlh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pextlh,
            codeStr: 'pextlh',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const a = decomp.getRegister(this.reads[0]);
        const b = decomp.getRegister(this.reads[1]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(16);
        for (let i = 0; i < 64; i += 16) {
            const bitIdx = Expr.Imm.u32(i);
            const byteA = new Expr.GetBits(a, bitIdx, elemWidth);
            const byteB = new Expr.GetBits(b, bitIdx, elemWidth);

            elems.push(byteB, byteA);
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return null;
    }
}

export class pextlw extends Instruction {
    static is(instruction: Instruction): instruction is pextlw {
        return instruction.code === Op.Code.pextlw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pextlw,
            codeStr: 'pextlw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const a = decomp.getRegister(this.reads[0]);
        const b = decomp.getRegister(this.reads[1]);

        const elems: Expr.Expression[] = [];
        const elemWidth = Expr.Imm.u32(32);
        for (let i = 0; i < 64; i += 32) {
            const bitIdx = Expr.Imm.u32(i);
            const byteA = new Expr.GetBits(a, bitIdx, elemWidth);
            const byteB = new Expr.GetBits(b, bitIdx, elemWidth);

            elems.push(byteB, byteA);
        }

        const finalValue = new Expr.ConcatBits(Expr.Imm.u32(128), elemWidth, elems);

        decomp.setRegister(this.writes[0], finalValue);

        return null;
    }
}

export class pmaxh extends Instruction {
    static is(instruction: Instruction): instruction is pmaxh {
        return instruction.code === Op.Code.pmaxh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pmaxh,
            codeStr: 'pmaxh',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('pmaxh not implemented');
    }
}

export class pmaxw extends Instruction {
    static is(instruction: Instruction): instruction is pmaxw {
        return instruction.code === Op.Code.pmaxw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.pmaxw,
            codeStr: 'pmaxw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd, { type: Reg.Type.EE, id: Reg.EE.LO }, { type: Reg.Type.EE, id: Reg.EE.HI }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('pmaxw not implemented');
    }
}

export class ppac5 extends Instruction {
    static is(instruction: Instruction): instruction is ppac5 {
        return instruction.code === Op.Code.ppac5;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.ppac5,
            codeStr: 'ppac5',
            machineCode: rawCode,
            operands: [rd, rt],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('ppac5 not implemented');
    }
}

export class ppacb extends Instruction {
    static is(instruction: Instruction): instruction is ppacb {
        return instruction.code === Op.Code.ppacb;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.ppacb,
            codeStr: 'ppacb',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('ppacb not implemented');
    }
}

export class ppach extends Instruction {
    static is(instruction: Instruction): instruction is ppach {
        return instruction.code === Op.Code.ppach;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.ppach,
            codeStr: 'ppach',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('ppach not implemented');
    }
}

export class ppacw extends Instruction {
    static is(instruction: Instruction): instruction is ppacw {
        return instruction.code === Op.Code.ppacw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.ppacw,
            codeStr: 'ppacw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('ppacw not implemented');
    }
}

export class psubb extends Instruction {
    static is(instruction: Instruction): instruction is psubb {
        return instruction.code === Op.Code.psubb;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.psubb,
            codeStr: 'psubb',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('psubb not implemented');
    }
}

export class psubh extends Instruction {
    static is(instruction: Instruction): instruction is psubh {
        return instruction.code === Op.Code.psubh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.psubh,
            codeStr: 'psubh',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('psubh not implemented');
    }
}

export class psubsb extends Instruction {
    static is(instruction: Instruction): instruction is psubsb {
        return instruction.code === Op.Code.psubsb;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.psubsb,
            codeStr: 'psubsb',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('psubsb not implemented');
    }
}

export class psubsh extends Instruction {
    static is(instruction: Instruction): instruction is psubsh {
        return instruction.code === Op.Code.psubsh;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.psubsh,
            codeStr: 'psubsh',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('psubsh not implemented');
    }
}

export class psubsw extends Instruction {
    static is(instruction: Instruction): instruction is psubsw {
        return instruction.code === Op.Code.psubsw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.psubsw,
            codeStr: 'psubsw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('psubsw not implemented');
    }
}

export class psubw extends Instruction {
    static is(instruction: Instruction): instruction is psubw {
        return instruction.code === Op.Code.psubw;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 11, 5) as Reg.EE };

        super({
            address,
            code: Op.Code.psubw,
            codeStr: 'psubw',
            machineCode: rawCode,
            operands: [rd, rs, rt],
            reads: [rs, rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.RawString('psubw not implemented');
    }
}
