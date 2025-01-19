import { Region, SequenceRegion } from '../../../types';
import { IStructurePass } from '../../structure_pass';

export class EliminateUnreachable extends IStructurePass {
    execute(root: Region): boolean {
        return this.processRegion(root);
    }

    processSequence(region: SequenceRegion): boolean {
        let impassableIdx = -1;

        for (let i = 0; i < region.sequence.length; i++) {
            const current = region.sequence[i];
            if (current.type === 'ref') {
                // basically an unconditional branch
                impassableIdx = i;
                break;
            }
        }

        if (impassableIdx === -1 || impassableIdx === region.sequence.length - 1) return false;

        region.sequence.splice(impassableIdx, region.sequence.length);

        return true;
    }
}
