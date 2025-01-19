import { FunctionCode } from '../input';
import { BlockRegion, IfRegion, LoopRegion, Region, RegionRef, SequenceRegion } from '../types';
import { BasicBlock, ControlFlowGraph } from './cfg';

export type StructurePassCreateInfo = {
    func: FunctionCode;
    regionMap: Map<BasicBlock, Region>;
    root: Region;
};

export abstract class IStructurePass {
    protected m_cfg!: ControlFlowGraph;
    protected m_func!: FunctionCode;
    protected m_regionMap!: Map<BasicBlock, Region>;
    protected m_root!: Region;

    initialize(info: StructurePassCreateInfo) {
        this.m_cfg = info.func.cfg;
        this.m_func = info.func;
        this.m_regionMap = info.regionMap;
        this.m_root = info.root;
    }

    get root() {
        return this.m_root;
    }

    abstract execute(root: Region): boolean;

    replaceAll(target: Region, replacement: Region) {
        const replaceCBs: ((replacement: Region) => void)[] = [];
        this.walkRegions(
            this.m_root,
            (region, replace) => {
                if (region.header.startAddress !== target.header.startAddress) return;
                if (region.type !== target.type) return;
                replaceCBs.push(replace);
            },
            rootReplacement => {
                if (rootReplacement) this.m_root = rootReplacement;
                else {
                    this.m_root = {
                        type: 'sequence',
                        header: this.m_root.header,
                        blocks: new Set(),
                        sequence: []
                    };
                }
            }
        );

        for (let i = replaceCBs.length - 1; i >= 0; i--) {
            replaceCBs[i](replacement);
        }
    }

    protected processBlock(block: BlockRegion, replace: (replacement: Region | null) => void): boolean {
        return false;
    }
    protected processSequence(sequence: SequenceRegion, replace: (replacement: Region | null) => void): boolean {
        return false;
    }
    protected processLoop(loop: LoopRegion, replace: (replacement: Region | null) => void): boolean {
        return false;
    }
    protected processIf(branch: IfRegion, replace: (replacement: Region | null) => void): boolean {
        return false;
    }
    protected processRef(ref: RegionRef, replace: (replacement: Region | null) => void): boolean {
        return false;
    }
    protected processAny(region: Region, replace: (replacement: Region | null) => void): boolean {
        return false;
    }

    protected processRegion(region: Region, replace?: (replacement: Region | null) => void): boolean {
        // console.log(`Processing ${region.header.startAddressHex} '${region.type}'`);
        const replaceFn =
            replace ||
            (replacement => {
                if (region !== this.m_root) return;
                if (replacement) this.m_root = replacement;
                else {
                    this.m_root = {
                        type: 'sequence',
                        header: this.m_root.header,
                        blocks: new Set(),
                        sequence: []
                    };
                }
            });
        let changed = this.processAny(region, replaceFn);
        switch (region.type) {
            case 'block': {
                changed ||= this.processBlock(region, replaceFn);
                return changed;
            }
            case 'sequence': {
                changed ||= this.processSequence(region, replaceFn);
                for (let i = 0; i < region.sequence.length; i++) {
                    changed ||= this.processRegion(region.sequence[i], replacement => {
                        if (replacement) region.sequence[i] = replacement;
                        else {
                            region.sequence.splice(i, 1);
                            i--;
                        }
                    });
                }
                return changed;
            }
            case 'if': {
                changed ||= this.processIf(region, replaceFn);
                if (region.thenRegion) {
                    changed ||= this.processRegion(region.thenRegion, replacement => {
                        if (replacement) region.thenRegion = replacement;
                        else {
                            if (region.elseRegion) {
                                region.thenRegion = region.elseRegion;
                                region.invertCondition = !region.invertCondition;
                            } else {
                                replaceFn(null);
                            }
                        }
                    });
                }
                if (region.elseRegion) {
                    changed ||= this.processRegion(region.elseRegion, replacement => {
                        region.elseRegion = replacement;
                    });
                }
                return changed;
            }
            case 'loop': {
                changed ||= this.processLoop(region, replaceFn);
                changed ||= this.processRegion(region.body, replacement => {
                    region.body = replacement || {
                        type: 'block',
                        blocks: new Set(),
                        header: region.header,
                        instructions: []
                    };
                });
                return changed;
            }
            case 'ref': {
                changed ||= this.processRef(region, replaceFn);
                return changed;
            }
        }
    }

    protected walkRegions(
        region: Region,
        callback: (region: Region, replace: (replacement: Region | null) => void) => void,
        replace?: (replacement: Region | null) => void
    ) {
        const replaceFn = replace || (() => {});
        callback(region, replaceFn);
        switch (region.type) {
            case 'block':
                break;
            case 'sequence': {
                for (let i = 0; i < region.sequence.length; i++) {
                    this.walkRegions(region.sequence[i], callback, replacement => {
                        if (replacement) region.sequence[i] = replacement;
                        else {
                            region.sequence.splice(i, 1);
                            i--;
                        }
                    });
                }
                break;
            }
            case 'if': {
                if (region.thenRegion) {
                    this.walkRegions(region.thenRegion, callback, replacement => {
                        if (replacement) region.thenRegion = replacement;
                        else {
                            if (region.elseRegion) {
                                region.thenRegion = region.elseRegion;
                                region.invertCondition = !region.invertCondition;
                            } else {
                                replaceFn(null);
                            }
                        }
                    });
                }
                if (region.elseRegion) {
                    this.walkRegions(region.elseRegion, callback, replacement => {
                        region.elseRegion = replacement;
                    });
                }
                break;
            }
            case 'loop': {
                this.walkRegions(region.body, callback, replacement => {
                    region.body = replacement || {
                        type: 'block',
                        blocks: new Set(),
                        header: region.header,
                        instructions: []
                    };
                });
                break;
            }
            case 'ref':
                break;
        }
    }
}
