import { CodeBuilder, DataType, PrimitiveType, TypeSystem } from 'decompiler';
import { Expression } from './base';
import { BinaryExpression } from './binary';
import { Imm } from './immediate';

export class PrimitiveCast extends Expression {
    private m_value: Expression;

    constructor(value: Expression, asType: DataType | string) {
        super();

        this.m_value = value;
        this.type = typeof asType === 'string' ? TypeSystem.get().getType(asType) : asType;
    }

    reduce(): Expression {
        const value = this.m_value.reduce();
        if (value.type === this.type) return value;
        if (!(value instanceof Imm)) {
            if (value === this.m_value) return this;
            return new PrimitiveCast(value, this.type).copyFrom(this);
        }

        const imm = value;
        if (imm.type instanceof PrimitiveType) {
            if (imm.type.isFloatingPoint) {
                let src: number;
                if (imm.type.size === 4) {
                    // convert from f32
                    src = imm.toF32();
                } else {
                    // convert from f64
                    src = imm.toF64();
                }

                if (this.type instanceof PrimitiveType) {
                    if (this.type.isFloatingPoint) {
                        if (this.type.size === 4) {
                            return Imm.f32(src).copyFrom(this);
                        } else {
                            return Imm.f64(src).copyFrom(this);
                        }
                    } else {
                        // convert from floating point to integer
                        if (this.type.isSigned) {
                            switch (this.type.size) {
                                case 1:
                                    return Imm.i8(Math.trunc(src)).copyFrom(this);
                                case 2:
                                    return Imm.i16(Math.trunc(src)).copyFrom(this);
                                case 4:
                                    return Imm.i32(Math.trunc(src)).copyFrom(this);
                                case 8:
                                    return Imm.i64(Math.trunc(src)).copyFrom(this);
                                case 16:
                                    return Imm.i128(Math.trunc(src)).copyFrom(this);
                            }
                        } else {
                            switch (this.type.size) {
                                case 1:
                                    return Imm.u8(Math.trunc(src)).copyFrom(this);
                                case 2:
                                    return Imm.u16(Math.trunc(src)).copyFrom(this);
                                case 4:
                                    return Imm.u32(Math.trunc(src)).copyFrom(this);
                                case 8:
                                    return Imm.u64(Math.trunc(src)).copyFrom(this);
                                case 16:
                                    return Imm.u128(Math.trunc(src)).copyFrom(this);
                            }
                        }
                    }
                }
            } else {
                // convert from integer
                if (this.type instanceof PrimitiveType) {
                    if (this.type.isFloatingPoint) {
                        if (this.type.size === 4) {
                            return Imm.f32(imm.toF32()).copyFrom(this);
                        } else {
                            return Imm.f64(imm.toF64()).copyFrom(this);
                        }
                    } else {
                        if (this.type.isSigned) {
                            switch (this.type.size) {
                                case 1:
                                    return Imm.i8(imm.value).copyFrom(this);
                                case 2:
                                    return Imm.i16(imm.value).copyFrom(this);
                                case 4:
                                    return Imm.i32(imm.value).copyFrom(this);
                                case 8:
                                    return Imm.i64(imm.value).copyFrom(this);
                                case 16:
                                    return Imm.i128(imm.value).copyFrom(this);
                            }
                        } else {
                            switch (this.type.size) {
                                case 1:
                                    return Imm.u8(imm.value).copyFrom(this);
                                case 2:
                                    return Imm.u16(imm.value).copyFrom(this);
                                case 4:
                                    return Imm.u32(imm.value).copyFrom(this);
                                case 8:
                                    return Imm.u64(imm.value).copyFrom(this);
                                case 16:
                                    return Imm.u128(imm.value).copyFrom(this);
                            }
                        }
                    }
                }
            }
        }

        if (value === this.m_value) return this;
        return new PrimitiveCast(value, this.type).copyFrom(this);
    }

    get children(): Expression[] {
        return [this.m_value];
    }

    clone(): Expression {
        return new PrimitiveCast(this.m_value, this.type).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.punctuation('(');
        code.dataType(this.type);
        code.punctuation(')');

        if (this.m_value instanceof BinaryExpression) this.m_value.parenthesize();
        code.expression(this.m_value);
    }

    protected toString_impl(): string {
        return `(${this.type.name})${this.m_value}`;
    }
}

export function cast(expr: Expression, type: DataType | string) {
    let tp = type instanceof DataType ? type : TypeSystem.get().getType(type);
    if (expr.type === tp) return expr;
    return new PrimitiveCast(expr, tp);
}
