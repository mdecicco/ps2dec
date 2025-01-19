import { i, Op, Reg } from 'decoder';
import { TypeSystem } from 'typesys';

import { AnnotationEntity, FunctionEntity } from 'apps/backend/entities';
import { MemoryService } from 'apps/backend/services';
import { AnnotationModel, MemoryRegionModel } from 'types';

const ProgressInterval = 125;

type FoundFunction = {
    startAddress: number;
    endAddress: number;
    stackSize: number;
    branches: {
        address: number;
        target: number;
    }[];
};

type FoundFunctionCall = {
    address: number;
    caller: FunctionEntity;
    callee: FunctionEntity;
};

export class FindFunctionAnalyzer {
    private m_functions: FunctionEntity[];
    private m_annotations: AnnotationEntity[];
    private m_calls: FoundFunctionCall[];

    constructor() {
        this.m_functions = [];
        this.m_annotations = [];
        this.m_calls = [];
    }

    public async analyze(progress: (desc: string, frac: number) => void) {
        const regions = MemoryService.regions;
        for (const r of regions) {
            if (!r.name.startsWith('.text')) continue;

            await this.analyzeCodeSection(r, progress);
        }

        return { annotations: this.m_annotations, functions: this.m_functions, calls: this.m_calls };
    }

    private async analyzeCodeSection(section: MemoryRegionModel, progress: (desc: string, frac: number) => void) {
        let addr = section.start;
        let lastWasBranch = false;
        let furthestBranch = 0;

        const signature = TypeSystem.get().getSignatureType(TypeSystem.get().getType('void'), []);

        // don't start functions on NOPs
        while (!MemoryService.read32(addr)) addr += 4;

        const found: FoundFunction[] = [];

        let currentFunction: FoundFunction = {
            startAddress: addr,
            endAddress: addr,
            stackSize: this.analyzeStackFrame(addr),
            branches: []
        };
        const endAddr = addr + section.size;

        let startAt = performance.now();
        while (addr < endAddr) {
            const current = performance.now();
            const elapsed = current - startAt;
            if (elapsed > ProgressInterval) {
                const desc = `Scanning for functions, ${found.length} found`;
                progress(desc, addr / endAddr);
                startAt = current;
            }

            lastWasBranch = false;
            const instruction = MemoryService.getInstruction(addr);
            if (!instruction) {
                addr += 4;
                continue;
            }

            // Check for function end conditions
            let isEnd = false;

            // Check if this function is still a straight leaf
            // A straight leaf function can't:
            // 1. Call other functions (JAL, JALR, BGEZAL, BLTZAL, or J to another function)
            // 2. Have any branches or jumps (except the final return)

            if (instruction.isBranch) {
                lastWasBranch = true;

                // Not technically safe, but we only use it if it's actually an address
                const target = instruction.operands[instruction.operands.length - 1] as number;

                if (typeof target === 'number') {
                    currentFunction.branches.push({
                        address: addr,
                        target
                    });
                }

                if (
                    instruction.code !== Op.Code.jr &&
                    instruction.code !== Op.Code.j &&
                    instruction.code !== Op.Code.jal &&
                    instruction.code !== Op.Code.jalr
                ) {
                    if (target > furthestBranch) furthestBranch = target;
                }

                // Function end conditions:
                // 1. JR RA (typical function return)
                if (
                    instruction.code === Op.Code.jr &&
                    Reg.compare(instruction.operands[0] as Reg.Register, { type: Reg.Type.EE, id: Reg.EE.RA })
                ) {
                    if (furthestBranch <= addr) {
                        isEnd = true;
                    }
                }
                // 2. Unconditional jump backwards (likely a loop end or tail call)
                else if (instruction.code === Op.Code.j) {
                    if (target <= addr && furthestBranch <= addr) {
                        isEnd = true;
                    } else {
                        if (this.isLikelyTailCall(currentFunction, addr, target)) {
                            isEnd = true;
                        }
                    }
                } else if (instruction.code === Op.Code.b) {
                    if (target <= addr && furthestBranch <= addr) {
                        isEnd = true;
                    } else {
                        if (this.isLikelyTailCall(currentFunction, addr, target)) {
                            isEnd = true;
                        }
                    }
                }
            }

            // Handle function end
            if (isEnd) {
                // delay slot
                addr += 4;

                // + 4 because the function ends after the instruction in the delay slot
                currentFunction.endAddress = addr + 4;

                // address after the delay slot (probably nop)
                addr += 4;

                if (currentFunction.endAddress > section.start + section.size) {
                    currentFunction.endAddress = section.start + section.size;
                }

                found.push(currentFunction);

                // don't start functions on NOPs
                while (!MemoryService.read32(addr) && addr < endAddr) addr += 4;

                currentFunction = {
                    startAddress: addr,
                    endAddress: addr,
                    stackSize: this.analyzeStackFrame(addr),
                    branches: []
                };

                furthestBranch = 0;
            } else {
                addr += 4;
            }
        }

        // Handle the last function
        if (currentFunction && currentFunction.startAddress < endAddr) {
            if (lastWasBranch) {
                // delay slot
                addr += 4;

                // + 4 because the function ends after the instruction in the delay slot
                currentFunction.endAddress = addr + 4;
            } else {
                // + 4 because the function ends after the current instruction (hopefully)
                currentFunction.endAddress = addr + 4;
            }

            if (currentFunction.endAddress > section.start + section.size) {
                currentFunction.endAddress = section.start + section.size;
            }

            found.push(currentFunction);
        }

        const addrFuncMap = new Map<number, FunctionEntity>();
        found.forEach(f => {
            const functionName = `FUN_${f.startAddress.toString(16).padStart(8, '0')}`;
            const annotation = new AnnotationEntity();
            annotation.address = f.startAddress;
            annotation.data = {
                type: 'label',
                label: functionName,
                address: f.startAddress
            } as AnnotationModel;

            this.m_annotations.push(annotation);

            const func = new FunctionEntity();
            func.name = functionName;
            func.address = f.startAddress;
            func.endAddress = f.endAddress;
            func.stackSize = f.stackSize;
            func.methodOfId = null;
            func.signatureId = signature.id;

            this.m_functions.push(func);
            addrFuncMap.set(f.startAddress, func);
        });

        found.forEach(f => {
            const caller = addrFuncMap.get(f.startAddress);
            if (!caller) return;

            f.branches.forEach(b => {
                const callee = addrFuncMap.get(b.target);
                if (!callee) return;

                const address = b.address;
                this.m_calls.push({ caller, callee, address });
            });
        });
    }

    private isLikelyTailCall(currentFunction: FoundFunction, addr: number, jumpAddr: number): boolean {
        // Case 1: Jump to earlier address is likely a tail call or error handler
        if (jumpAddr < currentFunction.startAddress) return true;
        const delayOp = MemoryService.read32(addr + 4);
        const delayInstr = MemoryService.getInstruction(addr + 4);
        if (!delayInstr) return false;

        // Case 2: Look for stack cleanup in delay slot
        if (currentFunction.stackSize > 0) {
            // Direct stack cleanup
            if (
                delayInstr &&
                delayInstr.code === Op.Code.addiu &&
                Reg.compare(delayInstr.operands[0] as Reg.Register, { type: Reg.Type.EE, id: Reg.EE.SP }) &&
                Reg.compare(delayInstr.operands[1] as Reg.Register, { type: Reg.Type.EE, id: Reg.EE.SP }) &&
                (delayInstr.operands[2] as number) === currentFunction.stackSize
            ) {
                return true;
            }

            // Look a few instructions back for stack cleanup
            let tempAddr = addr;
            for (let i = 0; i < 4 && tempAddr > currentFunction.startAddress; i++) {
                tempAddr -= 4;
                const prevInstr = MemoryService.getInstruction(tempAddr);
                if (!prevInstr) continue;

                if (
                    prevInstr.code === Op.Code.addiu &&
                    Reg.compare(prevInstr.operands[0] as Reg.Register, { type: Reg.Type.EE, id: Reg.EE.SP }) &&
                    Reg.compare(prevInstr.operands[1] as Reg.Register, { type: Reg.Type.EE, id: Reg.EE.SP }) &&
                    (prevInstr.operands[2] as number) === currentFunction.stackSize
                ) {
                    // Check if delay slot is doing something reasonable
                    if (!delayOp || this.isSimpleInstruction(delayInstr)) {
                        return true;
                    }
                }

                // Look for register restores from stack
                if (prevInstr.code === Op.Code.lw || prevInstr.code === Op.Code.ld) {
                    const dst = prevInstr.operands[0] as Reg.Register;
                    if (dst.type === Reg.Type.EE) {
                        // Common saved registers are s0-s7, ra
                        if ((dst.id >= Reg.EE.S0 && dst.id <= Reg.EE.S7) || dst.id === Reg.EE.RA) {
                            return true;
                        }
                    }
                }
            }
        }

        // Case 3: Look ahead for obvious start of new function
        let tempAddr = addr;
        for (let i = 0; i < 8; i++) {
            const nextOp = MemoryService.read32(tempAddr);
            if (nextOp === 0) {
                tempAddr += 4;
                continue;
            }

            const nextInstr = MemoryService.getInstruction(tempAddr);
            if (!nextInstr) {
                tempAddr += 4;
                continue;
            }

            if (
                nextInstr.code === Op.Code.addiu &&
                Reg.compare(nextInstr.operands[0] as Reg.Register, { type: Reg.Type.EE, id: Reg.EE.SP }) &&
                Reg.compare(nextInstr.operands[1] as Reg.Register, { type: Reg.Type.EE, id: Reg.EE.SP }) &&
                (nextInstr.operands[2] as number) < 0
            ) {
                // Functions often start with a stack adjustment like this
                return true;
            }

            tempAddr += 4;
        }

        return false;
    }

    private isSimpleInstruction(instr: i.Instruction): boolean {
        // Instructions commonly found in delay slots
        return (
            instr.code === Op.Code.addiu ||
            instr.code === Op.Code.ori ||
            instr.code === Op.Code.lui ||
            instr.code === Op.Code.lw ||
            instr.code === Op.Code.sw ||
            instr.code === Op.Code.sll ||
            instr.code === Op.Code.srl
        );
    }

    private analyzeStackFrame(addr: number): number {
        // Look at first few instructions for stack setup
        let stackSize = 0;

        for (let i = 0; i < 8; i++) {
            const instr = MemoryService.getInstruction(addr);
            if (!instr) {
                addr += 4;
                continue;
            }

            if (
                instr.code === Op.Code.addiu &&
                Reg.compare(instr.operands[0] as Reg.Register, { type: Reg.Type.EE, id: Reg.EE.SP }) &&
                Reg.compare(instr.operands[1] as Reg.Register, { type: Reg.Type.EE, id: Reg.EE.SP })
            ) {
                // addiu $sp, $sp, -X
                stackSize += -(instr.operands[2] as number);
            }

            // Look for frame pointer setup which might indicate stack size
            if (
                instr.code === Op.Code.addiu &&
                Reg.compare(instr.operands[0] as Reg.Register, { type: Reg.Type.EE, id: Reg.EE.FP }) &&
                Reg.compare(instr.operands[1] as Reg.Register, { type: Reg.Type.EE, id: Reg.EE.SP })
            ) {
                // addiu $fp, $sp, X might indicate total frame size
                const offset = instr.operands[2] as number;
                if (offset > 0) stackSize = Math.max(stackSize, offset);
            }

            addr += 4;
        }

        return stackSize || -1;
    }
}
