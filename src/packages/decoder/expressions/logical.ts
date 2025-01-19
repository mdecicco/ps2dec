import { CodeBuilder } from 'decompiler';
import { PointerType } from 'typesys';

import { Expression } from './base';
import { BinaryExpression } from './binary';
import { foldConstants } from './common';
import { Imm } from './immediate';

interface LogicalExpr extends Expression {
    logicalInversion(): LogicalExpr;
}

export function isLogical(expr: Expression): expr is LogicalExpr {
    return 'logicalInversion' in expr;
}

export class Not extends Expression implements LogicalExpr {
    private m_value: Expression;

    constructor(value: Expression) {
        super();

        this.m_value = value;
        this.type = 'bool';
    }

    logicalInversion() {
        return new IsNotEqual(this.m_value, Imm.typed(0n, this.m_value.type)).copyFrom(this);
    }

    reduce(): Expression {
        const value = this.m_value.reduce();
        if (!(value instanceof Imm)) {
            if (value === this.m_value) return this;
            return new Not(value).copyFrom(this);
        }

        return Imm.bool(value.value === 0n).copyFrom(this);
    }

    get children(): Expression[] {
        return [this.m_value];
    }

    clone(): Expression {
        return new Not(this.m_value).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.punctuation('!');
        code.expression(this.m_value);
    }

    protected toString_impl(): string {
        return `!${this.m_value}`;
    }
}

export class LogicalAnd extends BinaryExpression implements LogicalExpr {
    private m_bitWidth: number;

    constructor(lhs: Expression, rhs: Expression, bitWidth?: number) {
        super(lhs, rhs);

        this.m_bitWidth = bitWidth || lhs.type.size * 8;
        this.type = 'bool';
    }

    logicalInversion() {
        return new LogicalOr(new Not(this.m_lhs), new Not(this.m_rhs), this.m_bitWidth);
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();
        if (!(lhs instanceof Imm) || !(rhs instanceof Imm)) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new LogicalAnd(lhs, rhs).copyFrom(this);
        }

        const bitMask = (1n << BigInt(this.m_bitWidth)) - 1n;
        return Imm.bool((lhs.value & bitMask) !== 0n && (rhs.value & bitMask) !== 0n).copyFrom(this);
    }

    clone(): Expression {
        return new LogicalAnd(this.m_lhs, this.m_rhs, this.m_bitWidth).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('&&');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} && ${this.m_rhs}`;
    }
}

export class LogicalOr extends BinaryExpression implements LogicalExpr {
    private m_bitWidth: number;

    constructor(lhs: Expression, rhs: Expression, bitWidth?: number) {
        super(lhs, rhs);

        this.m_bitWidth = bitWidth || lhs.type.size * 8;
        this.type = 'bool';
    }

    logicalInversion() {
        return new LogicalAnd(new Not(this.m_lhs), new Not(this.m_rhs), this.m_bitWidth);
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();

        const bitMask = (1n << BigInt(this.m_bitWidth)) - 1n;
        if (lhs instanceof Imm && (lhs.value & bitMask) !== 0n) return Imm.bool(true).copyFrom(this);
        if (rhs instanceof Imm && (rhs.value & bitMask) !== 0n) return Imm.bool(true).copyFrom(this);

        if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
        return new LogicalOr(lhs, rhs).copyFrom(this);
    }

    clone(): Expression {
        return new LogicalOr(this.m_lhs, this.m_rhs, this.m_bitWidth).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('||');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} || ${this.m_rhs}`;
    }
}

export class IsEqual extends BinaryExpression implements LogicalExpr {
    constructor(lhs: Expression, rhs: Expression) {
        super(lhs, rhs);

        const lhsIsImm = lhs instanceof Imm;
        const rhsIsImm = rhs instanceof Imm;
        if (lhsIsImm && !rhsIsImm) {
            // prefer immediate on the right
            this.m_lhs = rhs;
            this.m_rhs = lhs;
        } else {
            this.m_lhs = lhs;
            this.m_rhs = rhs;
        }

        this.type = 'bool';
    }

    get lhs() {
        return this.m_lhs;
    }

    get rhs() {
        return this.m_rhs;
    }

    logicalInversion() {
        return new IsNotEqual(this.m_lhs, this.m_rhs).copyFrom(this);
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();

        if (lhs.type.name === 'bool' && rhs.type.name === 'bool' && rhs instanceof Imm) {
            if (rhs.value === 1n) {
                return lhs;
            } else if (isLogical(lhs) && rhs.value === 0n) {
                return lhs.logicalInversion().reduce();
            }
        }

        if (lhs instanceof Imm && rhs.type instanceof PointerType) {
            if (lhs.value === 0n) {
                return new Not(rhs).copyFrom(this);
            }
        } else if (rhs instanceof Imm && lhs.type instanceof PointerType) {
            if (rhs.value === 0n) {
                return new Not(lhs).copyFrom(this);
            }
        }

        if (!(lhs instanceof Imm) || !(rhs instanceof Imm)) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new IsEqual(lhs, rhs).copyFrom(this);
        }

        return foldConstants(lhs, rhs, 'eq');
    }

    clone(): Expression {
        return new IsEqual(this.m_lhs, this.m_rhs).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('==');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} == ${this.m_rhs}`;
    }
}

export class IsNotEqual extends BinaryExpression implements LogicalExpr {
    constructor(lhs: Expression, rhs: Expression) {
        super(lhs, rhs);

        const lhsIsImm = lhs instanceof Imm;
        const rhsIsImm = rhs instanceof Imm;
        if (lhsIsImm && !rhsIsImm) {
            // prefer immediate on the right
            this.m_lhs = rhs;
            this.m_rhs = lhs;
        } else {
            this.m_lhs = lhs;
            this.m_rhs = rhs;
        }

        this.type = 'bool';
    }

    get lhs() {
        return this.m_lhs;
    }

    get rhs() {
        return this.m_rhs;
    }

    logicalInversion() {
        return new IsEqual(this.m_lhs, this.m_rhs).copyFrom(this);
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();

        if (lhs.type.name === 'bool' && rhs instanceof Imm && rhs.value === 0n) {
            return lhs;
        }

        if (!(lhs instanceof Imm) || !(rhs instanceof Imm)) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new IsNotEqual(lhs, rhs).copyFrom(this);
        }

        return foldConstants(lhs, rhs, 'ne');
    }

    clone(): Expression {
        return new IsNotEqual(this.m_lhs, this.m_rhs).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('!=');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} != ${this.m_rhs}`;
    }
}

export class IsGreater extends BinaryExpression implements LogicalExpr {
    private m_isUnsigned: boolean;

    constructor(lhs: Expression, rhs: Expression, isUnsigned?: boolean) {
        super(lhs, rhs);

        this.m_isUnsigned = !!isUnsigned;

        this.type = 'bool';
    }

    logicalInversion() {
        return new IsLessOrEqual(this.m_lhs, this.m_rhs, this.m_isUnsigned).copyFrom(this);
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();

        const lhsIsImm = lhs instanceof Imm;
        const rhsIsImm = rhs instanceof Imm;
        if (lhsIsImm && !rhsIsImm) {
            // prefer immediate on the right
            return new IsLess(rhs, lhs, this.m_isUnsigned).copyFrom(this).reduce();
        }

        if (!lhsIsImm || !rhsIsImm) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new IsGreater(lhs, rhs, this.m_isUnsigned).copyFrom(this);
        }

        return foldConstants(lhs, rhs, 'gt');
    }

    clone(): Expression {
        return new IsGreater(this.m_lhs, this.m_rhs, this.m_isUnsigned).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('>');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} > ${this.m_rhs}`;
    }
}

export class IsGreaterOrEqual extends BinaryExpression implements LogicalExpr {
    private m_isUnsigned: boolean;

    constructor(lhs: Expression, rhs: Expression, isUnsigned?: boolean) {
        super(lhs, rhs);

        this.m_isUnsigned = !!isUnsigned;
        this.type = 'bool';
    }

    logicalInversion() {
        return new IsLess(this.m_lhs, this.m_rhs, this.m_isUnsigned).copyFrom(this);
    }

    isUnsigned() {
        return this.m_isUnsigned;
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();

        const lhsIsImm = lhs instanceof Imm;
        const rhsIsImm = rhs instanceof Imm;
        if (lhsIsImm && !rhsIsImm) {
            // prefer immediate on the right
            return new IsLessOrEqual(rhs, lhs, this.m_isUnsigned).copyFrom(this).reduce();
        }

        if (!lhsIsImm || !rhsIsImm) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new IsGreaterOrEqual(lhs, rhs, this.m_isUnsigned).copyFrom(this);
        }

        return foldConstants(lhs, rhs, 'ge');
    }

    clone(): Expression {
        return new IsGreaterOrEqual(this.m_lhs, this.m_rhs, this.m_isUnsigned).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('>=');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} >= ${this.m_rhs}`;
    }
}

export class IsLess extends BinaryExpression implements LogicalExpr {
    private m_isUnsigned: boolean;

    constructor(lhs: Expression, rhs: Expression, isUnsigned?: boolean) {
        super(lhs, rhs);

        this.m_isUnsigned = !!isUnsigned;
        this.type = 'bool';
    }

    logicalInversion() {
        return new IsGreaterOrEqual(this.m_lhs, this.m_rhs, this.m_isUnsigned).copyFrom(this);
    }

    isUnsigned() {
        return this.m_isUnsigned;
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();

        const lhsIsImm = lhs instanceof Imm;
        const rhsIsImm = rhs instanceof Imm;
        if (lhsIsImm && !rhsIsImm) {
            // prefer immediate on the right
            return new IsGreater(rhs, lhs, this.m_isUnsigned).copyFrom(this).reduce();
        }

        if (!lhsIsImm || !rhsIsImm) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new IsLess(lhs, rhs, this.m_isUnsigned).copyFrom(this);
        }

        return foldConstants(lhs, rhs, 'lt');
    }

    clone(): Expression {
        return new IsLess(this.m_lhs, this.m_rhs, this.m_isUnsigned).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('<');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} < ${this.m_rhs}`;
    }
}

export class IsLessOrEqual extends BinaryExpression implements LogicalExpr {
    private m_isUnsigned: boolean;

    constructor(lhs: Expression, rhs: Expression, isUnsigned?: boolean) {
        super(lhs, rhs);

        this.m_isUnsigned = !!isUnsigned;

        this.type = 'bool';
    }

    logicalInversion() {
        return new IsGreater(this.m_lhs, this.m_rhs, this.m_isUnsigned).copyFrom(this);
    }

    reduce(): Expression {
        const lhs = this.m_lhs.reduce();
        const rhs = this.m_rhs.reduce();

        const lhsIsImm = lhs instanceof Imm;
        const rhsIsImm = rhs instanceof Imm;
        if (lhsIsImm && !rhsIsImm) {
            // prefer immediate on the right
            return new IsGreaterOrEqual(rhs, lhs, this.m_isUnsigned).copyFrom(this).reduce();
        }

        if (!lhsIsImm || !rhsIsImm) {
            if (lhs === this.m_lhs && rhs === this.m_rhs) return this;
            return new IsLessOrEqual(lhs, rhs, this.m_isUnsigned).copyFrom(this);
        }

        return foldConstants(lhs, rhs, 'le');
    }

    clone(): Expression {
        return new IsLessOrEqual(this.m_lhs, this.m_rhs, this.m_isUnsigned).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_lhs);
        code.whitespace(1);
        code.punctuation('<=');
        code.whitespace(1);
        code.expression(this.m_rhs);
    }

    protected toString_impl(): string {
        return `${this.m_lhs} <= ${this.m_rhs}`;
    }
}
