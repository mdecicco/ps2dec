import Messager from 'apps/backend/message';
import { FunctionService } from 'apps/backend/services/FunctionService';
import { MemoryService } from 'apps/backend/services/MemoryService';
import { decode, i } from 'decoder';
import { Decompiler, DecompilerCache, SerializedDecompilation } from 'decompiler';

export class DecompilerService {
    static async initialize() {
        Messager.func('decompileFunction', (functionId: number) => {
            return this.decompileFunction(functionId);
        });
    }

    static decompileFunction(functionId: number): SerializedDecompilation | { error: string } {
        const func = FunctionService.getFunctionById(functionId);
        if (!func) {
            return { error: 'Function not found' };
        }

        const instructions: i.Instruction[] = [];
        for (let addr = func.address; addr < func.endAddress; addr += 4) {
            const op = MemoryService.read32(addr);
            try {
                instructions.push(decode(op, addr));
            } catch (err) {}
        }

        const decompiler = Decompiler.current;
        const cache = new DecompilerCache(FunctionService.toTypeSystem(func));

        try {
            return decompiler
                .decompile(instructions, cache, {
                    findFunctionByAddress: (address: number) => {
                        const func = FunctionService.getFunctionByAddress(address);
                        if (!func) return null;

                        return FunctionService.toTypeSystem(func);
                    },
                    findFunctionById: (id: number) => {
                        const func = FunctionService.getFunctionById(id);
                        if (!func) return null;

                        return FunctionService.toTypeSystem(func);
                    }
                })
                .serialize();
        } catch (err) {
            return { error: String(err) };
        }
    }
}
