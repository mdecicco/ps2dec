import { i, Op } from 'decoder';

export function findBlockBoundaries(input: i.Instruction[]): Set<number> {
    const boundaries = new Set<number>();

    // First instruction always starts a block
    if (input.length > 0) {
        boundaries.add(input[0].address);
    }

    for (let idx = 0; idx < input.length; idx++) {
        const instr = input[idx];
        if (!instr.isBranch) continue;
        if (instr.code === Op.Code.jal || instr.code === Op.Code.jalr) continue;

        // Target will always be the last operand
        const target = instr.operands[instr.operands.length - 1] as number;

        if (instr.code !== Op.Code.jr) {
            boundaries.add(target);
        }

        // Instruction after branch delay slot starts a new block
        if (idx + 2 < input.length) {
            boundaries.add(input[idx + 2].address);
        }
    }

    return boundaries;
}
