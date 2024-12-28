import { Elf, ElfSection } from 'utils/elf';

type Region = ElfSection & {
    start: number;
    end: number;
};

export class MemoryMap {
    private m_elf: Elf;
    private m_sections: Region[];
    private m_memoryBegin: number;
    private m_memoryEnd: number;

    constructor(elf: Elf) {
        this.m_elf = elf;
        this.m_sections = elf.sections.map(section => {
            return {
                ...section,
                start: section.virtualAddress,
                end: section.virtualAddress + section.size
            };
        });

        this.m_memoryBegin = Infinity;
        this.m_memoryEnd = 0;

        this.m_sections.forEach(section => {
            if (section.virtualAddress === 0 || section.size === 0) return;

            if (section.virtualAddress < this.m_memoryBegin) this.m_memoryBegin = section.virtualAddress;
            if (section.virtualAddress + section.size > this.m_memoryEnd)
                this.m_memoryEnd = section.virtualAddress + section.size;
        });
    }

    public getElf(): Elf {
        return this.m_elf;
    }

    public read8(address: number): number {
        const region = this.getRelevantSection(address);
        if (!region || !region.data) return 0;

        try {
            return region.data.getUint8(address - region.start);
        } catch (e) {
            console.error('Failed to read u8 at address', address);
        }

        return 0;
    }

    public read16(address: number): number {
        const region = this.getRelevantSection(address);
        if (!region || !region.data) return 0;

        try {
            return region.data.getUint16(address - region.start, true);
        } catch (e) {
            console.error('Failed to read u16 at address', address);
        }

        return 0;
    }

    public read32(address: number): number {
        const region = this.getRelevantSection(address);
        if (!region || !region.data) return 0;

        try {
            return region.data.getUint32(address - region.start, true);
        } catch (e) {
            console.error('Failed to read u32 at address', address);
        }

        return 0;
    }

    public getNextAddress(address: number, offset: number = 1, stopAtSectionBoundary: boolean = false): number {
        if (address + offset > this.m_memoryEnd) return this.m_memoryEnd;
        if (offset === 0) return address;

        const idx = this.m_sections.findIndex(
            s => s.start <= address && s.end > address && s.start !== 0 && s.size !== 0
        );
        if (idx === -1) {
            if (stopAtSectionBoundary) return address;

            const nextRegion = this.m_sections.find(s => s.start >= address + offset && s.start !== 0 && s.size !== 0);
            if (!nextRegion) return 0;

            return nextRegion.start;
        }

        if (address + offset < this.m_sections[idx].end) return address + offset;
        else if (stopAtSectionBoundary) return this.m_sections[idx].end;

        if (idx + 1 < this.m_sections.length) return this.m_sections[idx + 1].start;

        return 0;
    }

    public getAddressCount(startAddress: number, endAddress: number): number {
        if (startAddress === endAddress) return 0;
        if (startAddress > endAddress) return this.getAddressCount(endAddress, startAddress);

        const idx0 = this.m_sections.findIndex(
            s => s.start <= startAddress && s.end > startAddress && s.start !== 0 && s.size !== 0
        );
        if (idx0 === -1) return 0;

        const idx1 = this.m_sections.findIndex(
            s => s.start <= endAddress && s.end > endAddress && s.start !== 0 && s.size !== 0
        );
        if (idx1 === -1) return 0;

        if (idx0 === idx1) return endAddress - startAddress;

        let addressCount = this.m_sections[idx0].end - startAddress;

        for (let i = idx0 + 1; i < idx1; i++) {
            addressCount += this.m_sections[i].end - this.m_sections[i].start;
        }

        addressCount += endAddress - this.m_sections[idx1].start;

        return addressCount;
    }

    public isAddressMapped(address: number): boolean {
        return this.getRelevantSection(address) !== null;
    }

    public getMemoryBegin() {
        return this.m_memoryBegin;
    }

    public getMemoryEnd() {
        return this.m_memoryEnd;
    }

    private getRelevantSection(address: number): Region | null {
        const section = this.m_sections.find(s => s.start <= address && s.end > address);
        if (!section) return null;

        if (section.start === 0 || section.size === 0) return null;
        return section;
    }
}
