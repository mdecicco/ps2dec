import { formatRegister, Register } from './registers';

export enum Code {
    // pseudo instructions
    nop,
    b,
    move,
    li,

    // actual instructions
    add,
    addi,
    addiu,
    addu,
    and,
    andi,
    beq,
    beql,
    bgez,
    bgezal,
    bgezall,
    bgezl,
    bgtz,
    bgtzl,
    blez,
    blezl,
    bltz,
    bltzal,
    bltzall,
    bltzl,
    bne,
    bnel,
    break,
    dadd,
    daddi,
    daddiu,
    daddu,
    div,
    divu,
    dsll,
    dsll32,
    dsllv,
    dsra,
    dsra32,
    dsrav,
    dsrl,
    dsrl32,
    dsrlv,
    dsub,
    dsubu,
    j,
    jal,
    jalr,
    jr,
    lb,
    lbu,
    ld,
    ldl,
    ldr,
    lh,
    lhu,
    lui,
    lw,
    lwl,
    lwr,
    lwu,
    mfhi,
    mflo,
    movn,
    movz,
    mthi,
    mtlo,
    mult,
    multu,
    nor,
    or,
    ori,
    pref,
    sb,
    sd,
    sdl,
    sdr,
    sh,
    sll,
    sllv,
    slt,
    slti,
    sltiu,
    sltu,
    sra,
    srav,
    srl,
    srlv,
    sub,
    subu,
    sw,
    swl,
    swr,
    sync,
    syscall,
    teq,
    teqi,
    tge,
    tgei,
    tgeiu,
    tgeu,
    tlt,
    tlti,
    tltiu,
    tltu,
    tne,
    tnei,
    xor,
    xori,
    div1,
    divu1,
    lq,
    madd,
    madd1,
    maddu,
    maddu1,
    mfhi1,
    mflo1,
    mfsa,
    mthi1,
    mtlo1,
    mtsa,
    mtsab,
    mtsah,
    mult1,
    multu1,
    pabsh,
    pabsw,
    paddb,
    paddh,
    paddsb,
    paddsh,
    paddsw,
    paddub,
    padduh,
    padduw,
    paddw,
    padsbh,
    pand,
    pceqb,
    pceqh,
    pceqw,
    pcgtb,
    pcgth,
    pcgtw,
    pcpyh,
    pcpyld,
    pcpyud,
    pdivbw,
    pdivuw,
    pdivw,
    pexch,
    pexcw,
    pexeh,
    pexew,
    pext5,
    pextlb,
    pextlh,
    pextlw,
    pextub,
    pextuh,
    pextuw,
    phmadh,
    phmsbh,
    pinteh,
    pinth,
    plzcw, // not implemented
    pmaddh, // not implemented
    pmadduw, // not implemented
    pmaddw, // not implemented
    pmaxh, // not implemented
    pmaxw, // not implemented
    pmfhi,
    pmfhl, // not implemented
    pmflo,
    pminh, // not implemented
    pminw, // not implemented
    pmsubh, // not implemented
    pmsubw, // not implemented
    pmthi,
    pmthl, // not implemented
    pmtlo,
    pmulth, // not implemented
    pmultw, // not implemented
    pmultuw, // not implemented
    pnor, // not implemented
    por, // not implemented
    ppac5, // not implemented
    ppacb, // not implemented
    ppach, // not implemented
    ppacw, // not implemented
    prevh, // not implemented
    prot3w, // not implemented
    psllh, // not implemented
    psllvw, // not implemented
    psllw, // not implemented
    psrah, // not implemented
    psravw, // not implemented
    psraw, // not implemented
    psrlh, // not implemented
    psrlvw, // not implemented
    psrlw, // not implemented
    psubb, // not implemented
    psubh, // not implemented
    psubsb, // not implemented
    psubsh, // not implemented
    psubsw, // not implemented
    psubub, // not implemented
    psubuh, // not implemented
    psubuw, // not implemented
    psubw, // not implemented
    pxor, // not implemented
    qfsrv, // not implemented
    sq,
    bc0f,
    bc0fl,
    bc0t,
    bc0tl,
    // cache instructions skipped intentionally
    di,
    ei,
    eret,
    mfbpc, // not implemented
    mfc0,
    mfdab, // not implemented
    mfdabm, // not implemented
    mfdvb, // not implemented
    mfdvbm, // not implemented
    mfiab, // not implemented
    mfiabm, // not implemented
    mfpc, // not implemented
    mfps, // not implemented
    mtbpc, // not implemented
    mtc0,
    mtdab, // not implemented
    mtdabm, // not implemented
    mtdvb, // not implemented
    mtdvbm, // not implemented
    mtiab, // not implemented
    mtiabm, // not implemented
    mtpc, // not implemented
    mtps, // not implemented
    tlbp, // not implemented
    tlbr, // not implemented
    tlbwi, // not implemented
    tlbwr, // not implemented
    abs_s,
    add_s,
    adda_s,
    bc1f,
    bc1fl,
    bc1t,
    bc1tl,
    c_eq_s,
    c_f_s,
    c_le_s,
    c_lt_s,
    cfc1,
    ctc1,
    cvt_s_w,
    cvt_w_s,
    div_s,
    lwc1,
    madd_s,
    madda_s,
    max_s,
    mfc1,
    min_s,
    mov_s,
    msub_s,
    msuba_s,
    mtc1,
    mul_s,
    mula_s,
    neg_s,
    rsqrt_s,
    sqrt_s,
    sub_s,
    suba_s,
    swc1
}

export type ImmediateOperand = number;

export type MemOperand = {
    base: Register;
    offset: number;
};

export type Operand = Register | MemOperand | ImmediateOperand;

export function formatOperand(operand: Operand): string {
    if (typeof operand === 'number') {
        if (operand < 0) return `-0x${(-operand).toString(16)}`;
        return `0x${operand.toString(16)}`;
    }

    if ('base' in operand) {
        const offset = operand.offset < 0 ? `-0x${(-operand.offset).toString(16)}` : `0x${operand.offset.toString(16)}`;
        return `${offset}(${formatRegister(operand.base)})`;
    }

    return formatRegister(operand);
}

export function isImmediate(operand: Operand): operand is ImmediateOperand {
    return typeof operand === 'number';
}

export function isMemOperand(operand: Operand): operand is MemOperand {
    return typeof operand !== 'number' && 'base' in operand;
}

export function isRegister(operand: Operand): operand is Register {
    return typeof operand !== 'number' && 'type' in operand;
}
