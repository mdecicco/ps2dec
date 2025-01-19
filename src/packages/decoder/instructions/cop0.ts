import { Decompiler } from 'decompiler';

import * as Expr from '../expressions';
import * as Op from '../opcodes';
import * as Reg from '../registers';
import { branchTarget, extractBits, extractSignedBits } from '../utils';
import { Instruction } from './base';

export class bc0f extends Instruction {
    static is(instruction: Instruction): instruction is bc0f {
        return instruction.code === Op.Code.bc0f;
    }

    constructor(address: number, rawCode: number) {
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bc0f,
            codeStr: 'bc0f',
            machineCode: rawCode,
            operands: [target],
            reads: [{ type: Reg.Type.COP0, id: Reg.COP0.CPCOND0 }],
            writes: [],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const cond = new Expr.Not(decomp.getRegister(this.reads[0]));
        const expr = new Expr.ConditionalBranch(cond, this.operands[0] as number);
        return expr;
    }
}

export class bc0fl extends Instruction {
    static is(instruction: Instruction): instruction is bc0fl {
        return instruction.code === Op.Code.bc0fl;
    }

    constructor(address: number, rawCode: number) {
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bc0fl,
            codeStr: 'bc0fl',
            machineCode: rawCode,
            operands: [target],
            reads: [{ type: Reg.Type.COP0, id: Reg.COP0.CPCOND0 }],
            writes: [],
            isBranch: true,
            isLikelyBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const cond = new Expr.Not(decomp.getRegister(this.reads[0]));
        const expr = new Expr.ConditionalBranch(cond, this.operands[0] as number, true);
        return expr;
    }
}

export class bc0t extends Instruction {
    static is(instruction: Instruction): instruction is bc0t {
        return instruction.code === Op.Code.bc0t;
    }

    constructor(address: number, rawCode: number) {
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bc0t,
            codeStr: 'bc0t',
            machineCode: rawCode,
            operands: [target],
            reads: [{ type: Reg.Type.COP0, id: Reg.COP0.CPCOND0 }],
            writes: [],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const cond = decomp.getRegister(this.reads[0]);
        const expr = new Expr.ConditionalBranch(cond, this.operands[0] as number);
        return expr;
    }
}

export class bc0tl extends Instruction {
    static is(instruction: Instruction): instruction is bc0tl {
        return instruction.code === Op.Code.bc0tl;
    }

    constructor(address: number, rawCode: number) {
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.bc0tl,
            codeStr: 'bc0tl',
            machineCode: rawCode,
            operands: [target],
            reads: [{ type: Reg.Type.COP0, id: Reg.COP0.CPCOND0 }],
            writes: [],
            isBranch: true,
            isLikelyBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        const cond = decomp.getRegister(this.reads[0]);
        const expr = new Expr.ConditionalBranch(cond, this.operands[0] as number, true);
        return expr;
    }
}

export class di extends Instruction {
    static is(instruction: Instruction): instruction is di {
        return instruction.code === Op.Code.di;
    }

    constructor(address: number, rawCode: number) {
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.di,
            codeStr: 'di',
            machineCode: rawCode,
            operands: [target],
            reads: [{ type: Reg.Type.COP0, id: Reg.COP0.STATUS }],
            writes: [{ type: Reg.Type.COP0, id: Reg.COP0.STATUS }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return null;
    }
}

export class ei extends Instruction {
    static is(instruction: Instruction): instruction is ei {
        return instruction.code === Op.Code.ei;
    }

    constructor(address: number, rawCode: number) {
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.ei,
            codeStr: 'ei',
            machineCode: rawCode,
            operands: [target],
            reads: [{ type: Reg.Type.COP0, id: Reg.COP0.STATUS }],
            writes: [{ type: Reg.Type.COP0, id: Reg.COP0.STATUS }]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return null;
    }
}

export class eret extends Instruction {
    static is(instruction: Instruction): instruction is eret {
        return instruction.code === Op.Code.eret;
    }

    constructor(address: number, rawCode: number) {
        const offset = extractSignedBits(rawCode, 0, 16);
        const target = branchTarget(offset, address);

        super({
            address,
            code: Op.Code.eret,
            codeStr: 'eret',
            machineCode: rawCode,
            operands: [target],
            reads: [{ type: Reg.Type.COP0, id: Reg.COP0.STATUS }],
            writes: [
                { type: Reg.Type.COP0, id: Reg.COP0.STATUS },
                { type: Reg.Type.EE, id: Reg.EE.PC }
            ]
        });
    }

    protected createExpression(): Expr.Expression | null {
        return null;
    }
}

export class mfc0 extends Instruction {
    static is(instruction: Instruction): instruction is mfc0 {
        return instruction.code === Op.Code.mfc0;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.COP0, id: extractBits(rawCode, 11, 5) as Reg.COP0 };

        super({
            address,
            code: Op.Code.mfc0,
            codeStr: 'mfc0',
            machineCode: rawCode,
            operands: [rt, rd],
            reads: [rd],
            writes: [rt]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        decomp.setRegister(this.writes[0], decomp.getRegister(this.reads[0]));
        return null;
    }
}

export class mtc0 extends Instruction {
    static is(instruction: Instruction): instruction is mtc0 {
        return instruction.code === Op.Code.mtc0;
    }

    constructor(address: number, rawCode: number) {
        const rt: Reg.Register = { type: Reg.Type.EE, id: extractBits(rawCode, 16, 5) as Reg.EE };
        const rd: Reg.Register = { type: Reg.Type.COP0, id: extractBits(rawCode, 11, 5) as Reg.COP0 };

        super({
            address,
            code: Op.Code.mtc0,
            codeStr: 'mtc0',
            machineCode: rawCode,
            operands: [rt, rd],
            reads: [rt],
            writes: [rd]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        decomp.setRegister(this.writes[0], decomp.getRegister(this.reads[0]));
        return null;
    }
}
