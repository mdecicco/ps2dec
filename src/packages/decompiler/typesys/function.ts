import { EventListener } from 'utils';
import { SerializedValue, Value, ValueLocation } from '../value';
import { DataType, FunctionSignatureType, MethodSignatureType } from './datatype';
import { TypeSystem } from './typesys';
import { VTableMethod } from './vtable';

export type FuncRehydrateData = {
    id: number;
    address: number;
    args: SerializedValue[];
    retLocation: ValueLocation | null;
    signatureId: number;
    name: string;
    isConstructor: boolean;
    isDestructor: boolean;
    methodInfo: {
        thisTypeId: number;
        vtableMethod: {
            vtableId: number;
            methodOffset: number;
        } | null;
    } | null;
};

export class Func {
    private m_id: number;
    private m_address: number;
    private m_args: Value[];
    private m_retLocation: ValueLocation | null;
    protected m_signatureId: number;
    private m_name: string;
    private m_isConstructor: boolean;
    private m_isDestructor: boolean;
    private m_valueListeners: EventListener[];

    constructor(id: number, address: number, signature: FunctionSignatureType | MethodSignatureType) {
        this.m_id = id;
        this.m_address = address;
        this.m_signatureId = signature.id;
        this.m_name = `FUN_${address.toString(16).padStart(8, '0')}`;
        this.m_args = [];
        this.m_retLocation = signature.returnLocation;
        this.m_isConstructor = false;
        this.m_isDestructor = false;
        this.m_valueListeners = [];

        this.rebuildArgInfo();
    }

    get id(): number {
        return this.m_id;
    }

    get address(): number {
        return this.m_address;
    }

    get name(): string {
        return this.m_name;
    }

    set name(name: string) {
        this.m_name = name;
    }

    get isConstructor() {
        return this.m_isConstructor;
    }

    set isConstructor(isConstructor: boolean) {
        this.m_isConstructor = isConstructor;
    }

    get isDestructor() {
        return this.m_isDestructor;
    }

    set isDestructor(isDestructor: boolean) {
        this.m_isDestructor = isDestructor;
    }

    get arguments() {
        return this.m_args;
    }

    get returnLocation() {
        return this.m_retLocation || this.signature.returnLocation;
    }

    get signature(): FunctionSignatureType | MethodSignatureType {
        return TypeSystem.get().getType(this.m_signatureId) as FunctionSignatureType | MethodSignatureType;
    }

    set signature(sig: FunctionSignatureType | MethodSignatureType) {
        this.m_signatureId = sig.id;
        this.rebuildArgInfo();
    }

    setArgName(index: number, name: string) {
        if (index >= this.m_args.length) {
            throw new Error('Argument index out of range');
        }

        this.m_args[index].name = name;
    }

    setArgType(index: number, type: DataType) {
        if (index >= this.m_args.length) {
            throw new Error('Argument index out of range');
        }

        const currentSig = this.signature;

        const newArgTypes = Array.from(currentSig.argumentTypes);
        newArgTypes[index] = type;

        const sigName = FunctionSignatureType.generateName(currentSig.returnType, newArgTypes);
        this.m_signatureId = TypeSystem.get().getType(sigName).id;
        this.rebuildArgInfo();
    }

    addArg(type: DataType, name?: string) {
        const currentSig = this.signature;

        const newArgTypes = Array.from(currentSig.argumentTypes);
        newArgTypes.push(type);

        const sigName = FunctionSignatureType.generateName(currentSig.returnType, newArgTypes);
        this.m_signatureId = TypeSystem.get().getType(sigName).id;
        this.rebuildArgInfo();
    }

    removeArg(index: number) {
        if (index >= this.m_args.length) {
            throw new Error('Argument index out of range');
        }

        const currentSig = this.signature;

        const newArgTypes = Array.from(currentSig.argumentTypes);
        newArgTypes.splice(index, 1);

        this.m_args.forEach((a, idx) => {
            if (idx <= index) return;

            if (a.name === `param_${idx + 1}`) a.name = `param_${idx}`;
        });

        this.m_valueListeners.splice(index, 1)[0].remove();
        this.m_args.splice(index, 1);

        const sigName = FunctionSignatureType.generateName(currentSig.returnType, newArgTypes);
        this.m_signatureId = TypeSystem.get().getType(sigName).id;
        this.rebuildArgInfo();
    }

    protected rebuildArgInfo() {
        this.m_valueListeners.forEach(l => l.remove());
        this.m_valueListeners = [];

        const newArgInfo: Value[] = [];

        this.signature.arguments.forEach((arg, idx) => {
            const value = new Value(arg.typeId, idx < this.m_args.length ? this.m_args[idx].name : `param_${idx + 1}`);
            const typeListener = value.addListener('type-changed', this.setArgType.bind(this, idx));
            this.m_valueListeners.push(typeListener);
            newArgInfo.push(value);
        });

        this.m_args = newArgInfo;
    }

    static rehydrate(data: FuncRehydrateData): Func | Method {
        if (data.methodInfo) {
            return Method.rehydrate(data);
        }

        const fn = Object.create(Func.prototype) as Func;
        fn.setFromRehydrateData(data);
        return fn;
    }

    protected setFromRehydrateData(data: FuncRehydrateData) {
        this.m_id = data.id;
        this.m_address = data.address;
        this.m_retLocation = data.retLocation;
        this.m_signatureId = data.signatureId;
        this.m_name = data.name;
        this.m_isConstructor = data.isConstructor;
        this.m_isDestructor = data.isDestructor;
        this.m_valueListeners = [];
        this.m_args = data.args.map((arg, idx) => {
            const value = Value.deserialize(arg);
            const typeListener = value.addListener('type-changed', this.setArgType.bind(this, idx));
            this.m_valueListeners.push(typeListener);
            return value;
        });
    }
}

export class Method extends Func {
    private m_vtbEntry: VTableMethod | null;
    private m_thisValue: Value;

    constructor(id: number, address: number, signature: MethodSignatureType, vtableEntry?: VTableMethod) {
        super(id, address, signature);

        this.m_vtbEntry = vtableEntry || null;
        this.m_thisValue = new Value(signature.thisType.id, 'this');
    }

    get vtableEntry() {
        return this.m_vtbEntry;
    }

    override get signature(): MethodSignatureType {
        return TypeSystem.get().getType(this.m_signatureId) as MethodSignatureType;
    }

    override set signature(sig: MethodSignatureType) {
        this.m_signatureId = sig.id;
        this.rebuildArgInfo();
    }

    get thisValue() {
        return this.m_thisValue;
    }

    static rehydrate(data: FuncRehydrateData): Func | Method {
        if (!data.methodInfo) {
            return Func.rehydrate(data);
        }

        const fn = Object.create(Method.prototype) as Method;
        fn.setFromRehydrateData(data);
        fn.m_thisValue = new Value(data.methodInfo.thisTypeId, 'this');

        if (data.methodInfo.vtableMethod) {
            const vtb = TypeSystem.get().getVtableById(data.methodInfo.vtableMethod.vtableId);
            if (!vtb) {
                throw new Error(`Method.rehydrate: Specified vtable not found`);
            }

            const offset = data.methodInfo.vtableMethod.methodOffset;
            const meth = vtb.methods.find(m => m.offset === offset);
            if (!meth) {
                throw new Error(`Method.rehydrate: Specified method offset not found on vtable`);
            }

            fn.m_vtbEntry = meth;
        }

        return fn;
    }
}
