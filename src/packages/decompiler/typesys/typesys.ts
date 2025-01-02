import { EventProducer } from 'utils';
import {
    ArrayType,
    DataType,
    FunctionSignatureType,
    MethodSignatureType,
    PointerType,
    PrimitiveType,
    StructureType
} from './datatype';
import { VTable } from './vtable';

type TypeSystemEvents = {
    'type-added': (type: DataType) => void;
};

export class TypeSystem extends EventProducer<TypeSystemEvents> {
    private static instance: TypeSystem;
    private m_types: Map<number, DataType> = new Map();
    private m_typesByName: Map<string, number> = new Map();
    private m_nextTypeId: number = 1;
    private m_nextVtableId: number = 1;
    private m_pointerTypes: Map<number, number> = new Map();
    private m_arrayTypes: Map<string, number> = new Map();
    private m_vtables: Map<number, VTable> = new Map();

    constructor() {
        super();
    }

    public static get(): TypeSystem {
        if (!TypeSystem.instance) {
            TypeSystem.instance = new TypeSystem();
        }
        return TypeSystem.instance;
    }

    initialize() {
        // Define our primitive types
        const primitives: Array<[string, number, boolean, boolean]> = [
            ['void', 0, false, false],
            ['i8', 1, true, false],
            ['i16', 2, true, false],
            ['i32', 4, true, false],
            ['i64', 8, true, false],
            ['i128', 16, true, false],
            ['u8', 1, false, false],
            ['u16', 2, false, false],
            ['u32', 4, false, false],
            ['u64', 8, false, false],
            ['u128', 16, false, false],
            ['f32', 4, false, true],
            ['f64', 8, false, true],
            ['bool', 1, false, false],
            ['BOOL', 4, false, false],
            ['char', 1, false, false],
            ['undefined', 1, false, false],
            ['undefined2', 2, false, false],
            ['undefined4', 4, false, false],
            ['undefined8', 8, false, false]
        ];

        for (const [name, size, isSigned, isFloatingPoint] of primitives) {
            const type = new PrimitiveType(this.m_nextTypeId++, isSigned, isFloatingPoint, size);
            type.name = name;
            this.addType(type);
        }
    }

    get types(): DataType[] {
        return Array.from(this.m_types.values());
    }

    addType(type: DataType) {
        if (this.m_typesByName.has(type.name)) {
            throw new Error(`Type '${type.name}' already exists`);
        }

        this.m_types.set(type.id, type);
        this.m_typesByName.set(type.name, type.id);
        this.dispatch('type-added', type);
    }

    getType(nameOrId: string | number): DataType {
        // Handle numeric IDs
        if (typeof nameOrId === 'number') {
            const type = this.m_types.get(nameOrId);
            if (!type) {
                throw new Error(`Type ID ${nameOrId} not found`);
            }

            return type;
        }

        // Remove all whitespace from the type name
        const name = nameOrId.replace(/\s+/g, '');

        // Check if we already have this exact type
        const existingId = this.m_typesByName.get(name);
        if (existingId !== undefined) {
            const type = this.m_types.get(existingId);
            if (!type) {
                throw new Error(`Type ID ${existingId} not found`);
            }

            return type;
        }

        // Parse the type name from left to right
        let baseType = '';
        let modifiers: Array<'pointer' | { array: number }> = [];
        let i = 0;

        // First, get the base type name (everything up to first * or [)
        while (i < name.length && name[i] !== '*' && name[i] !== '[') {
            baseType += name[i];
            i++;
        }

        // Then process pointer and array modifiers
        while (i < name.length) {
            if (name[i] === '*') {
                modifiers.push('pointer');
                i++;
            } else if (name[i] === '[') {
                i++; // Skip [
                let sizeStr = '';
                while (i < name.length && name[i] !== ']') {
                    if (!/\d/.test(name[i])) {
                        throw new Error(`Invalid array size in type: ${name}`);
                    }
                    sizeStr += name[i];
                    i++;
                }
                if (i >= name.length) {
                    throw new Error(`Unterminated array bracket in type: ${name}`);
                }
                i++; // Skip ]
                const size = parseInt(sizeStr, 10);
                if (size <= 0) {
                    throw new Error(`Invalid array size: ${size}`);
                }
                modifiers.push({ array: size });
            } else {
                throw new Error(`Unexpected character in type name: ${name[i]}`);
            }
        }

        // Start with the base type
        let type = this.getType(baseType);

        // Apply modifiers from left to right
        for (const modifier of modifiers) {
            if (modifier === 'pointer') {
                type = this.getPointerType(type.id);
            } else {
                type = this.getArrayType(type.id, modifier.array);
            }
        }

        return type;
    }

    getPointerType(pointedTypeId: number): PointerType {
        // Check if we already have this pointer type
        const existingId = this.m_pointerTypes.get(pointedTypeId);
        if (existingId !== undefined) {
            const type = this.m_types.get(existingId);
            if (!type) {
                throw new Error(`Type ID ${existingId} not found`);
            }

            return type as PointerType;
        }

        const pointedType = this.m_types.get(pointedTypeId);
        if (!pointedType) throw new Error(`Type ${pointedTypeId} not found`);

        const id = this.m_nextTypeId++;
        const type = new PointerType(id, pointedType);
        this.addType(type);

        // Cache the pointer type
        this.m_pointerTypes.set(pointedTypeId, id);
        return type;
    }

    getArrayType(elementTypeId: number, length: number): ArrayType {
        const key = `${elementTypeId}:${length}`;

        // Check if we already have this array type
        const existingId = this.m_arrayTypes.get(key);
        if (existingId !== undefined) {
            const type = this.m_types.get(existingId);
            if (!type) {
                throw new Error(`Type ID ${existingId} not found`);
            }

            return type as ArrayType;
        }

        const elementType = this.m_types.get(elementTypeId);
        if (!elementType) throw new Error(`Type ${elementTypeId} not found`);

        const id = this.m_nextTypeId++;
        const type = new ArrayType(id, elementType, length);
        this.addType(type);

        return type;
    }

    getSignatureType(returnType: DataType, argumentTypes: DataType[]): FunctionSignatureType;
    getSignatureType(returnType: DataType, argumentTypes: DataType[], thisType: StructureType): MethodSignatureType;
    getSignatureType(
        returnType: DataType,
        argumentTypes: DataType[],
        thisType?: DataType
    ): FunctionSignatureType | MethodSignatureType {
        if (thisType) {
            const name = MethodSignatureType.generateName(returnType, argumentTypes, thisType);
            const existing = this.m_typesByName.get(name);
            if (existing) return this.getType(existing) as MethodSignatureType;

            const sig = new MethodSignatureType(this.m_nextTypeId++, thisType, returnType, argumentTypes);
            this.addType(sig);
            return sig;
        }

        const name = FunctionSignatureType.generateName(returnType, argumentTypes);
        const existing = this.m_typesByName.get(name);
        if (existing) return this.getType(existing) as FunctionSignatureType;

        const sig = new FunctionSignatureType(this.m_nextTypeId++, returnType, argumentTypes);
        this.addType(sig);
        return sig;
    }

    getVtableById(id: number) {
        const vtb = this.m_vtables.get(id);
        if (!vtb) throw new Error(`Vtable ID ${id} not found`);

        return vtb;
    }

    createVtable(extendsVtable?: VTable | null) {
        return new VTable(this.m_nextVtableId++, extendsVtable);
    }

    createStructure(name: string) {
        const type = new StructureType(this.m_nextTypeId++);
        type.name = name;

        this.addType(type);
        return type;
    }
}
