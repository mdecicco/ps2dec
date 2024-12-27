export { Op, Reg } from 'types';
export { decode } from './decoder';
export * as Inst from './instructions';

// import { test } from './tests/ragUnkInit';
import { test } from './tests/ragUnkDtor';

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

test();
