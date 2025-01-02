import {
    ActionEntity,
    AnnotationEntity,
    ArrayTypeEntity,
    BitfieldFieldEntity,
    BitfieldTypeEntity,
    DataTypeEntity,
    EnumFieldEntity,
    EnumTypeEntity,
    FunctionEntity,
    FunctionSignatureArgumentEntity,
    FunctionSignatureEntity,
    MemoryRegionEntity,
    PointerTypeEntity,
    PrimitiveTypeEntity,
    StructureFieldEntity,
    StructureInheritanceEntity,
    StructureMethodEntity,
    StructureTypeEntity,
    VTableEntity,
    VTableMethodEntity,
    WindowEntity
} from 'apps/backend/entities';
import { DataSource } from 'typeorm';

export async function createDatabase(path: string) {
    const source = new DataSource({
        type: 'better-sqlite3',
        database: path,
        entities: [
            MemoryRegionEntity,
            ActionEntity,
            WindowEntity,
            AnnotationEntity,
            DataTypeEntity,
            PrimitiveTypeEntity,
            PointerTypeEntity,
            ArrayTypeEntity,
            VTableMethodEntity,
            VTableEntity,
            StructureFieldEntity,
            StructureMethodEntity,
            StructureInheritanceEntity,
            StructureTypeEntity,
            FunctionSignatureArgumentEntity,
            FunctionSignatureEntity,
            EnumFieldEntity,
            EnumTypeEntity,
            BitfieldFieldEntity,
            BitfieldTypeEntity,
            FunctionEntity
        ],
        synchronize: true
    });

    await source.initialize();

    return source;
}
