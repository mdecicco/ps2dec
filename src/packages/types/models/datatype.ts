import { CallConfig } from 'decompiler';

export interface DataTypeModel {
    id: number;
    name: string;
    size: number;
    classType: 'primitive' | 'pointer' | 'array' | 'structure' | 'signature' | 'enum' | 'bitfield';
    isDeleted: boolean;
}

export interface PrimitiveTypeModel extends DataTypeModel {
    isSigned: boolean;
    isFloatingPoint: boolean;
}

export interface PointerTypeModel extends DataTypeModel {
    pointsToId: number;
}

export interface ArrayTypeModel extends DataTypeModel {
    elementTypeId: number;
    length: number;
}

//
// Structure
//

export interface VTableMethodModel {
    id: number;
    offset: number;
    dataOffset: number;
    name: string;
    vtableId: number;
}

export interface VTableModel {
    id: number;
    extendsVtableId: number | null;
    methods: VTableMethodModel[];
}

export interface StructureFieldModel {
    id: number;
    offset: number;
    name: string;
    typeId: number;
    structureId: number;
}

export interface StructureMethodModel {
    id: number;
    methodId: number;
    structureId: number;
    vtableMethodId: number | null;
    isConstructor: boolean;
    isDestructor: boolean;
}

export interface StructureInheritanceModel {
    id: number;
    structureId: number;
    dataOffset: number;
    vtableOffset: number | null;
    vtableId: number | null;
}

export interface StructureTypeModel extends DataTypeModel {
    vtableId: number | null;
    fields: StructureFieldModel[];
    methods: StructureMethodModel[];
    baseTypes: StructureInheritanceModel[];
}

//
// Function Signature
//

export interface FunctionSignatureArgumentModel {
    id: number;
    signatureId: number;
    typeId: number;
    index: number;
}

export interface FunctionSignatureModel extends DataTypeModel {
    returnTypeId: number;
    thisTypeId: number | null;
    arguments: FunctionSignatureArgumentModel[];
    callConfig: CallConfig;
    isVariadic: boolean;
}

//
// Enum
//

export interface EnumFieldModel {
    id: number;
    name: string;
    value: number;
    enumId: number;
}

export interface EnumTypeModel extends DataTypeModel {
    underlyingTypeId: number;
    fields: EnumFieldModel[];
}

//
// Bitfield
//

export interface BitfieldFieldModel {
    id: number;
    name: string;
    bitIndex: number;
    bitfieldId: number;
}

export interface BitfieldTypeModel extends DataTypeModel {
    underlyingTypeId: number;
    fields: BitfieldFieldModel[];
}

// Type guards
export function isPrimitiveType(type: DataTypeModel): type is PrimitiveTypeModel {
    return type.classType === 'primitive';
}

export function isPointerType(type: DataTypeModel): type is PointerTypeModel {
    return type.classType === 'pointer';
}

export function isArrayType(type: DataTypeModel): type is ArrayTypeModel {
    return type.classType === 'array';
}

export function isStructureType(type: DataTypeModel): type is StructureTypeModel {
    return type.classType === 'structure';
}

export function isFunctionSignatureType(type: DataTypeModel): type is FunctionSignatureModel {
    return type.classType === 'signature';
}

export function isEnumType(type: DataTypeModel): type is EnumTypeModel {
    return type.classType === 'enum';
}

export function isBitfieldType(type: DataTypeModel): type is BitfieldTypeModel {
    return type.classType === 'bitfield';
}
