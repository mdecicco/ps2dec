import { FunctionCallEntity, FunctionEntity } from 'apps/backend/entities';
import Messager from 'apps/backend/message';
import { Func, FunctionSignatureType, Method, MethodSignatureType, TypeSystem } from 'decompiler';
import { DataSource, Repository } from 'typeorm';

export class FunctionService {
    private static m_repo: Repository<FunctionEntity>;
    private static m_callRepo: Repository<FunctionCallEntity>;
    private static m_functionsById: Map<number, FunctionEntity>;
    private static m_functionsByAddress: Map<number, FunctionEntity>;
    private static m_functionCallsByCalleeId: Map<number, FunctionCallEntity[]>;
    private static m_functionCallsByCallerId: Map<number, FunctionCallEntity[]>;
    private static m_tsMap: Map<number, Func | Method>;

    public static async initialize(db: DataSource) {
        FunctionService.m_repo = db.getRepository(FunctionEntity);
        FunctionService.m_callRepo = db.getRepository(FunctionCallEntity);
        FunctionService.m_functionsById = new Map<number, FunctionEntity>();
        FunctionService.m_functionsByAddress = new Map<number, FunctionEntity>();
        FunctionService.m_functionCallsByCalleeId = new Map<number, FunctionCallEntity[]>();
        FunctionService.m_functionCallsByCallerId = new Map<number, FunctionCallEntity[]>();
        FunctionService.m_tsMap = new Map<number, Func | Method>();

        const functions = await this.m_repo.find({ relations: { signature: true, methodOf: true } });
        for (const func of functions) {
            FunctionService.m_functionsById.set(func.id, func);
            FunctionService.m_functionsByAddress.set(func.address, func);
        }

        const calls = await this.m_callRepo.find({ relations: { calleeFunction: true, callerFunction: true } });
        for (const call of calls) {
            const calleeMap = FunctionService.m_functionCallsByCalleeId.get(call.calleeFunctionId);
            if (!calleeMap) FunctionService.m_functionCallsByCalleeId.set(call.calleeFunctionId, [call]);
            else calleeMap.push(call);

            const callerMap = FunctionService.m_functionCallsByCallerId.get(call.callerFunctionId);
            if (!callerMap) FunctionService.m_functionCallsByCallerId.set(call.callerFunctionId, [call]);
            else callerMap.push(call);
        }

        Messager.func('getFunctions', () => {
            return FunctionService.functions.map(f => f.toModel());
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

        const calls = await this.m_callRepo.find({ relations: { calleeFunction: true, callerFunction: true } });
        for (const call of calls) {
            const calleeMap = FunctionService.m_functionCallsByCalleeId.get(call.calleeFunctionId);
            if (!calleeMap) FunctionService.m_functionCallsByCalleeId.set(call.calleeFunctionId, [call]);
            else calleeMap.push(call);

            const callerMap = FunctionService.m_functionCallsByCallerId.get(call.callerFunctionId);
            if (!callerMap) FunctionService.m_functionCallsByCallerId.set(call.callerFunctionId, [call]);
            else callerMap.push(call);
        }

        Messager.send(
            'setFunctions',
            FunctionService.functions.map(f => f.toModel())
        );
    }

    public static async update(id: number, changes: Partial<FunctionEntity>) {
        const func = FunctionService.m_functionsById.get(id);
        if (!func) return;

        const previous = func.toModel();
        Object.assign(func, changes);
        await FunctionService.m_repo.save(func);

        Messager.send('functionUpdated', { previous, current: func.toModel() });
    }

    public static async addFunction(func: FunctionEntity) {
        if (!func.id) {
            await FunctionService.m_repo.save(func);
            Messager.send('functionAdded', func.toModel());
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

    public static getCallsToFunction(calleeId: number) {
        return FunctionService.m_functionCallsByCalleeId.get(calleeId) || [];
    }

    public static getCallsFromFunction(callerId: number) {
        return FunctionService.m_functionCallsByCallerId.get(callerId) || [];
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
