import { CodeBuilder, DataType, Decompiler, DecompilerInstance, TypeSystem, VersionedLocation } from 'decompiler';

export abstract class Expression {
    private m_decomp: DecompilerInstance;
    private m_address: number;
    private m_allowPropagation: boolean;
    private m_resultType: DataType;
    private m_cachedString: string | null;
    private m_location: VersionedLocation | null;
    isParenthesized: boolean;

    constructor() {
        this.m_decomp = Decompiler.current;
        this.m_address = this.m_decomp.currentAddress;
        this.m_allowPropagation = true;
        this.m_resultType = TypeSystem.get().getType('undefined');
        this.m_cachedString = null;
        this.isParenthesized = false;
        this.m_location = null;
    }

    get decompiler() {
        return this.m_decomp;
    }

    get address(): number {
        return this.m_address;
    }

    set address(address: number) {
        this.m_address = address;
    }

    get location() {
        return this.m_location;
    }

    set location(location: VersionedLocation | null) {
        this.m_location = location;
    }

    get canPropagate() {
        return this.m_allowPropagation;
    }

    get type(): DataType {
        return this.m_resultType;
    }

    set type(type: DataType | string | number) {
        if (type instanceof DataType) {
            this.m_resultType = type;
            return;
        }

        this.m_resultType = TypeSystem.get().getType(type);
    }

    parenthesize(): Expression {
        this.isParenthesized = true;
        return this;
    }

    generate(code: CodeBuilder): void {
        code.pushAddress(this.address);
        this.generate_impl(code);
        code.popAddress();
    }

    toString(): string {
        // if (this.m_cachedString) return this.m_cachedString;

        let result = this.reduce().toString_impl();
        if (this.isParenthesized) result = `(${result})`;
        this.m_cachedString = result;

        return this.m_cachedString;
    }

    reduce(): Expression {
        return this;
    }

    copyFrom(other: Expression) {
        this.m_decomp = other.m_decomp;
        this.m_address = other.m_address;
        this.m_allowPropagation = other.m_allowPropagation;
        this.isParenthesized = other.isParenthesized;
        this.m_resultType = other.m_resultType;
        this.m_location = other.m_location;
        return this;
    }

    get allChildren(): Expression[] {
        const allChildren: Expression[] = [];
        const ownChildren = this.children;

        for (const child of ownChildren) {
            allChildren.push(child, ...child.allChildren);
        }

        return allChildren;
    }

    get children(): Expression[] {
        return [];
    }

    abstract clone(): Expression;
    abstract generate_impl(code: CodeBuilder): void;
    protected abstract toString_impl(): string;
}
