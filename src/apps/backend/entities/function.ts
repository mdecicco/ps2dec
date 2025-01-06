import { FunctionModel } from 'packages/types/models/function';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { DataTypeEntity, FunctionSignatureEntity, StructureTypeEntity, VTableMethodEntity } from './datatype';

@Entity('tblFunction')
export class FunctionEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column('text')
    name!: string;

    @Column('int')
    address!: number;

    @Column('int')
    endAddress!: number;

    @Column('int')
    stackSize!: number;

    @Column('boolean', { default: false })
    isDeleted!: boolean;

    @Column('boolean', { default: false })
    isConstructor!: boolean;

    @Column('boolean', { default: false })
    isDestructor!: boolean;

    @Column('int', { nullable: true })
    methodOfId!: number | null;

    @ManyToOne(() => StructureTypeEntity, structure => structure.id)
    @JoinColumn({ name: 'methodOfId' })
    methodOf!: StructureTypeEntity | null;

    @Column('int', { nullable: true })
    vtableMethodId!: number | null;

    @ManyToOne(() => VTableMethodEntity, meth => meth.id, { eager: true, nullable: true })
    @JoinColumn({ name: 'vtableMethodId' })
    vtableMethod!: VTableMethodEntity | null;

    @Column('int')
    signatureId!: number;

    @ManyToOne(() => FunctionSignatureEntity, signature => signature.id, { eager: true })
    @JoinColumn({ name: 'signatureId' })
    signature!: FunctionSignatureEntity;

    @ManyToOne(() => DataTypeEntity, type => type.id, { eager: true })
    @JoinColumn({ name: 'signatureId' })
    signatureBase!: DataTypeEntity;

    @OneToMany(() => FunctionCallEntity, call => call.calleeFunctionId, { lazy: true })
    calledBy!: Promise<FunctionCallEntity[]>;

    @OneToMany(() => FunctionCallEntity, call => call.callerFunctionId, { lazy: true })
    callsTo!: Promise<FunctionCallEntity[]>;

    toModel(): FunctionModel {
        return {
            id: this.id,
            address: this.address,
            endAddress: this.endAddress,
            stackSize: this.stackSize,
            name: this.name,
            signatureId: this.signatureId,
            signature: this.signature.toModel(this.signatureBase),
            methodOfId: this.methodOfId,
            vtableMethodId: this.vtableMethodId,
            vtableMethod: this.vtableMethod,
            isConstructor: this.isConstructor,
            isDestructor: this.isDestructor,
            isDeleted: this.isDeleted
        };
    }
}

@Entity('tblFunctionCall')
export class FunctionCallEntity {
    @PrimaryColumn('int')
    address!: number;

    @Column('int')
    callerFunctionId!: number;

    @ManyToOne(() => FunctionEntity, func => func.id, { lazy: true })
    @JoinColumn({ name: 'callerFunctionId' })
    callerFunction!: Promise<FunctionEntity>;

    @Column('int')
    calleeFunctionId!: number;

    @ManyToOne(() => FunctionEntity, func => func.id, { lazy: true })
    @JoinColumn({ name: 'calleeFunctionId' })
    calleeFunction!: Promise<FunctionEntity>;
}
