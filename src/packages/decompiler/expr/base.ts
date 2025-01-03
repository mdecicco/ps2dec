import { Reg } from 'decoder';
import { compareVersionedLocations } from 'utils';
import { Location, VersionedLocation } from '../analysis/ssa';
import { DecompVariable } from '../analysis/vardb';
import { CodeBuilder } from '../codegen/codebuilder';
import { Decompiler } from '../decompiler';
import { ArrayType, DataType, PointerType, PrimitiveType, StructureType, TypeSystem } from '../typesys';

type PropPathResult = {
    accessedType: DataType;
    remainingOffset: number;
    path: string;
};

type GenPropPathResult = {
    accessedType: DataType;
    remainingOffset: number;
    generate: () => void;
};

type IndexInfo = {
    elementSize: number;
    index: Expression;
    indexLocation: VersionedLocation | null;
};

export function getIndexInfo(offset: BinaryExpression): IndexInfo | null {
    if (offset.lhs instanceof Imm) {
        const testExpr = offset.clone() as BinaryExpression;
        testExpr.rhs = Imm.i32(1);
        const result = testExpr.reduce();
        if (result instanceof Imm) {
            return { elementSize: Number(result.value), index: offset.rhs, indexLocation: offset.rhs.location };
        }
    } else if (offset.rhs instanceof Imm) {
        const testExpr = offset.clone() as BinaryExpression;
        testExpr.lhs = Imm.i32(1);
        const result = testExpr.reduce();
        if (result instanceof Imm) {
            return { elementSize: Number(result.value), index: offset.lhs, indexLocation: offset.lhs.location };
        }
    }

    return null;
}

export function extractMemoryReference(expr: Expression): { base: Expression; offset: Expression } | null {
    if (!(expr instanceof Add)) return null;

    if (expr.rhs instanceof Imm) {
        if (expr.rhs.value === 0n) {
            return extractMemoryReference(expr.lhs);
        }

        return { base: expr.lhs, offset: expr.rhs };
    }

    if (expr.lhs instanceof Imm) {
        if (expr.lhs.value === 0n) {
            return extractMemoryReference(expr.rhs);
        }

        return { base: expr.rhs, offset: expr.lhs };
    }

    let base: Expression | null = null;
    let offset: Expression | null = null;

    // First figure out which operand is the base and which is the offset
    if (expr.lhs.type instanceof PointerType) {
        base = expr.lhs;
        offset = expr.rhs;
    } else if (expr.rhs.type instanceof PointerType) {
        base = expr.rhs;
        offset = expr.lhs;
    } else {
        // Neither is a pointer type, not much we can do at this point
        return null;
    }

    return { base, offset };
}

function getPropertyPath(type: DataType, offset: number, propAccessor: string = '.'): PropPathResult | null {
    if (offset > type.size) return null;

    if (type instanceof ArrayType) {
        const elemType = type.elementType;
        const index = Math.floor(offset / elemType.size);
        const offsetFromIndex = offset - index * elemType.size;

        const subPath = getPropertyPath(elemType, offsetFromIndex);
        if (!subPath) {
            return {
                accessedType: elemType,
                remainingOffset: offsetFromIndex,
                path: `[${index}]`
            };
        }

        subPath.path = `[${index}]${subPath.path}`;

        return subPath;
    }

    if (!(type instanceof StructureType)) return null;

    const prop = type.propAtOffset(offset);
    if (!prop) {
        return {
            accessedType: TypeSystem.get().getType('undefined'),
            remainingOffset: 0,
            path: `${propAccessor}field_0x${offset.toString(16)}`
        };
    }

    const propType = TypeSystem.get().getType(prop.typeId);
    const offsetFromProp = offset - prop.offset;

    const subPath = getPropertyPath(propType, offsetFromProp);
    if (!subPath) {
        return {
            accessedType: propType,
            remainingOffset: offsetFromProp,
            path: `${propAccessor}${prop.name}`
        };
    }

    subPath.path = `${propAccessor}${prop.name}.${subPath.path}`;

    return subPath;
}

function formatMem(base: Variable, offset: number, expectedType: DataType) {
    if (!(base.type instanceof PointerType)) {
        if (offset === 0) return `*(${expectedType.name}*)(${base})`;
        if (offset < 0) return `*(${expectedType.name}*)(${base} - ${(-offset).toString(16)})`;
        return `*(${expectedType.name}*)(${base} + 0x${offset.toString(16)})`;
    }

    let result = base.toString();
    const objType = base.type.pointsTo;
    const index = Math.floor(offset / objType.size);
    const remainingOffset = offset - index * objType.size;
    let didDeref = false;

    if (index > 0) {
        result += `[${index}]`;
        didDeref = true;
    }

    const path = getPropertyPath(objType, remainingOffset, didDeref ? '.' : '->');
    if (!path) {
        if (remainingOffset === 0) {
            if (expectedType.id === objType.id) {
                if (didDeref) return result;
                return `*${result}`;
            }

            if (didDeref) {
                return `*(${expectedType.name}*)&${result}`;
            }

            return `*(${expectedType.name}*)${result}`;
        }

        if (didDeref) {
            return `*(${expectedType.name}*)((u8*)(&${result}) + ${remainingOffset})`;
        }

        return `*(${expectedType.name}*)((u8*)(${result}) + ${remainingOffset})`;
    }

    if (path.remainingOffset === 0) {
        if (expectedType.id === path.accessedType.id) {
            return `${result}${path.path}`;
        }

        return `*(${expectedType.name}*)&${result}${path.path}`;
    }

    return `*(${expectedType.name}*)((u8*)(&${result}${path.path}) + ${remainingOffset})`;
}

function genPropertyPath(
    code: CodeBuilder,
    type: DataType,
    offset: number,
    propAccessor: string = '.'
): GenPropPathResult | null {
    if (offset > type.size) return null;

    if (type instanceof ArrayType) {
        const elemType = type.elementType;
        const index = Math.floor(offset / elemType.size);
        const offsetFromIndex = offset - index * elemType.size;

        const subPath = genPropertyPath(code, elemType, offsetFromIndex);
        if (!subPath) {
            return {
                accessedType: elemType,
                remainingOffset: offsetFromIndex,
                generate: () => {
                    code.punctuation('[');
                    code.arrayAccess(type, `${index}`);
                    code.punctuation(']');
                }
            };
        }

        const oldSubPathGen = subPath.generate;

        subPath.generate = () => {
            code.punctuation('[');
            code.arrayAccess(type, `${index}`);
            code.punctuation(']');
            oldSubPathGen();
        };

        return subPath;
    }

    if (!(type instanceof StructureType)) return null;

    const prop = type.propAtOffset(offset);
    if (!prop) {
        const undef = TypeSystem.get().getType('undefined');
        return {
            accessedType: undef,
            remainingOffset: 0,
            generate: () => {
                code.punctuation(propAccessor);
                code.propertyAccess(type, { offset, asType: undef });
            }
        };
    }

    const propType = TypeSystem.get().getType(prop.typeId);
    const offsetFromProp = offset - prop.offset;

    const subPath = genPropertyPath(code, propType, offsetFromProp);
    if (!subPath) {
        return {
            accessedType: propType,
            remainingOffset: offsetFromProp,
            generate: () => {
                code.punctuation(propAccessor);
                code.propertyAccess(type, prop);
            }
        };
    }

    const oldSubPathGen = subPath.generate;

    subPath.generate = () => {
        code.punctuation(propAccessor);
        code.propertyAccess(type, prop);
        code.punctuation('.');
        oldSubPathGen();
    };

    return subPath;
}

function generateMem(code: CodeBuilder, base: Variable, offset: number, expectedType: DataType) {
    if (!(base.type instanceof PointerType)) {
        code.punctuation('*(');
        code.dataType(expectedType);
        code.punctuation('*)(');
        code.expression(base);

        if (offset === 0) {
            code.punctuation(')');
            return;
        }

        code.whitespace(1);

        if (offset < 0) {
            code.punctuation('-');
            code.whitespace(1);
            Imm.i32(-offset).copyFrom(base).generate(code);
            code.punctuation(')');
            return;
        }

        code.punctuation('+');
        code.whitespace(1);
        Imm.i32(offset).copyFrom(base).generate(code);
        code.punctuation(')');
        return;
    }

    const objType = base.type.pointsTo;
    const index = Math.floor(offset / objType.size);
    const remainingOffset = offset - index * objType.size;
    let didDeref = false;

    const genResult = () => {
        code.expression(base);
        if (index > 0) {
            code.punctuation('[');
            Imm.i32(index).copyFrom(base).generate(code);
            code.punctuation(']');
        }
    };

    if (index > 0) {
        didDeref = true;
    }

    const path = genPropertyPath(code, objType, remainingOffset, didDeref ? '.' : '->');
    if (!path) {
        if (remainingOffset === 0) {
            if (expectedType.id === objType.id) {
                if (didDeref) {
                    genResult();
                }

                code.punctuation('*');
                genResult();
                return;
            }

            if (didDeref) {
                code.punctuation('*(');
                code.dataType(expectedType);
                code.punctuation('*)&');
                genResult();
                return;
            }

            code.punctuation('*(');
            code.dataType(expectedType);
            code.punctuation('*)');
            genResult();
            return;
        }

        if (didDeref) {
            code.punctuation('*(');
            code.dataType(expectedType);
            code.punctuation('*)((');
            code.dataType(TypeSystem.get().getType('u8*'));
            code.punctuation(')(&');
            genResult();
            code.punctuation(')');
            code.whitespace(1);
            code.punctuation('+');
            code.whitespace(1);
            Imm.i32(remainingOffset).copyFrom(base).generate(code);
            code.punctuation(')');
            return;
        }

        code.punctuation('*(');
        code.dataType(expectedType);
        code.punctuation('*)((');
        code.dataType(TypeSystem.get().getType('u8*'));
        code.punctuation(')(');
        genResult();
        code.punctuation(')');
        code.whitespace(1);
        code.punctuation('+');
        code.whitespace(1);
        Imm.i32(remainingOffset).copyFrom(base).generate(code);
        code.punctuation(')');
        return;
    }

    if (path.remainingOffset === 0) {
        if (expectedType.id === path.accessedType.id) {
            genResult();
            path.generate();
            return;
        }

        code.punctuation('*(');
        code.dataType(expectedType);
        code.punctuation('*)&');
        genResult();
        path.generate();
        return;
    }

    code.punctuation('*(');
    code.dataType(expectedType);
    code.punctuation('*)((');
    code.dataType(TypeSystem.get().getType('u8*'));
    code.punctuation(')(&');
    genResult();
    path.generate();
    code.punctuation(')');
    code.whitespace(1);
    code.punctuation('+');
    code.whitespace(1);
    Imm.i32(remainingOffset).copyFrom(base).generate(code);
    code.punctuation(')');
}

function foldConstants(
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

function getResultType(inType: DataType, isUnsigned?: boolean, bitWidth?: number): DataType {
    if (isUnsigned === undefined && bitWidth === undefined) return inType;

    let bits = inType.size * 8;
    let isSigned = inType instanceof PrimitiveType ? inType.isSigned : true;

    if (isUnsigned) isSigned = false;
    if (bitWidth) bits = bitWidth;

    return TypeSystem.get().getType(`${isSigned ? 'i' : 'u'}${bits}`);
}

function immIsNice(value: bigint): boolean {
    return value >= -128n && value <= 128n;
}

export abstract class Expression {
    private m_decomp: Decompiler;
    private m_address: number;
    private m_allowPropagation: boolean;
    private m_resultType: DataType;
    private m_cachedString: string | null;
    private m_location: VersionedLocation | null;
    isParenthesized: boolean;

    constructor() {
        this.m_decomp = Decompiler.get();
        this.m_address = this.m_decomp.currentAddress;
        this.m_allowPropagation = true;
        this.m_resultType = TypeSystem.get().getType('undefined');
        this.m_cachedString = null;
        this.isParenthesized = false;
        this.m_location = null;
    }

    get decompiler() {
        return this.m_decomp;
    }

    get address(): number {
        return this.m_address;
    }

    set address(address: number) {
        this.m_address = address;
    }

    get location() {
        return this.m_location;
    }

    set location(location: VersionedLocation | null) {
        this.m_location = location;
    }

    get canPropagate() {
        return this.m_allowPropagation;
    }

    get type(): DataType {
        return this.m_resultType;
    }

    set type(type: DataType | string | number) {
        if (type instanceof DataType) {
            this.m_resultType = type;
            return;
        }

        this.m_resultType = TypeSystem.get().getType(type);
    }

    parenthesize(): Expression {
        this.isParenthesized = true;
        return this;
    }

    generate(code: CodeBuilder): void {
        code.pushAddress(this.address);
        this.generate_impl(code);
        code.popAddress();
    }

    toString(): string {
        // if (this.m_cachedString) return this.m_cachedString;

        let result = this.reduce().toString_impl();
        if (this.isParenthesized) result = `(${result})`;
        this.m_cachedString = result;

        return this.m_cachedString;
    }

    reduce(): Expression {
        return this;
    }

    copyFrom(other: Expression) {
        this.m_decomp = other.m_decomp;
        this.m_address = other.m_address;
        this.m_allowPropagation = other.m_allowPropagation;
        this.isParenthesized = other.isParenthesized;
        this.m_resultType = other.m_resultType;
        this.m_location = other.m_location;
        return this;
    }

    get allChildren(): Expression[] {
        const allChildren: Expression[] = [];
        const ownChildren = this.children;

        for (const child of ownChildren) {
            allChildren.push(child, ...child.allChildren);
        }

        return allChildren;
    }

    get children(): Expression[] {
        return [];
    }

    abstract clone(): Expression;
    abstract generate_impl(code: CodeBuilder): void;
    protected abstract toString_impl(): string;
}

interface LogicalExpr extends Expression {
    logicalInversion(): LogicalExpr;
}

export function isLogical(expr: Expression): expr is LogicalExpr {
    return 'logicalInversion' in expr;
}

export class Null extends Expression {
    constructor() {
        super();
    }

    clone(): Expression {
        return new Null().copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {}

    protected toString_impl(): string {
        return '';
    }
}

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
        return this.m_value.name || Decompiler.get().vars.getDefaultVarName(this.m_value.type);
    }
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
        code.literal(this.toString(), this.type);
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

export class Load extends Expression {
    private m_source: Expression;
    private m_size: number;
    private m_isUnassigned: boolean;

    constructor(source: Expression, size: number, isUnassigned?: boolean) {
        super();
        this.m_source = source;
        this.m_size = size;
        this.m_isUnassigned = !!isUnassigned;

        const src = this.m_source.reduce();
        if (src instanceof Add) {
            if (src.lhs instanceof Variable && src.rhs instanceof Imm) {
                if (src.lhs.type instanceof PointerType) {
                    const prop = getPropertyPath(src.lhs.type.pointsTo, Number(src.rhs.value), '->');
                    if (prop && prop.remainingOffset === 0 && prop.accessedType.size === this.m_size) {
                        this.type = prop.accessedType;
                    }
                }
            } else if (src.lhs instanceof StackPointer && src.rhs instanceof Imm) {
                const offset = Number(src.rhs.value);
                const stackType = src.lhs.getTypeAtOffset(offset);
                if (stackType.size === this.m_size) {
                    this.type = stackType;
                }
            } else {
                const mem = extractMemoryReference(src);
                if (mem && mem.offset instanceof BinaryExpression) {
                    const indexInfo = getIndexInfo(mem.offset);
                    if (indexInfo && indexInfo.elementSize === this.m_size && mem.base.type instanceof PointerType) {
                        this.type = mem.base.type.pointsTo;
                    }
                }
            }
        } else if (src instanceof Variable) {
            if (src.type instanceof PointerType) {
                const prop = getPropertyPath(src.type.pointsTo, 0, '->');
                if (prop && prop.accessedType.size === this.m_size) {
                    this.type = prop.accessedType;
                }
            }
        } else if (src instanceof StackPointer) {
            const stackType = src.getTypeAtOffset(0);
            if (stackType.size === this.m_size) {
                this.type = stackType;
            }
        } else {
            this.type = TypeSystem.get().getType(`${this.m_isUnassigned ? 'u' : 'i'}${this.m_size * 8}`);
        }

        if (this.type.size !== size) {
            this.type = TypeSystem.get().getType(`${this.m_isUnassigned ? 'u' : 'i'}${this.m_size * 8}`);
        }
    }

    get isUnassigned() {
        return this.m_isUnassigned;
    }

    get source() {
        return this.m_source;
    }

    get size() {
        return this.m_size;
    }

    reduce(): Expression {
        const src = this.m_source.reduce();
        if (src === this.m_source) return this;
        return new Load(src, this.m_size, this.m_isUnassigned).copyFrom(this);
    }

    get children(): Expression[] {
        return [this.m_source];
    }

    clone(): Expression {
        return new Load(this.m_source, this.m_size, this.m_isUnassigned).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        const src = this.m_source.reduce();

        if (src instanceof Add) {
            if (src.lhs instanceof Variable && src.rhs instanceof Imm) {
                generateMem(code, src.lhs, Number(src.rhs.value), this.type);
                return;
            } else if (src.lhs instanceof StackPointer && src.rhs instanceof Imm) {
                const offset = Number(src.rhs.value);
                const value = Decompiler.get().getStack(offset, this.address);
                if (value.type === this.type) {
                    code.expression(value);
                    return;
                }

                code.punctuation('(');
                code.dataType(this.type);
                code.punctuation(')');
                code.expression(value);
                return;
            } else {
                const mem = extractMemoryReference(src);
                if (mem && mem.offset instanceof BinaryExpression) {
                    const indexInfo = getIndexInfo(mem.offset);
                    if (indexInfo && indexInfo.elementSize === this.m_size && mem.base.type instanceof PointerType) {
                        if (mem.base.type.pointsTo === this.type) {
                            code.expression(mem.base);
                            code.punctuation('[');
                            code.expression(indexInfo.index);
                            code.punctuation(']');
                            return;
                        }

                        code.punctuation('(');
                        code.dataType(this.type);
                        code.punctuation(')');
                        code.expression(mem.base);
                        code.punctuation('[');
                        code.expression(indexInfo.index);
                        code.punctuation(']');
                        return;
                    }
                }
            }
        } else if (src instanceof Variable) {
            generateMem(code, src, 0, this.type);
            return;
        } else if (src instanceof StackPointer) {
            const value = Decompiler.get().getStack(0, this.address);
            if (value.type === this.type) {
                code.expression(value);
                return;
            }
            code.punctuation('(');
            code.dataType(this.type);
            code.punctuation(')');
            code.expression(value);
            return;
        } else if (src.type instanceof PointerType && src.type.pointsTo === this.type) {
            code.punctuation('*');
            code.expression(src);
            return;
        } else if (src instanceof Imm) {
            code.miscReference(`DAT_${src.value.toString(16).padStart(8, '0')}`);
            return;
        }

        code.punctuation('*(');
        code.dataType(this.type);
        code.punctuation('*)(');
        code.expression(src);
        code.punctuation(')');
    }

    protected toString_impl(): string {
        const src = this.m_source.reduce();

        if (src instanceof Add) {
            if (src.lhs instanceof Variable && src.rhs instanceof Imm) {
                return formatMem(src.lhs, Number(src.rhs.value), this.type);
            } else if (src.lhs instanceof StackPointer && src.rhs instanceof Imm) {
                const offset = Number(src.rhs.value);
                const value = Decompiler.get().getStack(offset, this.address);
                if (value.type === this.type) return value.toString();
                return `(${this.type.name})${value}`;
            } else {
                const mem = extractMemoryReference(src);
                if (mem && mem.offset instanceof BinaryExpression) {
                    const indexInfo = getIndexInfo(mem.offset);
                    if (indexInfo && indexInfo.elementSize === this.m_size && mem.base.type instanceof PointerType) {
                        if (mem.base.type.pointsTo === this.type) {
                            return `${mem.base}[${indexInfo.index}]`;
                        } else {
                            return `(${this.type.name})${mem.base}[${indexInfo.index}]`;
                        }
                    }
                }
            }
        } else if (src instanceof Variable) {
            return formatMem(src, 0, this.type);
        } else if (src instanceof StackPointer) {
            const value = Decompiler.get().getStack(0, this.address);
            if (value.type === this.type) return value.toString();
            return `(${this.type.name})${value}`;
        } else if (src.type instanceof PointerType) {
            if (src.type.pointsTo === this.type) {
                return `*${src}`;
            }
        } else if (src instanceof Imm) {
            return `*(${this.type.name}*)(DAT_${src.value.toString(16).padStart(8, '0')})`;
        }

        return `*(${this.type.name}*)(${src})`;
    }
}

export class Store extends Expression {
    private m_source: Expression;
    private m_dest: Expression;
    private m_size: number;
    private m_isUnassigned: boolean;

    constructor(source: Expression, dest: Expression, size: number, isUnassigned?: boolean) {
        super();
        this.m_source = source;
        this.m_dest = dest;
        this.m_size = size;
        this.m_isUnassigned = !!isUnassigned;
    }

    get isUnassigned() {
        return this.m_isUnassigned;
    }

    get source() {
        return this.m_source;
    }

    get dest() {
        return this.m_dest;
    }

    get size() {
        return this.m_size;
    }

    reduce(): Expression {
        const src = this.m_source.reduce();
        const dest = this.m_dest.reduce();
        if (src === this.m_source && dest === this.m_dest) return this;
        return new Store(src, dest, this.m_size, this.m_isUnassigned).copyFrom(this);
    }

    get children(): Expression[] {
        return [this.m_source, this.m_dest];
    }

    clone(): Expression {
        return new Store(this.m_source, this.m_dest, this.m_size, this.m_isUnassigned).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        let lhs: string;
        let src = this.m_source.reduce();

        let storedType = src.type;
        if (src.type.size !== this.m_size) {
            if (src.type instanceof PrimitiveType && src.type.isFloatingPoint) {
                storedType = TypeSystem.get().getType(`f${this.m_size * 8}`);
            } else {
                storedType = TypeSystem.get().getType(`${this.m_isUnassigned ? 'u' : 'i'}${this.m_size * 8}`);
            }
        }

        const dest = this.m_dest.reduce();

        let mem: { base: Expression; offset: Expression } | null = null;
        let indexInfo: IndexInfo | null = null;

        // prefer destination type over source type if it can be deduced
        if (dest instanceof Add) {
            mem = extractMemoryReference(dest);
            if (mem) {
                if (mem.base instanceof Variable && mem.offset instanceof Imm) {
                    if (mem.base.type instanceof PointerType) {
                        const offset = Number(mem.offset.value);
                        const prop = getPropertyPath(mem.base.type.pointsTo, offset, '->');
                        if (prop && prop.remainingOffset === 0 && prop.accessedType.size === this.m_size) {
                            storedType = prop.accessedType;
                        }
                    }
                } else if (mem.base instanceof StackPointer && mem.offset instanceof Imm) {
                    const offset = Number(mem.offset.value);
                    const stackType = mem.base.getTypeAtOffset(offset);
                    if (stackType.size === this.m_size) {
                        storedType = stackType;
                    }
                } else if (mem.offset instanceof BinaryExpression) {
                    indexInfo = getIndexInfo(mem.offset);
                    if (indexInfo) {
                        if (indexInfo.elementSize === this.m_size && mem.base.type instanceof PointerType) {
                            storedType = mem.base.type.pointsTo;
                        }
                    }
                }
            }
        } else if (dest instanceof Variable) {
            if (dest.type instanceof PointerType) {
                const prop = getPropertyPath(dest.type.pointsTo, 0, '->');
                if (prop && prop.accessedType.size === this.m_size) {
                    storedType = prop.accessedType;
                }
            }
        } else if (dest instanceof StackPointer) {
            const stackType = dest.getTypeAtOffset(0);
            if (stackType.size === this.m_size) {
                storedType = stackType;
            }
        }

        if (storedType !== src.type) {
            if (src instanceof Imm && src.value === 0n && storedType instanceof PointerType) {
                src = new RawString('nullptr');
                src.type = storedType;
            } else {
                src = new PrimitiveCast(src, storedType).reduce();
            }
        }

        if (mem) {
            if (mem.base instanceof Variable && mem.offset instanceof Imm) {
                const offset = Number(mem.offset.value);
                generateMem(code, mem.base, offset, storedType);
            } else if (mem.base instanceof StackPointer && mem.offset instanceof Imm) {
                const offset = Number(mem.offset.value);
                Decompiler.get().getStack(offset, this.address).generate(code);
            } else if (indexInfo && mem.base.type instanceof PointerType && indexInfo.elementSize === this.m_size) {
                code.expression(mem.base);
                code.punctuation('[');
                code.expression(indexInfo.index);
                code.punctuation(']');
            } else {
                code.punctuation('*(');
                code.dataType(storedType);
                code.punctuation('*)(');
                code.expression(mem.base);
                if (mem.offset instanceof Imm) {
                    if (mem.offset.value > 0n) {
                        code.whitespace(1);
                        code.punctuation('+');
                        code.whitespace(1);
                        mem.offset.generate(code);
                    } else if (mem.offset.value < 0n) {
                        code.whitespace(1);
                        code.punctuation('-');
                        code.whitespace(1);
                        foldConstants(mem.offset, mem.offset, 'neg').generate(code);
                    }
                } else {
                    code.whitespace(1);
                    code.punctuation('+');
                    code.whitespace(1);
                    mem.offset.generate(code);
                }
                code.punctuation(')');
            }
        } else if (dest instanceof Variable) {
            generateMem(code, dest, 0, storedType);
        } else if (dest instanceof StackPointer) {
            Decompiler.get().getStack(0, this.address).generate(code);
        } else if (dest instanceof Imm) {
            code.punctuation('*(');
            code.dataType(storedType);
            code.punctuation('*)(');
            code.miscReference(`DAT_${dest.value.toString(16).padStart(8, '0')}`);
            code.punctuation(')');
        } else {
            code.punctuation('*(');
            code.dataType(storedType);
            code.punctuation('*)(');
            code.expression(dest);
            code.punctuation(')');
        }

        code.whitespace(1);
        code.punctuation('=');
        code.whitespace(1);
        code.expression(src);
    }

    protected toString_impl(): string {
        let lhs: string;
        let src = this.m_source.reduce();

        let storedType = src.type;
        if (src.type.size !== this.m_size) {
            if (src.type instanceof PrimitiveType && src.type.isFloatingPoint) {
                storedType = TypeSystem.get().getType(`f${this.m_size * 8}`);
            } else {
                storedType = TypeSystem.get().getType(`${this.m_isUnassigned ? 'u' : 'i'}${this.m_size * 8}`);
            }
        }

        const dest = this.m_dest.reduce();

        let mem: { base: Expression; offset: Expression } | null = null;
        let indexInfo: IndexInfo | null = null;

        // prefer destination type over source type if it can be deduced
        if (dest instanceof Add) {
            mem = extractMemoryReference(dest);
            if (mem) {
                if (mem.base instanceof Variable && mem.offset instanceof Imm) {
                    if (mem.base.type instanceof PointerType) {
                        const offset = Number(mem.offset.value);
                        const prop = getPropertyPath(mem.base.type.pointsTo, offset, '->');
                        if (prop && prop.remainingOffset === 0 && prop.accessedType.size === this.m_size) {
                            storedType = prop.accessedType;
                        }
                    }
                } else if (mem.base instanceof StackPointer && mem.offset instanceof Imm) {
                    const offset = Number(mem.offset.value);
                    const stackType = mem.base.getTypeAtOffset(offset);
                    if (stackType.size === this.m_size) {
                        storedType = stackType;
                    }
                } else if (mem.offset instanceof BinaryExpression) {
                    indexInfo = getIndexInfo(mem.offset);
                    if (indexInfo) {
                        if (indexInfo.elementSize === this.m_size && mem.base.type instanceof PointerType) {
                            storedType = mem.base.type.pointsTo;
                        }
                    }
                }
            }
        } else if (dest instanceof Variable) {
            if (dest.type instanceof PointerType) {
                const prop = getPropertyPath(dest.type.pointsTo, 0, '->');
                if (prop && prop.accessedType.size === this.m_size) {
                    storedType = prop.accessedType;
                }
            }
        } else if (dest instanceof StackPointer) {
            const stackType = dest.getTypeAtOffset(0);
            if (stackType.size === this.m_size) {
                storedType = stackType;
            }
        }

        if (storedType !== src.type) {
            if (src instanceof Imm && src.value === 0n && storedType instanceof PointerType) {
                src = new RawString('nullptr');
                src.type = storedType;
            } else {
                src = new PrimitiveCast(src, storedType).reduce();
            }
        }

        if (mem) {
            if (mem.base instanceof Variable && mem.offset instanceof Imm) {
                const offset = Number(mem.offset.value);
                lhs = formatMem(mem.base, offset, storedType);
            } else if (mem.base instanceof StackPointer && mem.offset instanceof Imm) {
                const offset = Number(mem.offset.value);
                lhs = `${Decompiler.get().getStack(offset, this.address)}`;
            } else if (indexInfo && mem.base.type instanceof PointerType && indexInfo.elementSize === this.m_size) {
                lhs = `${mem.base}[${indexInfo.index}]`;
            } else {
                if (mem.offset instanceof Imm) {
                    if (mem.offset.value === 0n) {
                        lhs = `*(${storedType.name}*)(${mem.base})`;
                    } else if (mem.offset.value > 0n) {
                        lhs = `*(${storedType.name}*)(${mem.base} + ${mem.offset})`;
                    } else {
                        lhs = `*(${storedType.name}*)(${mem.base} - ${foldConstants(mem.offset, mem.offset, 'neg')})`;
                    }
                } else {
                    lhs = `*(${storedType.name}*)(${mem.base} + ${mem.offset})`;
                }
            }
        } else if (dest instanceof Variable) {
            lhs = formatMem(dest, 0, storedType);
        } else if (dest instanceof StackPointer) {
            lhs = `${Decompiler.get().getStack(0, this.address)}`;
        } else if (dest instanceof Imm) {
            lhs = `*(${storedType.name}*)(DAT_${dest.value.toString(16).padStart(8, '0')})`;
        } else lhs = `*(${storedType.name}*)(${dest})`;

        return `${lhs} = ${src}`;
    }
}

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

export class Call extends Expression {
    private m_target: number;

    constructor(target: number) {
        super();
        this.m_target = target;
    }

    get target() {
        return Decompiler.get().funcDb.findFunctionByAddress(this.m_target);
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

        const decomp = Decompiler.get();
        code.func(func);
        code.punctuation('(');
        func.signature.arguments.map((a, idx) => {
            if (idx > 0) {
                code.punctuation(',');
                code.whitespace(1);
            }

            if ('reg' in a.location) {
                decomp.getRegister(a.location.reg).generate(code);
            } else {
                decomp.getStack(a.location.offset, this.address).generate(code);
            }
        });
        code.punctuation(')');
    }

    protected toString_impl(): string {
        const decomp = Decompiler.get();
        const func = this.target;
        if (!func) {
            return `FUN_${this.m_target.toString(16).padStart(8, '0')}()`;
        }

        const args: Expression[] = func.signature.arguments.map(a => {
            if ('reg' in a.location) {
                return decomp.getRegister(a.location.reg);
            }

            return decomp.getStack(a.location.offset, this.address);
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

export class StackPointer extends Expression {
    constructor() {
        super();

        this.type = 'undefined*';
    }

    getTypeAtOffset(offset: number): DataType {
        const decomp = Decompiler.get();
        const val = decomp.getStack(offset);
        return val.type;
    }

    clone(): Expression {
        return new StackPointer().copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {}

    protected toString_impl(): string {
        return `$sp`;
    }
}

export class SSAVariable extends Expression {
    constructor(location: Location, version: number) {
        super();
        this.location = { value: location, version };
        const value = Decompiler.get().getValueForVersion(this.location.value, this.location.version);
        if (value) {
            this.type = value.type;
        }
    }

    reduce(): Expression {
        if (!this.location) return this;

        const decomp = Decompiler.get();
        const value = decomp.getValueForVersion(this.location.value, this.location.version);
        if (value) {
            if (value instanceof SSAVariable && value.location) {
                if (compareVersionedLocations(this.location, value.location)) {
                    return value;
                }
            } else if (value === this) {
                return value;
            }

            return value.reduce().copyFrom(this);
        }

        return this;
    }

    clone(): Expression {
        if (!this.location) throw new Error('Invalid SSAVariable');
        return new SSAVariable(this.location.value, this.location.version).copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {
        if (!this.location) throw new Error('Invalid SSAVariable');

        const decomp = Decompiler.get();
        const instr = decomp.getInstruction(this.address);
        if (instr) {
            // Try to get the actual value for this version
            const value = decomp.getValueForVersion(this.location.value, this.location.version);
            if (value) {
                value.copyFrom(this);
                value.reduce().generate(code);
                return;
            }
        }

        if (typeof this.location.value === 'number') {
            code.miscReference(`stack_${this.location.value.toString(16)}_${this.location.version}`);
        } else {
            code.miscReference(`${Reg.formatRegister(this.location.value).slice(1)}_${this.location.version}`);
        }
    }

    protected toString_impl(): string {
        if (!this.location) return `Invalid SSAVariable`;

        /*
        const decomp = Decompiler.get();
        const instr = decomp.getInstruction(this.address);
        if (instr) {
            // Try to get the actual value for this version
            const value = decomp.getValueForVersion(this.location.value, this.location.version);
            if (value) {
                value.copyFrom(this);
                return value.reduce().toString();
            }
        }
        */

        if (typeof this.location.value === 'number') {
            return `stack_${this.location.value.toString(16)}_${this.location.version}`;
        } else {
            return `${Reg.formatRegister(this.location.value).slice(1)}_${this.location.version}`;
        }
    }
}
