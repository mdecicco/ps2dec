import { FunctionModel } from 'packages/types/models/function';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FunctionSignatureEntity, StructureTypeEntity } from './datatype';

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

    @Column('int', { nullable: true })
    methodOfId!: number | null;

    @ManyToOne(() => StructureTypeEntity, structure => structure.id)
    @JoinColumn({ name: 'methodOfId' })
    methodOf!: StructureTypeEntity | null;

    @Column('int')
    signatureId!: number;

    @ManyToOne(() => FunctionSignatureEntity, signature => signature.id)
    @JoinColumn({ name: 'signatureId' })
    signature!: FunctionSignatureEntity;

    toModel(): FunctionModel {
        return {
            id: this.id,
            address: this.address,
            endAddress: this.endAddress,
            stackSize: this.stackSize,
            name: this.name,
            signatureId: this.signatureId,
            methodOfId: this.methodOfId,
            isDeleted: this.isDeleted
        };
    }
}
