import { MemoryRegionEntity } from 'apps/backend/entities';
import Messager from 'apps/backend/message';
import { decode, i } from 'decoder';
import { DataSource, Repository } from 'typeorm';

type Region = {
    id: number;
    start: number;
    end: number;
    size: number;
    name: string;
    view: DataView | null;
};

export class MemoryService {
    private static m_repo: Repository<MemoryRegionEntity>;
    private static m_regions: Region[];
    private static m_memoryBegin: number;
    private static m_memoryEnd: number;
    private static m_codeSections: [number, number][];
    private static m_instructionMap: Map<number, i.Instruction>;

    static async initialize(dataSource: DataSource) {
        MemoryService.m_repo = dataSource.getRepository(MemoryRegionEntity);
        MemoryService.m_regions = [];
        MemoryService.m_memoryBegin = Infinity;
        MemoryService.m_memoryEnd = 0;
        MemoryService.m_codeSections = [];
        MemoryService.m_instructionMap = new Map();

        Messager.func('readBytes', req => {
            return MemoryService.readBytes(req.address, req.count);
        });

        Messager.func('getMemoryRegions', () => {
            return MemoryService.m_regions.map(r => ({
                id: r.id,
                name: r.name,
                size: r.size,
                start: r.start,
                end: r.end
            }));
        });

        await MemoryService.fetchRegions();
    }

    static async fetchRegions() {
        if (this.m_regions.length > 0) return;
        const sections = await MemoryService.m_repo.find();
        sections.forEach(MemoryService.addRegion);

        Messager.send('setMemoryRegions', {
            regions: MemoryService.m_regions.map(r => ({
                id: r.id,
                name: r.name,
                size: r.size,
                start: r.start,
                end: r.end
            }))
        });
    }

    static get regions() {
        return MemoryService.m_regions;
    }

    static get memoryBegin() {
        return MemoryService.m_memoryBegin;
    }

    static get memoryEnd() {
        return MemoryService.m_memoryEnd;
    }

    static addRegion(region: MemoryRegionEntity) {
        MemoryService.m_regions.push({
            id: region.id,
            start: region.startAddress,
            end: region.endAddress,
            size: region.size,
            name: region.name,
            view: region.data ? new DataView(region.data.buffer, region.data.byteOffset, region.data.byteLength) : null
        });

        if (region.name === '.text') {
            MemoryService.m_codeSections.push([region.startAddress, region.endAddress]);
        }

        if (region.startAddress === 0 || region.size === 0) return;

        if (region.startAddress < MemoryService.m_memoryBegin) MemoryService.m_memoryBegin = region.startAddress;
        if (region.endAddress > MemoryService.m_memoryEnd) MemoryService.m_memoryEnd = region.endAddress;
    }

    static removeRegion(id: number) {
        const idx = MemoryService.m_regions.findIndex(r => r.id === id);
        if (idx === -1) return;

        if (MemoryService.m_regions[idx].name === '.text') {
            MemoryService.m_codeSections = MemoryService.m_codeSections.filter(
                section => section[0] !== MemoryService.m_regions[idx].start
            );
        }

        MemoryService.m_regions.splice(idx, 1);

        MemoryService.m_memoryBegin = Infinity;
        MemoryService.m_memoryEnd = 0;
        MemoryService.m_regions.forEach(region => {
            if (region.start === 0 || region.size === 0) return;

            if (region.start < MemoryService.m_memoryBegin) MemoryService.m_memoryBegin = region.start;
            if (region.end > MemoryService.m_memoryEnd) MemoryService.m_memoryEnd = region.end;
        });
    }

    static read8(address: number): number {
        const region = MemoryService.getRelevantSection(address);
        if (!region || !region.view) return 0;

        try {
            return region.view.getUint8(address - region.start);
        } catch (e) {
            console.error('Failed to read u8 at address', address);
        }

        return 0;
    }

    static read16(address: number): number {
        const region = MemoryService.getRelevantSection(address);
        if (!region || !region.view) return 0;

        try {
            return region.view.getUint16(address - region.start, true);
        } catch (e) {
            console.error('Failed to read u16 at address', address);
        }

        return 0;
    }

    static read32(address: number): number {
        const region = MemoryService.getRelevantSection(address);
        if (!region || !region.view) return 0;

        try {
            return region.view.getUint32(address - region.start, true);
        } catch (e) {
            console.error('Failed to read u32 at address', address);
        }

        return 0;
    }

    static readBytes(address: number, count: number): Uint8Array {
        const regions = MemoryService.getRelevantRegionsForRange(address, address + count);
        if (regions.length === 0) return new Uint8Array(0);

        if (regions.length === 1) {
            const region = regions[0];
            if (!region.view) return new Uint8Array(0);

            return new Uint8Array(region.view.buffer, region.view.byteOffset + (address - region.start), count);
        }

        const bytes = new Uint8Array(count);

        let currentReadAddress = address;
        let bytesRemaining = count;

        // Copy bytes from each reigon, setting all bytes to 0 if they are not in any region
        for (const region of regions) {
            if (!region.view) continue;

            const memBegin = currentReadAddress;
            const memEnd = memBegin + bytesRemaining;

            // Where to begin reading from the region's buffer
            const readBegin = Math.max(memBegin, region.start) - region.start;

            // How many bytes to copy from the region's buffer
            const bytesToCopy = Math.min(memEnd, region.end) - memBegin;

            bytes.set(new Uint8Array(region.view.buffer, readBegin, bytesToCopy), currentReadAddress - address);

            currentReadAddress = memEnd;
            bytesRemaining -= bytesToCopy;

            if (bytesRemaining <= 0) break;
        }

        return bytes;
    }

    static getNextAddress(address: number, offset: number = 1, stopAtSectionBoundary: boolean = false): number {
        if (address + offset > MemoryService.m_memoryEnd) return MemoryService.m_memoryEnd;
        if (offset === 0) return address;

        const idx = MemoryService.m_regions.findIndex(
            s => s.start <= address && s.end > address && s.start !== 0 && s.size !== 0
        );
        if (idx === -1) {
            if (stopAtSectionBoundary) return address;

            const nextRegion = MemoryService.m_regions.find(
                r => r.start >= address + offset && r.start !== 0 && r.size !== 0
            );
            if (!nextRegion) return 0;

            return nextRegion.start;
        }

        if (address + offset < MemoryService.m_regions[idx].end) return address + offset;
        else if (stopAtSectionBoundary) return MemoryService.m_regions[idx].end;

        if (idx + 1 < MemoryService.m_regions.length) return MemoryService.m_regions[idx + 1].start;

        return 0;
    }

    static getAddressCount(startAddress: number, endAddress: number): number {
        if (startAddress === endAddress) return 0;
        if (startAddress > endAddress) return MemoryService.getAddressCount(endAddress, startAddress);

        const idx0 = MemoryService.m_regions.findIndex(
            r => r.start <= startAddress && r.end > startAddress && r.start !== 0 && r.size !== 0
        );
        if (idx0 === -1) return 0;

        const idx1 = MemoryService.m_regions.findIndex(
            r => r.start <= endAddress && r.end > endAddress && r.start !== 0 && r.size !== 0
        );
        if (idx1 === -1) return 0;

        if (idx0 === idx1) return endAddress - startAddress;

        let addressCount = MemoryService.m_regions[idx0].end - startAddress;

        for (let i = idx0 + 1; i < idx1; i++) {
            addressCount += MemoryService.m_regions[i].end - MemoryService.m_regions[i].start;
        }

        addressCount += endAddress - MemoryService.m_regions[idx1].start;

        return addressCount;
    }

    static isAddressMapped(address: number): boolean {
        return MemoryService.getRelevantSection(address) !== null;
    }

    static getInstruction(address: number): i.Instruction | null {
        const existing = MemoryService.m_instructionMap.get(address);
        if (existing) return existing;

        const codeSection = MemoryService.m_codeSections.find(section => section[0] <= address && section[1] > address);
        if (!codeSection) return null;

        try {
            const op = MemoryService.read32(address);
            if (!op) return null;

            const instruction = decode(op, address);
            if (!instruction) return null;

            MemoryService.m_instructionMap.set(address, instruction);
            return instruction;
        } catch (e) {
            return null;
        }
    }

    private static getRelevantRegionsForRange(startAddress: number, endAddress: number): Region[] {
        return MemoryService.m_regions.filter(
            r =>
                (startAddress <= r.start && endAddress > r.start) || // Region starts within range
                (startAddress < r.end && endAddress >= r.end) || // Region ends within range
                (r.start <= startAddress && r.end >= endAddress) // Region contains range
        );
    }

    private static getRelevantSection(address: number): Region | null {
        const region = MemoryService.m_regions.find(r => r.start <= address && r.end > address);
        if (!region) return null;

        if (region.start === 0 || region.size === 0) return null;
        return region;
    }
}
