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

const strEE: Record<EE, string> = {
    [EE.ZERO]: '$zero',
    [EE.AT]: '$at',
    [EE.V0]: '$v0',
    [EE.V1]: '$v1',
    [EE.A0]: '$a0',
    [EE.A1]: '$a1',
    [EE.A2]: '$a2',
    [EE.A3]: '$a3',
    [EE.T0]: '$t0',
    [EE.T1]: '$t1',
    [EE.T2]: '$t2',
    [EE.T3]: '$t3',
    [EE.T4]: '$t4',
    [EE.T5]: '$t5',
    [EE.T6]: '$t6',
    [EE.T7]: '$t7',
    [EE.S0]: '$s0',
    [EE.S1]: '$s1',
    [EE.S2]: '$s2',
    [EE.S3]: '$s3',
    [EE.S4]: '$s4',
    [EE.S5]: '$s5',
    [EE.S6]: '$s6',
    [EE.S7]: '$s7',
    [EE.T8]: '$t8',
    [EE.T9]: '$t9',
    [EE.K0]: '$k0',
    [EE.K1]: '$k1',
    [EE.GP]: '$gp',
    [EE.SP]: '$sp',
    [EE.FP]: '$fp',
    [EE.RA]: '$ra',
    [EE.PC]: '$pc',
    [EE.HI]: '$hi',
    [EE.LO]: '$lo',
    [EE.HI1]: '$hi1',
    [EE.LO1]: '$lo1',
    [EE.SA]: '$sa'
};
const strCOP0: Record<COP0, string> = {
    [COP0.INDEX]: '$Index',
    [COP0.RANDOM]: '$Random',
    [COP0.ENTRYLO0]: '$EntryLo0',
    [COP0.ENTRYLO1]: '$EntryLo1',
    [COP0.CONTEXT]: '$Context',
    [COP0.PAGEMASK]: '$PageMask',
    [COP0.WIRED]: '$Wired',
    [COP0.BADVADDR]: '$BadVAddr',
    [COP0.COUNT]: '$Count',
    [COP0.ENTRYHI]: '$EntryHi',
    [COP0.COMPARE]: '$Compare',
    [COP0.STATUS]: '$Status',
    [COP0.CAUSE]: '$Cause',
    [COP0.EPC]: '$EPC',
    [COP0.PRID]: '$PrId',
    [COP0.CONFIG]: '$Config',
    [COP0.CPCOND0]: '$CPCond0',
    [COP0.BADPADDR]: '$BadPAddr',
    [COP0.DEBUG]: '$Debug',
    [COP0.PERF]: '$Perf',
    [COP0.TAGLO]: '$TagLo',
    [COP0.TAGHI]: '$TagHi',
    [COP0.ERROREPC]: '$ErrorEPC'
};
const strCOP1: Record<COP1, string> = {
    [COP1.F0]: '$f0',
    [COP1.F1]: '$f1',
    [COP1.F2]: '$f2',
    [COP1.F3]: '$f3',
    [COP1.F4]: '$f4',
    [COP1.F5]: '$f5',
    [COP1.F6]: '$f6',
    [COP1.F7]: '$f7',
    [COP1.F8]: '$f8',
    [COP1.F9]: '$f9',
    [COP1.F10]: '$f10',
    [COP1.F11]: '$f11',
    [COP1.F12]: '$f12',
    [COP1.F13]: '$f13',
    [COP1.F14]: '$f14',
    [COP1.F15]: '$f15',
    [COP1.F16]: '$f16',
    [COP1.F17]: '$f17',
    [COP1.F18]: '$f18',
    [COP1.F19]: '$f19',
    [COP1.F20]: '$f20',
    [COP1.F21]: '$f21',
    [COP1.F22]: '$f22',
    [COP1.F23]: '$f23',
    [COP1.F24]: '$f24',
    [COP1.F25]: '$f25',
    [COP1.F26]: '$f26',
    [COP1.F27]: '$f27',
    [COP1.F28]: '$f28',
    [COP1.F29]: '$f29',
    [COP1.F30]: '$f30',
    [COP1.F31]: '$f31',
    [COP1.ACC]: '$Acc',
    [COP1.C]: '$C',
    [COP1.I]: '$I',
    [COP1.D]: '$D',
    [COP1.O]: '$O',
    [COP1.U]: '$U',
    [COP1.SI]: '$SI',
    [COP1.SD]: '$SD',
    [COP1.SO]: '$SO',
    [COP1.SU]: '$SU'
};
const strCOP2_VF: Record<COP2.Vector, string> = {
    [COP2.Vector.VF0]: '$vf0',
    [COP2.Vector.VF1]: '$vf1',
    [COP2.Vector.VF2]: '$vf2',
    [COP2.Vector.VF3]: '$vf3',
    [COP2.Vector.VF4]: '$vf4',
    [COP2.Vector.VF5]: '$vf5',
    [COP2.Vector.VF6]: '$vf6',
    [COP2.Vector.VF7]: '$vf7',
    [COP2.Vector.VF8]: '$vf8',
    [COP2.Vector.VF9]: '$vf9',
    [COP2.Vector.VF10]: '$vf10',
    [COP2.Vector.VF11]: '$vf11',
    [COP2.Vector.VF12]: '$vf12',
    [COP2.Vector.VF13]: '$vf13',
    [COP2.Vector.VF14]: '$vf14',
    [COP2.Vector.VF15]: '$vf15',
    [COP2.Vector.VF16]: '$vf16',
    [COP2.Vector.VF17]: '$vf17',
    [COP2.Vector.VF18]: '$vf18',
    [COP2.Vector.VF19]: '$vf19',
    [COP2.Vector.VF20]: '$vf20',
    [COP2.Vector.VF21]: '$vf21',
    [COP2.Vector.VF22]: '$vf22',
    [COP2.Vector.VF23]: '$vf23',
    [COP2.Vector.VF24]: '$vf24',
    [COP2.Vector.VF25]: '$vf25',
    [COP2.Vector.VF26]: '$vf26',
    [COP2.Vector.VF27]: '$vf27',
    [COP2.Vector.VF28]: '$vf28',
    [COP2.Vector.VF29]: '$vf29',
    [COP2.Vector.VF30]: '$vf30',
    [COP2.Vector.VF31]: '$vf31',
    [COP2.Vector.ACC]: '$Acc'
};
const strCOP2_VI: Record<COP2.Integer, string> = {
    [COP2.Integer.VI0]: '$vi0',
    [COP2.Integer.VI1]: '$vi1',
    [COP2.Integer.VI2]: '$vi2',
    [COP2.Integer.VI3]: '$vi3',
    [COP2.Integer.VI4]: '$vi4',
    [COP2.Integer.VI5]: '$vi5',
    [COP2.Integer.VI6]: '$vi6',
    [COP2.Integer.VI7]: '$vi7',
    [COP2.Integer.VI8]: '$vi8',
    [COP2.Integer.VI9]: '$vi9',
    [COP2.Integer.VI10]: '$vi10',
    [COP2.Integer.VI11]: '$vi11',
    [COP2.Integer.VI12]: '$vi12',
    [COP2.Integer.VI13]: '$vi13',
    [COP2.Integer.VI14]: '$vi14',
    [COP2.Integer.VI15]: '$vi15'
};
const strCOP2_Special: Record<COP2.Special, string> = {
    [COP2.Special.Status]: '$Status',
    [COP2.Special.MAC]: '$MAC',
    [COP2.Special.Clip]: '$Clip',
    [COP2.Special.R]: '$R',
    [COP2.Special.I]: '$I',
    [COP2.Special.Q]: '$Q',
    [COP2.Special.P]: '$P',
    [COP2.Special.TPC]: '$TPC'
};

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
