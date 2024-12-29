export * as i from './instructions';
export * as Op from './opcodes';
export * as Reg from './registers';

import * as i from './instructions';
import * as Reg from './registers';
import { extractBits } from './utils';

interface InstrCtor {
    new (address: number, rawCode: number): i.Instruction;
}

type Match = {
    startBit: number;
    length: number;
    map: Map<number, Match | InstrCtor>;
};

const SPECIAL: Match = {
    startBit: 0,
    length: 6,
    map: new Map<number, Match | InstrCtor>([
        [0b100000, i.add],
        [0b100001, i.addu],
        [0b100100, i.and],
        [0b001101, i.break_],
        [0b101100, i.dadd],
        [0b101101, i.daddu],
        [0b011010, i.div],
        [0b011011, i.divu],
        [0b111000, i.dsll],
        [0b111100, i.dsll32],
        [0b010100, i.dsllv],
        [0b111011, i.dsra],
        [0b111111, i.dsra32],
        [0b010111, i.dsrav],
        [0b111010, i.dsrl],
        [0b111110, i.dsrl32],
        [0b010110, i.dsrlv],
        [0b101110, i.dsub],
        [0b101111, i.dsubu],
        [0b001001, i.jalr],
        [0b001000, i.jr],
        [0b010000, i.mfhi],
        [0b010010, i.mflo],
        [0b001011, i.movn],
        [0b001010, i.movz],
        [0b010001, i.mthi],
        [0b010011, i.mtlo],
        [0b011000, i.mult],
        [0b011001, i.multu],
        [0b100111, i.nor],
        [0b100101, i.or],
        [0b000000, i.sll],
        [0b000100, i.sllv],
        [0b101010, i.slt],
        [0b101011, i.sltu],
        [0b000011, i.sra],
        [0b000111, i.srav],
        [0b000010, i.srl],
        [0b000110, i.srlv],
        [0b100010, i.sub],
        [0b100011, i.subu],
        [0b001111, i.sync],
        [0b001100, i.syscall],
        [0b110100, i.teq],
        [0b110000, i.tge],
        [0b110001, i.tgeu],
        [0b110010, i.tlt],
        [0b110011, i.tltu],
        [0b110110, i.tne],
        [0b100110, i.xor],
        [0b101000, i.mfsa],
        [0b101001, i.mtsa]
    ])
};

const REGIMM: Match = {
    startBit: 16,
    length: 5,
    map: new Map<number, Match | InstrCtor>([
        [0b00001, i.bgez],
        [0b10001, i.bgezal],
        [0b10011, i.bgezall],
        [0b00011, i.bgezl],
        [0b00000, i.bltz],
        [0b10000, i.bltzal],
        [0b10010, i.bltzall],
        [0b00010, i.bltzl],
        [0b01100, i.teqi],
        [0b01000, i.tgei],
        [0b01001, i.tgeiu],
        [0b01010, i.tlti],
        [0b01011, i.tltiu],
        [0b01110, i.tnei],
        [0b11000, i.mtsab],
        [0b11001, i.mtsah]
    ])
};

const MMI0: Match = {
    startBit: 6,
    length: 5,
    map: new Map<number, Match | InstrCtor>([
        [0b01000, i.paddb],
        [0b00100, i.paddh],
        [0b11000, i.paddsb],
        [0b10100, i.paddsh],
        [0b10000, i.paddsw],
        [0b00000, i.paddw],
        [0b01010, i.pcgtb],
        [0b00110, i.pcgth],
        [0b00010, i.pcgtw],
        [0b11110, i.pext5],
        [0b11010, i.pextlb],
        [0b10110, i.pextlh],
        [0b10010, i.pextlw],
        [0b00111, i.pmaxh],
        [0b00011, i.pmaxw],
        [0b11111, i.ppac5],
        [0b11011, i.ppacb],
        [0b10111, i.ppach],
        [0b10011, i.ppacw],
        [0b01001, i.psubb],
        [0b00101, i.psubh],
        [0b11001, i.psubsb],
        [0b10101, i.psubsh],
        [0b10001, i.psubsw],
        [0b00001, i.psubw]
    ])
};

const MMI1: Match = {
    startBit: 6,
    length: 5,
    map: new Map<number, Match | InstrCtor>([
        [0b00101, i.pabsh],
        [0b00001, i.pabsw],
        [0b11000, i.paddub],
        [0b10100, i.padduh],
        [0b10000, i.padduw],
        [0b00100, i.padsbh],
        [0b01010, i.pceqb],
        [0b00110, i.pceqh],
        [0b00010, i.pceqw],
        [0b11010, i.pextub],
        [0b10110, i.pextuh],
        [0b10010, i.pextuw],
        [0b00111, i.pminh],
        [0b00011, i.pminw],
        [0b11001, i.psubub],
        [0b10101, i.psubuh],
        [0b10001, i.psubuw],
        [0b11011, i.qfsrv]
    ])
};

const MMI2: Match = {
    startBit: 6,
    length: 5,
    map: new Map<number, Match | InstrCtor>([
        [0b10010, i.pand],
        [0b01110, i.pcpyld],
        [0b11101, i.pdivbw],
        [0b01101, i.pdivw],
        [0b11010, i.pexeh],
        [0b11110, i.pexew],
        [0b10001, i.phmadh],
        [0b10101, i.phmsbh],
        [0b01010, i.pinth],
        [0b10000, i.pmaddh],
        [0b00000, i.pmaddw],
        [0b01000, i.pmfhi],
        [0b01001, i.pmflo],
        [0b10100, i.pmsubh],
        [0b00100, i.pmsubw],
        [0b11100, i.pmulth],
        [0b01100, i.pmultw],
        [0b11011, i.prevh],
        [0b11111, i.prot3w],
        [0b00010, i.psllvw],
        [0b00011, i.psrlvw],
        [0b10011, i.pxor]
    ])
};

const MMI3: Match = {
    startBit: 6,
    length: 5,
    map: new Map<number, Match | InstrCtor>([
        [0b11011, i.pcpyh],
        [0b01110, i.pcpyud],
        [0b01101, i.pdivuw],
        [0b11010, i.pexch],
        [0b11110, i.pexcw],
        [0b01010, i.pinteh],
        [0b00000, i.pmadduw],
        [0b01000, i.pmthi],
        [0b01001, i.pmtlo],
        [0b01100, i.pmultuw],
        [0b10011, i.pnor],
        [0b10010, i.por],
        [0b00011, i.psravw]
    ])
};

const MMI: Match = {
    startBit: 0,
    length: 6,
    map: new Map<number, Match | InstrCtor>([
        [0b001000, MMI0],
        [0b101000, MMI1],
        [0b001001, MMI2],
        [0b101001, MMI3],

        [0b011010, i.div1],
        [0b011011, i.divu1],
        [0b000000, i.madd],
        [0b100000, i.madd1],
        [0b000001, i.maddu],
        [0b100001, i.maddu1],
        [0b010000, i.mfhi1],
        [0b010010, i.mflo1],
        [0b010001, i.mthi1],
        [0b010011, i.mtlo1],
        [0b011000, i.mult1],
        [0b011001, i.multu1],
        [0b000100, i.plzcw],
        [0b110000, i.pmfhl],
        [0b110100, i.psllh],
        [0b111100, i.psllw],
        [0b110111, i.psrah],
        [0b111111, i.psraw],
        [0b110110, i.psrlh],
        [0b111110, i.psrlw]
    ])
};

const BC0: Match = {
    startBit: 21,
    length: 5,
    map: new Map<number, Match | InstrCtor>([
        [0b00000, i.bc0f],
        [0b00010, i.bc0fl],
        [0b00001, i.bc0t],
        [0b00011, i.bc0tl]
    ])
};

const CO: Match = {
    startBit: 0,
    length: 6,
    map: new Map<number, Match | InstrCtor>([
        [0b111001, i.di],
        [0b111000, i.ei],
        [0b011000, i.eret]
    ])
};

const COP0: Match = {
    startBit: 21,
    length: 5,
    map: new Map<number, Match | InstrCtor>([
        [0b01000, BC0],
        [0b10000, CO],

        [0b00000, i.mfc0],
        [0b00100, i.mtc0]
    ])
};

const BC1: Match = {
    startBit: 16,
    length: 5,
    map: new Map<number, Match | InstrCtor>([
        [0b00000, i.bc1f],
        [0b00010, i.bc1fl],
        [0b00001, i.bc1t],
        [0b00011, i.bc1tl]
    ])
};

const COP1_S: Match = {
    startBit: 0,
    length: 6,
    map: new Map<number, Match | InstrCtor>([
        [0b000101, i.abs_s],
        [0b000000, i.add_s],
        [0b110010, i.c_eq_s],
        [0b110000, i.c_f_s],
        [0b110110, i.c_le_s],
        [0b110100, i.c_lt_s],
        [0b000011, i.div_s],
        [0b011100, i.madd_s],
        [0b011110, i.madda_s],
        [0b101000, i.max_s],
        [0b101001, i.min_s],
        [0b000110, i.mov_s],
        [0b011101, i.msub_s],
        [0b011111, i.msuba_s],
        [0b000010, i.mul_s],
        [0b011010, i.mula_s],
        [0b000111, i.neg_s],
        [0b010110, i.rsqrt_s],
        [0b000100, i.sqrt_s],
        [0b000001, i.sub_s],
        [0b011001, i.suba_s]
    ])
};

const COP1_W: Match = {
    startBit: 0,
    length: 6,
    map: new Map<number, Match | InstrCtor>([
        [0b100000, i.cvt_s_w],
        [0b100100, i.cvt_w_s]
    ])
};

const COP1: Match = {
    startBit: 21,
    length: 5,
    map: new Map<number, Match | InstrCtor>([
        [0b10000, COP1_S],
        [0b10100, COP1_W],
        [0b01000, BC1],

        [0b00010, i.cfc1],
        [0b00110, i.ctc1],
        [0b00000, i.mfc1],
        [0b00100, i.mtc1]
    ])
};

const COP2: Match = {
    startBit: 0,
    length: 6,
    map: new Map<number, Match | InstrCtor>([])
};

const InstructionSet: Match = {
    startBit: 26,
    length: 6,
    map: new Map<number, Match | InstrCtor>([
        [0b000000, SPECIAL],
        [0b000001, REGIMM],
        [0b011100, MMI],
        [0b010000, COP0],
        [0b010001, COP1],
        // [0b000000, COP2],

        [0b001000, i.addi],
        [0b001001, i.addiu],
        [0b001100, i.andi],
        [0b000100, i.beq],
        [0b010100, i.beql],
        [0b000111, i.bgtz],
        [0b000111, i.bgtzl],
        [0b000110, i.blez],
        [0b010110, i.blezl],
        [0b000101, i.bnel],
        [0b010101, i.bnel],
        [0b011000, i.daddi],
        [0b011001, i.daddiu],
        [0b000010, i.j],
        [0b000011, i.jal],
        [0b100000, i.lb],
        [0b100100, i.lbu],
        [0b110111, i.ld],
        [0b011010, i.ldl],
        [0b011011, i.ldr],
        [0b100001, i.lh],
        [0b100101, i.lhu],
        [0b001111, i.lui],
        [0b100011, i.lw],
        [0b100010, i.lwl],
        [0b100110, i.lwr],
        [0b100111, i.lwu],
        [0b001101, i.ori],
        [0b110011, i.pref],
        [0b101000, i.sb],
        [0b111111, i.sd],
        [0b101100, i.sdl],
        [0b101101, i.sdr],
        [0b101001, i.sh],
        [0b001010, i.slti],
        [0b001011, i.sltiu],
        [0b101011, i.sw],
        [0b101010, i.swl],
        [0b101110, i.swr],
        [0b011110, i.lq],
        [0b011111, i.sq],
        [0b110001, i.lwc1],
        [0b111001, i.swc1]
    ])
};

function simplify(inst: i.Instruction): i.Instruction {
    if (i.beq.is(inst)) {
        if (inst.reads[0].id !== Reg.EE.ZERO || inst.reads[1].id !== Reg.EE.ZERO) return inst;
        return new i.b(inst.address, inst.operands[2] as number);
    }

    if (i.or.is(inst)) {
        if (inst.reads[1].id !== Reg.EE.ZERO) return inst;
        return new i.move(inst.address, inst.writes[0], inst.reads[0]);
    }

    if (i.daddu.is(inst)) {
        if (inst.reads[1].id !== Reg.EE.ZERO) return inst;
        return new i.move(inst.address, inst.writes[0], inst.reads[0]);
    }

    if (i.addiu.is(inst)) {
        if (inst.reads[0].id !== Reg.EE.ZERO) return inst;
        return new i.li(inst.address, inst.writes[0], inst.operands[2] as number);
    }

    return inst;
}

function decodeInstr(operation: number, address: number, match: Match): i.Instruction {
    const bits = extractBits(operation, match.startBit, match.length);
    const found = match.map.get(bits);
    if (!found) {
        throw new Error(`Unknown instruction at 0x${address.toString(16).padStart(8, '0')}`);
    }

    if (typeof found === 'function') {
        return new found(address, operation);
    }

    return decodeInstr(operation, address, found);
}

export function decode(operation: number, address: number): i.Instruction {
    if (operation === 0) return new i.nop(address);
    const instruction = decodeInstr(operation, address, InstructionSet);
    return simplify(instruction);
}
