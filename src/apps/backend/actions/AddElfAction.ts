import * as path from 'path';
import { In, Repository } from 'typeorm';

import { i } from 'decoder';
import { Elf } from 'utils';

import { Action, ActionData } from 'apps/backend/actions/Action';
import { FindFunctionAnalyzer } from 'apps/backend/actions/analysis/FindFunctions';
import { AnnotationEntity, FunctionEntity, MemoryRegionEntity } from 'apps/backend/entities';
import { MemoryService } from 'apps/backend/services/MemoryService';
import { AnnotationModel } from 'packages/types/models';

const ProgressInterval = 125;

export class AddElfAction extends Action {
    public static readonly ActionName = 'AddElfAction';
    private m_elfPath: string;
    private m_addedRegionIds: number[];

    constructor(elfPath: string) {
        super();
        this.m_elfPath = elfPath;
        this.m_addedRegionIds = [];
    }

    get description(): string {
        return `Add ELF file: ${path.basename(this.m_elfPath)}`;
    }

    protected async addAnnotations(
        annotations: AnnotationEntity[],
        annotationRepo: Repository<AnnotationEntity>
    ): Promise<void> {
        if (annotations.length === 0) return;
        const desc = `Saving ${annotations.length} annotations`;
        let startAt = performance.now();
        for (let i = 0; i < annotations.length; i += 300) {
            const current = performance.now();
            const elapsed = current - startAt;
            if (elapsed > ProgressInterval) {
                this.dispatch('progress', desc, i / annotations.length);
                startAt = current;
            }
            await annotationRepo.insert(annotations.slice(i, i + 300));
        }
    }

    protected async addRegions(
        elf: Elf,
        regionRepo: Repository<MemoryRegionEntity>,
        annotationRepo: Repository<AnnotationEntity>
    ): Promise<MemoryRegionEntity[]> {
        const regions: MemoryRegionEntity[] = [];

        await this.database.transaction(async () => {
            for (const section of elf.sections) {
                const region = new MemoryRegionEntity();
                const annotations: AnnotationEntity[] = [];
                region.name = section.name || '';
                region.size = section.size;
                region.startAddress = section.virtualAddress;
                region.endAddress = section.virtualAddress + (section.data ? section.data.byteLength : 0);
                region.data = section.data
                    ? Buffer.from(section.data.buffer, section.data.byteOffset, section.data.byteLength)
                    : null;

                try {
                    await regionRepo.insert(region);
                    regions.push(region);
                } catch (error) {
                    console.error(error);
                }

                if (region.name.length > 0 && region.startAddress !== 0) {
                    const annotation = new AnnotationEntity();
                    annotation.address = region.startAddress;
                    annotation.data = {
                        type: 'region_start',
                        address: region.startAddress
                    } as AnnotationModel;
                    annotations.push(annotation);
                }

                if (section.name === '.text') {
                    const desc = `Annotating instructions from 0x${region.startAddress.toString(
                        16
                    )} to 0x${region.endAddress.toString(16)}`;
                    let startAt = performance.now();
                    for (let address = region.startAddress; address < region.endAddress; address += 4) {
                        const current = performance.now();
                        const elapsed = current - startAt;
                        if (elapsed > ProgressInterval) {
                            this.dispatch(
                                'progress',
                                desc,
                                (address - region.startAddress) / (region.endAddress - region.startAddress)
                            );
                            startAt = current;
                        }

                        const annotation = new AnnotationEntity();
                        annotation.address = address;
                        annotation.data = {
                            type: 'instruction',
                            address
                        } as AnnotationModel;
                        annotations.push(annotation);
                    }
                }

                await this.addAnnotations(annotations, annotationRepo);
            }
        });

        return regions;
    }

    protected async annotateBranchTargets(
        regions: MemoryRegionEntity[],
        annotationRepo: Repository<AnnotationEntity>
    ): Promise<void> {
        await this.database.transaction(async () => {
            const annotations: AnnotationEntity[] = [];
            const codeSections = regions.filter(r => r.name === '.text');
            const seenAddresses: Set<number> = new Set();

            for (const section of codeSections) {
                let startAt = performance.now();
                const startAddr = section.startAddress.toString(16);
                const endAddr = section.endAddress.toString(16);
                for (let address = section.startAddress; address < section.endAddress; address += 4) {
                    const current = performance.now();
                    const elapsed = current - startAt;
                    if (elapsed > ProgressInterval) {
                        const desc = `Labeling ${seenAddresses.size} branch targets from 0x${startAddr} to 0x${endAddr}`;
                        this.dispatch(
                            'progress',
                            desc,
                            (address - section.startAddress) / (section.endAddress - section.startAddress)
                        );
                        startAt = current;
                    }

                    try {
                        const instr = MemoryService.getInstruction(address);
                        if (!instr) continue;

                        if (
                            instr.isBranch &&
                            !i.jal.is(instr) &&
                            typeof instr.operands[instr.operands.length - 1] === 'number'
                        ) {
                            const target = instr.operands[instr.operands.length - 1] as number;
                            if (seenAddresses.has(target)) continue;
                            seenAddresses.add(target);

                            const annotation = new AnnotationEntity();
                            annotation.address = target;
                            annotation.data = {
                                type: 'label',
                                address: target,
                                label: `LBL_${target.toString(16).padStart(8, '0')}`
                            } as AnnotationModel;
                            annotations.push(annotation);
                        }
                    } catch (err) {}
                }
            }

            await this.addAnnotations(annotations, annotationRepo);
        });
    }

    protected async findFunctions(annotationRepo: Repository<AnnotationEntity>): Promise<void> {
        const analyzer = new FindFunctionAnalyzer();
        const result = await analyzer.analyze(this.dispatch.bind(this, 'progress'));
        const annotations = result.annotations;
        const functions = result.functions;

        await this.addAnnotations(annotations, annotationRepo);

        const functionRepo = this.database.getRepository(FunctionEntity);
        if (functions.length === 0) return;

        const desc = `Saving ${functions.length} functions`;
        let startAt = performance.now();
        for (let i = 0; i < functions.length; i += 120) {
            const current = performance.now();
            const elapsed = current - startAt;
            if (elapsed > ProgressInterval) {
                this.dispatch('progress', desc, i / functions.length);
                startAt = current;
            }
            await functionRepo.insert(functions.slice(i, i + 120));
        }
    }

    protected async execute(): Promise<void> {
        const repo = this.database.getRepository(MemoryRegionEntity);
        const annotationRepo = this.database.getRepository(AnnotationEntity);
        const elf = Elf.fromFile(this.m_elfPath);
        if (!elf) {
            throw new Error('Failed to load ELF file');
        }

        const regions = await this.addRegions(elf, repo, annotationRepo);

        await MemoryService.initialize(this.database);

        await this.annotateBranchTargets(regions, annotationRepo);

        await this.findFunctions(annotationRepo);

        this.m_addedRegionIds = regions.map(r => r.id);
    }

    protected async rollback(): Promise<void> {
        if (this.m_addedRegionIds.length === 0) return;
        const repo = this.database.getRepository(MemoryRegionEntity);
        const annotationRepo = this.database.getRepository(AnnotationEntity);
        const functionRepo = this.database.getRepository(FunctionEntity);
        await repo.delete({
            id: In(this.m_addedRegionIds)
        });
        await annotationRepo.clear();
        await functionRepo.clear();
    }

    serialize(): ActionData {
        return {
            type: AddElfAction.ActionName,
            parameters: {
                elfPath: this.m_elfPath,
                regionIds: this.m_addedRegionIds
            }
        };
    }

    setFrom(data: ActionData): void {
        this.m_elfPath = data.parameters.elfPath;
        this.m_addedRegionIds = data.parameters.regionIds;
    }

    static deserialize(data: ActionData['parameters']): AddElfAction {
        const action = new AddElfAction(data.elfPath);
        action.m_addedRegionIds = data.regionIds;
        return action;
    }
}

// Register the action type
Action.registerActionType(AddElfAction);
