import { CodeBuilder, PrimitiveType, TypeSystem } from 'decompiler';
import { Expression } from './base';
import { foldConstants } from './common';
import { Imm } from './immediate';

export class Break extends Expression {
    constructor() {
        super();
    }

    clone(): Expression {
        return new Break().copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.miscReference('breakpoint');
        code.punctuation('()');
    }

    protected toString_impl(): string {
        return `breakpoint()`;
    }
}

export class Abs extends Expression {
    private m_value: Expression;

    constructor(value: Expression) {
        super();

        this.m_value = value;
        this.type = value.type;
    }

    reduce(): Expression {
        const value = this.m_value.reduce();
        if (!(value instanceof Imm)) {
            if (value === this.m_value) return this;
            return new Abs(value).copyFrom(this);
        }

        // second argument is ignored but required by foldConstants
        return foldConstants(value, value, 'abs');
    }

    get children(): Expression[] {
        return [this.m_value];
    }

    clone(): Expression {
        return new Abs(this.m_value).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.miscReference('abs');
        code.punctuation('(');
        code.expression(this.m_value);
        code.punctuation(')');
    }

    protected toString_impl(): string {
        return `abs(${this.m_value})`;
    }
}

export class Min extends Expression {
    private m_values: Expression[];

    constructor(values: Expression[]) {
        super();

        this.m_values = values;
        this.type = values[0].type;
    }

    reduce(): Expression {
        const values = this.m_values.map(v => v.reduce());

        // If there is more than one immediate, we can get the minimum value between
        // them. Then remove all immediates from the list and return just the non-immediates
        // with the minimum immediate value.

        let minImmediate: Imm | null = null;
        const nonImmediates: Expression[] = [];
        for (const v of values) {
            if (v instanceof Imm) {
                if (minImmediate === null) minImmediate = v;
                else minImmediate = foldConstants(minImmediate, v, 'lt').value === 0n ? v : minImmediate;
            } else nonImmediates.push(v);
        }

        if (minImmediate === null) {
            // there were no immediates, so we can't reduce this expression
            if (values.every((v, idx) => v === this.m_values[idx])) return this;
            return new Min(values).copyFrom(this);
        }

        if (nonImmediates.length === 0) {
            // there were no non-immediates, so we can return the minimum immediate
            return minImmediate;
        } else {
            nonImmediates.push(minImmediate);
        }

        return new Min(nonImmediates).copyFrom(this);
    }

    clone(): Expression {
        return new Min(Array.from(this.m_values)).copyFrom(this);
    }

    get children(): Expression[] {
        return Array.from(this.m_values);
    }

    generate_impl(code: CodeBuilder): void {
        code.miscReference('min');
        code.punctuation('(');
        for (let i = 0; i < this.m_values.length; i++) {
            if (i > 0) {
                code.punctuation(',');
                code.whitespace(1);
            }
            code.expression(this.m_values[i]);
        }
        code.punctuation(')');
    }

    protected toString_impl(): string {
        return `min(${this.m_values.map(v => v.toString()).join(', ')})`;
    }
}

export class Max extends Expression {
    private m_values: Expression[];

    constructor(values: Expression[]) {
        super();

        this.m_values = values;
        this.type = values[0].type;
    }

    reduce(): Expression {
        const values = this.m_values.map(v => v.reduce());

        // If there is more than one immediate, we can get the maximum value between
        // them. Then remove all immediates from the list and return just the non-immediates
        // with the maximum immediate value.

        let maxImmediate: Imm | null = null;
        const nonImmediates: Expression[] = [];
        for (const v of values) {
            if (v instanceof Imm) {
                if (maxImmediate === null) maxImmediate = v;
                else maxImmediate = foldConstants(maxImmediate, v, 'gt').value === 0n ? v : maxImmediate;
            } else nonImmediates.push(v);
        }

        if (maxImmediate === null) {
            // there were no immediates, so we can't reduce this expression
            if (values.every((v, idx) => v === this.m_values[idx])) return this;
            return new Max(values).copyFrom(this);
        }

        if (nonImmediates.length === 0) {
            // there were no non-immediates, so we can return the maximum immediate
            return maxImmediate;
        } else {
            nonImmediates.push(maxImmediate);
        }

        return new Max(nonImmediates).copyFrom(this);
    }

    get children(): Expression[] {
        return Array.from(this.m_values);
    }

    clone(): Expression {
        return new Max(Array.from(this.m_values)).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.miscReference('max');
        code.punctuation('(');
        for (let i = 0; i < this.m_values.length; i++) {
            if (i > 0) {
                code.punctuation(',');
                code.whitespace(1);
            }
            code.expression(this.m_values[i]);
        }
        code.punctuation(')');
    }

    protected toString_impl(): string {
        return `max(${this.m_values.map(v => v.toString()).join(', ')})`;
    }
}

export class Clamp extends Expression {
    private m_value: Expression;
    private m_min: Expression;
    private m_max: Expression;

    constructor(value: Expression, min: Expression, max: Expression) {
        super();

        this.m_value = value;
        this.m_min = min;
        this.m_max = max;
        this.type = value.type;
    }

    reduce(): Expression {
        const value = this.m_value.reduce();
        const min = this.m_min.reduce();
        const max = this.m_max.reduce();

        if (value instanceof Imm && min instanceof Imm && max instanceof Imm) {
            if (foldConstants(value, min, 'lt').value !== 0n) return min;
            if (foldConstants(value, max, 'gt').value !== 0n) return max;
            return value;
        }

        if (value === this.m_value && min === this.m_min && max === this.m_max) return this;
        return new Clamp(value, min, max).copyFrom(this);
    }

    get children(): Expression[] {
        return [this.m_value, this.m_min, this.m_max];
    }

    clone(): Expression {
        return new Clamp(this.m_value, this.m_min, this.m_max).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.miscReference('clamp');
        code.punctuation('(');
        code.expression(this.m_value);
        code.punctuation(',');
        code.whitespace(1);
        code.expression(this.m_min);
        code.punctuation(',');
        code.whitespace(1);
        code.expression(this.m_max);
        code.punctuation(')');
    }

    protected toString_impl(): string {
        return `clamp(${this.m_value}, ${this.m_min}, ${this.m_max})`;
    }
}

export class Sqrt extends Expression {
    private m_value: Expression;

    constructor(value: Expression) {
        super();

        this.m_value = value;
        this.type = value.type;
    }

    reduce(): Expression {
        const value = this.m_value.reduce();
        if (!(value instanceof Imm) || !(value.type instanceof PrimitiveType) || !value.type.isFloatingPoint) {
            if (value === this.m_value) return this;
            return new Sqrt(value).copyFrom(this);
        }

        if (value.type.size === 4) {
            return Imm.f32(Math.sqrt(value.toF32())).copyFrom(this);
        }

        return Imm.f64(Math.sqrt(value.toF64())).copyFrom(this);
    }

    get children(): Expression[] {
        return [this.m_value];
    }

    clone(): Expression {
        return new Sqrt(this.m_value).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.miscReference('sqrt');
        code.punctuation('(');
        code.expression(this.m_value);
        code.punctuation(')');
    }

    protected toString_impl(): string {
        return `sqrt(${this.m_value})`;
    }
}

export class GetBits extends Expression {
    private m_source: Expression;
    private m_startBit: Expression;
    private m_count: Expression;

    constructor(source: Expression, startBit: Expression, count: Expression) {
        super();

        this.m_source = source;
        this.m_startBit = startBit;
        this.m_count = count;
        this.type = source.type;
    }

    reduce(): Expression {
        const source = this.m_source.reduce();
        const startBit = this.m_startBit.reduce();
        const count = this.m_count.reduce();

        if (source instanceof Imm && startBit instanceof Imm && count instanceof Imm) {
            const value = source.value;
            const startBitIdx = startBit.value;
            const bitCount = count.value;

            const mask = (1n << bitCount) - 1n;
            const bits = (value >> startBitIdx) & mask;

            return Imm.typed(bits, source.type).copyFrom(this);
        }

        if (source === this.m_source && startBit === this.m_startBit && count === this.m_count) return this;
        return new GetBits(source, startBit, count).copyFrom(this);
    }

    get children(): Expression[] {
        return [this.m_source, this.m_startBit, this.m_count];
    }

    clone(): Expression {
        return new GetBits(this.m_source, this.m_startBit, this.m_count).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.miscReference('getBits');
        code.punctuation('(');
        code.expression(this.m_source);
        code.punctuation(',');
        code.whitespace(1);
        code.expression(this.m_startBit);
        code.punctuation(',');
        code.whitespace(1);
        code.expression(this.m_count);
        code.punctuation(')');
    }

    protected toString_impl(): string {
        return `getBits(${this.m_source}, ${this.m_startBit}, ${this.m_count})`;
    }
}

/**
 * Represents a concatenation of bit strings, where each element has a
 * width of `elementBitWidth`. `elements.length * elementBitWidth` must
 * not exceed `totalBitWidth`. Any bits between the end of the last element
 * and `totalBitWidth` will be set to zero.
 *
 * Elements are concatenated from least significant to most significant
 */
export class ConcatBits extends Expression {
    private m_totalBitWidth: Expression;
    private m_elementBitWidth: Expression;
    private m_elements: Expression[];

    constructor(totalBitWidth: Expression, elementBitWidth: Expression, elements: Expression[]) {
        super();

        this.m_totalBitWidth = totalBitWidth;
        this.m_elementBitWidth = elementBitWidth;
        this.m_elements = elements;

        if (totalBitWidth instanceof Imm) {
            let isSigned = false;
            if (elements[0].type instanceof PrimitiveType) {
                isSigned = elements[0].type.isSigned;
            }

            this.type = TypeSystem.get().getType(`${isSigned ? 'i' : 'u'}${totalBitWidth.value}`);
        } else {
            this.type = elements[0].type;
        }
    }

    reduce(): Expression {
        const totalBitWidth = this.m_totalBitWidth.reduce();
        const elementBitWidth = this.m_elementBitWidth.reduce();
        const elements = this.m_elements.map(e => e.reduce());

        if (
            !(totalBitWidth instanceof Imm) ||
            !(elementBitWidth instanceof Imm) ||
            elements.some(e => !(e instanceof Imm))
        ) {
            if (
                totalBitWidth === this.m_totalBitWidth &&
                elementBitWidth === this.m_elementBitWidth &&
                elements.every((e, idx) => e === this.m_elements[idx])
            )
                return this;
            return new ConcatBits(totalBitWidth, elementBitWidth, elements).copyFrom(this);
        }

        const bitWidth = totalBitWidth.value;
        const elementWidth = elementBitWidth.value;
        const elementBits = (elements as Imm[]).map(e => e.value);

        let resultValue = 0n;
        for (let i = 0; i < elementBits.length; i++) {
            resultValue |= elementBits[i] << (BigInt(i) * elementWidth);
        }

        return Imm.typed(resultValue, TypeSystem.get().getType(`i${bitWidth}`)).copyFrom(this);
    }

    get children(): Expression[] {
        return [this.m_totalBitWidth, this.m_elementBitWidth, ...this.m_elements];
    }

    clone(): Expression {
        return new ConcatBits(this.m_totalBitWidth, this.m_elementBitWidth, Array.from(this.m_elements)).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.miscReference('concatBits');
        code.punctuation('(');
        code.expression(this.m_totalBitWidth);
        code.punctuation(',');
        code.whitespace(1);
        code.expression(this.m_elementBitWidth);
        code.punctuation(',');
        code.whitespace(1);
        for (let i = 0; i < this.m_elements.length; i++) {
            if (i > 0) {
                code.punctuation(',');
                code.whitespace(1);
            }
            code.expression(this.m_elements[i]);
        }
        code.punctuation(')');
    }

    protected toString_impl(): string {
        const elems = this.m_elements.map(e => e.toString()).join(', ');
        return `concatBits(${this.m_totalBitWidth}, ${this.m_elementBitWidth}, ${elems})`;
    }
}
