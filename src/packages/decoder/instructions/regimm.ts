import { Decompiler, Expr } from 'decompiler';
import * as Op from '../opcodes';
import * as Reg from '../registers';
import { branchTarget, extractBits, extractSignedBits } from '../utils';
import { Instruction } from './base';

export class bgez extends Instruction {
    static is(instruction: Instruction): instruction is bgez {
        return instruction.code === Op.Code.bgez;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bgez,
            codeStr: 'bgez',
            machineCode: rawCode,
            operands: [rs, target],
            reads: [rs],
            writes: [],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.i32(0);

        const cond = new Expr.IsGreaterOrEqual(lhs, rhs);
        const expr = new Expr.ConditionalBranch(cond, this.operands[2] as number);
        return expr;
    }
}

export class bgezal extends Instruction {
    static is(instruction: Instruction): instruction is bgezal {
        return instruction.code === Op.Code.bgezal;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bgezal,
            codeStr: 'bgezal',
            machineCode: rawCode,
            operands: [rs, target],
            reads: [rs],
            writes: [{ type: Reg.Type.EE, id: Reg.EE.RA }],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.i32(0);
        const returnAddress = Expr.Imm.u32(this.address + 8);

        const cond = new Expr.IsGreaterOrEqual(lhs, rhs);
        decomp.setRegister(this.writes[0], returnAddress);

        const expr = new Expr.ConditionalBranch(cond, this.operands[2] as number);
        return expr;
    }
}

export class bgezall extends Instruction {
    static is(instruction: Instruction): instruction is bgezall {
        return instruction.code === Op.Code.bgezall;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bgezall,
            codeStr: 'bgezall',
            machineCode: rawCode,
            operands: [rs, target],
            reads: [rs],
            writes: [{ type: Reg.Type.EE, id: Reg.EE.RA }],
            isBranch: true,
            isLikelyBranch: true
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.i32(0);
        const returnAddress = Expr.Imm.u32(this.address + 8);

        const cond = new Expr.IsGreaterOrEqual(lhs, rhs);
        decomp.setRegister(this.writes[0], returnAddress);

        const expr = new Expr.ConditionalBranch(cond, this.operands[2] as number, true);
        return expr;
    }
}

export class bgezl extends Instruction {
    static is(instruction: Instruction): instruction is bgezl {
        return instruction.code === Op.Code.bgezl;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bgezl,
            codeStr: 'bgezl',
            machineCode: rawCode,
            operands: [rs, target],
            reads: [rs],
            writes: [],
            isBranch: true,
            isLikelyBranch: true
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.i32(0);

        const cond = new Expr.IsGreaterOrEqual(lhs, rhs);
        const expr = new Expr.ConditionalBranch(cond, this.operands[2] as number, true);
        return expr;
    }
}

export class bltz extends Instruction {
    static is(instruction: Instruction): instruction is bltz {
        return instruction.code === Op.Code.bltz;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bltz,
            codeStr: 'bltz',
            machineCode: rawCode,
            operands: [rs, target],
            reads: [rs],
            writes: [],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.i32(0);

        const cond = new Expr.IsLess(lhs, rhs);
        const expr = new Expr.ConditionalBranch(cond, this.operands[2] as number);
        return expr;
    }
}

export class bltzal extends Instruction {
    static is(instruction: Instruction): instruction is bltzal {
        return instruction.code === Op.Code.bltzal;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bltzal,
            codeStr: 'bltzal',
            machineCode: rawCode,
            operands: [rs, target],
            reads: [rs],
            writes: [{ type: Reg.Type.EE, id: Reg.EE.RA }],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.i32(0);
        const returnAddress = Expr.Imm.u32(this.address + 8);

        const cond = new Expr.IsLess(lhs, rhs);
        decomp.setRegister(this.writes[0], returnAddress);
        const expr = new Expr.ConditionalBranch(cond, this.operands[2] as number);
        return expr;
    }
}

export class bltzall extends Instruction {
    static is(instruction: Instruction): instruction is bltzall {
        return instruction.code === Op.Code.bltzall;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bltzall,
            codeStr: 'bltzall',
            machineCode: rawCode,
            operands: [rs, target],
            reads: [rs],
            writes: [{ type: Reg.Type.EE, id: Reg.EE.RA }],
            isBranch: true,
            isLikelyBranch: true
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.i32(0);
        const returnAddress = Expr.Imm.u32(this.address + 8);

        const cond = new Expr.IsLess(lhs, rhs);
        decomp.setRegister(this.writes[0], returnAddress);
        const expr = new Expr.ConditionalBranch(cond, this.operands[2] as number, true);
        return expr;
    }
}

export class bltzl extends Instruction {
    static is(instruction: Instruction): instruction is bltzl {
        return instruction.code === Op.Code.bltzl;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bltzl,
            codeStr: 'bltzl',
            machineCode: rawCode,
            operands: [rs, target],
            reads: [rs],
            writes: [],
            isBranch: true,
            isLikelyBranch: true
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = decomp.getRegister(this.operands[1] as Reg.Register);
        const rhs = Expr.Imm.i32(0);

        const cond = new Expr.IsLess(lhs, rhs);
        const expr = new Expr.ConditionalBranch(cond, this.operands[2] as number, true);
        return expr;
    }
}

export class teqi extends Instruction {
    static is(instruction: Instruction): instruction is teqi {
        return instruction.code === Op.Code.teqi;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const immediate = extractBits(rawCode, 6, 10);

        super({
            address,
            code: Op.Code.teqi,
            codeStr: 'teqi',
            machineCode: rawCode,
            operands: [rs, immediate],
            reads: [rs],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const code = this.operands[0] as number;
        const cond = new Expr.IsEqual(decomp.getRegister(this.reads[0]), Expr.Imm.i32(this.operands[1] as number));

        return new Expr.ConditionalExpr(cond, new Expr.RawString(`trap()`));
    }
}

export class tgei extends Instruction {
    static is(instruction: Instruction): instruction is tgei {
        return instruction.code === Op.Code.tgei;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const immediate = extractBits(rawCode, 6, 10);

        super({
            address,
            code: Op.Code.tgei,
            codeStr: 'tgei',
            machineCode: rawCode,
            operands: [rs, immediate],
            reads: [rs],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const code = this.operands[0] as number;
        const cond = new Expr.IsGreaterOrEqual(
            decomp.getRegister(this.reads[0]),
            Expr.Imm.i32(this.operands[1] as number)
        );

        return new Expr.ConditionalExpr(cond, new Expr.RawString(`trap(0x${code.toString(16)})`));
    }
}

export class tgeiu extends Instruction {
    static is(instruction: Instruction): instruction is tgeiu {
        return instruction.code === Op.Code.tgeiu;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const immediate = extractBits(rawCode, 6, 10);

        super({
            address,
            code: Op.Code.tgeiu,
            codeStr: 'tgeiu',
            machineCode: rawCode,
            operands: [rs, immediate],
            reads: [rs],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const code = this.operands[0] as number;
        const cond = new Expr.IsGreaterOrEqual(
            decomp.getRegister(this.reads[0]),
            Expr.Imm.i32(this.operands[1] as number),
            true
        );

        return new Expr.ConditionalExpr(cond, new Expr.RawString(`trap(0x${code.toString(16)})`));
    }
}

export class tlti extends Instruction {
    static is(instruction: Instruction): instruction is tlti {
        return instruction.code === Op.Code.tlti;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const immediate = extractBits(rawCode, 6, 10);

        super({
            address,
            code: Op.Code.tlti,
            codeStr: 'tlti',
            machineCode: rawCode,
            operands: [rs, immediate],
            reads: [rs],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const code = this.operands[0] as number;
        const cond = new Expr.IsLess(decomp.getRegister(this.reads[0]), Expr.Imm.i32(this.operands[1] as number));

        return new Expr.ConditionalExpr(cond, new Expr.RawString(`trap(0x${code.toString(16)})`));
    }
}

export class tltiu extends Instruction {
    static is(instruction: Instruction): instruction is tltiu {
        return instruction.code === Op.Code.tltiu;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const immediate = extractBits(rawCode, 6, 10);

        super({
            address,
            code: Op.Code.tltiu,
            codeStr: 'tltiu',
            machineCode: rawCode,
            operands: [rs, immediate],
            reads: [rs],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const code = this.operands[0] as number;
        const cond = new Expr.IsLess(decomp.getRegister(this.reads[0]), Expr.Imm.i32(this.operands[1] as number), true);

        return new Expr.ConditionalExpr(cond, new Expr.RawString(`trap()`));
    }
}

export class tnei extends Instruction {
    static is(instruction: Instruction): instruction is tnei {
        return instruction.code === Op.Code.tnei;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const immediate = extractBits(rawCode, 6, 10);

        super({
            address,
            code: Op.Code.tnei,
            codeStr: 'tnei',
            machineCode: rawCode,
            operands: [rs, immediate],
            reads: [rs],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const code = this.operands[0] as number;
        const cond = new Expr.IsNotEqual(decomp.getRegister(this.reads[0]), Expr.Imm.i32(this.operands[1] as number));

        return new Expr.ConditionalExpr(cond, new Expr.RawString(`trap(0x${code.toString(16)})`));
    }
}

export class mtsab extends Instruction {
    static is(instruction: Instruction): instruction is mtsab {
        return instruction.code === Op.Code.mtsab;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const immediate = extractBits(rawCode, 6, 10);

        super({
            address,
            code: Op.Code.mtsab,
            codeStr: 'mtsab',
            machineCode: rawCode,
            operands: [rs, immediate],
            reads: [rs],
            writes: [{ type: Reg.Type.EE, id: Reg.EE.SA }]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = new Expr.BitwiseAnd(decomp.getRegister(this.reads[0]), Expr.Imm.u32(0b1111));
        const rhs = Expr.Imm.u32((this.operands[1] as number) & 0b1111);
        const xorResult = new Expr.BitwiseXOr(lhs, rhs);
        const byteShift = new Expr.Mul(xorResult, Expr.Imm.u32(8));

        decomp.setRegister(this.writes[0], byteShift);

        return new Expr.Null();
    }
}

export class mtsah extends Instruction {
    static is(instruction: Instruction): instruction is mtsah {
        return instruction.code === Op.Code.mtsah;
    }

    constructor(address: number, rawCode: number) {
        const rs: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 21, 5) as Reg.EE };
        const immediate = extractBits(rawCode, 6, 10);

        super({
            address,
            code: Op.Code.mtsah,
            codeStr: 'mtsah',
            machineCode: rawCode,
            operands: [rs, immediate],
            reads: [rs],
            writes: [{ type: Reg.Type.EE, id: Reg.EE.SA }]
        });
    }

    protected createExpression(): Expr.Expression {
        const decomp = Decompiler.get();
        const lhs = new Expr.BitwiseAnd(decomp.getRegister(this.reads[0]), Expr.Imm.u32(0b111));
        const rhs = Expr.Imm.u32((this.operands[1] as number) & 0b111);
        const xorResult = new Expr.BitwiseXOr(lhs, rhs);
        const halfShift = new Expr.Mul(xorResult, Expr.Imm.u32(16));

        decomp.setRegister(this.writes[0], halfShift);

        return new Expr.Null();
    }
}
