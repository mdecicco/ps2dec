import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tblMemoryRegion')
export class MemoryRegionEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'text' })
    name!: string;

    @Column({ type: 'int' })
    size!: number;

    @Column({ type: 'int' })
    startAddress!: number;

    @Column({ type: 'int' })
    endAddress!: number;

    @Column({ type: 'blob', nullable: true })
    data!: Buffer | null;
}
