import { EventProducer } from 'utils';
import { ValueLocation } from '../value';
import { CallConfig, CallConv, getCallConfig } from './callconv';
import { Method } from './function';
import { TypeSystem } from './typesys';
import { VTable } from './vtable';

/**
 * Represents a property/field in a data type
 */
export interface TypeProperty {
    /** Name of the property */
    name: string;

    /** Type ID of the property */
    typeId: number;

    /** Offset in bytes from the start of the containing type */
    offset: number;
}

/**
 * Represents inheritance information for a type
 */
export interface TypeInheritance {
    /** Type ID of the parent type */
    typeId: number;

    /** Offset of the parent type's data in the child type's structure */
    offset: number;

    /** Information about the vtable, if one exists for this parent */
    vtableInfo: {
        /** VTable for the child class that inherits the parent's */
        vtable: VTable;

        /** Offset of the vtable in the child type's structure */
        offset: number;
    } | null;
}

export interface ArgumentInfo {
    location: ValueLocation;
    typeId: number;
}

type DataTypeEvents = {
    'name-changed': (newName: string, oldName: string) => void;
    'size-changed': (newSize: number, oldSize: number) => void;
    'property-added': (prop: TypeProperty) => void;
    'method-added': (method: Method) => void;
    'method-replaced': (newMethod: Method, oldMethod: Method) => void;
    'method-removed': (method: Method) => void;
    'base-added': (base: TypeInheritance) => void;
    'enum-field-added': (name: string, value: number) => void;
    'bitfield-field-added': (name: string, bitIndex: number) => void;
};

export abstract class DataType extends EventProducer<DataTypeEvents> {
    private m_id: number;
    private m_size: number;
    private m_name: string;

    constructor(id: number) {
        super();
        this.m_id = id;
        this.m_size = 0;
        this.m_name = `TYPE_${id}`;
    }

    get id(): number {
        return this.m_id;
    }

    get size(): number {
        return this.m_size;
    }

    get name(): string {
        return this.m_name;
    }

    set name(name: string) {
        const oldName = this.m_name;
        this.m_name = name;
        this.dispatch('name-changed', name, oldName);
    }

    protected setSize(size: number) {
        const oldSize = this.m_size;
        this.m_size = size;
        this.dispatch('size-changed', size, oldSize);
    }
}

export class PrimitiveType extends DataType {
    private m_isSigned: boolean;
    private m_isFloatingPoint: boolean;

    constructor(id: number, isSigned: boolean, isFloatingPoint: boolean, size: number) {
        super(id);

        this.m_isSigned = isSigned;
        this.m_isFloatingPoint = isFloatingPoint;
        this.setSize(size);
    }

    get isSigned() {
        return this.m_isSigned;
    }

    get isFloatingPoint() {
        return this.m_isFloatingPoint;
    }
}

export class StructureType extends DataType {
    private m_properties: TypeProperty[];
    private m_methods: Method[];
    private m_baseTypes: TypeInheritance[];
    private m_vtable: VTable | null;

    constructor(id: number) {
        super(id);
        this.m_properties = [];
        this.m_methods = [];
        this.m_baseTypes = [];
        this.m_vtable = null;
    }

    get properties() {
        const props: TypeProperty[] = [];
        const ts = TypeSystem.get();

        this.m_baseTypes.forEach(b => {
            const tp = ts.getType(b.typeId) as StructureType;
            const inheritedProps = tp.properties;

            inheritedProps.forEach(p => {
                props.push({
                    name: p.name,
                    typeId: p.typeId,
                    offset: b.offset + p.offset
                });
            });
        });

        props.push(...this.m_properties);

        return props;
    }

    get ownProperties() {
        return this.m_properties;
    }

    get methods() {
        const methods: Method[] = [];
        const ts = TypeSystem.get();

        this.m_baseTypes.forEach(b => {
            const tp = ts.getType(b.typeId) as StructureType;
            methods.push(...tp.methods);
        });

        methods.push(...this.m_methods);

        return methods;
    }

    get ownMethods() {
        return this.m_methods;
    }

    get baseTypes() {
        return this.m_baseTypes;
    }

    get vtable() {
        return this.m_vtable;
    }

    addBase(type: StructureType, offset: number, vtableOffset?: number) {
        let vtableInfo: TypeInheritance['vtableInfo'] | null = null;
        if (vtableOffset !== undefined) {
            vtableInfo = {
                vtable: TypeSystem.get().createVtable(type.vtable),
                offset: vtableOffset
            };
        }

        const base = {
            typeId: type.id,
            offset,
            vtableInfo
        };

        this.m_baseTypes.push(base);

        this.dispatch('base-added', base);
    }

    addMethod(method: Method) {
        this.m_methods.push(method);
        this.dispatch('method-added', method);
    }

    replaceMethod(oldMethod: Method, newMethod: Method) {
        this.m_methods.some((m, idx) => {
            if (m !== oldMethod) return false;
            this.m_methods[idx] = newMethod;
            this.dispatch('method-replaced', newMethod, oldMethod);
            return true;
        });
    }

    removeMethod(method: Method) {
        this.m_methods.some((m, idx) => {
            if (m !== method) return false;
            this.m_methods.splice(idx, 1);
            this.dispatch('method-removed', method);
            return true;
        });
    }

    addProperty(name: string, offset: number, type: DataType) {
        const trimmed = name.trim();
        const ts = TypeSystem.get();

        this.properties.forEach(p => {
            if (p.name === trimmed) throw new Error(`Type '${this.name}' already has a property named '${trimmed}'`);
            const tp = ts.getType(p.typeId);

            const aBegin = offset;
            const aEnd = aBegin + type.size;
            const bBegin = p.offset;
            const bEnd = bBegin + tp.size;

            const aBeginsInB = aBegin >= bBegin && aBegin < bEnd;
            const aEndsInB = aEnd >= bBegin && aEnd < bEnd;
            const aContainsB = aBegin <= bBegin && aEnd >= bEnd;
            const bContainsA = bBegin <= aBegin && bEnd > aEnd;

            if (aBeginsInB || aEndsInB || aContainsB || bContainsA) {
                throw new Error(
                    `Cannot add property '${name}' to type '${this.name}' because the specified offset/type overlap with existing property '${p.name}'`
                );
            }
        });

        const prop = {
            name: trimmed,
            offset,
            typeId: type.id
        };

        if (offset + type.size > this.size) {
            const diff = offset + type.size - this.size;
            this.setSize(this.size + diff);
        }

        this.m_properties.push(prop);
        this.dispatch('property-added', prop);
    }

    createVtable() {
        if (this.m_vtable) {
            throw new Error(`Vtable for type '${this.name}' already created`);
        }

        this.m_vtable = TypeSystem.get().createVtable();
    }

    propAtOffset(offset: number) {
        const prop = this.properties.find(p => {
            if (p.offset > offset) return false;

            const tp = TypeSystem.get().getType(p.typeId);
            if (p.offset + tp.size <= offset) return false;

            return true;
        });

        return prop || null;
    }

    static rehydrate(
        id: number,
        properties: TypeProperty[],
        methods: Method[],
        baseTypes: TypeInheritance[],
        vtable: VTable | null,
        name: string
    ) {
        const tp = new StructureType(id);
        tp.name = name;
        tp.m_properties = properties;
        tp.m_methods = methods;
        tp.m_baseTypes = baseTypes;
        tp.m_vtable = vtable;
        return tp;
    }
}

export class PointerType extends DataType {
    private m_pointedTypeId: number;

    constructor(id: number, pointsTo: DataType) {
        super(id);

        this.m_pointedTypeId = pointsTo.id;
        this.name = PointerType.generateName(pointsTo);
        this.setSize(4);
    }

    get pointsTo() {
        return TypeSystem.get().getType(this.m_pointedTypeId);
    }

    static generateName(pointsTo: DataType) {
        return `${pointsTo.name}*`;
    }

    static rehydrate(id: number, pointsToId: number, name: string) {
        const voidT = TypeSystem.get().getType('void');
        const tp = new PointerType(id, voidT);
        tp.name = name;
        tp.m_pointedTypeId = pointsToId;
        return tp;
    }
}

export class ArrayType extends DataType {
    private m_elementTypeId: number;
    private m_length: number;

    constructor(id: number, elementType: DataType, length: number) {
        super(id);

        this.m_elementTypeId = elementType.id;
        this.m_length = length;

        this.name = ArrayType.generateName(elementType, length);
        this.setSize(elementType.size * length);
    }

    get elementType() {
        return TypeSystem.get().getType(this.m_elementTypeId);
    }

    get length() {
        return this.m_length;
    }

    static generateName(elementType: DataType, length: number) {
        return `${elementType.name}[${length}]`;
    }

    static rehydrate(id: number, elementTypeId: number, length: number, size: number, name: string) {
        const voidT = TypeSystem.get().getType('void');
        const tp = new ArrayType(id, voidT, length);
        tp.name = name;
        tp.m_elementTypeId = elementTypeId;
        tp.setSize(size);
        return tp;
    }
}

export class FunctionSignatureType extends DataType {
    protected m_returnTypeId: number;
    protected m_callConf!: CallConfig;
    protected m_arguments!: ArgumentInfo[];
    protected m_isVariadic: boolean;

    protected initCallConf(returnType: DataType, argumentTypes: DataType[], thisType?: DataType) {
        this.m_callConf = getCallConfig(CallConv.CDecl, returnType, argumentTypes, thisType);

        this.m_arguments = argumentTypes.map((a, idx) => {
            return {
                location: this.m_callConf.argumentLocations[idx],
                typeId: a.id
            };
        });
    }

    constructor(id: number, returnType: DataType, argumentTypes: DataType[], isVariadic?: boolean) {
        super(id);
        this.m_returnTypeId = returnType.id;
        this.m_isVariadic = isVariadic || false;

        this.setSize(4);
        this.name = FunctionSignatureType.generateName(returnType, argumentTypes);

        this.initCallConf(returnType, argumentTypes);
    }

    get returnType() {
        return TypeSystem.get().getType(this.m_returnTypeId);
    }

    get argumentTypes() {
        const ts = TypeSystem.get();
        return this.m_arguments.map(a => ts.getType(a.typeId));
    }

    get arguments() {
        return this.m_arguments;
    }

    get returnLocation() {
        return this.m_callConf.returnValueLocation;
    }

    get callConfig() {
        return this.m_callConf;
    }

    get isVariadic() {
        return this.m_isVariadic;
    }

    getArgType(idx: number) {
        if (idx >= this.m_arguments.length) {
            throw new Error(`Argument index ${idx} out of range`);
        }

        return TypeSystem.get().getType(this.m_arguments[idx].typeId);
    }

    static generateName(returnType: DataType, argumentTypes: DataType[], methodOf?: DataType) {
        if (methodOf) {
            return `${returnType.name} ${methodOf.name}::(${argumentTypes.map(t => t.name).join(',')})`;
        }

        return `${returnType.name}(${argumentTypes.map(t => t.name).join(',')})`;
    }

    static rehydrate(
        id: number,
        returnTypeId: number,
        thisTypeId: number | null,
        argumentTypeIds: number[],
        conf: CallConfig,
        name: string,
        isVariadic: boolean
    ) {
        const ts = TypeSystem.get();
        const voidT = ts.getType('void');

        if (thisTypeId) {
            const tp = new MethodSignatureType(id, voidT, voidT, [], isVariadic);
            tp.name = name;
            tp.m_returnTypeId = returnTypeId;
            (tp as any).m_thisTypeId = thisTypeId;
            tp.m_callConf = conf;
            tp.m_arguments = argumentTypeIds.map((id, idx) => ({
                location: conf.argumentLocations[idx],
                typeId: id
            }));
            return tp;
        }

        const tp = new FunctionSignatureType(id, voidT, [], isVariadic);
        tp.name = name;
        tp.m_returnTypeId = returnTypeId;
        tp.m_callConf = conf;
        tp.m_arguments = argumentTypeIds.map((id, idx) => ({
            location: conf.argumentLocations[idx],
            typeId: id
        }));
        return tp;
    }
}

export class MethodSignatureType extends FunctionSignatureType {
    private m_thisTypeId: number;

    constructor(id: number, methodOf: DataType, returnType: DataType, argumentTypes: DataType[], isVariadic?: boolean) {
        super(id, returnType, argumentTypes, isVariadic);

        this.m_thisTypeId = TypeSystem.get().getPointerType(methodOf.id).id;

        // TODO: Double check this
        this.setSize(8);
        this.name = MethodSignatureType.generateName(returnType, argumentTypes, methodOf);

        this.initCallConf(returnType, argumentTypes, methodOf);
    }

    get thisType() {
        return TypeSystem.get().getType(this.m_thisTypeId);
    }

    get thisLocation() {
        return this.m_callConf.thisArgumentLocation as ValueLocation;
    }

    static generateName(returnType: DataType, argumentTypes: DataType[], methodOf?: DataType) {
        if (!methodOf) {
            throw new Error(`MethodSignatureType.generateName: 'methodOf' parameter must be specified`);
        }

        return `${returnType.name} ${methodOf.name}::(${argumentTypes.map(t => t.name).join(',')})`;
    }
}

export class EnumType extends DataType {
    private m_fields: Map<string, number>;
    private m_underlyingTypeId: number;

    constructor(id: number, underlyingType: PrimitiveType) {
        super(id);

        if (underlyingType.isFloatingPoint) {
            throw new Error(`Enum underlying type must be integral, '${underlyingType.name}' provided`);
        }

        this.m_fields = new Map();
        this.m_underlyingTypeId = underlyingType.id;
        this.setSize(underlyingType.size);
    }

    /** Map of field name -> field value */
    get fields() {
        return this.m_fields;
    }

    get underlyingType() {
        return TypeSystem.get().getType(this.m_underlyingTypeId) as PrimitiveType;
    }

    static rehydrate(id: number, underlyingTypeId: number, fields: Map<string, number>, name: string) {
        const ts = TypeSystem.get();
        const u8 = ts.getType('u8') as PrimitiveType;
        const tp = new EnumType(id, u8);
        tp.name = name;
        tp.m_underlyingTypeId = underlyingTypeId;
        tp.m_fields = fields;
        return tp;
    }
}

export class BitfieldType extends DataType {
    private m_fields: Map<string, number>;
    private m_underlyingTypeId: number;

    constructor(id: number, underlyingType: PrimitiveType) {
        super(id);

        if (underlyingType.isFloatingPoint || underlyingType.size === 0) {
            throw new Error(`Bitfield underlying type must be integral, '${underlyingType.name}' provided`);
        }

        this.m_fields = new Map();
        this.m_underlyingTypeId = underlyingType.id;
        this.setSize(underlyingType.size);
    }

    /** Map of field name -> bit index */
    get fields() {
        return this.m_fields;
    }

    get underlyingType() {
        return TypeSystem.get().getType(this.m_underlyingTypeId) as PrimitiveType;
    }

    static rehydrate(id: number, underlyingTypeId: number, fields: Map<string, number>, name: string) {
        const ts = TypeSystem.get();
        const u8 = ts.getType('u8') as PrimitiveType;
        const tp = new BitfieldType(id, u8);
        tp.name = name;
        tp.m_underlyingTypeId = underlyingTypeId;
        tp.m_fields = fields;
        return tp;
    }
}
