import { AnnotationModel } from 'packages/types/models';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tblAnnotation')
export class AnnotationEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    address!: number;

    @Column({ type: 'text', transformer: { to: JSON.stringify, from: JSON.parse } })
    data!: AnnotationModel;

    toModel(): AnnotationModel {
        return this.data;
    }
}
