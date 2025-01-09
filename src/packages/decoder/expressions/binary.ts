import { CodeBuilder } from 'decompiler';
import { Expression } from './base';
import { foldConstants, getResultType } from './common';
import { Imm } from './immediate';
import { Negate } from './unary';

export abstract class BinaryExpression extends Expression {
    protected m_lhs: Expression;
    protected m_rhs: Expression;

    constructor(lhs: Expression, rhs: Expression) {
        super();
        this.m_lhs = lhs;
        this.m_rhs = rhs;
    }

    get lhs() {
        return this.m_lhs;
    }

    set lhs(lhs: Expression) {
        this.m_lhs = lhs;
    }

    get rhs() {
        return this.m_rhs;
    }

    set rhs(rhs: Expression) {
        this.m_rhs = rhs;
    }

    get children(): Expression[] {
        return [this.m_lhs, this.m_rhs];
    }

    abstract clone(): Expression;
    abstract generate_impl(code: CodeBuilder): void;
    protected abstract toString_impl(): string;
}

export class Add extends BinaryExpression {
    private m_isUnsigned: boolean | undefined;
    private m_bitWidth: number | undefined;

    constructor(lhs: Expression, rhs: Expression, isUnsigned?: boolean, bitWidth?: number) {
        super(lhs, rhs);

        this.m_isUnsigned = isUnsigned;
        this.m_bitWidth = bitWidth;

        this.type = getResultType(lhs.type, isUnsigned, bitWidth);
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();

        const rhsIsImm = rhs instanceof Imm;
        if (lhs instanceof Add && rhsIsImm) {
            if (lhs.m_lhs instanceof Imm) {
                const result = lhs.clone() as Add;
                result.m_lhs = foldConstants(lhs.m_lhs, rhs, 'add');
                return result;
            } else if (lhs.m_rhs instanceof Imm) {
                const result = lhs.clone() as Add;
                result.m_rhs = foldConstants(lhs.m_rhs, rhs, 'add');
                return result;
            }
        }

        const lhsIsImm = lhs instanceof Imm;
        if (rhs instanceof Add && lhsIsImm) {
            if (rhs.m_lhs instanceof Imm) {
                const result = rhs.clone() as Add;
                result.m_lhs = foldConstants(rhs.m_lhs, lhs, 'add');
                return result;
            } else if (rhs.m_rhs instanceof Imm) {
                const result = rhs.clone() as Add;
                result.m_rhs = foldConstants(rhs.m_rhs, lhs, 'add');
                return result;
            }
        }

        if (lhsIsImm && lhs.value === 0n) return rhs;
        if (lhsIsImm && lhs.value === 0n) return rhs;
        if (rhsIsImm && rhs.value === 0n) return lhs;
        if (!lhsIsImm || !rhsIsImm) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;

            if (rhsIsImm && foldConstants(rhs, Imm.typed(0n, rhs.type), 'lt').value === 1n) {
                // Adding a negative number is the same as subtracting the positive version of that number
                return new Sub(lhs, foldConstants(rhs, rhs, 'neg'), this.m_isUnsigned, this.m_bitWidth).copyFrom(this);
            } else if (lhsIsImm && foldConstants(lhs, Imm.typed(0n, lhs.type), 'lt').value === 1n) {
                // Adding a negative number is the same as subtracting the positive version of that number
                return new Sub(rhs, foldConstants(lhs, lhs, 'neg'), this.m_isUnsigned, this.m_bitWidth).copyFrom(this);
            }

            return new Add(lhs, rhs).copyFrom(this);
        }

        return foldConstants(lhs, rhs, 'add');
    }

    clone(): Expression {
        return new Add(this.m_lhs, this.m_rhs, this.m_isUnsigned, this.m_bitWidth).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('+');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} + ${this.m_rhs}`;
    }
}

export class Sub extends BinaryExpression {
    private m_isUnsigned: boolean | undefined;
    private m_bitWidth: number | undefined;

    constructor(lhs: Expression, rhs: Expression, isUnsigned?: boolean, bitWidth?: number) {
        super(lhs, rhs);

        this.m_isUnsigned = isUnsigned;
        this.m_bitWidth = bitWidth;

        this.type = getResultType(lhs.type, isUnsigned, bitWidth);
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();

        const rhsIsImm = rhs instanceof Imm;
        if (lhs instanceof Sub && rhsIsImm) {
            if (lhs.m_lhs instanceof Imm) {
                const result = lhs.clone() as Sub;
                result.m_lhs = foldConstants(lhs.m_lhs, rhs, 'sub');
                return result;
            } else if (lhs.m_rhs instanceof Imm) {
                const result = lhs.clone() as Sub;
                result.m_rhs = foldConstants(lhs.m_rhs, rhs, 'sub');
                return result;
            }
        }

        const lhsIsImm = lhs instanceof Imm;
        if (rhs instanceof Sub && lhsIsImm) {
            if (rhs.m_lhs instanceof Imm) {
                const result = rhs.clone() as Sub;
                result.m_lhs = foldConstants(rhs.m_lhs, lhs, 'sub');
                return result;
            } else if (rhs.m_rhs instanceof Imm) {
                const result = rhs.clone() as Sub;
                result.m_rhs = foldConstants(rhs.m_rhs, lhs, 'sub');
                return result;
            }
        }

        if (rhsIsImm && rhs.value === 0n) return lhs;
        if (lhsIsImm && lhs.value === 0n) return new Negate(rhs).copyFrom(this);
        if (!lhsIsImm || !rhsIsImm) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new Sub(lhs, rhs).copyFrom(this);
        }

        return foldConstants(lhs, rhs, 'sub');
    }

    clone(): Expression {
        return new Sub(this.m_lhs, this.m_rhs, this.m_isUnsigned, this.m_bitWidth).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('-');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} - ${this.m_rhs}`;
    }
}

export class Mul extends BinaryExpression {
    private m_isUnsigned: boolean | undefined;
    private m_bitWidth: number | undefined;

    constructor(lhs: Expression, rhs: Expression, isUnsigned?: boolean, bitWidth?: number) {
        super(lhs, rhs);

        this.m_isUnsigned = isUnsigned;
        this.m_bitWidth = bitWidth;

        this.type = getResultType(lhs.type, isUnsigned, bitWidth);
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();
        if (!(lhs instanceof Imm) || !(rhs instanceof Imm)) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new Mul(lhs, rhs).copyFrom(this);
        }

        return foldConstants(lhs, rhs, 'mul');
    }

    clone(): Expression {
        return new Mul(this.m_lhs, this.m_rhs, this.m_isUnsigned, this.m_bitWidth).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('*');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} * ${this.m_rhs}`;
    }
}

export class Div extends BinaryExpression {
    private m_isUnsigned: boolean | undefined;
    private m_bitWidth: number | undefined;

    constructor(lhs: Expression, rhs: Expression, isUnsigned?: boolean, bitWidth?: number) {
        super(lhs, rhs);

        this.m_isUnsigned = isUnsigned;
        this.m_bitWidth = bitWidth;

        this.type = getResultType(lhs.type, isUnsigned, bitWidth);
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();
        if (!(lhs instanceof Imm) || !(rhs instanceof Imm)) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new Div(lhs, rhs).copyFrom(this);
        }

        return foldConstants(lhs, rhs, 'div');
    }

    clone(): Expression {
        return new Div(this.m_lhs, this.m_rhs, this.m_isUnsigned, this.m_bitWidth).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('/');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} / ${this.m_rhs}`;
    }
}

export class Mod extends BinaryExpression {
    private m_isUnsigned: boolean | undefined;
    private m_bitWidth: number | undefined;

    constructor(lhs: Expression, rhs: Expression, isUnsigned?: boolean, bitWidth?: number) {
        super(lhs, rhs);

        this.m_isUnsigned = isUnsigned;
        this.m_bitWidth = bitWidth;

        this.type = getResultType(lhs.type, isUnsigned, bitWidth);
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();
        if (!(lhs instanceof Imm) || !(rhs instanceof Imm)) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new Mod(lhs, rhs).copyFrom(this);
        }

        return foldConstants(lhs, rhs, 'mod');
    }

    clone(): Expression {
        return new Mod(this.m_lhs, this.m_rhs, this.m_isUnsigned, this.m_bitWidth).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('%');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} % ${this.m_rhs}`;
    }
}

export class ShiftLeft extends BinaryExpression {
    private m_preserveSignBit: boolean;
    private m_bitWidth: number | undefined;

    constructor(lhs: Expression, rhs: Expression, bitWidth?: number, preserveSign?: boolean) {
        super(lhs, rhs);

        this.type = getResultType(lhs.type, preserveSign !== undefined ? !preserveSign : undefined, bitWidth);
        this.m_preserveSignBit = !!preserveSign;
        this.m_bitWidth = bitWidth;
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();
        if (!(lhs instanceof Imm) || !(rhs instanceof Imm)) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new ShiftLeft(lhs, rhs, this.m_bitWidth, this.m_preserveSignBit).copyFrom(this);
        }

        const bitWidth = this.type.size * 8;
        const bitMask = (1n << BigInt(bitWidth)) - 1n;

        if (this.m_preserveSignBit) {
            // I think?
            const sign = lhs.value & (1n << BigInt(bitWidth - 1));
            const shift = rhs.value & (BigInt(bitWidth) - 1n);
            const signBit = (sign << shift) & (1n << BigInt(bitWidth - 1));
            return Imm.typed(((lhs.value << rhs.value) & bitMask) | signBit, lhs.type).copyFrom(this);
        }

        return Imm.typed((lhs.value << rhs.value) & bitMask, lhs.type).copyFrom(this);
    }

    clone(): Expression {
        return new ShiftLeft(this.m_lhs, this.m_rhs, this.m_bitWidth, this.m_preserveSignBit).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('<<');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} << ${this.m_rhs}`;
    }
}

export class ShiftRight extends BinaryExpression {
    private m_preserveSignBit: boolean;
    private m_bitWidth: number | undefined;

    constructor(lhs: Expression, rhs: Expression, bitWidth?: number, preserveSign?: boolean) {
        super(lhs, rhs);

        this.type = getResultType(lhs.type, preserveSign !== undefined ? !preserveSign : undefined, bitWidth);
        this.m_preserveSignBit = !!preserveSign;
        this.m_bitWidth = bitWidth;
    }

    get preservesSign() {
        return this.m_preserveSignBit;
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();
        if (!(lhs instanceof Imm) || !(rhs instanceof Imm)) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new ShiftRight(lhs, rhs).copyFrom(this);
        }

        const bitWidth = this.type.size * 8;
        const bitMask = (1n << BigInt(bitWidth)) - 1n;

        if (this.m_preserveSignBit) {
            // I think?
            const sign = lhs.value & (1n << BigInt(bitWidth - 1));
            const shift = rhs.value & (BigInt(bitWidth) - 1n);
            const signBit = (sign << shift) & (1n << BigInt(bitWidth - 1));
            return Imm.typed(((lhs.value >> rhs.value) & bitMask) | signBit, lhs.type).copyFrom(this);
        }

        return Imm.typed((lhs.value >> rhs.value) & bitMask, lhs.type).copyFrom(this);
    }

    clone(): Expression {
        return new ShiftRight(this.m_lhs, this.m_rhs, this.m_bitWidth, this.m_preserveSignBit).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('>>');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} >> ${this.m_rhs}`;
    }
}

export class BitwiseAnd extends BinaryExpression {
    private m_bitWidth: number | undefined;

    constructor(lhs: Expression, rhs: Expression, bitWidth?: number) {
        super(lhs, rhs);

        this.type = getResultType(lhs.type, undefined, bitWidth);
        this.m_bitWidth = bitWidth;
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();
        if (!(lhs instanceof Imm) || !(rhs instanceof Imm)) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new BitwiseAnd(lhs, rhs).copyFrom(this);
        }

        const bitWidth = this.type.size * 8;
        const bitMask = (1n << BigInt(bitWidth)) - 1n;
        return Imm.typed(lhs.value & rhs.value & bitMask, lhs.type).copyFrom(this);
    }

    clone(): Expression {
        return new BitwiseAnd(this.m_lhs, this.m_rhs, this.m_bitWidth).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('&');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} & ${this.m_rhs}`;
    }
}

export class BitwiseOr extends BinaryExpression {
    private m_bitWidth: number | undefined;

    constructor(lhs: Expression, rhs: Expression, bitWidth?: number) {
        super(lhs, rhs);

        this.type = getResultType(lhs.type, undefined, bitWidth);
        this.m_bitWidth = bitWidth;
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();
        if (!(lhs instanceof Imm) || !(rhs instanceof Imm)) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new BitwiseOr(lhs, rhs).copyFrom(this);
        }

        const bitWidth = this.type.size * 8;
        const bitMask = (1n << BigInt(bitWidth)) - 1n;
        return Imm.typed((lhs.value | rhs.value) & bitMask, lhs.type).copyFrom(this);
    }

    clone(): Expression {
        return new BitwiseOr(this.m_lhs, this.m_rhs, this.m_bitWidth).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('|');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} | ${this.m_rhs}`;
    }
}

export class BitwiseXOr extends BinaryExpression {
    private m_bitWidth: number | undefined;

    constructor(lhs: Expression, rhs: Expression, bitWidth?: number) {
        super(lhs, rhs);

        this.type = getResultType(lhs.type, undefined, bitWidth);
        this.m_bitWidth = bitWidth;
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();
        if (!(lhs instanceof Imm) || !(rhs instanceof Imm)) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new BitwiseXOr(lhs, rhs).copyFrom(this);
        }

        const bitWidth = this.type.size * 8;
        const bitMask = (1n << BigInt(bitWidth)) - 1n;
        return Imm.typed((lhs.value ^ rhs.value) & bitMask, lhs.type).copyFrom(this);
    }

    clone(): Expression {
        return new BitwiseXOr(this.m_lhs, this.m_rhs, this.m_bitWidth).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('^');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} ^ ${this.m_rhs}`;
    }
}
