import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import zlib from 'zlib';

const transformer = {
    to: (value: any) => zlib.gzipSync(JSON.stringify(value), { level: 9 }),
    from: (value: any) => JSON.parse(zlib.gunzipSync(value, { level: 9 }).toString())
};

@Entity('tblAction')
export class ActionEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'text' })
    type!: string;

    @Column({ type: 'text' })
    description!: string;

    @Column({ type: 'blob', transformer })
    parameters!: Record<string, any>;

    @Column({ type: 'datetime' })
    timestamp!: Date;
}
