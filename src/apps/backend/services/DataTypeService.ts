import { DataSource, Repository } from 'typeorm';
import {
    ArrayType,
    BitfieldType,
    DataType,
    EnumType,
    FunctionSignatureType,
    Method,
    MethodSignatureType,
    PointerType,
    PrimitiveType,
    StructureType,
    TypeInheritance,
    TypeSystem,
    VTable,
    VTableMethod
} from 'typesys';

import {
    ArrayTypeEntity,
    BitfieldFieldEntity,
    BitfieldTypeEntity,
    DataTypeEntity,
    EnumFieldEntity,
    EnumTypeEntity,
    FunctionSignatureArgumentEntity,
    FunctionSignatureEntity,
    PointerTypeEntity,
    PrimitiveTypeEntity,
    StructureFieldEntity,
    StructureInheritanceEntity,
    StructureMethodEntity,
    StructureTypeEntity,
    VTableEntity,
    VTableMethodEntity
} from 'apps/backend/entities';
import Messager from 'apps/backend/message';
import { FunctionService } from 'apps/backend/services/FunctionService';

type DataTypeModelKeys = {
    PrimitiveTypeEntity: PrimitiveTypeEntity;
    PointerTypeEntity: PointerTypeEntity;
    ArrayTypeEntity: ArrayTypeEntity;
    VTableMethodEntity: VTableMethodEntity;
    VTableEntity: VTableEntity;
    StructureFieldEntity: StructureFieldEntity;
    StructureMethodEntity: StructureMethodEntity;
    StructureInheritanceEntity: StructureInheritanceEntity;
    StructureTypeEntity: StructureTypeEntity;
    FunctionSignatureArgumentEntity: FunctionSignatureArgumentEntity;
    FunctionSignatureEntity: FunctionSignatureEntity;
    EnumFieldEntity: EnumFieldEntity;
    EnumTypeEntity: EnumTypeEntity;
    BitfieldFieldEntity: BitfieldFieldEntity;
    BitfieldTypeEntity: BitfieldTypeEntity;
};

export type RevertStep<T extends keyof DataTypeModelKeys> = {
    stepType: 'add' | 'update';
    type: T;
    previous: DataTypeModelKeys[T];
};

export class DataTypeService {
    private static m_database: DataSource;
    private static m_repo: Repository<DataTypeEntity>;
    private static m_primitiveTypeRepo: Repository<PrimitiveTypeEntity>;
    private static m_pointerTypeRepo: Repository<PointerTypeEntity>;
    private static m_arrayTypeRepo: Repository<ArrayTypeEntity>;
    private static m_vTableMethodRepo: Repository<VTableMethodEntity>;
    private static m_vTableRepo: Repository<VTableEntity>;
    private static m_structureFieldRepo: Repository<StructureFieldEntity>;
    private static m_structureMethodRepo: Repository<StructureMethodEntity>;
    private static m_structureInheritanceRepo: Repository<StructureInheritanceEntity>;
    private static m_structureTypeRepo: Repository<StructureTypeEntity>;
    private static m_functionSignatureArgumentRepo: Repository<FunctionSignatureArgumentEntity>;
    private static m_functionSignatureRepo: Repository<FunctionSignatureEntity>;
    private static m_enumFieldRepo: Repository<EnumFieldEntity>;
    private static m_enumTypeRepo: Repository<EnumTypeEntity>;
    private static m_bitfieldFieldRepo: Repository<BitfieldFieldEntity>;
    private static m_bitfieldTypeRepo: Repository<BitfieldTypeEntity>;
    private static m_dataTypesById: Map<number, DataTypeEntity>;
    private static m_waitingFor: Map<number, Promise<DataTypeEntity>>;
    private static m_vTablesById: Map<number, VTableEntity>;
    private static m_tsTypeMap: Map<number, DataType>;
    private static m_tsVTableMap: Map<number, VTable>;

    public static async initialize(db: DataSource) {
        DataTypeService.m_database = db;
        DataTypeService.m_repo = db.getRepository(DataTypeEntity);
        DataTypeService.m_primitiveTypeRepo = db.getRepository(PrimitiveTypeEntity);
        DataTypeService.m_pointerTypeRepo = db.getRepository(PointerTypeEntity);
        DataTypeService.m_arrayTypeRepo = db.getRepository(ArrayTypeEntity);
        DataTypeService.m_vTableMethodRepo = db.getRepository(VTableMethodEntity);
        DataTypeService.m_vTableRepo = db.getRepository(VTableEntity);
        DataTypeService.m_structureFieldRepo = db.getRepository(StructureFieldEntity);
        DataTypeService.m_structureMethodRepo = db.getRepository(StructureMethodEntity);
        DataTypeService.m_structureInheritanceRepo = db.getRepository(StructureInheritanceEntity);
        DataTypeService.m_structureTypeRepo = db.getRepository(StructureTypeEntity);
        DataTypeService.m_functionSignatureArgumentRepo = db.getRepository(FunctionSignatureArgumentEntity);
        DataTypeService.m_functionSignatureRepo = db.getRepository(FunctionSignatureEntity);
        DataTypeService.m_enumFieldRepo = db.getRepository(EnumFieldEntity);
        DataTypeService.m_enumTypeRepo = db.getRepository(EnumTypeEntity);
        DataTypeService.m_bitfieldFieldRepo = db.getRepository(BitfieldFieldEntity);
        DataTypeService.m_bitfieldTypeRepo = db.getRepository(BitfieldTypeEntity);
        DataTypeService.m_dataTypesById = new Map<number, DataTypeEntity>();
        DataTypeService.m_waitingFor = new Map<number, Promise<DataTypeEntity>>();
        DataTypeService.m_vTablesById = new Map<number, VTableEntity>();
        DataTypeService.m_tsTypeMap = new Map<number, DataType>();
        DataTypeService.m_tsVTableMap = new Map<number, VTable>();

        const types = await DataTypeService.m_repo.find({
            order: { id: 'ASC' }
        });
        for (const tp of types) {
            DataTypeService.m_dataTypesById.set(tp.id, tp);
        }

        const vTables = await DataTypeService.m_vTableRepo.find({ order: { id: 'ASC' } });
        for (const vt of vTables) {
            DataTypeService.m_vTablesById.set(vt.id, vt);
            DataTypeService.m_tsVTableMap.set(vt.id, DataTypeService.toTypeSystem(vt));
        }

        Messager.func('getDataTypes', () => {
            return DataTypeService.dataTypes.map(dataType => dataType.toModel());
        });

        Messager.func('getVTables', () => {
            return DataTypeService.vtables.map(vt => vt.toModel());
        });

        const ts = TypeSystem.get();
        ts.initialize();
        const seen = new Set<number>();

        for (const type of ts.types) {
            await DataTypeService.onTypeAdded(type);
            seen.add(type.id);
        }

        for (const tp of types) {
            if (seen.has(tp.id)) continue;
            const tsType = DataTypeService.toTypeSystem(tp);
            DataTypeService.m_tsTypeMap.set(tsType.id, tsType);
            ts.addType(tsType);
        }

        ts.addListener('type-added', type => {
            const add = async () => {
                const result = await DataTypeService.onTypeAdded(type);
                DataTypeService.m_waitingFor.delete(type.id);
                return result;
            };

            DataTypeService.m_waitingFor.set(type.id, add());
        });
    }

    public static async addDataType(dataType: DataTypeEntity) {
        const existing = await DataTypeService.m_repo.findOne({ where: { id: dataType.id } });
        if (!existing) {
            await DataTypeService.m_repo.save(dataType);
            Messager.send('dataTypeAdded', dataType);
        }

        DataTypeService.m_dataTypesById.set(dataType.id, dataType);
    }

    public static async removeDataType(id: number, noNotify: boolean = false) {
        const dataType = DataTypeService.m_dataTypesById.get(id);
        if (!dataType) return;

        const previous = dataType.toModel();
        dataType.isDeleted = true;
        await DataTypeService.m_repo.save(dataType);

        Messager.send('dataTypeUpdated', { previous, current: dataType.toModel() });
    }

    public static getDataTypeById(id: number) {
        return DataTypeService.m_dataTypesById.get(id);
    }

    public static waitFor(id: number): Promise<DataTypeEntity | null> {
        const existing = DataTypeService.m_dataTypesById.get(id);
        if (existing) return Promise.resolve(existing);

        const promise = DataTypeService.m_waitingFor.get(id);
        if (promise) return promise;

        return Promise.resolve(null);
    }

    public static get dataTypes() {
        return Array.from(DataTypeService.m_dataTypesById.values());
    }

    public static get vtables() {
        return Array.from(DataTypeService.m_vTablesById.values());
    }

    private static async onTypeAdded(type: DataType) {
        const existing = await DataTypeService.m_repo.findOne({ where: { id: type.id } });
        if (existing) return existing;

        await DataTypeService.m_database.transaction(async () => {
            const entity = new DataTypeEntity();
            entity.id = type.id;
            entity.name = type.name;
            entity.size = type.size;

            if (type instanceof PrimitiveType) {
                entity.classType = 'primitive';
                await DataTypeService.addDataType(entity);
                await DataTypeService.createPrimitive(type);
            } else if (type instanceof PointerType) {
                entity.classType = 'pointer';
                await DataTypeService.addDataType(entity);
                await DataTypeService.createPointer(type);
            } else if (type instanceof ArrayType) {
                entity.classType = 'array';
                await DataTypeService.addDataType(entity);
                await DataTypeService.createArray(type);
            } else if (type instanceof StructureType) {
                entity.classType = 'structure';
                await DataTypeService.addDataType(entity);
                await DataTypeService.createStructure(type);
            } else if (type instanceof FunctionSignatureType) {
                entity.classType = 'signature';
                await DataTypeService.addDataType(entity);
                await DataTypeService.createFunctionSignature(type);
            } else if (type instanceof MethodSignatureType) {
                entity.classType = 'signature';
                await DataTypeService.addDataType(entity);
                await DataTypeService.createMethodSignature(type);
            } else if (type instanceof EnumType) {
                entity.classType = 'enum';
                await DataTypeService.addDataType(entity);
                await DataTypeService.createEnum(type);
            } else if (type instanceof BitfieldType) {
                entity.classType = 'bitfield';
                await DataTypeService.addDataType(entity);
                await DataTypeService.createBitfield(type);
            }

            DataTypeService.m_tsTypeMap.set(type.id, type);
        });

        return (await DataTypeService.m_repo.findOne({ where: { id: type.id } }))!;
    }

    private static async createPrimitive(type: PrimitiveType) {
        const primitive = new PrimitiveTypeEntity();
        primitive.id = type.id;
        primitive.isSigned = type.isSigned;
        primitive.isFloatingPoint = type.isFloatingPoint;
        await DataTypeService.m_primitiveTypeRepo.save(primitive);
    }

    private static async createPointer(type: PointerType) {
        const pointer = new PointerTypeEntity();
        pointer.id = type.id;
        pointer.pointsToId = type.pointsTo.id;
        await DataTypeService.m_pointerTypeRepo.save(pointer);
    }

    private static async createArray(type: ArrayType) {
        const array = new ArrayTypeEntity();
        array.id = type.id;
        array.elementTypeId = type.elementType.id;
        array.length = type.length;
        await DataTypeService.m_arrayTypeRepo.save(array);
    }

    private static async createStructure(type: StructureType) {
        const structure = new StructureTypeEntity();
        structure.id = type.id;

        if (type.vtable) {
            const existing = await DataTypeService.m_vTableRepo.findOne({ where: { id: type.vtable.id } });
            if (existing) {
                structure.vtableId = existing.id;
                structure.vtable = existing;
            } else {
                const vtable = new VTableEntity();
                vtable.id = type.vtable.id;
                vtable.extendsVtableId = type.vtable.extendsVtable?.id || null;
                await DataTypeService.m_vTableRepo.save(vtable);

                for (const method of type.vtable.methods) {
                    const vtableMethod = new VTableMethodEntity();
                    vtableMethod.name = method.name;
                    vtableMethod.offset = method.offset;
                    vtableMethod.dataOffset = method.offset;
                    vtableMethod.vtableId = vtable.id;
                    await DataTypeService.m_vTableMethodRepo.save(vtableMethod);
                    vtable.methods.push(vtableMethod);
                }

                structure.vtableId = vtable.id;
                structure.vtable = vtable;
            }
        }

        await DataTypeService.m_structureTypeRepo.save(structure);

        for (const field of type.ownProperties) {
            const structureField = new StructureFieldEntity();
            structureField.name = field.name;
            structureField.offset = field.offset;
            structureField.typeId = field.typeId;
            structureField.structureId = structure.id;
            structureField.structure = structure;

            await DataTypeService.m_structureFieldRepo.save(structureField);
            structure.fields.push(structureField);
        }

        for (const method of type.methods) {
            const structureMethod = new StructureMethodEntity();
            structureMethod.methodId = method.id;
            structureMethod.structureId = structure.id;
            structureMethod.structure = structure;
            structureMethod.vtableMethodId = null;

            if (method.vtableEntry && structure.vtable) {
                if (method.vtableEntry.vtable.id === structure.vtable.id) {
                    const meth = structure.vtable.methods.find(m => m.offset === method.vtableEntry?.offset);
                    if (meth) {
                        structureMethod.vtableMethodId = meth.id;
                        structureMethod.vtableMethod = meth;
                    }
                } else {
                    const found = await DataTypeService.m_vTableMethodRepo.findOne({
                        where: { vtableId: method.vtableEntry.vtable.id, offset: method.vtableEntry.offset }
                    });

                    if (found) {
                        structureMethod.vtableMethodId = found.id;
                        structureMethod.vtableMethod = found;
                    }
                }
            }

            structureMethod.isConstructor = method.isConstructor;
            structureMethod.isDestructor = method.isDestructor;

            await DataTypeService.m_structureMethodRepo.save(structureMethod);
            structure.methods.push(structureMethod);
        }

        for (const baseType of type.baseTypes) {
            const structureInheritance = new StructureInheritanceEntity();
            structureInheritance.structureId = structure.id;
            structureInheritance.structure = structure;
            structureInheritance.dataOffset = baseType.offset;
            structureInheritance.vtableOffset = null;
            structureInheritance.vtableId = null;

            if (baseType.vtableInfo) {
                structureInheritance.vtableOffset = baseType.vtableInfo.offset;
                structureInheritance.vtableId = baseType.vtableInfo.vtable.id;
                if (baseType.vtableInfo.vtable.id === structure.vtable?.id) {
                    structureInheritance.vtable = structure.vtable;
                } else {
                    const found = await DataTypeService.m_vTableRepo.findOne({
                        where: { id: baseType.vtableInfo.vtable.id }
                    });
                    if (found) {
                        structureInheritance.vtable = found;
                    }
                }
            }

            await DataTypeService.m_structureInheritanceRepo.save(structureInheritance);
        }
    }

    private static async createFunctionSignature(type: FunctionSignatureType) {
        const funcSig = new FunctionSignatureEntity();
        funcSig.id = type.id;
        funcSig.returnTypeId = type.returnType.id;
        // funcSig.returnType = DataTypeService.m_dataTypesById.get(type.returnType.id)!;
        funcSig.thisTypeId = null;
        // funcSig.thisType = null;
        funcSig.callConfig = type.callConfig;
        funcSig.arguments = [];
        funcSig.isVariadic = type.isVariadic;
        await DataTypeService.m_functionSignatureRepo.save(funcSig);

        let idx = 0;
        for (const arg of type.arguments) {
            const argEntity = new FunctionSignatureArgumentEntity();
            argEntity.typeId = arg.typeId;
            // argEntity.type = DataTypeService.m_dataTypesById.get(arg.typeId)!;
            argEntity.signatureId = funcSig.id;
            argEntity.signature = funcSig;
            argEntity.index = idx++;
            await DataTypeService.m_functionSignatureArgumentRepo.save(argEntity);
            funcSig.arguments.push(argEntity);
        }
    }

    private static async createMethodSignature(type: MethodSignatureType) {
        const funcSig = new FunctionSignatureEntity();
        funcSig.id = type.id;
        funcSig.returnTypeId = type.returnType.id;
        // funcSig.returnType = DataTypeService.m_dataTypesById.get(type.returnType.id)!;
        funcSig.thisTypeId = type.thisType.id;
        // funcSig.thisType = DataTypeService.m_dataTypesById.get(type.thisType.id)!;
        funcSig.callConfig = type.callConfig;
        funcSig.isVariadic = type.isVariadic;
        await DataTypeService.m_functionSignatureRepo.save(funcSig);

        let idx = 0;
        for (const arg of type.arguments) {
            const argEntity = new FunctionSignatureArgumentEntity();
            argEntity.typeId = arg.typeId;
            // argEntity.type = DataTypeService.m_dataTypesById.get(arg.typeId)!;
            argEntity.signatureId = funcSig.id;
            argEntity.signature = funcSig;
            argEntity.index = idx++;
            await DataTypeService.m_functionSignatureArgumentRepo.save(argEntity);
            funcSig.arguments.push(argEntity);
        }
    }

    private static async createEnum(type: EnumType) {
        const enumType = new EnumTypeEntity();
        enumType.id = type.id;
        enumType.underlyingTypeId = type.underlyingType.id;
        // enumType.underlyingType = (await DataTypeService.m_primitiveTypeRepo.findOne({
        //     where: { id: type.underlyingType.id }
        // }))!;
        await DataTypeService.m_enumTypeRepo.save(enumType);

        for (const field of type.fields) {
            const enumField = new EnumFieldEntity();
            enumField.name = field[0];
            enumField.value = field[1];
            enumField.enumId = enumType.id;
            enumField.enum = enumType;
            await DataTypeService.m_enumFieldRepo.save(enumField);
            enumType.fields.push(enumField);
        }
    }

    private static async createBitfield(type: BitfieldType) {
        const bitfieldType = new BitfieldTypeEntity();
        bitfieldType.id = type.id;
        bitfieldType.underlyingTypeId = type.underlyingType.id;
        // bitfieldType.underlyingType = (await DataTypeService.m_primitiveTypeRepo.findOne({
        //     where: { id: type.underlyingType.id }
        // }))!;
        await DataTypeService.m_bitfieldTypeRepo.save(bitfieldType);

        for (const field of type.fields) {
            const bitfieldField = new BitfieldFieldEntity();
            bitfieldField.name = field[0];
            bitfieldField.bitIndex = field[1];
            bitfieldField.bitfieldId = bitfieldType.id;
            bitfieldField.bitfield = bitfieldType;
            await DataTypeService.m_bitfieldFieldRepo.save(bitfieldField);
            bitfieldType.fields.push(bitfieldField);
        }
    }

    private static toTypeSystem(ent: VTableEntity): VTable;
    private static toTypeSystem(ent: VTableMethodEntity): VTableMethod;
    private static toTypeSystem(ent: DataTypeEntity): DataType;
    private static toTypeSystem(ent: VTableEntity | VTableMethodEntity | DataTypeEntity) {
        if (ent instanceof VTableEntity) {
            const existing = DataTypeService.m_tsVTableMap.get(ent.id);
            if (existing) return existing;

            const extendsVTable = ent.extendsVtableId ? DataTypeService.m_vTablesById.get(ent.extendsVtableId) : null;
            const vtb = new VTable(ent.id, extendsVTable ? DataTypeService.toTypeSystem(extendsVTable) : null);

            for (const method of ent.methods) {
                vtb.addMethod(DataTypeService.toTypeSystem(method));
            }

            return vtb;
        }

        if (ent instanceof VTableMethodEntity) {
            return new VTableMethod(ent.vtableId, ent.offset, ent.dataOffset, ent.name);
        }

        if (ent instanceof DataTypeEntity) {
            const existing = DataTypeService.m_tsTypeMap.get(ent.id);
            if (existing) return existing;

            const ts = TypeSystem.get();
            switch (ent.classType) {
                case 'primitive':
                    const primitive = ent.primitive!;
                    return new PrimitiveType(ent.id, primitive.isSigned, primitive.isFloatingPoint, ent.size);
                case 'structure':
                    const structure = ent.structure!;
                    const methods: Method[] = [];
                    for (const method of structure.methods) {
                        const meth = FunctionService.getFunctionById(method.methodId);
                        if (!meth) continue;
                        methods.push(FunctionService.toTypeSystem(meth) as Method);
                    }

                    const baseTypes: TypeInheritance[] = [];
                    for (const base of structure.baseTypes) {
                        let vtable: VTable | null = null;
                        if (base.vtableId) {
                            const vtb = DataTypeService.m_vTablesById.get(base.vtableId);
                            if (vtb) {
                                vtable = DataTypeService.toTypeSystem(vtb);
                            }
                        }

                        baseTypes.push({
                            offset: base.dataOffset,
                            typeId: base.structureId,
                            vtableInfo:
                                vtable && base.vtableOffset
                                    ? {
                                          offset: base.vtableOffset,
                                          vtable
                                      }
                                    : null
                        });
                    }

                    let vtable: VTable | null = null;
                    if (structure.vtableId) {
                        const vtb = DataTypeService.m_vTablesById.get(structure.vtableId);
                        if (vtb) {
                            vtable = DataTypeService.toTypeSystem(vtb);
                        }
                    }

                    return StructureType.rehydrate(
                        ent.id,
                        structure.fields.map(f => ({ name: f.name, typeId: f.typeId, offset: f.offset })),
                        methods,
                        baseTypes,
                        vtable,
                        ent.name
                    );
                case 'pointer':
                    const pointer = ent.pointer!;
                    return PointerType.rehydrate(ent.id, pointer.pointsToId, ent.name);
                case 'array':
                    const array = ent.array!;
                    return ArrayType.rehydrate(ent.id, array.elementTypeId, array.length, ent.size, ent.name);
                case 'signature':
                    const funcSig = ent.signature!;
                    return FunctionSignatureType.rehydrate(
                        ent.id,
                        funcSig.returnTypeId,
                        funcSig.thisTypeId,
                        funcSig.arguments.map(a => a.typeId),
                        funcSig.callConfig,
                        ent.name,
                        funcSig.isVariadic
                    );
                case 'enum':
                    const enumType = ent.enum!;
                    return EnumType.rehydrate(
                        ent.id,
                        enumType.underlyingTypeId,
                        new Map(enumType.fields.map(f => [f.name, f.value])),
                        ent.name
                    );
                case 'bitfield':
                    const bitfieldType = ent.bitfield!;
                    return BitfieldType.rehydrate(
                        ent.id,
                        bitfieldType.underlyingTypeId,
                        new Map(bitfieldType.fields.map(f => [f.name, f.bitIndex])),
                        ent.name
                    );
            }
        }

        throw new Error('Invalid entity type');
    }
}
