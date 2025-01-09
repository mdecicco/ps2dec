import { CodeBuilder, DataType, DecompVariable } from 'decompiler';
import { Expression } from './base';

export class RawString extends Expression {
    private m_str: string;
    private m_genFunc: ((code: CodeBuilder) => void) | null;

    constructor(str: string, type?: DataType | string | number | null, genFunc?: (code: CodeBuilder) => void) {
        super();
        this.m_str = str;
        this.type = type ? type : 'undefined';
        this.m_genFunc = genFunc || null;
    }

    clone(): Expression {
        return new RawString(this.m_str, this.type).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        if (this.m_genFunc) this.m_genFunc(code);
        else code.plainText(this.m_str);
    }

    protected toString_impl(): string {
        return this.m_str;
    }
}

export class Variable extends Expression {
    private m_value: DecompVariable;

    constructor(value: DecompVariable) {
        super();
        this.m_value = value;
        this.type = value.type;
    }

    get value() {
        return this.m_value;
    }

    clone(): Expression {
        return new Variable(this.m_value).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.variable(this.m_value);
    }

    protected toString_impl(): string {
        return this.m_value.name;
    }
}
