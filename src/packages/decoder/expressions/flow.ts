import { PointerType, TypeSystem } from 'decompiler';
import { CodeBuilder } from 'packages/decompiler/codegen';
import { Expression } from './base';
import { BinaryExpression } from './binary';
import { Imm } from './immediate';
import { IsNotEqual } from './logical';

export class Ternary extends Expression {
    private m_cond: Expression;
    private m_truthyResult: Expression;
    private m_falsyResult: Expression;

    constructor(condition: Expression, truthy: Expression, falsy: Expression) {
        super();

        this.m_cond = condition;
        this.m_truthyResult = truthy;
        this.m_falsyResult = falsy;
    }

    get truthyResult() {
        return this.m_truthyResult;
    }

    get falsyResult() {
        return this.m_falsyResult;
    }

    reduce(): Expression {
        const cond = this.m_cond.reduce();
        const truthy = this.m_truthyResult.reduce();
        const falsy = this.m_falsyResult.reduce();

        if (!(cond instanceof Imm)) {
            if (cond === this.m_cond && truthy === this.m_truthyResult && falsy === this.m_falsyResult) return this;
            return new Ternary(cond, truthy, falsy).copyFrom(this);
        }

        return cond.value !== 0n ? truthy : falsy;
    }

    get children(): Expression[] {
        return [this.m_cond, this.m_truthyResult, this.m_falsyResult];
    }

    clone(): Expression {
        return new Ternary(this.m_cond, this.m_truthyResult, this.m_falsyResult).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        if (this.m_cond instanceof BinaryExpression) this.m_cond.parenthesize();

        code.expression(this.m_cond);
        code.whitespace(1);
        code.punctuation('?');
        code.whitespace(1);
        code.expression(this.m_truthyResult);
        code.whitespace(1);
        code.punctuation(':');
        code.whitespace(1);
        code.expression(this.m_falsyResult);
    }

    protected toString_impl(): string {
        return `${this.m_cond} ? ${this.m_truthyResult} : ${this.m_falsyResult}`;
    }
}

export class ConditionalBranch extends Expression {
    private m_cond: Expression;
    private m_branchAddress: number;
    private m_skipDelaySlotOnNoBranch: boolean;

    constructor(condition: Expression, target: number, skipDelayOnNoBranch?: boolean) {
        super();

        this.m_cond = condition;
        this.m_branchAddress = target;
        this.m_skipDelaySlotOnNoBranch = !!skipDelayOnNoBranch;
    }

    get condition() {
        return this.m_cond;
    }

    set condition(cond: Expression) {
        this.m_cond = cond;
    }

    get target() {
        return this.m_branchAddress;
    }

    get skipsDelayOnNoBranch() {
        return this.m_skipDelaySlotOnNoBranch;
    }

    reduce(): Expression {
        let cond = this.m_cond.reduce();

        if (cond instanceof IsNotEqual) {
            if (cond.lhs instanceof Imm && cond.rhs.type instanceof PointerType) {
                if (cond.lhs.value === 0n) {
                    cond = cond.rhs;
                }
            } else if (cond.rhs instanceof Imm && cond.lhs.type instanceof PointerType) {
                if (cond.rhs.value === 0n) {
                    cond = cond.lhs;
                }
            }
        }

        if (cond === this.m_cond) return this;
        return new ConditionalBranch(cond, this.m_branchAddress, this.m_skipDelaySlotOnNoBranch).copyFrom(this);
    }

    get children(): Expression[] {
        return [this.m_cond];
    }

    clone(): Expression {
        return new ConditionalBranch(this.m_cond, this.m_branchAddress, this.m_skipDelaySlotOnNoBranch).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        // conditional branches are specially handled by the flow analyzer / code generator
        // don't generate any code here
    }

    protected toString_impl(): string {
        return `if (${this.m_cond}) goto LBL_${this.m_branchAddress.toString(16).padStart(8, '0')}`;
    }
}

export class UnconditionalBranch extends Expression {
    private m_branchAddress: Expression;

    constructor(target: Expression) {
        super();

        this.m_branchAddress = target;
    }

    get target() {
        return this.m_branchAddress;
    }

    reduce(): Expression {
        const target = this.m_branchAddress.reduce();
        if (target === this.m_branchAddress) return this;
        return new UnconditionalBranch(target).copyFrom(this);
    }

    get children(): Expression[] {
        return [this.m_branchAddress];
    }

    clone(): Expression {
        return new UnconditionalBranch(this.m_branchAddress).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        if (this.m_branchAddress instanceof Imm) {
            // todo: check if target is a function
            const target = this.m_branchAddress.value;

            if (target === BigInt(this.address)) {
                code.keyword('while');
                code.whitespace(1);
                code.punctuation('(');
                code.literal('true', TypeSystem.get().getType('bool'), 1n);
                code.punctuation(')');
                code.whitespace(1);
                code.keyword('{');
                code.whitespace(1);
                code.comment('Infinite loop');
                code.whitespace(1);
                code.keyword('}');
                return;
            }

            code.keyword('goto');
            code.whitespace(1);
            code.plainText(`LBL_${target.toString(16).padStart(8, '0')}`);
        } else {
            code.comment(`TODO: indirect unconditional branches\ngoto ${this.m_branchAddress}`);
        }
    }

    protected toString_impl(): string {
        if (this.m_branchAddress instanceof Imm) {
            // todo: check if target is a function
            const target = this.m_branchAddress.value;
            return `goto LBL_${target.toString(16).padStart(8, '0')}`;
        }

        return `goto ${this.m_branchAddress}`;
    }
}

export class ConditionalExpr extends Expression {
    private m_cond: Expression;
    private m_expr: Expression;

    constructor(condition: Expression, expr: Expression) {
        super();

        this.m_cond = condition;
        this.m_expr = expr;
    }

    get condition() {
        return this.m_cond;
    }

    get expr() {
        return this.m_expr;
    }

    reduce(): Expression {
        const cond = this.m_cond.reduce();
        const expr = this.m_expr.reduce();
        if (cond === this.m_cond && expr === this.m_expr) return this;
        return new ConditionalExpr(cond, expr).copyFrom(this);
    }

    clone(): Expression {
        return new ConditionalExpr(this.m_cond, this.m_expr).copyFrom(this);
    }

    get children(): Expression[] {
        return [this.m_cond, this.m_expr];
    }

    generate_impl(code: CodeBuilder): void {
        code.keyword('if');
        code.whitespace(1);
        code.punctuation('(');
        code.expression(this.m_cond);
        code.punctuation(')');
        code.whitespace(1);
        code.expression(this.m_expr);
    }

    protected toString_impl(): string {
        return `if (${this.m_cond}) ${this.m_expr}`;
    }
}
