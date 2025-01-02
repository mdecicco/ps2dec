import { FunctionEntity } from 'apps/backend/entities';
import Messager from 'apps/backend/message';
import { Func, FunctionSignatureType, Method, MethodSignatureType, TypeSystem } from 'decompiler';
import { DataSource, Repository } from 'typeorm';

export class FunctionService {
    private static m_repo: Repository<FunctionEntity>;
    private static m_functionsById: Map<number, FunctionEntity>;
    private static m_functionsByAddress: Map<number, FunctionEntity>;
    private static m_tsMap: Map<number, Func | Method>;

    public static async initialize(db: DataSource) {
        FunctionService.m_repo = db.getRepository(FunctionEntity);
        FunctionService.m_functionsById = new Map<number, FunctionEntity>();
        FunctionService.m_functionsByAddress = new Map<number, FunctionEntity>();
        FunctionService.m_tsMap = new Map<number, Func | Method>();

        const functions = await this.m_repo.find({ relations: { signature: true, methodOf: true } });
        for (const func of functions) {
            FunctionService.m_functionsById.set(func.id, func);
            FunctionService.m_functionsByAddress.set(func.address, func);
        }

        Messager.func('getFunctions', () => {
            return FunctionService.functions;
        });
    }

    public static async refetch() {
        FunctionService.m_functionsById.clear();
        FunctionService.m_functionsByAddress.clear();

        const functions = await FunctionService.m_repo.find({ relations: { signature: true, methodOf: true } });
        for (const func of functions) {
            FunctionService.m_functionsById.set(func.id, func);
            FunctionService.m_functionsByAddress.set(func.address, func);
        }

        Messager.send('setFunctions', FunctionService.functions);
    }

    public static async addFunction(func: FunctionEntity) {
        if (!func.id) {
            await FunctionService.m_repo.save(func);
            Messager.send('functionAdded', func);
        }

        FunctionService.m_functionsById.set(func.id, func);
        FunctionService.m_functionsByAddress.set(func.address, func);
    }

    public static async removeFunction(id: number) {
        const func = FunctionService.m_functionsById.get(id);
        if (!func) return;

        const previous = func.toModel();
        func.isDeleted = true;
        await FunctionService.m_repo.save(func);

        Messager.send('functionUpdated', { previous, current: func.toModel() });

        FunctionService.m_functionsById.delete(id);
        FunctionService.m_functionsByAddress.delete(func.address);
    }

    public static getFunctionById(id: number) {
        return FunctionService.m_functionsById.get(id);
    }

    public static getFunctionByAddress(address: number) {
        return FunctionService.m_functionsByAddress.get(address);
    }

    public static toTypeSystem(func: FunctionEntity): Func | Method {
        const cached = FunctionService.m_tsMap.get(func.id);
        if (cached) return cached;

        const sig = TypeSystem.get().getType(func.signatureId);

        let result: Func | Method;

        if (func.methodOfId) {
            result = new Method(func.id, func.address, sig as MethodSignatureType);
        } else {
            result = new Func(func.id, func.address, sig as FunctionSignatureType);
        }

        FunctionService.m_tsMap.set(func.id, result);
        return result;
    }

    public static get functions() {
        return Array.from(FunctionService.m_functionsById.values());
    }
}