import { CodeBuilder } from 'decompiler';
import { DataType, PrimitiveType, TypeSystem } from 'typesys';

import { Expression } from './base';

export function immIsNice(value: bigint): boolean {
    // If the hex would be the same as the decimal other than the '0x' then just show it as a decimal
    return value >= -9n && value <= 9n;
}

export class Imm extends Expression {
    private static convBuf = new ArrayBuffer(8);
    private static convView = new DataView(Imm.convBuf, 0, 8);
    private m_value: bigint;

    private constructor(value: bigint | number, type: DataType | string | number) {
        super();
        this.m_value = typeof value === 'number' ? BigInt(value) : value;
        this.type = type;
    }

    get value() {
        return this.m_value;
    }

    clone(): Expression {
        return new Imm(this.m_value, this.type).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        code.literal(this.toString(), this.type, this.m_value);
    }

    protected toString_impl(): string {
        if (this.type.name === 'bool') return this.m_value === 1n ? 'true' : 'false';
        if (this.m_value === 0n) return '0';

        if (this.type instanceof PrimitiveType && this.type.isFloatingPoint) {
            if (this.type.size === 4) {
                const str = this.toF32().toString();
                if (str.includes('.')) return `${str}f`;
                return `${str}.0f`;
            }

            if (this.type.size === 8) {
                const str = this.toF64().toString();
                if (str.includes('.')) return str;
                return `${str}.0`;
            }
        }

        if (immIsNice(this.m_value)) return this.m_value.toString();

        if (this.m_value < 0n) return `-0x${(-this.m_value).toString(16)}`;
        return `0x${this.m_value.toString(16)}`;
    }

    toF32(): number {
        Imm.convView.setUint32(0, Number(this.m_value & 0xffffffffn), true);
        return Imm.convView.getFloat32(0, true);
    }

    toF64(): number {
        Imm.convView.setBigUint64(0, this.m_value & 0xffffffffffffffffn, true);
        return Imm.convView.getFloat64(0, true);
    }

    static typed(value: bigint | number, type: DataType | string | number): Imm {
        const tp = type instanceof DataType ? type : TypeSystem.get().getType(type);
        if (tp instanceof PrimitiveType) {
            if (tp.name === 'bool') {
                value = !!value ? 1n : 0n;
            } else if (tp.isFloatingPoint) {
                if (typeof value !== 'number') {
                    throw new Error(
                        `Imm.typed: expected number when creating floating point immediate, got ${typeof value}`
                    );
                }

                if (tp.size === 4) {
                    Imm.convView.setFloat32(0, value, true);
                    value = Imm.convView.getUint32(0, true);
                } else if (tp.size === 8) {
                    Imm.convView.setFloat64(0, value, true);
                    value = Imm.convView.getBigUint64(0, true);
                } else {
                    throw new Error(`Unsupported floating point size: ${tp.size}`);
                }
            } else if (tp.isSigned) {
                switch (tp.size) {
                    case 1:
                        Imm.convView.setInt8(0, Number(BigInt(value) & 0xffn));
                        value = Imm.convView.getInt8(0);
                        break;
                    case 2:
                        Imm.convView.setInt16(0, Number(BigInt(value) & 0xffffn), true);
                        value = Imm.convView.getInt16(0, true);
                        break;
                    case 4:
                        Imm.convView.setInt32(0, Number(BigInt(value) & 0xffffffffn), true);
                        value = Imm.convView.getInt32(0, true);
                        break;
                    case 8:
                        Imm.convView.setBigInt64(0, BigInt(value) & 0xffffffffffffffffn, true);
                        value = Imm.convView.getBigInt64(0, true);
                        break;
                }
            } else {
                switch (tp.size) {
                    case 1:
                        Imm.convView.setUint8(0, Number(BigInt(value) & 0xffn));
                        value = Imm.convView.getUint8(0);
                        break;
                    case 2:
                        Imm.convView.setUint16(0, Number(BigInt(value) & 0xffffn), true);
                        value = Imm.convView.getUint16(0, true);
                        break;
                    case 4:
                        Imm.convView.setUint32(0, Number(BigInt(value) & 0xffffffffn), true);
                        value = Imm.convView.getUint32(0, true);
                        break;
                    case 8:
                        Imm.convView.setBigUint64(0, BigInt(value) & 0xffffffffffffffffn, true);
                        value = Imm.convView.getBigUint64(0, true);
                        break;
                }
            }
        }

        return new Imm(value, type);
    }

    static i8(value: bigint | number): Imm {
        return Imm.typed(value, 'i8');
    }

    static u8(value: bigint | number): Imm {
        return Imm.typed(value, 'u8');
    }

    static i16(value: bigint | number): Imm {
        return Imm.typed(value, 'i16');
    }

    static u16(value: bigint | number): Imm {
        return Imm.typed(value, 'u16');
    }

    static i32(value: bigint | number): Imm {
        return Imm.typed(value, 'i32');
    }

    static u32(value: bigint | number): Imm {
        return Imm.typed(value, 'u32');
    }

    static i64(value: bigint | number): Imm {
        return Imm.typed(value, 'i64');
    }

    static u64(value: bigint | number): Imm {
        return Imm.typed(value, 'u64');
    }

    static i128(value: bigint | number): Imm {
        return Imm.typed(value, 'i128');
    }

    static u128(value: bigint | number): Imm {
        return Imm.typed(value, 'u128');
    }

    static f32(value: number): Imm {
        return Imm.typed(value, 'f32');
    }

    static f64(value: number): Imm {
        return Imm.typed(value, 'f64');
    }

    static bool(value: boolean): Imm {
        return new Imm(value ? 1n : 0n, 'bool');
    }
}
