import { FunctionCallEntity, FunctionEntity } from 'apps/backend/entities';
import { DataTypeService, FunctionService, MemoryService } from 'apps/backend/services';
import { i, Op, Reg } from 'decoder';
import { BasicBlock, ControlFlowGraph, DataType, Location, TypeSystem } from 'decompiler';
import { compareLocations, LocationMap, LocationSet } from 'utils';

interface ArgumentEvidence {
    location: Location;
    confidence: number;
    firstUseAddress: number | null;
    usageCount: number;
}

interface CallSiteInfo {
    caller: FunctionEntity;
    address: number;
}

interface ArgumentMetadata {
    type: DataType;
    location: Location;
}

interface ReturnValueMetadata {
    type: DataType;
    location: Location | null; // null means void
}

interface SignatureMetadata {
    args: ArgumentMetadata[];
    isVariadic: boolean;
    returnValue: ReturnValueMetadata;
}

const MinimumConfidence = 0.5;
const ProgressInterval = 125;

export class FindFunctionSignatureAnalyzer {
    private m_lastProgress: number;
    private m_calleeBackupLocations: LocationSet;
    private m_processedFunctions: Set<number>;
    private m_analyzingFunctions: Set<number>;
    private m_signatureMetadata: Map<number, SignatureMetadata>;
    private m_cfgCache: Map<number, ControlFlowGraph>;
    private m_functionCount: number;
    private m_updateFuncIdBySigId: Map<number, number[]>;
    private m_progress: (desc: string, frac: number) => void;

    constructor(progress: (desc: string, frac: number) => void) {
        this.m_lastProgress = performance.now();
        this.m_calleeBackupLocations = new LocationSet();
        this.m_processedFunctions = new Set<number>();
        this.m_analyzingFunctions = new Set<number>();
        this.m_signatureMetadata = new Map<number, SignatureMetadata>();
        this.m_cfgCache = new Map<number, ControlFlowGraph>();
        this.m_functionCount = 0;
        this.m_updateFuncIdBySigId = new Map<number, number[]>();
        this.m_progress = progress;
    }

    private doSendProgress() {
        const current = performance.now();
        if (current - this.m_lastProgress > ProgressInterval) {
            this.m_lastProgress = current;
            return true;
        }
        return false;
    }

    public async analyze() {
        const functions = FunctionService.functions
            .map(f => {
                const calls = FunctionService.getCallsFromFunction(f.id);

                let callCount = 0;
                const seenTargets = new Set<number>();
                for (const call of calls) {
                    if (seenTargets.has(call.calleeFunctionId)) continue;
                    seenTargets.add(call.calleeFunctionId);
                    callCount++;
                }

                return {
                    func: f,
                    callCount
                };
            })
            .sort((a, b) => a.callCount - b.callCount)
            .map(f => f.func);

        this.m_functionCount = functions.length;

        for (let i = 0; i < functions.length; i++) {
            const func = functions[i];
            if (this.m_processedFunctions.has(func.address)) continue;

            const metadata = await this.analyzeFunction(func);
            this.m_signatureMetadata.set(func.address, metadata);
        }

        return Array.from(this.m_updateFuncIdBySigId.entries()).map(([signatureId, funcIds]) => ({
            signatureId,
            funcIds
        }));
    }

    private async analyzeFunction(func: FunctionEntity): Promise<SignatureMetadata> {
        const instructions: i.Instruction[] = [];
        for (let addr = func.address; addr < func.endAddress; addr += 4) {
            const instr = MemoryService.getInstruction(addr);
            if (!instr) {
                instructions.push(new i.nop(addr));
                continue;
            }

            instructions.push(instr);

            // before doing anything, make sure any functions that are called within this function
            // have been processed (so long as they aren't already being analyzed)
            if (instr.isBranch) {
                const target = instr.operands[instr.operands.length - 1];
                if (typeof target !== 'number') continue;

                if (this.m_processedFunctions.has(target)) continue;
                if (this.m_analyzingFunctions.has(target)) continue;

                const targetFunc = FunctionService.getFunctionByAddress(target);
                if (!targetFunc) continue;

                this.m_analyzingFunctions.add(targetFunc.address);

                const calleeMetadata = await this.analyzeFunction(targetFunc);
                this.m_signatureMetadata.set(targetFunc.address, calleeMetadata);
                this.m_processedFunctions.add(targetFunc.address);

                this.m_analyzingFunctions.delete(targetFunc.address);
            }
        }

        if (this.doSendProgress()) {
            this.m_progress(
                `Determining signature for ${func.name}`,
                this.m_processedFunctions.size / this.m_functionCount
            );
        }

        this.m_calleeBackupLocations.clear();

        const callsTo = FunctionService.getCallsToFunction(func.id);
        const callSites = await this.getCallSiteInfo(callsTo);
        const cfg = this.getCfg(func, instructions);
        const argEvidence = this.getArgumentEvidence(func, instructions, cfg);

        // Update confidence scores with call site information
        for (const evidence of argEvidence.values) {
            evidence.confidence = this.calculateArgumentConfidence(evidence, callSites);
        }

        const argLocations = this.determineArgumentLocations(argEvidence, callSites);
        const args: ArgumentMetadata[] = [];
        let isVariadic = false;

        if (this.isLikelyVariadic(cfg, argLocations.gpArgs, argLocations.fpArgs)) {
            isVariadic = true;
            const { gpRegs, fpRegs } = this.findExplicitArgumentRegisters(
                cfg,
                argLocations.gpArgs,
                argLocations.fpArgs
            );

            // Convert locations to metadata with types
            for (const arg of gpRegs.values) {
                const evidence = argLocations.gpArgs.find(e => compareLocations(e.location, arg));
                if (!evidence) continue;

                args.push({
                    type: this.determineArgumentType(cfg, evidence),
                    location: arg
                });
            }

            for (const arg of fpRegs.values) {
                const evidence = argLocations.fpArgs.find(e => compareLocations(e.location, arg));
                if (!evidence) continue;

                args.push({
                    type: this.determineArgumentType(cfg, evidence),
                    location: arg
                });
            }
        } else {
            // Convert locations to metadata with types
            for (const arg of argLocations.gpArgs) {
                args.push({
                    type: this.determineArgumentType(cfg, arg),
                    location: arg.location
                });
            }

            for (const arg of argLocations.fpArgs) {
                args.push({
                    type: this.determineArgumentType(cfg, arg),
                    location: arg.location
                });
            }

            for (const arg of argLocations.stackArgs) {
                args.push({
                    type: this.determineArgumentType(cfg, arg),
                    location: arg.location
                });
            }
        }

        const returnValue = this.determineReturnValue(func, cfg, callSites);

        // const argStrs = args.map(a => `${a.type.name} ${formatLocation(a.location)}`);
        // if (isVariadic) argStrs.push('...');
        // console.log(`${returnValue.type.name} ${func.name}(${argStrs.join(', ')})`);

        const sig = TypeSystem.get().getSignatureType(
            returnValue.type,
            args.map(a => a.type),
            isVariadic
        );
        await DataTypeService.waitFor(sig.id);

        let funcIds = this.m_updateFuncIdBySigId.get(sig.id);
        if (!funcIds) {
            funcIds = [];
            this.m_updateFuncIdBySigId.set(sig.id, funcIds);
        }
        funcIds.push(func.id);

        return { args, isVariadic, returnValue };
    }

    private processArgumentLocation(
        func: FunctionEntity,
        argEvidence: LocationMap<ArgumentEvidence>,
        cfg: ControlFlowGraph,
        instr: i.Instruction,
        location: Location
    ) {
        // Check if this use has any assignments before it
        if (this.hasBeenAssigned(cfg, instr, location)) {
            // assigned before this use, ignore it
            return;
        }

        let evidence = argEvidence.get(location);

        if (!evidence) {
            evidence = {
                location,
                confidence: 0,
                usageCount: 0,
                firstUseAddress: null
            };
            argEvidence.set(location, evidence);
        }

        evidence.usageCount++;

        // If no assignments before use, this is likely an argument
        evidence.confidence += 1;
        if (!evidence.firstUseAddress) {
            evidence.firstUseAddress = instr.address;
        }
    }

    private getArgumentEvidence(
        func: FunctionEntity,
        instructions: i.Instruction[],
        cfg: ControlFlowGraph
    ): LocationMap<ArgumentEvidence> {
        // Track evidence for potential arguments
        const argEvidence = new LocationMap<ArgumentEvidence>();

        // Check each instruction for uses of argument registers/stack
        for (const instr of instructions) {
            // Skip initial stack frame setup
            if (this.isStackFrameSetup(instr, cfg)) continue;

            // Check direct register reads
            for (const reg of instr.reads) {
                if (this.isPotentialArgumentRegister(reg)) {
                    this.processArgumentLocation(func, argEvidence, cfg, instr, reg);
                }
            }

            // Check loads from stack
            if (instr.isLoad) {
                const offset = this.getStackOffset(instr);
                if (offset !== null) {
                    // Ignore these for now... there seems to be a lot of false positives
                    // this.processArgumentLocation(func, argEvidence, cfg, instr, offset);
                }
            }

            // Check function calls for argument forwarding
            if (instr.isBranch) {
                const target = instr.operands[instr.operands.length - 1];
                if (typeof target !== 'number') continue;

                const calleeMetadata = this.m_signatureMetadata.get(target);
                if (calleeMetadata) {
                    // Check each argument in the callee's signature for forwarding
                    for (const arg of calleeMetadata.args) {
                        this.processArgumentLocation(func, argEvidence, cfg, instr, arg.location);
                    }
                }
            }
        }

        return argEvidence;
    }

    private isStackFrameSetup(instr: i.Instruction, cfg: ControlFlowGraph): boolean {
        // Stack pointer adjustment is always setup
        if (
            instr.code === Op.Code.addiu &&
            Reg.compare(instr.operands[0] as Reg.Register, { type: Reg.Type.EE, id: Reg.EE.SP }) &&
            Reg.compare(instr.operands[1] as Reg.Register, { type: Reg.Type.EE, id: Reg.EE.SP })
        ) {
            return true;
        }

        // For stores, check if it's storing an unmodified saved register
        if (instr.isStore && this.getStackOffset(instr) !== null) {
            const savedReg = instr.reads[0];

            // If the register hasn't been written to before this store,
            // then it's likely just being backed up
            if (!this.hasBeenAssigned(cfg, instr, savedReg)) {
                this.m_calleeBackupLocations.add(savedReg);
                return true;
            }
        }

        return false;
    }

    private isPotentialArgumentRegister(reg: Reg.Register): boolean {
        if (reg.type === Reg.Type.EE) {
            // $a0-$a3
            return reg.id >= Reg.EE.A0 && reg.id <= Reg.EE.A3;
        } else if (reg.type === Reg.Type.COP1) {
            // $f12-$f19
            return reg.id >= Reg.COP1.F12 && reg.id <= Reg.COP1.F19;
        }
        return false;
    }

    private hasBeenAssigned(cfg: ControlFlowGraph, useInstruction: i.Instruction, location: Location): boolean {
        const block = cfg.getBlock(useInstruction.address);
        if (!block) {
            // Error, can't assume it hasn't been assigned
            return true;
        }

        let foundAssignment = false;
        block.walkBackward(b => {
            b.reverseEach(instr => {
                if (instr === useInstruction) return;
                if (this.instructionAssignsLocation(instr, location)) {
                    foundAssignment = true;
                    return true;
                }
            }, useInstruction);

            return !foundAssignment;
        });

        return foundAssignment;
    }

    private instructionAssignsLocation(
        instr: i.Instruction,
        location: Location,
        ignoreBackups: boolean = false
    ): boolean {
        if (typeof location !== 'number') {
            return instr.writesTo(location);
        }

        // Check for stack writes
        return instr.isStore && this.getStackOffset(instr, ignoreBackups) === location;
    }

    private instructionUsesLocation(instr: i.Instruction, location: Location): boolean {
        if (typeof location !== 'number') {
            if (instr.readsFrom(location)) return true;
        }

        if (instr.isLoad && this.getStackOffset(instr, true) === location) return true;

        if (instr.isBranch) {
            const target = instr.operands[instr.operands.length - 1];
            if (typeof target === 'number') {
                const calleeMetadata = this.m_signatureMetadata.get(target);
                if (calleeMetadata) {
                    for (const arg of calleeMetadata.args) {
                        if (compareLocations(arg.location, location)) return true;
                    }
                }
            }
        }

        return false;
    }

    private getStackOffset(instr: i.Instruction, ignoreBackups: boolean = false): number | null {
        const dest = instr.operands.find(op => Op.isMem(op));
        if (!dest) return null;

        if (!Reg.compare(dest.base, { type: Reg.Type.EE, id: Reg.EE.SP })) {
            return null;
        }

        if (!ignoreBackups) {
            const nonBaseOperand = instr.reads.find(r => !Reg.compare(r, dest.base));
            if (!nonBaseOperand) return null;

            if (this.m_calleeBackupLocations.has(nonBaseOperand)) {
                return null;
            }
        }

        return dest.offset;
    }

    private determineArgumentLocations(argEvidence: LocationMap<ArgumentEvidence>, callSites: CallSiteInfo[]) {
        const gpArgs: ArgumentEvidence[] = [];
        const fpArgs: ArgumentEvidence[] = [];
        const stackArgs: ArgumentEvidence[] = [];

        // First pass - categorize arguments by type
        for (const [loc, evidence] of argEvidence.entries) {
            if (typeof loc === 'number') {
                stackArgs.push(evidence);
            } else if (loc.type === Reg.Type.EE) {
                if (loc.id >= Reg.EE.A0 && loc.id <= Reg.EE.A3) {
                    gpArgs.push(evidence);
                }
            } else if (loc.type === Reg.Type.COP1) {
                if (loc.id >= Reg.COP1.F12 && loc.id <= Reg.COP1.F19) {
                    fpArgs.push(evidence);
                }
            }
        }

        // Sort args by register/offset
        gpArgs.sort((a, b) => {
            const regA = a.location as Reg.Register;
            const regB = b.location as Reg.Register;
            return regA.id - regB.id;
        });

        fpArgs.sort((a, b) => {
            const regA = a.location as Reg.Register;
            const regB = b.location as Reg.Register;
            return regA.id - regB.id;
        });

        stackArgs.sort((a, b) => {
            const offsetA = a.location as number;
            const offsetB = b.location as number;
            return offsetA - offsetB;
        });

        const confirmedGP: ArgumentEvidence[] = [];
        const confirmedFP: ArgumentEvidence[] = [];
        const confirmedStack: ArgumentEvidence[] = [];

        // Process GP args - find furthest confirmed arg
        let furthestGPId = -1;
        for (const evidence of gpArgs) {
            const reg = evidence.location as Reg.Register;
            if (evidence.confidence >= MinimumConfidence) {
                furthestGPId = Math.max(furthestGPId, reg.id);
            }
        }

        // Fill in all GP args up to furthest confirmed
        if (furthestGPId >= Reg.EE.A0) {
            for (let id = Reg.EE.A0; id <= furthestGPId; id++) {
                const existing = gpArgs.find(e => (e.location as Reg.Register).id === id);
                confirmedGP.push(
                    existing || {
                        location: { type: Reg.Type.EE, id },
                        confidence: MinimumConfidence,
                        usageCount: 0,
                        firstUseAddress: null
                    }
                );
            }
        }

        // Process FP args similarly
        let furthestFPId = -1;
        for (const evidence of fpArgs) {
            const reg = evidence.location as Reg.Register;
            if (evidence.confidence >= MinimumConfidence) {
                furthestFPId = Math.max(furthestFPId, reg.id);
            }
        }

        // Fill in all FP args up to furthest confirmed
        if (furthestFPId >= Reg.COP1.F12) {
            for (let id = Reg.COP1.F12; id <= furthestFPId; id++) {
                const existing = fpArgs.find(e => (e.location as Reg.Register).id === id);
                confirmedFP.push(
                    existing || {
                        location: { type: Reg.Type.COP1, id },
                        confidence: MinimumConfidence,
                        usageCount: 0,
                        firstUseAddress: null
                    }
                );
            }
        }

        // Process stack args - find furthest confirmed offset
        let furthestOffset = -1;
        for (const evidence of stackArgs) {
            const offset = evidence.location as number;
            if (evidence.confidence >= MinimumConfidence) {
                furthestOffset = Math.max(furthestOffset, offset);
            }
        }

        // Include all stack args up to furthest offset
        if (furthestOffset >= 0) {
            confirmedStack.push(...stackArgs.filter(e => (e.location as number) <= furthestOffset));
        }

        return { gpArgs: confirmedGP, fpArgs: confirmedFP, stackArgs: confirmedStack };
    }

    private async getCallSiteInfo(callsTo: FunctionCallEntity[]): Promise<CallSiteInfo[]> {
        const callSites: CallSiteInfo[] = [];

        for (const call of callsTo) {
            const caller = await call.callerFunction;

            callSites.push({
                caller,
                address: call.address
            });
        }

        return callSites;
    }

    private getCfg(func: FunctionEntity, preDecodedInstructions?: i.Instruction[]): ControlFlowGraph {
        let cfg = this.m_cfgCache.get(func.id);

        if (!cfg) {
            if (preDecodedInstructions) {
                cfg = ControlFlowGraph.build(preDecodedInstructions);
            } else {
                const instructions: i.Instruction[] = [];
                for (let addr = func.address; addr < func.endAddress; addr += 4) {
                    const instr = MemoryService.getInstruction(addr);
                    if (!instr) instructions.push(new i.nop(addr));
                    else instructions.push(instr);
                }

                cfg = ControlFlowGraph.build(instructions);
            }

            this.m_cfgCache.set(func.id, cfg);
        }

        return cfg;
    }

    private calculateArgumentConfidence(evidence: ArgumentEvidence, callSites: CallSiteInfo[]): number {
        let confidence = 0;

        // Base confidence from unassigned uses within the function
        confidence += evidence.confidence * 0.3;

        // More uses = more confidence
        confidence += Math.min(evidence.usageCount / 3, 1) * 0.2;

        // Early use is a good indicator
        if (evidence.firstUseAddress) {
            confidence += 0.2;
        }

        // Exit early if we're already confident enough
        if (confidence >= MinimumConfidence) return confidence;

        // Check call sites
        let assignedCallSites = 0;
        let processedCallSites = 0;

        for (const site of callSites) {
            const cfg = this.getCfg(site.caller);

            // Look for assignments before the call
            let foundAssignment = false;

            if (typeof evidence.location === 'number') {
                // Start from call instruction and work backwards
                const block = cfg.getBlock(site.address);
                if (!block) continue;

                for (let i = block.instructions.length - 1; i >= 0; i--) {
                    const instr = block.instructions[i];

                    // Found stack adjustment
                    if (
                        instr.code === Op.Code.addiu &&
                        Reg.compare(instr.operands[0] as Reg.Register, { type: Reg.Type.EE, id: Reg.EE.SP }) &&
                        Reg.compare(instr.operands[1] as Reg.Register, { type: Reg.Type.EE, id: Reg.EE.SP }) &&
                        (instr.operands[2] as number) !== -site.caller.stackSize
                    ) {
                        // Look for stores to stack between adjustment and call
                        for (let j = i + 1; j < block.instructions.length; j++) {
                            const storeInstr = block.instructions[j];
                            if (storeInstr.isStore && this.getStackOffset(storeInstr) === evidence.location) {
                                foundAssignment = true;
                                break;
                            }
                        }
                        break;
                    }
                }
            } else {
                // For register arguments, look for assignments before call
                // Include delay slot instruction after call
                const block = cfg.getBlock(site.address);
                if (!block) continue;

                foundAssignment = this.hasBeenAssigned(
                    cfg,
                    block.instructions[block.instructions.length - 1],
                    evidence.location
                );
            }

            if (foundAssignment) {
                assignedCallSites++;
            }
            processedCallSites++;

            // Calculate current confidence to see if we can exit early
            const currentCallSiteConfidence = assignedCallSites / processedCallSites;
            const totalConfidence = confidence + currentCallSiteConfidence * 0.3;

            if (totalConfidence >= MinimumConfidence) {
                return totalConfidence;
            }
        }

        // Add final confidence based on processed call sites
        if (processedCallSites > 0) {
            const callSiteConfidence = assignedCallSites / processedCallSites;
            confidence += callSiteConfidence * 0.3;
        }

        return confidence;
    }

    private determineArgumentType(cfg: ControlFlowGraph, evidence: ArgumentEvidence): DataType {
        const ts = TypeSystem.get();
        let defaultType = ts.getType('undefined4');
        let isFloat = false;
        if (typeof evidence.location !== 'number') {
            if (evidence.location.type === Reg.Type.COP1) {
                defaultType = ts.getType('f32');
                isFloat = true;
                // todo: f64? Once the rest of the instructions are implemented we can see
                // if any double precision instructions are used with the argument
            }
        }

        // iterate through cfg to analyze uses of the argument, exiting when the argument is written to for now
        const entry = cfg.getEntryBlock();
        if (!entry) return defaultType;

        const workList: BasicBlock[] = [entry];
        const seenBlocks = new Set<number>();

        while (workList.length > 0) {
            const block = workList.shift();
            if (!block) continue;

            if (seenBlocks.has(block.startAddress)) continue;
            seenBlocks.add(block.startAddress);

            if (typeof evidence.location !== 'number') {
                for (const instr of block.instructions) {
                    if (instr.writesTo(evidence.location as Reg.Register)) {
                        return defaultType;
                    }

                    if (instr.isStore && instr.readsFrom(evidence.location)) {
                        // Store instructions indicate the size of the argument
                        switch (instr.memSize) {
                            case 1:
                                return ts.getType('undefined');
                            case 2:
                                return ts.getType('undefined2');
                            case 4:
                                return defaultType;
                            case 8:
                                return isFloat ? ts.getType('f64') : ts.getType('undefined8');
                            case 16:
                                return ts.getType('undefined16');
                        }
                    }
                }
            } else {
                for (const instr of block.instructions) {
                    if (instr.isStore && this.getStackOffset(instr) === evidence.location) {
                        return defaultType;
                    }

                    // Unfortunately load instructions don't indicate the size of the argument
                    // since the argument is likely a structure. Any loads would most likely be
                    // just loading a field from the structure
                }
            }

            for (const succ of block.successors) {
                workList.push(succ);
            }
        }

        return defaultType;
    }

    private isLikelyVariadic(cfg: ControlFlowGraph, gpArgs: ArgumentEvidence[], fpArgs: ArgumentEvidence[]): boolean {
        const argRegCount = Reg.EE.A3 - Reg.EE.A0 + 1 + (Reg.EE.T3 - Reg.EE.T0 + 1) + (Reg.COP1.F18 - Reg.COP1.F12 + 1);

        let backedUpArgRegCount = 0;

        const backups = this.m_calleeBackupLocations.values;
        for (const loc of backups) {
            if (typeof loc === 'number') continue;

            if (loc.type === Reg.Type.EE) {
                if (loc.id >= Reg.EE.A0 && loc.id <= Reg.EE.A3) {
                    backedUpArgRegCount++;
                } else if (loc.id >= Reg.EE.T0 && loc.id <= Reg.EE.T3) {
                    backedUpArgRegCount++;
                }
            } else if (loc.type === Reg.Type.COP1) {
                if (loc.id >= Reg.COP1.F12 && loc.id <= Reg.COP1.F19) {
                    backedUpArgRegCount++;
                }
            }
        }

        // If it backs up more than 70% of the argument registers, it's probably varidic
        if (backedUpArgRegCount > Math.floor(argRegCount * 0.7)) {
            return true;
        }

        return false;
    }

    private findExplicitArgumentRegisters(
        cfg: ControlFlowGraph,
        gpArgs: ArgumentEvidence[],
        fpArgs: ArgumentEvidence[]
    ): { gpRegs: LocationSet; fpRegs: LocationSet } {
        // Look for meaningful uses of argument registers
        const meaningfulUses = new LocationSet();
        const seenBlocks = new Set<number>();
        const assignedRegisters = new LocationSet();
        const workList = [cfg.getEntryBlock()];

        while (workList.length > 0) {
            const block = workList.shift();
            if (!block || seenBlocks.has(block.startAddress)) continue;
            seenBlocks.add(block.startAddress);

            for (const instr of block.instructions) {
                if (this.isStackFrameSetup(instr, cfg)) continue;

                // For each argument register that's read
                for (const reg of instr.reads) {
                    if (!this.isPotentialArgumentRegister(reg)) continue;
                    if (assignedRegisters.has(reg)) continue;

                    // If this is just storing to stack, skip it
                    if (instr.isStore && this.getStackOffset(instr) !== null) {
                        continue;
                    }

                    // Found a meaningful use
                    meaningfulUses.add(reg);
                }

                // Track assignments to argument registers
                for (const reg of instr.writes) {
                    if (this.isPotentialArgumentRegister(reg)) {
                        assignedRegisters.add(reg);
                    }
                }
            }

            // Break if all potential args have been assigned
            const unassignedGP = gpArgs.some(arg => !assignedRegisters.has(arg.location));
            const unassignedFP = fpArgs.some(arg => !assignedRegisters.has(arg.location));
            if (!unassignedGP && !unassignedFP) break;

            workList.push(...block.successors);
        }

        // Find the highest numbered register that had a meaningful use
        const explicitGPRegs = new LocationSet();
        const explicitFPRegs = new LocationSet();

        let lastMeaningfulGP = -1;
        for (const arg of gpArgs) {
            const reg = arg.location as Reg.Register;
            if (meaningfulUses.has(reg)) {
                lastMeaningfulGP = reg.id;
            }
        }

        // Include all registers up to the last meaningful one
        if (lastMeaningfulGP >= 0) {
            for (let id = Reg.EE.A0; id <= lastMeaningfulGP; id++) {
                explicitGPRegs.add({ type: Reg.Type.EE, id });
            }
        }

        let lastMeaningfulFP = -1;
        for (const arg of fpArgs) {
            const reg = arg.location as Reg.Register;
            if (meaningfulUses.has(reg)) {
                lastMeaningfulFP = reg.id;
            }
        }

        // Include all registers up to the last meaningful one
        if (lastMeaningfulFP >= 0) {
            for (let id = Reg.COP1.F12; id <= lastMeaningfulFP; id++) {
                explicitFPRegs.add({ type: Reg.Type.COP1, id });
            }
        }

        return { gpRegs: explicitGPRegs, fpRegs: explicitFPRegs };
    }

    private determineReturnValue(
        func: FunctionEntity,
        cfg: ControlFlowGraph,
        callSites: CallSiteInfo[]
    ): ReturnValueMetadata {
        const potentialReturns = new LocationSet();
        const directAssignments: { location: Location; block: BasicBlock; instruction: i.Instruction }[] = [];

        // First find assignments to potential return registers
        const entry = cfg.getEntryBlock();
        if (!entry) return { type: TypeSystem.get().getType('void'), location: null };

        entry.walkForward(block => {
            for (const instr of block.instructions) {
                // Check for assignments to return registers
                for (const reg of instr.writes) {
                    if (this.isPotentialReturnRegister(reg)) {
                        potentialReturns.add(reg);
                        directAssignments.push({ location: reg, block, instruction: instr });
                    }
                }

                // Check for calls to functions that return values
                if (instr.isBranch) {
                    const target = instr.operands[instr.operands.length - 1];
                    if (typeof target !== 'number') continue;

                    const calleeMetadata = this.m_signatureMetadata.get(target);
                    if (calleeMetadata?.returnValue.location) {
                        potentialReturns.add(calleeMetadata.returnValue.location);
                    }
                }
            }

            return true;
        });

        if (potentialReturns.size === 0) {
            return { type: TypeSystem.get().getType('void'), location: null };
        }

        // Check if any direct assignments to return registers reach a jr $ra without
        // being used
        for (const assignment of directAssignments) {
            let foundUse = false;
            let foundReturn = false;

            assignment.block.walkForward(block => {
                block.each(
                    instr => {
                        if (instr === assignment.instruction) return;

                        if (this.instructionUsesLocation(instr, assignment.location)) {
                            foundUse = true;
                            return true;
                        }

                        if (
                            instr.code === Op.Code.jr &&
                            Reg.compare(instr.reads[0], { type: Reg.Type.EE, id: Reg.EE.RA })
                        ) {
                            foundReturn = true;
                            return true;
                        }
                    },
                    block === assignment.block ? assignment.instruction : undefined
                );

                return !foundUse && !foundReturn;
            });

            if (foundReturn && !foundUse) {
                // Return register assigned and not used prior to the return, that's
                // a pretty good indicator that it's a return value
                return {
                    type: this.determineReturnType(cfg, assignment.location),
                    location: assignment.location
                };
            }
        }

        // Now check how callers use these potential return values
        let bestReturn: Location | null = null;
        let bestConfidence = 0;

        for (const returnLoc of potentialReturns.values) {
            let usedCallSites = 0;
            let totalCallSites = 0;

            for (const site of callSites) {
                const cfg = this.getCfg(site.caller);
                const block = cfg.getBlock(site.address);
                if (!block) continue;

                const siteInstr = block.instructions.find(instr => instr.address === site.address)!;

                // Look for uses of the return value after the call

                let foundUse = false;
                let foundDef = false;
                block.walkForward(succ => {
                    const checkInstr = (instr: i.Instruction) => {
                        if (instr === siteInstr) return;

                        if (typeof returnLoc !== 'number') {
                            if (instr.readsFrom(returnLoc)) {
                                foundUse = true;
                                usedCallSites++;
                                return true;
                            }
                        } else if (instr.isLoad && this.getStackOffset(instr, true) === returnLoc) {
                            foundUse = true;
                            usedCallSites++;
                            return true;
                        } else if (instr.isBranch) {
                            const target = instr.operands[instr.operands.length - 1];
                            if (typeof target !== 'number') return;

                            const calleeMetadata = this.m_signatureMetadata.get(target);
                            if (calleeMetadata) {
                                // Check each argument in the callee's signature for forwarding
                                for (const arg of calleeMetadata.args) {
                                    if (compareLocations(arg.location, returnLoc)) {
                                        foundUse = true;
                                        usedCallSites++;
                                        return true;
                                    }
                                }
                            }
                        }

                        if (this.instructionAssignsLocation(instr, returnLoc, true)) {
                            foundDef = true;
                            return true;
                        }
                    };

                    succ.each(checkInstr, block === succ ? siteInstr : undefined);

                    return !foundUse && !foundDef;
                });

                totalCallSites++;
            }

            const confidence = totalCallSites > 0 ? usedCallSites / totalCallSites : 0;
            if (confidence > bestConfidence) {
                bestConfidence = confidence;
                bestReturn = returnLoc;
            }
        }

        if (bestConfidence >= 0.3 && bestReturn) {
            // Threshold could be tuned
            return {
                type: this.determineReturnType(cfg, bestReturn),
                location: bestReturn
            };
        }

        return { type: TypeSystem.get().getType('void'), location: null };
    }

    private isPotentialReturnRegister(reg: Reg.Register): boolean {
        if (reg.type === Reg.Type.EE) {
            return reg.id === Reg.EE.V0; // $v0
        } else if (reg.type === Reg.Type.COP1) {
            return reg.id === Reg.COP1.F0; // $f0
        }
        return false;
    }

    private determineReturnType(cfg: ControlFlowGraph, location: Location): DataType {
        const ts = TypeSystem.get();

        // Default types based on register
        if (typeof location !== 'number') {
            if (location.type === Reg.Type.COP1) {
                return ts.getType('f32');
            }
            return ts.getType('undefined4');
        }

        return ts.getType('undefined4');
    }
}
