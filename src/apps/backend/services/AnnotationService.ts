import { AnnotationEntity } from 'apps/backend/entities';
import Messager from 'apps/backend/message';
import { MemoryService } from 'apps/backend/services';
import { AnnotationModel, RenderedRow } from 'packages/types';
import { DataSource, Repository } from 'typeorm';
import { registerAnnotationTypes } from './AnnotationTypes';

type RowLocation = {
    address: number;
    annotationIndex: number;
    annotationRowOffset: number;
};

type MemoryChunk = {
    startAddress: number;
    endAddress: number;
    startRow: number;
    annotations: AnnotationModel[];
};

export type RowInfo = {
    address: number;
    size: number;
};

type AnnotationType = AnnotationModel['type'];
type AnnotationRowCountCallback<T extends AnnotationType> = (
    annotation: Extract<AnnotationModel, { type: T }>
) => number;
type AnnotationConsumedSizeCallback<T extends AnnotationType> = (
    annotation: Extract<AnnotationModel, { type: T }>
) => number;
type AnnotationRenderCallback<T extends AnnotationType> = (
    annotation: Extract<AnnotationModel, { type: T }>
) => RenderedRow[];
type AnnotationData<T extends AnnotationType> = {
    getRowCount: AnnotationRowCountCallback<T>;
    getConsumedSize: AnnotationConsumedSizeCallback<T>;
    render: AnnotationRenderCallback<T>;
};

export class AnnotationService {
    private static m_repo: Repository<AnnotationEntity>;
    private static m_annotations: Map<number, AnnotationModel[]>;
    private static m_cachedRowCount: number;
    private static m_cacheInvalidated: boolean;
    private static m_memoryChunks: MemoryChunk[];
    private static m_rowInfoMap: Map<number, RowInfo>;
    private static m_annotationTypeMap: Map<AnnotationType, AnnotationData<any>>;

    static async initialize(dataSource: DataSource) {
        AnnotationService.m_repo = dataSource.getRepository(AnnotationEntity);

        AnnotationService.m_annotations = new Map<number, AnnotationModel[]>();
        AnnotationService.m_cachedRowCount = 0;
        AnnotationService.m_cacheInvalidated = true;
        AnnotationService.m_memoryChunks = [];
        AnnotationService.m_rowInfoMap = new Map<number, RowInfo>();
        AnnotationService.m_annotationTypeMap = new Map<AnnotationType, AnnotationData<any>>();

        const annotations = await AnnotationService.m_repo.find();
        for (const annotation of annotations) {
            AnnotationService.mapAnnotation(annotation.toModel());
        }

        registerAnnotationTypes();

        AnnotationService.rebuildChunks();

        Messager.on('addAnnotation', (annotation: AnnotationModel) => {
            const entity = new AnnotationEntity();
            entity.address = annotation.address;
            entity.data = annotation;
            AnnotationService.addAnnotation(entity);
        });

        Messager.on('removeAnnotation', async id => {
            const entity = await AnnotationService.m_repo.findOne({ where: { id } });
            if (!entity) return;

            AnnotationService.removeAnnotation(entity);
        });

        Messager.func('getRowCount', AnnotationService.getRowCount);
        Messager.func('getConsumedSize', AnnotationService.getConsumedSize);
        Messager.func('getTotalRows', AnnotationService.getTotalRows);
        Messager.func('getRowInfo', AnnotationService.getRowInfo);
        Messager.func('getAddressAtRow', AnnotationService.getAddressAtRow);
        Messager.func('getAnnotations', AnnotationService.getAnnotations);
        Messager.func('getRowAtAddress', AnnotationService.getRowAtAddress);
        Messager.func('renderAnnotation', AnnotationService.renderAnnotation);
        Messager.func('renderRows', req => {
            return AnnotationService.renderRows(req.startRow, req.rowCount);
        });
    }

    static async refetch() {
        AnnotationService.m_annotations = new Map<number, AnnotationModel[]>();
        AnnotationService.m_cachedRowCount = 0;
        AnnotationService.m_cacheInvalidated = true;
        AnnotationService.m_memoryChunks = [];
        AnnotationService.m_rowInfoMap = new Map<number, RowInfo>();

        const annotations = await AnnotationService.m_repo.find();
        for (const annotation of annotations) {
            AnnotationService.mapAnnotation(annotation.toModel());
        }

        AnnotationService.rebuildChunks();
    }

    static async addAnnotation(annotation: AnnotationEntity) {
        await AnnotationService.m_repo.save(annotation);
        AnnotationService.mapAnnotation(annotation.toModel());
    }

    static async removeAnnotation(annotation: AnnotationEntity) {
        AnnotationService.unmapAnnotation(annotation.toModel());
        await AnnotationService.m_repo.delete(annotation.id);
    }

    static getRowCount(annotation: AnnotationModel): number {
        const data = AnnotationService.m_annotationTypeMap.get(annotation.type);
        if (!data) return 1;

        return data.getRowCount(annotation);
    }

    static getConsumedSize(annotation: AnnotationModel): number {
        const data = AnnotationService.m_annotationTypeMap.get(annotation.type);
        if (!data) return 1;

        return data.getConsumedSize(annotation);
    }

    static getChunks(): MemoryChunk[] {
        return AnnotationService.m_memoryChunks;
    }

    static rebuildChunks() {
        AnnotationService.m_memoryChunks = [];
        const sections = MemoryService.regions.filter(r => r.start !== 0 && r.size > 0);
        if (sections.length === 0) return;

        const sortedAnnotationAddresses = Array.from(AnnotationService.m_annotations.entries()).sort(
            ([addr1], [addr2]) => addr1 - addr2
        );
        let beginAnnotationArrIdx = 0;
        let currentRow = 0;
        const ChunkSize = 4 * 1024;

        sections.forEach(s => {
            let currentAddr = s.start;
            while (currentAddr < s.end) {
                const chunk: MemoryChunk = {
                    startAddress: currentAddr,
                    endAddress: MemoryService.getNextAddress(currentAddr, ChunkSize),
                    startRow: currentRow,
                    annotations: []
                };

                if (chunk.endAddress > s.end) chunk.endAddress = s.end;

                (chunk as any).start = `0x${chunk.startAddress.toString(16)}`;
                (chunk as any).end = `0x${chunk.endAddress.toString(16)}`;

                // find annotations in this chunk
                while (beginAnnotationArrIdx < sortedAnnotationAddresses.length) {
                    const [addr, annotations] = sortedAnnotationAddresses[beginAnnotationArrIdx];
                    if (addr >= chunk.endAddress) break;

                    for (const a of annotations) {
                        if (a.address > currentAddr) {
                            // add rows for bytes between last position and this annotation
                            currentRow += MemoryService.getAddressCount(currentAddr, a.address);
                        }

                        // add rows for this annotation
                        currentRow += AnnotationService.getRowCount(a);

                        // move current position to end of this annotation
                        currentAddr = MemoryService.getNextAddress(a.address, AnnotationService.getConsumedSize(a));

                        chunk.annotations.push(a);
                    }

                    beginAnnotationArrIdx++;

                    if (currentAddr >= chunk.endAddress) {
                        chunk.endAddress = currentAddr;
                        break;
                    }
                }

                if (currentAddr < chunk.endAddress) {
                    // add rows for bytes between last position and end of chunk
                    currentRow += chunk.endAddress - currentAddr;
                }

                currentAddr = chunk.endAddress;
                chunk.annotations.sort((a, b) => {
                    if (a.address < b.address) return -1;
                    if (a.address > b.address) return 1;
                    return AnnotationService.getConsumedSize(a) - AnnotationService.getConsumedSize(b);
                });
                AnnotationService.m_memoryChunks.push(chunk);
            }
        });

        AnnotationService.m_cachedRowCount = currentRow;
        AnnotationService.m_cacheInvalidated = false;

        Messager.send('setTotalRows', AnnotationService.m_cachedRowCount);
    }

    static getTotalRows(): number {
        if (!AnnotationService.m_cacheInvalidated) return AnnotationService.m_cachedRowCount;
        AnnotationService.rebuildChunks();
        return AnnotationService.m_cachedRowCount;
    }

    static getRowInfo(row: number): RowInfo {
        let info = AnnotationService.m_rowInfoMap.get(row);
        if (info) return info;

        const address = AnnotationService.getAddressAtRow(row).address;
        const size = AnnotationService.getAnnotations(address).reduce(
            (sz, a) => Math.max(sz, AnnotationService.getConsumedSize(a)),
            1
        );

        info = { address, size };
        AnnotationService.m_rowInfoMap.set(row, info);
        return info;
    }

    static setRowInfo(row: number, info: RowInfo) {
        AnnotationService.m_rowInfoMap.set(row, info);
    }

    static getAddressAtRow(row: number): RowLocation {
        // Divide and conquer the memory chunks to find the chunk with the nearest starting row that is less than or equal to the desired row

        let low = 0;
        let high = AnnotationService.m_memoryChunks.length - 1;
        let nearestChunk: MemoryChunk | null = null;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const chunk = AnnotationService.m_memoryChunks[mid];

            if (
                chunk.startRow <= row &&
                (AnnotationService.m_memoryChunks.length <= mid + 1 ||
                    AnnotationService.m_memoryChunks[mid + 1].startRow > row)
            ) {
                // We've found the chunk
                nearestChunk = chunk;
                break;
            }

            if (chunk.startRow > row) {
                // Search the left half
                high = mid - 1;
            } else {
                // Search the right half
                low = mid + 1;
            }
        }

        if (!nearestChunk) {
            console.error('Could not find nearest chunk');
        }

        const newLocation = AnnotationService.calcAddressAtRow(row, nearestChunk);
        return newLocation;
    }

    static getAnnotations(address: number): AnnotationModel[] {
        return AnnotationService.m_annotations.get(address) || [];
    }

    static getRowAtAddress(address: number): number {
        if (!MemoryService.isAddressMapped(address)) return -1;

        let low = 0;
        let high = AnnotationService.m_memoryChunks.length - 1;
        let nearestChunk: MemoryChunk | null = null;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const chunk = AnnotationService.m_memoryChunks[mid];

            if (
                chunk.startAddress <= address &&
                (AnnotationService.m_memoryChunks.length <= mid + 1 ||
                    AnnotationService.m_memoryChunks[mid + 1].startAddress > address)
            ) {
                // We've found the chunk
                nearestChunk = chunk;
                break;
            }

            if (chunk.startAddress > address) {
                // Search the left half
                high = mid - 1;
            } else {
                // Search the right half
                low = mid + 1;
            }
        }

        if (!nearestChunk) {
            console.error('Could not find nearest chunk');
        }

        return AnnotationService.calcRowAtAddress(address, nearestChunk);
    }

    static renderAnnotation(annotation: AnnotationModel): RenderedRow[] {
        const data = AnnotationService.m_annotationTypeMap.get(annotation.type);
        if (!data) return [];

        return data.render(annotation);
    }

    static renderRows(startRow: number, rowCount: number): RenderedRow[] {
        const rows: RenderedRow[] = [];

        const startPosition = AnnotationService.getAddressAtRow(startRow);

        let address = startPosition.address;

        while (rows.length < rowCount) {
            const annotations = AnnotationService.getAnnotations(address).sort(
                (a, b) => AnnotationService.getConsumedSize(a) - AnnotationService.getConsumedSize(b)
            );
            let consumedSize = 0;
            let annotationIdx = startPosition.address === address ? startPosition.annotationIndex : 0;

            if (annotationIdx >= 0) {
                for (let i = annotationIdx; i < annotations.length && rows.length < rowCount; i++) {
                    const annotation = annotations[i];
                    const addrRows = AnnotationService.renderAnnotation(annotation);

                    const doOffsetAnnotation = startPosition.address === address && i === annotationIdx;

                    for (
                        let r = doOffsetAnnotation ? startPosition.annotationRowOffset : 0;
                        r < addrRows.length && rows.length < rowCount;
                        r++
                    ) {
                        AnnotationService.setRowInfo(startRow + rows.length, {
                            address,
                            size: addrRows[r].consumedSize
                        });
                        rows.push(addrRows[r]);
                        consumedSize += addrRows[r].consumedSize;
                    }
                }
            }

            if (consumedSize === 0) {
                const byteTp = AnnotationService.m_annotationTypeMap.get('raw-byte')!;

                // Default to raw byte view
                AnnotationService.setRowInfo(startRow + rows.length, { address, size: 1 });
                rows.push(...byteTp.render({ id: 0, address, type: 'raw-byte' }));
                consumedSize = 1;
            }

            address = MemoryService.getNextAddress(address, consumedSize);
            if (address === 0) break;
        }

        return rows;
    }

    static registerAnnotationType<T extends AnnotationType>(type: T, data: AnnotationData<T>) {
        AnnotationService.m_annotationTypeMap.set(type, data);
    }

    private static calcAddressAtRow(row: number, chunk: MemoryChunk | null): RowLocation {
        let currentRow = chunk ? chunk.startRow : 0;
        let currentAddr = chunk ? chunk.startAddress : MemoryService.memoryBegin;

        if (AnnotationService.m_annotations.size === 0) {
            return {
                address: currentAddr + MemoryService.getAddressCount(currentAddr, currentAddr + row - currentRow),
                annotationIndex: 0,
                annotationRowOffset: 0
            };
        }

        const sortedAnnotations = chunk
            ? chunk.annotations
            : Array.from(AnnotationService.m_annotations.entries())
                  .filter(([addr]) => addr >= currentAddr)
                  .flatMap(([addr, annotations]) => annotations)
                  .sort((a, b) => a.address - b.address);

        let lastAnnotationAddr = -1;
        let addrAnnotationIdx = 0;

        for (const annotation of sortedAnnotations) {
            if (annotation.address !== lastAnnotationAddr) {
                addrAnnotationIdx = 0;
                lastAnnotationAddr = annotation.address;
            }

            if (annotation.address > currentAddr) {
                // Add rows for bytes between last position and this annotation

                const addrDiff = MemoryService.getAddressCount(currentAddr, annotation.address);
                if (currentRow + addrDiff > row) {
                    // Desired row is in this unannotated region

                    return {
                        address: MemoryService.getNextAddress(currentAddr, row - currentRow),
                        annotationIndex: -1,
                        annotationRowOffset: 0
                    };
                }

                // 1 row per byte for unannotated regions
                currentRow += addrDiff;
                currentAddr = annotation.address;
            }

            // Add rows for this annotation
            const annRowCount = AnnotationService.getRowCount(annotation);
            if (currentRow + annRowCount > row) {
                // Desired row is in this annotation
                return {
                    address: currentAddr,
                    annotationIndex: addrAnnotationIdx,
                    annotationRowOffset: row - currentRow
                };
            }
            currentRow += annRowCount;

            addrAnnotationIdx++;

            // Move current position to end of this annotation
            currentAddr = MemoryService.getNextAddress(
                annotation.address,
                AnnotationService.getConsumedSize(annotation)
            );
        }

        return {
            address: MemoryService.getNextAddress(currentAddr, row - currentRow),
            annotationIndex: -1,
            annotationRowOffset: 0
        };
    }

    private static calcRowAtAddress(address: number, chunk: MemoryChunk | null): number {
        let currentRow = chunk ? chunk.startRow : 0;
        let currentAddr = chunk ? chunk.startAddress : MemoryService.memoryBegin;

        if (AnnotationService.m_annotations.size === 0) {
            return currentRow + MemoryService.getAddressCount(currentAddr, address);
        }

        const sortedAnnotations = chunk
            ? chunk.annotations
            : Array.from(AnnotationService.m_annotations.entries())
                  .filter(([addr]) => addr >= currentAddr)
                  .flatMap(([addr, annotations]) => annotations)
                  .sort((a, b) => {
                      if (a.address < b.address) return -1;
                      if (a.address > b.address) return 1;
                      return AnnotationService.getConsumedSize(a) - AnnotationService.getConsumedSize(b);
                  });

        for (const annotation of sortedAnnotations) {
            if (annotation.address > address) {
                return currentRow + MemoryService.getAddressCount(currentAddr, address);
            }

            if (annotation.address > currentAddr) {
                // Add rows for bytes between last position and this annotation
                currentRow += MemoryService.getAddressCount(currentAddr, annotation.address);
                currentAddr = annotation.address;
            }

            const consumedSize = AnnotationService.getConsumedSize(annotation);

            if (annotation.address <= address && annotation.address + consumedSize > address) {
                // Desired row is in this annotation
                return currentRow;
            }

            // Add rows for this annotation
            currentRow += AnnotationService.getRowCount(annotation);

            // Move current position to end of this annotation
            currentAddr = MemoryService.getNextAddress(annotation.address, consumedSize);
        }

        // Desired row is in the unannotated region after the last annotation
        return currentRow + MemoryService.getAddressCount(currentAddr, address);
    }

    private static mapAnnotation(annotation: AnnotationModel) {
        const annotations = AnnotationService.m_annotations.get(annotation.address);

        if (annotations) {
            const hasSize = annotations.some(a => AnnotationService.getConsumedSize(a) > 0);
            if (hasSize) {
                annotations.splice(annotations.length - 1, 0, annotation);
            } else {
                annotations.push(annotation);
            }
        } else {
            AnnotationService.m_annotations.set(annotation.address, [annotation]);
        }

        // todo: calculate changes to row count
        AnnotationService.m_cacheInvalidated = true;
    }

    private static unmapAnnotation(annotation: AnnotationModel) {
        const set = AnnotationService.m_annotations.get(annotation.address);
        if (set) {
            const idx = set.findIndex(a => a.id === annotation.id);
            if (idx !== -1) set.splice(idx, 1);
        }

        // todo: calculate changes to row count
        AnnotationService.m_cacheInvalidated = true;
    }
}
