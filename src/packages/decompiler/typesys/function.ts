import { EventListener } from 'utils';
import { Value, ValueLocation } from '../value';
import { DataType, FunctionSignatureType, MethodSignatureType } from './datatype';
import { TypeSystem } from './typesys';
import { VTableMethod } from './vtable';

export class Func {
    private m_id: number;
    private m_address: number;
    private m_args: Value[];
    private m_retLocation: ValueLocation | null;
    protected m_signatureId: number;
    private m_name: string;
    private m_valueListeners: EventListener[];

    constructor(id: number, address: number, signature: FunctionSignatureType | MethodSignatureType) {
        this.m_id = id;
        this.m_address = address;
        this.m_signatureId = signature.id;
        this.m_name = `FUN_${address.toString(16).padStart(8, '0')}`;
        this.m_args = [];
        this.m_retLocation = signature.returnLocation;
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
}