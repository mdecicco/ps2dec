// General Purpose Registers (EE)
export enum EE {
    ZERO = 0,
    AT = 1,
    V0 = 2,
    V1 = 3,
    A0 = 4,
    A1 = 5,
    A2 = 6,
    A3 = 7,
    T0 = 8,
    T1 = 9,
    T2 = 10,
    T3 = 11,
    T4 = 12,
    T5 = 13,
    T6 = 14,
    T7 = 15,
    S0 = 16,
    S1 = 17,
    S2 = 18,
    S3 = 19,
    S4 = 20,
    S5 = 21,
    S6 = 22,
    S7 = 23,
    T8 = 24,
    T9 = 25,
    K0 = 26,
    K1 = 27,
    GP = 28,
    SP = 29,
    FP = 30,
    RA = 31,
    PC,
    HI,
    LO,
    HI1,
    LO1,
    SA
}

// COP0 System Control Registers
export enum COP0 {
    INDEX = 0,
    RANDOM = 1,
    ENTRYLO0 = 2,
    ENTRYLO1 = 3,
    CONTEXT = 4,
    PAGEMASK = 5,
    WIRED = 6,
    BADVADDR = 8,
    COUNT = 9,
    ENTRYHI = 10,
    COMPARE = 11,
    STATUS = 12,
    CAUSE = 13,
    EPC = 14,
    PRID = 15,
    CONFIG = 16,
    CPCOND0 = 21,
    BADPADDR = 23,
    DEBUG = 24,
    PERF = 25,
    TAGLO = 28,
    TAGHI = 29,
    ERROREPC = 30
}

// Floating Point Registers (COP1)
export enum COP1 {
    F0 = 0,
    F1 = 1,
    F2 = 2,
    F3 = 3,
    F4 = 4,
    F5 = 5,
    F6 = 6,
    F7 = 7,
    F8 = 8,
    F9 = 9,
    F10 = 10,
    F11 = 11,
    F12 = 12,
    F13 = 13,
    F14 = 14,
    F15 = 15,
    F16 = 16,
    F17 = 17,
    F18 = 18,
    F19 = 19,
    F20 = 20,
    F21 = 21,
    F22 = 22,
    F23 = 23,
    F24 = 24,
    F25 = 25,
    F26 = 26,
    F27 = 27,
    F28 = 28,
    F29 = 29,
    F30 = 30,
    F31 = 31,
    ACC,

    // FCR is a register, but the flags are set individually
    // so it's more useful here to treat the individual flags
    // as registers
    /** Comparison flag */
    C,

    /** Invalid operation flag */
    I,

    /** Division by zero flag */
    D,

    /** Overflow flag */
    O,

    /** Underflow flag */
    U,

    /** Invalid operation flag (cumulative) */
    SI,

    /** Division by zero flag (cumulative) */
    SD,

    /** Overflow flag (cumulative) */
    SO,

    /** Underflow flag (cumulative) */
    SU
}

export namespace COP2 {
    export enum Vector {
        VF0 = 0, // Constant (0,0,0,1)
        VF1 = 1,
        VF2 = 2,
        VF3 = 3,
        VF4 = 4,
        VF5 = 5,
        VF6 = 6,
        VF7 = 7,
        VF8 = 8,
        VF9 = 9,
        VF10 = 10,
        VF11 = 11,
        VF12 = 12,
        VF13 = 13,
        VF14 = 14,
        VF15 = 15,
        VF16 = 16,
        VF17 = 17,
        VF18 = 18,
        VF19 = 19,
        VF20 = 20,
        VF21 = 21,
        VF22 = 22,
        VF23 = 23,
        VF24 = 24,
        VF25 = 25,
        VF26 = 26,
        VF27 = 27,
        VF28 = 28,
        VF29 = 29,
        VF30 = 30,
        VF31 = 31,
        ACC = 32
    }

    export enum VComp {
        X,
        Y,
        Z,
        W
    }

    // VU0 Integer Registers (COP2)
    export enum Integer {
        VI0 = 0, // Constant 0
        VI1 = 1,
        VI2 = 2,
        VI3 = 3,
        VI4 = 4,
        VI5 = 5,
        VI6 = 6,
        VI7 = 7,
        VI8 = 8,
        VI9 = 9,
        VI10 = 10,
        VI11 = 11,
        VI12 = 12,
        VI13 = 13,
        VI14 = 14,
        VI15 = 15
    }

    export enum Special {
        Status,
        MAC,
        Clip,
        R,
        I,
        Q,
        P,
        TPC
    }
}

export enum Type {
    EE,
    COP0,
    COP1,
    COP2_VF,
    COP2_VI,
    COP2_Special
}

export type regEE = {
    type: Type.EE;
    id: EE;
};

export type regCOP0 = {
    type: Type.COP0;
    id: COP0;
};

export type regCOP1 = {
    type: Type.COP1;
    id: COP1;
};

export type regCOP2_VF = {
    type: Type.COP2_VF;
    id: COP2.Vector;
    comp: COP2.VComp;
};

export type regCOP2_VI = {
    type: Type.COP2_VI;
    id: COP2.Integer;
};

export type regCOP2_Special = {
    type: Type.COP2_Special;
    id: COP2.Special;
};

export type Register = regEE | regCOP0 | regCOP1 | regCOP2_VF | regCOP2_VI | regCOP2_Special;

export function key(reg: Register) {
    switch (reg.type) {
        case Type.EE:
        case Type.COP0:
        case Type.COP1:
        case Type.COP2_VI:
        case Type.COP2_Special:
            return `${reg.type}.${reg.id}`;
        case Type.COP2_VF: {
            let key = `${reg.type}.${reg.id}`;
            if (reg.comp === COP2.VComp.X) key += '.x';
            if (reg.comp === COP2.VComp.Y) key += '.y';
            if (reg.comp === COP2.VComp.Z) key += '.z';
            if (reg.comp === COP2.VComp.W) key += '.w';
            return key;
        }
    }
}

export function compare(a: Register, b: Register) {
    if (a.type !== b.type) return false;
    if (a.id !== b.id) return false;

    if (a.type === Type.COP2_VF) {
        if (a.comp !== (b as regCOP2_VF).comp) return false;
    }

    return true;
}

const strEE: string[] = [
    '$zero',
    '$at',
    '$v0',
    '$v1',
    '$a0',
    '$a1',
    '$a2',
    '$a3',
    '$t0',
    '$t1',
    '$t2',
    '$t3',
    '$t4',
    '$t5',
    '$t6',
    '$t7',
    '$s0',
    '$s1',
    '$s2',
    '$s3',
    '$s4',
    '$s5',
    '$s6',
    '$s7',
    '$t8',
    '$t9',
    '$k0',
    '$k1',
    '$gp',
    '$sp',
    '$fp',
    '$ra',
    '$pc',
    '$hi',
    '$lo',
    '$hi1',
    '$lo1',
    '$sa'
];
const strCOP0: string[] = [
    'Index',
    'Random',
    'EntryLo0',
    'EntryLo1',
    'Context',
    'PageMask',
    'Wired',
    'BadVAddr',
    'Count',
    'EntryHi',
    'Compare',
    'Status',
    'Cause',
    'EPC',
    'PrId',
    'Config',
    'CPCond0',
    'BadPAddr',
    'Debug',
    'Perf',
    'TagLo',
    'TagHi',
    'ErrorEPC'
];
const strCOP1: string[] = [
    '$f0',
    '$f1',
    '$f2',
    '$f3',
    '$f4',
    '$f5',
    '$f6',
    '$f7',
    '$f8',
    '$f9',
    '$f10',
    '$f11',
    '$f12',
    '$f13',
    '$f14',
    '$f15',
    '$f16',
    '$f17',
    '$f18',
    '$f19',
    '$f20',
    '$f21',
    '$f22',
    '$f23',
    '$f24',
    '$f25',
    '$f26',
    '$f27',
    '$f28',
    '$f29',
    '$f30',
    '$f31',
    'Acc',
    'C',
    'I',
    'D',
    'O',
    'U',
    'SI',
    'SD',
    'SO',
    'SU'
];
const strCOP2_VF: string[] = [
    '$vf0',
    '$vf1',
    '$vf2',
    '$vf3',
    '$vf4',
    '$vf5',
    '$vf6',
    '$vf7',
    '$vf8',
    '$vf9',
    '$vf10',
    '$vf11',
    '$vf12',
    '$vf13',
    '$vf14',
    '$vf15',
    '$vf16',
    '$vf17',
    '$vf18',
    '$vf19',
    '$vf20',
    '$vf21',
    '$vf22',
    '$vf23',
    '$vf24',
    '$vf25',
    '$vf26',
    '$vf27',
    '$vf28',
    '$vf29',
    '$vf30',
    '$vf31',
    'Acc'
];
const strCOP2_VI: string[] = [
    '$vi0',
    '$vi1',
    '$vi2',
    '$vi3',
    '$vi4',
    '$vi5',
    '$vi6',
    '$vi7',
    '$vi8',
    '$vi9',
    '$vi10',
    '$vi11',
    '$vi12',
    '$vi13',
    '$vi14',
    '$vi15'
];
const strCOP2_Special: string[] = ['Status', 'MAC', 'Clip', 'R', 'I', 'Q', 'P', 'TPC'];

export function formatRegister(reg: Register): string {
    switch (reg.type) {
        case Type.EE:
            return strEE[reg.id];
        case Type.COP0:
            return strCOP0[reg.id];
        case Type.COP1:
            return strCOP1[reg.id];
        case Type.COP2_VF: {
            let field = '';
            if (reg.comp === COP2.VComp.X) field = '.x';
            else if (reg.comp === COP2.VComp.Y) field = '.y';
            else if (reg.comp === COP2.VComp.Z) field = '.z';
            else if (reg.comp === COP2.VComp.W) field = '.w';

            if (field.length > 0) return `${strCOP2_VF[reg.id]}${field}`;
            return strCOP2_VF[reg.id];
        }
        case Type.COP2_VI:
            return strCOP2_VI[reg.id];
        case Type.COP2_Special:
            return strCOP2_Special[reg.id];
    }
}
