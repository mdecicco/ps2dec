import { Reg } from 'decoder';
import { VariableDB } from '../analysis/vardb';
import { FunctionCode } from './code';

type RegisterBackup = {
    reg: Reg.Register;
    offset: number;
};

export class DecompilerCache {
    code: FunctionCode;
    vars: VariableDB;
    stackSize: number;
    backedUpRegisters: RegisterBackup[];

    constructor(functionId: number) {
        this.code = new FunctionCode(functionId);
        this.vars = new VariableDB(this.code);
        this.stackSize = 0;
        this.backedUpRegisters = [];
    }

    get func() {
        return this.code.function;
    }

    get cfg() {
        return this.code.cfg;
    }
}
