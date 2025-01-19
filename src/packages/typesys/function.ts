import { EventListener } from 'utils';
import { FunctionSignatureType, MethodSignatureType } from './datatype';
import { TypeSystem } from './typesys';
import { VTableMethod } from './vtable';

export type FuncRehydrateData = {
    id: number;
    address: number;
    endAddress: number;
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
    private m_endAddress: number;
    protected m_signatureId: number;
    private m_name: string;
    private m_isConstructor: boolean;
    private m_isDestructor: boolean;
    private m_valueListeners: EventListener[];

    constructor(
        id: number,
        address: number,
        endAddress: number,
        signature: FunctionSignatureType | MethodSignatureType
    ) {
        this.m_id = id;
        this.m_address = address;
        this.m_endAddress = endAddress;
        this.m_signatureId = signature.id;
        this.m_name = `FUN_${address.toString(16).padStart(8, '0')}`;
        this.m_isConstructor = false;
        this.m_isDestructor = false;
        this.m_valueListeners = [];
    }

    get id(): number {
        return this.m_id;
    }

    get address(): number {
        return this.m_address;
    }

    get endAddress(): number {
        return this.m_endAddress;
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
        const sig = this.signature;
        const argTypes = sig.argumentTypes;
        return sig.arguments.map((a, idx) => ({
            location: a.location,
            type: argTypes[idx]
        }));
    }

    get returnLocation() {
        return this.signature.returnLocation;
    }

    get signature(): FunctionSignatureType | MethodSignatureType {
        return TypeSystem.get().getType(this.m_signatureId) as FunctionSignatureType | MethodSignatureType;
    }

    set signature(sig: FunctionSignatureType | MethodSignatureType) {
        this.m_signatureId = sig.id;
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
        this.m_endAddress = data.endAddress;
        this.m_signatureId = data.signatureId;
        this.m_name = data.name;
        this.m_isConstructor = data.isConstructor;
        this.m_isDestructor = data.isDestructor;
        this.m_valueListeners = [];
    }
}

export class Method extends Func {
    private m_vtbEntry: VTableMethod | null;

    constructor(
        id: number,
        address: number,
        endAddress: number,
        signature: MethodSignatureType,
        vtableEntry?: VTableMethod
    ) {
        super(id, address, endAddress, signature);

        this.m_vtbEntry = vtableEntry || null;
    }

    get vtableEntry() {
        return this.m_vtbEntry;
    }

    override get signature(): MethodSignatureType {
        return TypeSystem.get().getType(this.m_signatureId) as MethodSignatureType;
    }

    override set signature(sig: MethodSignatureType) {
        this.m_signatureId = sig.id;
    }

    get thisValue() {
        const signature = this.signature;
        return {
            location: signature.thisLocation,
            type: signature.thisType
        };
    }

    static rehydrate(data: FuncRehydrateData): Func | Method {
        if (!data.methodInfo) {
            return Func.rehydrate(data);
        }

        const fn = Object.create(Method.prototype) as Method;
        fn.setFromRehydrateData(data);

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
