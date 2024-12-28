export { Op, Reg } from 'types';
export { decode } from './decoder';
export * as Inst from './instructions';

import { Decompiler } from 'decompiler/decompiler';
import { TypeSystem } from 'decompiler/typesys';
// import { test as test2 } from './tests/ragUnkDtor';
import { Elf } from 'utils/elf';
import { test as test1 } from './tests/ragUnkInit';

/*
const oldLog = console.log;
console.log = (message: any, ...args: any[]) => {
    oldLog(message, ...args);

    const currentTime = Date.now();
    while (Date.now() - currentTime < 250) {
        // do nothing
    }
};
*/

const elf = Elf.fromFile('C:/Users/miguel/reverse_engineering/sr2/sr/game.elf');

test1();
(TypeSystem as any).instance = null;
(Decompiler as any).instance = null;
// test2();
