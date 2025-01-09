import { Decompiler } from 'decompiler';
import * as Expr from '../expressions';
import * as Op from '../opcodes';
import * as Reg from '../registers';
import { Instruction } from './base';

export class nop extends Instruction {
    static is(instruction: Instruction): instruction is nop {
        return instruction.code === Op.Code.nop;
    }

    constructor(address: number) {
        super({
            address,
            code: Op.Code.nop,
            codeStr: 'nop',
            machineCode: 0,
            operands: [],
            reads: [],
            writes: []
        });
    }

    protected createExpression(): Expr.Expression | null {
        return null;
    }
}

export class b extends Instruction {
    static is(instruction: Instruction): instruction is b {
        return instruction.code === Op.Code.b;
    }

    constructor(address: number, target: number) {
        super({
            address,
            code: Op.Code.b,
            codeStr: 'b',
            machineCode: 0,
            operands: [target],
            reads: [],
            writes: [],
            isBranch: true
        });
    }

    protected createExpression(): Expr.Expression | null {
        return new Expr.UnconditionalBranch(Expr.Imm.u32(this.operands[0] as number));
    }
}

export class move extends Instruction {
    static is(instruction: Instruction): instruction is move {
        return instruction.code === Op.Code.move;
    }

    constructor(address: number, dest: Reg.Register, src: Reg.Register) {
        super({
            address,
            code: Op.Code.move,
            codeStr: 'move',
            machineCode: 0,
            operands: [dest, src],
            reads: [src],
            writes: [dest]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        decomp.setRegister(this.writes[0], decomp.getRegister(this.reads[0]));
        return null;
    }
}

export class li extends Instruction {
    static is(instruction: Instruction): instruction is li {
        return instruction.code === Op.Code.li;
    }

    constructor(address: number, dest: Reg.Register, val: number) {
        super({
            address,
            code: Op.Code.li,
            codeStr: 'li',
            machineCode: 0,
            operands: [dest, val],
            reads: [],
            writes: [dest]
        });
    }

    protected createExpression(): Expr.Expression | null {
        const decomp = Decompiler.current;
        decomp.setRegister(this.writes[0], Expr.Imm.i32(this.operands[1] as number));
        return null;
    }
}
