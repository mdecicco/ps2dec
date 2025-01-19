import { CodeBuilder, Decompiler } from 'decompiler';
import { Expression } from './base';

export class Call extends Expression {
    private m_target: number;

    constructor(target: number) {
        super();
        this.m_target = target;
    }

    get target() {
        return Decompiler.findFunctionByAddress(this.m_target);
    }

    clone(): Expression {
        return new Call(this.m_target).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        const func = this.target;
        if (!func) {
            code.miscReference(`FUN_${this.m_target.toString(16).padStart(8, '0')}`);
            code.punctuation('()');
            return;
        }

        const decomp = Decompiler.current;
        code.func(func);
        code.punctuation('(');
        func.signature.arguments.map((a, idx) => {
            if (idx > 0) {
                code.punctuation(',');
                code.whitespace(1);
            }

            if (typeof a.location === 'number') {
                decomp.getStack(a.location, this.address).generate(code);
            } else {
                decomp.getRegister(a.location, this.address).generate(code);
            }
        });
        code.punctuation(')');
    }

    protected toString_impl(): string {
        const decomp = Decompiler.current;
        const func = this.target;
        if (!func) {
            return `FUN_${this.m_target.toString(16).padStart(8, '0')}()`;
        }

        const args: Expression[] = func.signature.arguments.map(a => {
            decomp.currentAddress = this.address;
            if (typeof a.location === 'number') {
                return decomp.getStack(a.location, this.address);
            }
            return decomp.getRegister(a.location);
        });

        return `${func.name}(${args.map(a => a.toString()).join(', ')})`;
    }
}

export class IndirectCall extends Expression {
    private m_target: Expression;

    constructor(target: Expression) {
        super();
        this.m_target = target;
    }

    get target() {
        return this.m_target;
    }

    clone(): Expression {
        return new IndirectCall(this.m_target).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.expression(this.m_target);
        code.punctuation('()');
    }

    protected toString_impl(): string {
        return `${this.m_target}()`;
    }
}
