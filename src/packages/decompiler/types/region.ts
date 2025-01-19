import { i, Reg } from 'decoder';

import { BasicBlock } from '../analysis/cfg';
import { Value } from '../analysis/vardb';

export interface InductionVariable {
    register: Reg.Register;
    initVersion: number;
    initInstruction: i.Instruction | null;
    stepVersion: number;
    stepInstruction: i.Instruction;
    variable: Value | null;
}

interface RegionBase<T extends string> {
    type: T;
    header: BasicBlock;
    blocks: Set<BasicBlock>;
}

export interface BlockRegion extends RegionBase<'block'> {
    instructions: i.Instruction[];
}

export interface SequenceRegion extends RegionBase<'sequence'> {
    sequence: Region[];
}

export interface LoopRegion extends RegionBase<'loop'> {
    backEdges: BasicBlock[];
    // null condition indicates `while (true)` or `for (...; ; ...)` or similar
    condition: i.Instruction | null;
    // non-null indicates a for loop
    inductionVar: InductionVariable | null;
    body: Region;
}

export interface IfRegion extends RegionBase<'if'> {
    condition: i.Instruction;
    invertCondition: boolean;
    thenRegion: Region;
    elseRegion: Region | null;
}

export interface RegionRef extends RegionBase<'ref'> {
    targetHeader: BasicBlock;
    branchInstr: i.Instruction;
}

export type Region = BlockRegion | SequenceRegion | LoopRegion | IfRegion | RegionRef;
