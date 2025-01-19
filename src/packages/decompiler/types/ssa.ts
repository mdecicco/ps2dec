import { Expr, i } from 'decoder';
import { Location } from 'types';

import { BasicBlock } from '../analysis';

export interface Phi {
    location: Location;
    versions: number[];
    definitions: LocationDef[];
    uses: LocationUse[];
    variable: Expr.Variable;
}

export interface LocationDef {
    value: Location;
    version: number;
    instruction: i.Instruction | null;
    block: BasicBlock;
}

export interface LocationUse {
    value: Location;
    version: number;
    instruction: i.Instruction;
    block: BasicBlock;
}
