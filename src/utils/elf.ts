import fs from 'fs';
const elf = require('elf-tools');

export interface ElfProgram {
    alignment: number;
    fileSize: number;
    memorySize: number;
    memoryFlags: number;
    offsetInFile: number;
    physicalAddress: number;
    virtualAddress: number;
    data: DataView;
}

export interface ElfSection {
    name: string;
    type: string;
    flags: string;
    alignment: number;
    size: number;
    entrySize: number;
    offsetInFile: number;
    virtualAddress: number;
    data: DataView | null;
}

export class Elf {
    private m_data: Uint8Array;
    private m_size: number;
    private m_entryPoint: number;
    private m_programs: ElfProgram[];
    private m_sections: ElfSection[];

    private constructor(data: Uint8Array, entryPoint: number, programs: ElfProgram[], sections: ElfSection[]) {
        this.m_data = data;
        this.m_size = data.length;
        this.m_entryPoint = entryPoint;
        this.m_programs = programs;
        this.m_sections = sections;
    }

    get data() {
        return this.m_data;
    }

    get size() {
        return this.m_size;
    }

    get entryPoint() {
        return this.m_entryPoint;
    }

    get programs() {
        return this.m_programs;
    }

    get sections() {
        return this.m_sections;
    }

    static fromFile(path: string): Elf | null {
        const data = fs.readFileSync(path);
        if (data.length === 0) return null;

        return Elf.fromData(data);
    }

    static fromData(data: Buffer): Elf | null {
        try {
            const u8Arr = new Uint8Array(data);
            const parsed = elf.parse(data);
            const programs: ElfProgram[] = [];
            const sections: ElfSection[] = [];

            for (const { header } of parsed.programs) {
                programs.push({
                    alignment: header.align,
                    fileSize: header.filesz,
                    memorySize: header.memsz,
                    memoryFlags: header.flags,
                    offsetInFile: header.offset,
                    physicalAddress: header.paddr,
                    virtualAddress: header.vaddr,
                    data: new DataView(
                        u8Arr.buffer,
                        header.offset,
                        Math.min(header.filesz, data.length - header.offset)
                    )
                });
            }

            for (const { header, data: secData } of parsed.sections) {
                sections.push({
                    name: header.name || '',
                    type: header.type || '',
                    flags: header.flags || '',
                    alignment: header.addralign,
                    size: header.size,
                    entrySize: header.entsize,
                    offsetInFile: header.offset,
                    virtualAddress: header.addr,
                    data: new DataView(u8Arr.buffer, header.offset, Math.min(header.size, data.length - header.offset))
                });
            }

            return new Elf(u8Arr, parsed.header.entry, programs, sections);
        } catch (e) {
            console.error(e);
        }

        return null;
    }
}
