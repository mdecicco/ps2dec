import { Region, SequenceRegion } from '../../../types';
import { IStructurePass } from '../../structure_pass';

export class SequenceMerge extends IStructurePass {
    execute(root: Region): boolean {
        return this.processRegion(root);
    }

    protected processSequence(region: SequenceRegion, replace: (replacement: Region | null) => void): boolean {
        if (region.sequence.length === 1 && region.sequence[0].type === 'sequence') {
            replace(region.sequence[0]);
            return true;
        }

        let didChange = false;
        const newSequence: Region[] = [];
        for (let i = 0; i < region.sequence.length; i++) {
            const current = region.sequence[i];

            if (current.type !== 'sequence') {
                newSequence.push(current);
                continue;
            }

            newSequence.push(...current.sequence);
            didChange = true;
        }

        if (didChange) {
            replace({
                type: 'sequence',
                header: region.header,
                blocks: region.blocks,
                sequence: newSequence
            });
        }

        return didChange;
    }
}
