import { Decompiler, Expr } from 'decompiler';
import * as Op from '../opcodes';
import * as Reg from '../registers';

export type InstructionCreationInfo = {
    address: number;
    machineCode: number;
    code: Op.Code;
    codeStr: string;
    operands: Op.Operand[];
    writes: Reg.Register[];
    reads: Reg.Register[];
    isBranch?: boolean;
    isLikelyBranch?: boolean;
    isLoad?: boolean;
    isStore?: boolean;
};

export abstract class Instruction {
    private m_expr: Expr.Expression | null;
    private m_opStrs: string[];
    private m_code: Op.Code;
    private m_operands: Op.Operand[];
    private m_writes: Reg.Register[];
    private m_reads: Reg.Register[];
    private m_address: number;
    private m_machineCode: number;
    private m_isBranch: boolean;
    private m_isLikelyBranch: boolean;
    private m_isUnconditionalBranch: boolean;
    private m_isLoad: boolean;
    private m_isStore: boolean;
    private m_youreWelcome: string;

    constructor(info: InstructionCreationInfo) {
        this.m_expr = null;
        this.m_opStrs = [info.codeStr, ...info.operands.map(Op.formatOperand)];
        this.m_code = info.code;
        this.m_operands = info.operands;
        this.m_writes = info.writes;
        this.m_reads = info.reads;
        this.m_address = info.address;
        this.m_machineCode = info.machineCode;
        this.m_isBranch = info.isBranch || false;
        this.m_isLikelyBranch = info.isLikelyBranch || false;
        this.m_isUnconditionalBranch = false;
        this.m_isLoad = info.isLoad || false;
        this.m_isStore = info.isStore || false;
        this.m_youreWelcome = `0x${info.address.toString(16).padStart(8, '0')}`;

        if (this.m_isBranch) {
            switch (this.m_code) {
                case Op.Code.b:
                case Op.Code.jal:
                case Op.Code.jalr:
                case Op.Code.j:
                case Op.Code.jr:
                    this.m_isUnconditionalBranch = true;
                    break;
            }
        }
    }

    get code(): Op.Code {
        return this.m_code;
    }

    get operands(): Op.Operand[] {
        return this.m_operands;
    }

    get writes(): Reg.Register[] {
        return this.m_writes;
    }

    get reads(): Reg.Register[] {
        return this.m_reads;
    }

    get address(): number {
        return this.m_address;
    }

    get rawMachineCode(): number {
        return this.m_machineCode;
    }

    get isLoad(): boolean {
        return this.m_isLoad;
    }

    get isStore(): boolean {
        return this.m_isStore;
    }

    /**
     * @returns `true` if the instruction is one of the branch instructions
     * @note All branches have delay slots, but not all delay slots are treated equally
     */
    get isBranch(): boolean {
        return this.m_isBranch;
    }

    /**
     * @returns `true` if the instruction is an unconditional branch
     */
    get isUnconditionalBranch(): boolean {
        return this.m_isUnconditionalBranch;
    }

    /**
     * @returns `true` if the instruction is a branch instruction that is likely take the branch
     * @note When likely branches do not branch the delay slot is nullified. This effectively
     * means that the delay slot acts as the first instruction of the targeted basic block.
     */
    get isLikelyBranch(): boolean {
        return this.m_isLikelyBranch;
    }

    writesTo(reg: Reg.Register) {
        for (let i = 0; i < this.m_writes.length; i++) {
            if (Reg.compare(this.m_writes[i], reg)) return true;
        }

        return false;
    }

    readsFrom(reg: Reg.Register) {
        for (let i = 0; i < this.m_reads.length; i++) {
            if (Reg.compare(this.m_reads[i], reg)) return true;
        }

        return false;
    }

    toExpression(): Expr.Expression {
        // if (this.m_expr) return this.m_expr;
        Decompiler.get().currentInstruction = this;
        this.m_expr = this.createExpression();
        return this.m_expr;
    }

    toString(): string {
        return `${this.m_opStrs[0]} ${this.m_opStrs.slice(1).join(', ')}`;
    }

    toStrings(): string[] {
        return this.m_opStrs;
    }

    protected abstract createExpression(): Expr.Expression;
}
