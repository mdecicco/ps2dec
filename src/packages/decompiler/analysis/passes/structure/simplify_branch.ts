import { IfRegion, Region } from '../../../types';
import { IStructurePass } from '../../structure_pass';

export class SimplifyBranches extends IStructurePass {
    private m_seen!: Set<Region>;

    execute(root: Region) {
        this.m_seen = new Set();
        return this.processRegion(root);
    }

    processIf(region: IfRegion): boolean {
        if (this.m_seen.has(region)) return false;
        this.m_seen.add(region);

        if (this.maybeSwapPaths(region)) return true;
        if (this.tryEliminateEitherPath(region)) return true;
        if (this.extractCommonTail(region)) return true;

        return false;
    }

    maybeSwapPaths(region: IfRegion): boolean {
        if (!region.elseRegion) return false;

        if (region.elseRegion.blocks.size < region.thenRegion.blocks.size) {
            const elseRegion = region.elseRegion;
            region.elseRegion = region.thenRegion;
            region.thenRegion = elseRegion;
            return true;
        }

        return false;
    }

    tryEliminateEitherPath(region: IfRegion): boolean {
        if (!region.elseRegion) return false;

        if (this.regionIsIsolatedFrom(region.thenRegion, region.elseRegion)) {
            // No path to "then" region from anywhere else
            const elseRegion = region.elseRegion;

            this.replaceAll(region, {
                type: 'sequence',
                header: region.header,
                blocks: region.blocks,
                sequence: [Object.assign({}, region, { elseRegion: null }), elseRegion]
            });

            region.elseRegion = null;
            return true;
        }

        if (this.regionIsIsolatedFrom(region.elseRegion, region.thenRegion)) {
            // No path to "else" region from anywhere else
            const thenRegion = region.thenRegion;
            const elseRegion = region.elseRegion;

            this.replaceAll(region, {
                type: 'sequence',
                header: region.header,
                blocks: region.blocks,
                sequence: [
                    Object.assign({}, region, {
                        thenRegion: elseRegion,
                        elseRegion: null,
                        invertCondition: !region.invertCondition
                    }),
                    thenRegion
                ]
            });

            region.elseRegion = null;
            return true;
        }

        return false;
    }

    extractCommonTail(region: IfRegion): boolean {
        if (!region.elseRegion) return false;

        if (region.thenRegion.type !== 'sequence') return false;
        if (region.elseRegion.type !== 'sequence') return false;

        // Iterate backwards over both paths and collect as many identical blocks as possible

        const extracted: Region[] = [];

        let thenIdx = region.thenRegion.sequence.length - 1;
        let elseIdx = region.elseRegion.sequence.length - 1;
        while (thenIdx >= 0 && elseIdx >= 0) {
            const thenBlk = region.thenRegion.sequence[thenIdx--];
            const elseBlk = region.elseRegion.sequence[elseIdx--];

            if (thenBlk.header !== elseBlk.header) {
                // ends of paths no longer equal
                break;
            }

            region.thenRegion.blocks.delete(thenBlk.header);
            region.elseRegion.blocks.delete(thenBlk.header);

            extracted.unshift(thenBlk);
        }

        if (extracted.length === 0) return false;
        region.thenRegion.sequence.splice(-extracted.length, extracted.length);
        region.elseRegion.sequence.splice(-extracted.length, extracted.length);

        if (region.thenRegion.sequence.length === 0) {
            region.thenRegion = region.elseRegion;
            region.invertCondition = !region.invertCondition;
        }

        if (region.elseRegion.sequence.length === 0) {
            region.elseRegion = null;
        }

        this.replaceAll(region, {
            type: 'sequence',
            header: region.header,
            blocks: region.blocks,
            sequence: [region, ...extracted]
        });

        return true;
    }

    regionIsIsolatedFrom(source: Region, target: Region) {
        let isIsolated = !source.header.canFlowTo(target.header);

        // console.log(`Region ${source.header.startAddressHex} ${isIsolated ? 'is' : 'is not'} isolated from ${target.header.startAddressHex}`);

        return isIsolated;
    }
}
