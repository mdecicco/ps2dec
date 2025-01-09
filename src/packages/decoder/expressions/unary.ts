import { CodeBuilder } from 'decompiler';
import { Expression } from './base';
import { foldConstants } from './common';
import { Imm } from './immediate';

export class Negate extends Expression {
    private m_value: Expression;

    constructor(value: Expression) {
        super();

        this.m_value = value;
    }

    reduce(): Expression {
        const value = this.m_value.reduce();
        if (!(value instanceof Imm)) {
            if (value === this.m_value) return this;
            return new Negate(value).copyFrom(this);
        }

        // Second operand is ignored, just pass value again to satisfy the signature
        return foldConstants(value, value, 'neg');
    }

    get children(): Expression[] {
        return [this.m_value];
    }

    clone(): Expression {
        return new Negate(this.m_value).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.punctuation('-');
        code.expression(this.m_value);
    }

    protected toString_impl(): string {
        return `-${this.m_value}`;
    }
}

export class Invert extends Expression {
    private m_value: Expression;

    constructor(value: Expression) {
        super();

        this.m_value = value;
    }

    reduce(): Expression {
        const value = this.m_value.reduce();
        if (!(value instanceof Imm)) {
            if (value === this.m_value) return this;
            return new Invert(value).copyFrom(this);
        }

        return Imm.typed(~value.value, value.type).copyFrom(this);
    }

    get children(): Expression[] {
        return [this.m_value];
    }

    clone(): Expression {
        return new Invert(this.m_value).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.punctuation('~');
        code.expression(this.m_value);
    }

    protected toString_impl(): string {
        return `~${this.m_value}`;
    }
}
