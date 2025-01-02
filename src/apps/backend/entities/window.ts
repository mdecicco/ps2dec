import { ViewId } from 'messages';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tblWindow')
export class WindowEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'text' })
    viewId!: ViewId;

    @Column({ type: 'int' })
    positionX!: number;

    @Column({ type: 'int' })
    positionY!: number;

    @Column({ type: 'int' })
    width!: number;

    @Column({ type: 'int' })
    height!: number;

    @Column({ type: 'boolean' })
    isOpen!: boolean;
}
