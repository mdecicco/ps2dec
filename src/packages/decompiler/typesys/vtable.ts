import { TypeSystem } from './typesys';

export class VTableMethod {
    private m_vtableId: number;
    private m_offset: number;
    private m_dataOffset: number;
    private m_name: string;

    constructor(vtableId: number, offset: number, dataOffset: number, name?: string) {
        this.m_vtableId = vtableId;
        this.m_offset = offset;
        this.m_dataOffset = dataOffset;
        this.m_name = name || `VMETHOD_${offset.toString(16)}`;
    }

    get vtable() {
        return TypeSystem.get().getVtableById(this.m_vtableId);
    }

    get offset() {
        return this.m_offset;
    }

    get dataOffset() {
        return this.m_dataOffset;
    }

    get name() {
        return this.m_name;
    }
}

export class VTable {
    private m_id: number;
    private m_extendsVtableId: number | null;
    private m_methods: VTableMethod[];

    constructor(id: number, extendsVtable?: VTable | null) {
        this.m_id = id;
        this.m_extendsVtableId = extendsVtable?.m_id || null;
        this.m_methods = [];
    }

    get id() {
        return this.m_id;
    }

    get extendsVtable(): VTable | null {
        if (!this.m_extendsVtableId) return null;

        return TypeSystem.get().getVtableById(this.m_extendsVtableId);
    }

    get methods(): VTableMethod[] {
        const parent = this.extendsVtable;
        if (parent) {
            return parent.methods.concat(this.m_methods);
        }

        return this.m_methods;
    }

    get ownMethods() {
        return this.m_methods;
    }

    addMethod(method: VTableMethod) {
        this.m_methods.push(method);
    }
}
