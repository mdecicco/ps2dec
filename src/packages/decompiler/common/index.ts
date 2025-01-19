import { i, Op, Reg } from 'decoder';
import { Location } from 'types';
import { Func, Method } from 'typesys';

export function instructionReads(currentFunc: Func | Method, instr: i.Instruction): Location[] {
    const uses: Location[] = [];

    if (instr.isLoad) {
        const mem = instr.operands[instr.operands.length - 1] as Op.MemOperand;
        if (Reg.compare(mem.base, { type: Reg.Type.EE, id: Reg.EE.SP })) {
            uses.push(mem.offset);
        }
    }

    // Determine if the instruction is a call that reads argument locations
    const callTarget = instr.getCallTarget(currentFunc);
    if (callTarget) {
        callTarget.signature.arguments.forEach(arg => {
            uses.push(arg.location);
        });
    }

    // If this instruction returns from the function, we need to add the return location
    if (
        instr.isBranch &&
        instr.code === Op.Code.jr &&
        Reg.compare(instr.reads[0], { type: Reg.Type.EE, id: Reg.EE.RA })
    ) {
        const returnLoc = currentFunc.signature.returnLocation;
        if (returnLoc) {
            uses.push(returnLoc);
        }
    }

    for (const reg of instr.reads) {
        uses.push(reg);
    }

    return uses;
}

export function instructionWrites(currentFunc: Func | Method, instr: i.Instruction): Location[] {
    const defs: Location[] = [];

    // Determine if the instruction stores to a stack offset
    if (instr.isStore) {
        const mem = instr.operands[instr.operands.length - 1] as Op.MemOperand;
        if (Reg.compare(mem.base, { type: Reg.Type.EE, id: Reg.EE.SP })) {
            defs.push(mem.offset);
        }
    }

    // Determine if the instruction is a call that sets the return location
    const callTarget = instr.getCallTarget(currentFunc);
    if (callTarget && callTarget.returnLocation) {
        defs.push(callTarget.returnLocation);
    }

    for (const reg of instr.writes) {
        if (reg.type === Reg.Type.EE) {
            if (reg.id === Reg.EE.SP) {
                // Don't count stack adjustments
                continue;
            }

            if (reg.id === Reg.EE.PC) {
                // Don't count the return address
                continue;
            }

            if (reg.id === Reg.EE.ZERO) {
                // Don't count the zero register
                continue;
            }
        }

        defs.push(reg);
    }

    return defs;
}
