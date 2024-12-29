export { decode, i, Op, Reg } from 'decoder';

import { Decompiler, TypeSystem } from 'decompiler';
import { test as test2 } from './ragUnkDtor';
import { test as test1 } from './ragUnkInit';

test1();
(TypeSystem as any).instance = null;
(Decompiler as any).instance = null;
test2();
