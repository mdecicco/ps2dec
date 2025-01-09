import { DataType, PrimitiveType, TypeSystem } from 'decompiler';
import { Imm } from './immediate';

export function foldConstants(
    lhsImm: Imm,
    rhsImm: Imm,
    operation: 'add' | 'sub' | 'mul' | 'div' | 'mod' | 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge' | 'abs' | 'neg'
): Imm {
    let lhs: bigint | number;
    let rhs: bigint | number;
    let resultMask: bigint;
    let isSigned: boolean;

    if (lhsImm.type instanceof PrimitiveType) {
        if (lhsImm.type.isFloatingPoint) {
            if (lhsImm.type.size === 4) {
                lhs = lhsImm.toF32();
                rhs = rhsImm.toF32();
                resultMask = 0xffffffffn;
            } else if (lhsImm.type.size === 8) {
                lhs = lhsImm.toF64();
                rhs = rhsImm.toF64();
                resultMask = 0xffffffffffffffffn;
            } else {
                throw new Error(`Unsupported floating point size: ${lhsImm.type.size}`);
            }

            isSigned = false;
        } else {
            lhs = lhsImm.value;
            rhs = rhsImm.value;
            resultMask = (1n << BigInt(lhsImm.type.size * 8)) - 1n;
            isSigned = lhsImm.type.isSigned;
        }
    } else {
        lhs = lhsImm.value;
        rhs = rhsImm.value;
        resultMask = 0xffffffffn;
        isSigned = false;
    }

    if (typeof lhs === 'number' && typeof rhs === 'number') {
        // Floating point operations
        let result: number;
        switch (operation) {
            case 'add': {
                result = lhs + rhs;
                break;
            }
            case 'sub': {
                result = lhs - rhs;
                break;
            }
            case 'mul': {
                result = lhs * rhs;
                break;
            }
            case 'div': {
                result = lhs / rhs;
                break;
            }
            case 'mod': {
                result = lhs % rhs;
                break;
            }
            case 'eq': {
                return Imm.bool(lhs === rhs).copyFrom(lhsImm);
            }
            case 'ne': {
                return Imm.bool(lhs !== rhs).copyFrom(lhsImm);
            }
            case 'lt': {
                return Imm.bool(lhs < rhs).copyFrom(lhsImm);
            }
            case 'le': {
                return Imm.bool(lhs <= rhs).copyFrom(lhsImm);
            }
            case 'gt': {
                return Imm.bool(lhs > rhs).copyFrom(lhsImm);
            }
            case 'ge': {
                return Imm.bool(lhs >= rhs).copyFrom(lhsImm);
            }
            case 'abs': {
                result = Math.abs(lhs);
                break;
            }
            case 'neg': {
                result = -lhs;
                break;
            }
        }

        if (lhsImm.type.size === 4) return Imm.f32(result).copyFrom(lhsImm);
        if (lhsImm.type.size === 8) return Imm.f64(result).copyFrom(lhsImm);

        throw new Error(`Unsupported floating point size: ${lhsImm.type.size}`);
    }

    if (typeof lhs === 'bigint' && typeof rhs === 'bigint') {
        let result: bigint;
        // unsigned integer operations
        switch (operation) {
            case 'add': {
                result = lhs + rhs;
                break;
            }
            case 'sub': {
                result = lhs - rhs;
                break;
            }
            case 'mul': {
                result = lhs * rhs;
                break;
            }
            case 'div': {
                result = lhs / rhs;
                break;
            }
            case 'mod': {
                result = lhs % rhs;
                break;
            }
            case 'eq': {
                return Imm.bool(lhs === rhs).copyFrom(lhsImm);
            }
            case 'ne': {
                return Imm.bool(lhs !== rhs).copyFrom(lhsImm);
            }
            case 'lt': {
                return Imm.bool(lhs < rhs).copyFrom(lhsImm);
            }
            case 'le': {
                return Imm.bool(lhs <= rhs).copyFrom(lhsImm);
            }
            case 'gt': {
                return Imm.bool(lhs > rhs).copyFrom(lhsImm);
            }
            case 'ge': {
                return Imm.bool(lhs >= rhs).copyFrom(lhsImm);
            }
            case 'abs': {
                if (isSigned) {
                    result = lhs < 0n ? -lhs : lhs;
                } else {
                    result = lhs;
                }
                break;
            }
            case 'neg': {
                result = -lhs;
                break;
            }
        }

        return Imm.typed(result & resultMask, lhsImm.type).copyFrom(lhsImm);
    }

    throw new Error(`Unsupported operation: ${lhsImm.type.name} ${operation} ${rhsImm.type.name}`);
}

export function getResultType(inType: DataType, isUnsigned?: boolean, bitWidth?: number): DataType {
    if (isUnsigned === undefined && bitWidth === undefined) return inType;

    let bits = inType.size * 8;
    let isSigned = inType instanceof PrimitiveType ? inType.isSigned : true;

    if (isUnsigned) isSigned = false;
    if (bitWidth) bits = bitWidth;

    return TypeSystem.get().getType(`${isSigned ? 'i' : 'u'}${bits}`);
}
