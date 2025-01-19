import { CodeBuilder, Decompiler } from 'decompiler';
import { VersionedLocation } from 'types';
import { ArrayType, DataType, PointerType, PrimitiveType, StructureType, TypeSystem } from 'typesys';

import { Expression } from './base';
import { Add, BinaryExpression } from './binary';
import { foldConstants } from './common';
import { cast } from './conversion';
import { Imm } from './immediate';
import { RawString, Variable } from './utility';

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

export function getPropertyPath(type: DataType, offset: number, propAccessor: string = '.'): PropPathResult | null {
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

export function formatMem(base: Expression, offset: number, expectedType: DataType) {
    const baseType = base.type;
    if (!(baseType instanceof PointerType)) {
        if (offset === 0) return `*(${expectedType.name}*)(${base})`;
        if (offset < 0) return `*(${expectedType.name}*)(${base} - ${(-offset).toString(16)})`;
        return `*(${expectedType.name}*)(${base} + 0x${offset.toString(16)})`;
    }

    let result = base.toString();
    const objType = baseType.pointsTo;
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

export function genPropertyPath(
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

export function generateMem(code: CodeBuilder, base: Expression, offset: number, expectedType: DataType) {
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

export class StackPointer extends Expression {
    constructor() {
        super();

        this.type = 'undefined*';
    }

    getTypeAtOffset(offset: number, atAddress?: number): DataType {
        const decomp = Decompiler.current;
        try {
            const val = decomp.getStack(offset, atAddress);
            return val.type;
        } catch (e) {
            return TypeSystem.get().getType('undefined');
        }
    }

    clone(): Expression {
        return new StackPointer().copyFrom(this);
    }

    generate_impl(code: CodeBuilder): void {}

    protected toString_impl(): string {
        return `$sp`;
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
                const stackType = src.lhs.getTypeAtOffset(offset, this.address);
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
            const stackType = src.getTypeAtOffset(0, this.address);
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
        if (src instanceof Add) {
            let sp: StackPointer | null = null;
            let offset: number | null = null;
            if (src.lhs instanceof StackPointer && src.rhs instanceof Imm) {
                sp = src.lhs;
                offset = Number(src.rhs.value);
            } else if (src.rhs instanceof StackPointer && src.lhs instanceof Imm) {
                sp = src.rhs;
                offset = Number(src.lhs.value);
            }

            if (sp && offset !== null) {
                return Decompiler.current.getStack(offset, this.address);
            }
        }

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
                const value = Decompiler.current.getStack(offset, this.address);
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
            const value = Decompiler.current.getStack(0, this.address);
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
                const value = Decompiler.current.getStack(offset, this.address);
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
            const value = Decompiler.current.getStack(0, this.address);
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

        if (dest instanceof StackPointer) {
            // Spills should not be rendered
            return;
        }

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
                } else if (mem.base instanceof StackPointer /* && mem.offset instanceof Imm */) {
                    // Commented out because spills should not be rendered
                    // const offset = Number(mem.offset.value);
                    // const stackType = mem.base.getTypeAtOffset(offset, this.address);
                    // if (stackType.size === this.m_size) {
                    //     storedType = stackType;
                    // }
                    return;
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
            const stackType = dest.getTypeAtOffset(0, this.address);
            if (stackType.size === this.m_size) {
                storedType = stackType;
            }
        }

        if (storedType !== src.type) {
            if (src instanceof Imm && src.value === 0n && storedType instanceof PointerType) {
                src = new RawString('nullptr', storedType, code => {
                    code.keyword('nullptr');
                });
            } else {
                src = cast(src, storedType).reduce();
            }
        }

        if (mem) {
            if (mem.base instanceof Variable && mem.offset instanceof Imm) {
                const offset = Number(mem.offset.value);
                generateMem(code, mem.base, offset, storedType);
            } else if (mem.base instanceof StackPointer && mem.offset instanceof Imm) {
                const offset = Number(mem.offset.value);
                Decompiler.current.getStack(offset, this.address).generate(code);
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
            Decompiler.current.getStack(0, this.address).generate(code);
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
                    const stackType = mem.base.getTypeAtOffset(offset, this.address);
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
            const stackType = dest.getTypeAtOffset(0, this.address);
            if (stackType.size === this.m_size) {
                storedType = stackType;
            }
        }

        if (storedType !== src.type) {
            if (src instanceof Imm && src.value === 0n && storedType instanceof PointerType) {
                src = new RawString('nullptr', storedType, code => {
                    code.keyword('nullptr');
                });
            } else {
                src = cast(src, storedType).reduce();
            }
        }

        if (mem) {
            if (mem.base instanceof Variable && mem.offset instanceof Imm) {
                const offset = Number(mem.offset.value);
                lhs = formatMem(mem.base, offset, storedType);
            } else if (mem.base instanceof StackPointer && mem.offset instanceof Imm) {
                const offset = Number(mem.offset.value);
                lhs = `${Decompiler.current.getStack(offset, this.address)}`;
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
            lhs = `${Decompiler.current.getStack(0, this.address)}`;
        } else if (dest instanceof Imm) {
            lhs = `*(${storedType.name}*)(DAT_${dest.value.toString(16).padStart(8, '0')})`;
        } else lhs = `*(${storedType.name}*)(${dest})`;

        return `${lhs} = ${src}`;
    }
}
