import { i } from 'decoder';
import { DecompilerCache } from 'packages/decompiler/input';
import { Func, Method } from '../typesys';

export interface IDataSource {
    findFunctionByAddress: (address: number) => Func | Method | null;
    findFunctionById: (id: number) => Func | Method | null;
    getInstructionAtAddress: (address: number) => i.Instruction | null;
    getCacheForFunctionId: (id: number) => DecompilerCache | null;
}
