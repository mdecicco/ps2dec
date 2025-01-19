import { Region, SequenceRegion } from '../../../types';
import { IStructurePass } from '../../structure_pass';

export class BlockMerge extends IStructurePass {
    execute(root: Region): boolean {
        return this.processRegion(root);
    }

    processSequence(region: SequenceRegion, replace: (replacement: Region | null) => void): boolean {
        let didChange = false;

        const newSequence: Region[] = [];
        for (let i = 0; i < region.sequence.length; i++) {
            const current = region.sequence[i];

            if (i === 0) {
                newSequence.push(current);
                continue;
            }

            const last = newSequence[newSequence.length - 1];

            if (last.type !== 'block' || current.type !== 'block') {
                newSequence.push(current);
                continue;
            }

            if (current.header.predecessors.length !== 1) {
                newSequence.push(current);
                continue;
            }

            if (current.header.predecessors[0] !== last.header) {
                newSequence.push(current);
                continue;
            }

            newSequence[newSequence.length - 1] = {
                type: 'block',
                header: last.header,
                blocks: new Set([...last.blocks.values(), ...current.blocks.values()]),
                instructions: [...last.instructions, ...current.instructions]
            };
            didChange = true;
        }

        if (didChange) {
            replace({
                type: 'sequence',
                blocks: region.blocks,
                header: region.header,
                sequence: newSequence
            });
        }

        return didChange;
    }
}
