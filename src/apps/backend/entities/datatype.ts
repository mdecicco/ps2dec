import { CallConfig } from 'decompiler';
import {
    ArrayTypeModel,
    BitfieldFieldModel,
    BitfieldTypeModel,
    DataTypeModel,
    EnumFieldModel,
    EnumTypeModel,
    FunctionSignatureArgumentModel,
    FunctionSignatureModel,
    PointerTypeModel,
    PrimitiveTypeModel,
    StructureFieldModel,
    StructureInheritanceModel,
    StructureMethodModel,
    StructureTypeModel,
    VTableMethodModel,
    VTableModel
} from 'packages/types/models/datatype';
import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    OneToOne,
    PrimaryColumn,
    PrimaryGeneratedColumn
} from 'typeorm';
import { FunctionEntity } from './function';

@Entity('tblDataType')
export class DataTypeEntity {
    @PrimaryColumn('int')
    id!: number;

    @Column('text')
    name!: string;

    @Column('int')
    size!: number;

    @Column('text')
    classType!: 'primitive' | 'pointer' | 'array' | 'structure' | 'signature' | 'enum' | 'bitfield';

    @Column('boolean', { default: false })
    isDeleted!: boolean;

    @OneToOne(() => PrimitiveTypeEntity, primitive => primitive.id, {
        nullable: true,
        createForeignKeyConstraints: false,
        eager: true
    })
    @JoinColumn({ name: 'id' })
    primitive!: PrimitiveTypeEntity | null;

    @OneToOne(() => PointerTypeEntity, pointer => pointer.id, {
        nullable: true,
        createForeignKeyConstraints: false,
        eager: true
    })
    @JoinColumn({ name: 'id' })
    pointer!: PointerTypeEntity | null;

    @OneToOne(() => ArrayTypeEntity, array => array.id, {
        nullable: true,
        createForeignKeyConstraints: false,
        eager: true
    })
    @JoinColumn({ name: 'id' })
    array!: ArrayTypeEntity | null;

    @OneToOne(() => StructureTypeEntity, structure => structure.id, {
        nullable: true,
        createForeignKeyConstraints: false,
        eager: true
    })
    @JoinColumn({ name: 'id' })
    structure!: StructureTypeEntity | null;

    @OneToOne(() => FunctionSignatureEntity, signature => signature.id, {
        nullable: true,
        createForeignKeyConstraints: false,
        eager: true
    })
    @JoinColumn({ name: 'id' })
    signature!: FunctionSignatureEntity | null;

    @OneToOne(() => EnumTypeEntity, enumType => enumType.id, {
        nullable: true,
        createForeignKeyConstraints: false,
        eager: true
    })
    @JoinColumn({ name: 'id' })
    enum!: EnumTypeEntity | null;

    @OneToOne(() => BitfieldTypeEntity, bitfield => bitfield.id, {
        nullable: true,
        createForeignKeyConstraints: false,
        eager: true
    })
    @JoinColumn({ name: 'id' })
    bitfield!: BitfieldTypeEntity | null;

    toModel(): DataTypeModel {
        switch (this.classType) {
            case 'primitive':
                return this.primitive!.toModel(this);
            case 'pointer':
                return this.pointer!.toModel(this);
            case 'array':
                return this.array!.toModel(this);
            case 'structure':
                return this.structure!.toModel(this);
            case 'signature':
                return this.signature!.toModel(this);
            case 'enum':
                return this.enum!.toModel(this);
            case 'bitfield':
                return this.bitfield!.toModel(this);
        }
    }
}

@Entity('tblPrimitiveType')
export class PrimitiveTypeEntity {
    @PrimaryColumn('int')
    id!: number;

    @Column('boolean')
    isSigned!: boolean;

    @Column('boolean')
    isFloatingPoint!: boolean;

    @OneToOne(() => DataTypeEntity, dataType => dataType.id)
    @JoinColumn({ name: 'id' })
    type!: DataTypeEntity;

    toModel(parent: DataTypeEntity): PrimitiveTypeModel {
        return {
            id: this.id,
            name: parent.name,
            size: parent.size,
            classType: 'primitive',
            isSigned: this.isSigned,
            isFloatingPoint: this.isFloatingPoint,
            isDeleted: parent.isDeleted
        };
    }
}

@Entity('tblPointerType')
export class PointerTypeEntity {
    @PrimaryColumn('int')
    id!: number;

    @OneToOne(() => DataTypeEntity, dataType => dataType.id)
    @JoinColumn({ name: 'id' })
    type!: DataTypeEntity;

    @Column('int')
    pointsToId!: number;

    @ManyToOne(() => DataTypeEntity, dataType => dataType.id)
    @JoinColumn({ name: 'pointsToId' })
    pointsTo!: DataTypeEntity;

    toModel(parent: DataTypeEntity): PointerTypeModel {
        return {
            id: this.id,
            name: parent.name,
            size: parent.size,
            classType: 'pointer',
            pointsToId: this.pointsToId,
            isDeleted: parent.isDeleted
        };
    }
}

@Entity('tblArrayType')
export class ArrayTypeEntity {
    @PrimaryColumn('int')
    id!: number;

    @OneToOne(() => DataTypeEntity, dataType => dataType.id)
    @JoinColumn({ name: 'id' })
    type!: DataTypeEntity;

    @Column('int')
    elementTypeId!: number;

    @ManyToOne(() => DataTypeEntity, dataType => dataType.id)
    @JoinColumn({ name: 'elementTypeId' })
    elementType!: DataTypeEntity;

    @Column('int')
    length!: number;

    toModel(parent: DataTypeEntity): ArrayTypeModel {
        return {
            id: this.id,
            name: parent.name,
            size: parent.size,
            classType: 'array',
            elementTypeId: this.elementTypeId,
            length: this.length,
            isDeleted: parent.isDeleted
        };
    }
}

//
// Structure
//

@Entity('tblVTableMethod')
export class VTableMethodEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column('int')
    offset!: number;

    @Column('int')
    dataOffset!: number;

    @Column('text')
    name!: string;

    @Column('int')
    vtableId!: number;

    @ManyToOne(() => VTableEntity, vtable => vtable.id)
    @JoinColumn({ name: 'vtableId' })
    vtable!: VTableEntity;

    toModel(): VTableMethodModel {
        return {
            id: this.id,
            name: this.name,
            vtableId: this.vtableId,
            offset: this.offset,
            dataOffset: this.dataOffset
        };
    }
}

@Entity('tblVTable')
export class VTableEntity {
    @PrimaryColumn('int')
    id!: number;

    @Column('int')
    extendsVtableId!: number | null;

    @ManyToOne(() => VTableEntity, vtable => vtable.id, { nullable: true, lazy: true })
    @JoinColumn({ name: 'extendsVtableId' })
    extendsVtable!: Promise<VTableEntity | null>;

    @OneToMany(() => VTableMethodEntity, method => method.vtable, { eager: true })
    methods!: VTableMethodEntity[];

    toModel(): VTableModel {
        return {
            id: this.id,
            extendsVtableId: this.extendsVtableId,
            methods: this.methods.map(method => method.toModel())
        };
    }
}

@Entity('tblStructureField')
export class StructureFieldEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column('int')
    offset!: number;

    @Column('text')
    name!: string;

    @Column('int')
    typeId!: number;

    @ManyToOne(() => DataTypeEntity, dataType => dataType.id)
    @JoinColumn({ name: 'typeId' })
    type!: DataTypeEntity;

    @Column('int')
    structureId!: number;

    @ManyToOne(() => StructureTypeEntity, structure => structure.id)
    @JoinColumn({ name: 'structureId' })
    structure!: StructureTypeEntity;

    toModel(): StructureFieldModel {
        return {
            id: this.id,
            name: this.name,
            offset: this.offset,
            typeId: this.typeId,
            structureId: this.structureId
        };
    }
}

@Entity('tblStructureMethod')
export class StructureMethodEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column('int')
    methodId!: number;

    @ManyToOne(() => FunctionEntity, func => func.id)
    @JoinColumn({ name: 'methodId' })
    method!: FunctionEntity;

    @Column('int')
    structureId!: number;

    @ManyToOne(() => StructureTypeEntity, structure => structure.id)
    @JoinColumn({ name: 'structureId' })
    structure!: StructureTypeEntity;

    @Column('int')
    vtableMethodId!: number | null;

    @ManyToOne(() => VTableMethodEntity, vtableMethod => vtableMethod.id, { nullable: true })
    @JoinColumn({ name: 'vtableMethodId' })
    vtableMethod!: VTableMethodEntity | null;

    @Column('boolean')
    isConstructor!: boolean;

    @Column('boolean')
    isDestructor!: boolean;

    toModel(): StructureMethodModel {
        return {
            id: this.id,
            methodId: this.methodId,
            structureId: this.structureId,
            vtableMethodId: this.vtableMethodId,
            isConstructor: this.isConstructor,
            isDestructor: this.isDestructor
        };
    }
}

@Entity('tblStructureInheritance')
export class StructureInheritanceEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column('int')
    structureId!: number;

    @ManyToOne(() => StructureTypeEntity, structure => structure.id)
    @JoinColumn({ name: 'structureId' })
    structure!: StructureTypeEntity;

    @Column('int')
    dataOffset!: number;

    @Column('int', { nullable: true })
    vtableOffset!: number | null;

    @Column('int', { nullable: true })
    vtableId!: number | null;

    @ManyToOne(() => VTableEntity, vtable => vtable.id, { nullable: true })
    @JoinColumn({ name: 'vtableId' })
    vtable!: VTableEntity | null;

    toModel(): StructureInheritanceModel {
        return {
            id: this.id,
            structureId: this.structureId,
            dataOffset: this.dataOffset,
            vtableOffset: this.vtableOffset,
            vtableId: this.vtableId
        };
    }
}

@Entity('tblStructureType')
export class StructureTypeEntity {
    @PrimaryColumn('int')
    id!: number;

    @OneToOne(() => DataTypeEntity, dataType => dataType.id)
    @JoinColumn({ name: 'id' })
    type!: DataTypeEntity;

    @Column('int', { nullable: true })
    vtableId!: number | null;

    @ManyToOne(() => VTableEntity, vtable => vtable.id, { nullable: true, eager: true })
    @JoinColumn({ name: 'vtableId' })
    vtable!: VTableEntity | null;

    @OneToMany(() => StructureFieldEntity, field => field.structure, { eager: true })
    fields!: StructureFieldEntity[];

    @OneToMany(() => StructureMethodEntity, method => method.structure, { eager: true })
    methods!: StructureMethodEntity[];

    @OneToMany(() => StructureInheritanceEntity, inheritance => inheritance.structure, { eager: true })
    baseTypes!: StructureInheritanceEntity[];

    toModel(parent: DataTypeEntity): StructureTypeModel {
        return {
            id: this.id,
            name: parent.name,
            size: parent.size,
            classType: 'structure',
            vtableId: this.vtableId,
            fields: this.fields.map(field => field.toModel()),
            methods: this.methods.map(method => method.toModel()),
            baseTypes: this.baseTypes.map(base => base.toModel()),
            isDeleted: parent.isDeleted
        };
    }
}

//
// Function Signature
//

@Entity('tblFunctionSignatureArgument')
export class FunctionSignatureArgumentEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column('int')
    signatureId!: number;

    @ManyToOne(() => FunctionSignatureEntity, signature => signature.id)
    @JoinColumn({ name: 'signatureId' })
    signature!: FunctionSignatureEntity;

    @Column('int')
    typeId!: number;

    @ManyToOne(() => DataTypeEntity, dataType => dataType.id, { lazy: true })
    @JoinColumn({ name: 'typeId' })
    type!: Promise<DataTypeEntity>;

    @Column('int')
    index!: number;

    toModel(): FunctionSignatureArgumentModel {
        return {
            id: this.id,
            signatureId: this.signatureId,
            index: this.index,
            typeId: this.typeId
        };
    }
}

@Entity('tblFunctionSignature')
export class FunctionSignatureEntity {
    @PrimaryColumn('int')
    id!: number;

    @OneToOne(() => DataTypeEntity, dataType => dataType.id)
    @JoinColumn({ name: 'id' })
    type!: DataTypeEntity;

    @Column('int')
    returnTypeId!: number;

    @ManyToOne(() => DataTypeEntity, dataType => dataType.id, { lazy: true })
    @JoinColumn({ name: 'returnTypeId' })
    returnType!: Promise<DataTypeEntity>;

    @Column('int', { nullable: true })
    thisTypeId!: number | null;

    @ManyToOne(() => DataTypeEntity, dataType => dataType.id, { nullable: true, lazy: true })
    @JoinColumn({ name: 'thisTypeId' })
    thisType!: Promise<DataTypeEntity | null>;

    @OneToMany(() => FunctionSignatureArgumentEntity, argument => argument.signature, { eager: true })
    arguments!: FunctionSignatureArgumentEntity[];

    @Column('text', {
        transformer: { to: value => JSON.stringify(value), from: value => JSON.parse(value) }
    })
    callConfig!: CallConfig;

    @Column('boolean')
    isVariadic!: boolean;

    toModel(parent: DataTypeEntity): FunctionSignatureModel {
        return {
            id: this.id,
            name: parent.name,
            size: parent.size,
            classType: 'signature',
            returnTypeId: this.returnTypeId,
            thisTypeId: this.thisTypeId,
            arguments: this.arguments.map(argument => argument.toModel()),
            callConfig: this.callConfig,
            isDeleted: parent.isDeleted,
            isVariadic: this.isVariadic
        };
    }
}

//
// Enum
//

@Entity('tblEnumField')
export class EnumFieldEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column('text')
    name!: string;

    @Column('int')
    value!: number;

    @Column('int')
    enumId!: number;

    @ManyToOne(() => EnumTypeEntity, enumType => enumType.id)
    @JoinColumn({ name: 'enumId' })
    enum!: EnumTypeEntity;

    toModel(): EnumFieldModel {
        return {
            id: this.id,
            name: this.name,
            value: this.value,
            enumId: this.enumId
        };
    }
}

@Entity('tblEnumType')
export class EnumTypeEntity {
    @PrimaryColumn('int')
    id!: number;

    @OneToOne(() => DataTypeEntity, dataType => dataType.id)
    @JoinColumn({ name: 'id' })
    type!: DataTypeEntity;

    @Column('int')
    underlyingTypeId!: number;

    @ManyToOne(() => PrimitiveTypeEntity, primitive => primitive.id, { lazy: true })
    @JoinColumn({ name: 'underlyingTypeId' })
    underlyingType!: Promise<PrimitiveTypeEntity>;

    @OneToMany(() => EnumFieldEntity, field => field.enum, { eager: true })
    fields!: EnumFieldEntity[];

    toModel(parent: DataTypeEntity): EnumTypeModel {
        return {
            id: this.id,
            name: parent.name,
            size: parent.size,
            classType: 'enum',
            underlyingTypeId: this.underlyingTypeId,
            fields: this.fields.map(field => field.toModel()),
            isDeleted: parent.isDeleted
        };
    }
}

//
// Bitfield
//

@Entity('tblBitfieldField')
export class BitfieldFieldEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column('text')
    name!: string;

    @Column('int')
    bitIndex!: number;

    @Column('int')
    bitfieldId!: number;

    @ManyToOne(() => BitfieldTypeEntity, bitfield => bitfield.id)
    @JoinColumn({ name: 'bitfieldId' })
    bitfield!: BitfieldTypeEntity;

    toModel(): BitfieldFieldModel {
        return {
            id: this.id,
            name: this.name,
            bitIndex: this.bitIndex,
            bitfieldId: this.bitfieldId
        };
    }
}

@Entity('tblBitfieldType')
export class BitfieldTypeEntity {
    @PrimaryColumn('int')
    id!: number;

    @OneToOne(() => DataTypeEntity, dataType => dataType.id)
    @JoinColumn({ name: 'id' })
    type!: DataTypeEntity;

    @Column('int')
    underlyingTypeId!: number;

    @ManyToOne(() => PrimitiveTypeEntity, primitive => primitive.id, { lazy: true })
    @JoinColumn({ name: 'underlyingTypeId' })
    underlyingType!: Promise<PrimitiveTypeEntity>;

    @OneToMany(() => BitfieldFieldEntity, field => field.bitfield)
    fields!: BitfieldFieldEntity[];

    toModel(parent: DataTypeEntity): BitfieldTypeModel {
        return {
            id: this.id,
            name: parent.name,
            size: parent.size,
            classType: 'bitfield',
            underlyingTypeId: this.underlyingTypeId,
            fields: this.fields.map(field => field.toModel()),
            isDeleted: parent.isDeleted
        };
    }
}
