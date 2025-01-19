import { i } from 'decoder';
import { Func, Method } from 'typesys';

import { DecompilerCache } from './cache';

export interface IDataSource {
    findFunctionByAddress: (address: number) => Func | Method | null;
    findFunctionById: (id: number) => Func | Method | null;
    getInstructionAtAddress: (address: number) => i.Instruction | null;
    getCacheForFunctionId: (id: number) => DecompilerCache | null;
}
