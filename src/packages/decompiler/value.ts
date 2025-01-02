import { Reg } from 'decoder';
import { EventProducer, LocationMap, LocationSet } from 'utils';
import { Location } from './analysis/ssa';
import { DataType, TypeSystem } from './typesys';

type ValueLocationReg = {
    reg: Reg.Register;
};

type ValueLocationMem = {
    offset: number;
    base: Reg.Register;
};

export type ValueLocation = ValueLocationReg | ValueLocationMem;

type ValueEvents = {
    'name-changed': (newName: string | null, oldName: string | null) => void;
    'type-changed': (newType: DataType, oldType: DataType) => void;
    'ssa-location-added': (location: Location, version: number) => void;
};

export type SerializedValue = {
    typeId: number;
    name: string | null;
    ssaLocations: Location[];
    ssaVersions: [Location, number[]][];
};

export class Value extends EventProducer<ValueEvents> {
    private m_typeId: number;
    private m_name: string | null;
    private m_ssaLocations: LocationSet;
    private m_ssaVersions: LocationMap<number[]>;

    constructor(type: DataType | number, name?: string | null) {
        super();
        this.m_typeId = typeof type === 'number' ? type : type.id;
        this.m_name = name || null;
        this.m_ssaLocations = new LocationSet();
        this.m_ssaVersions = new LocationMap<number[]>();
    }

    set name(name: string | null) {
        const oldName = this.m_name;
        this.m_name = name;

        this.dispatch('name-changed', name, oldName);
    }

    get name(): string | null {
        return this.m_name;
    }

    get type(): DataType {
        return TypeSystem.get().getType(this.m_typeId);
    }

    set type(type: DataType | number | string) {
        const newType = typeof type === 'number' || typeof type === 'string' ? TypeSystem.get().getType(type) : type;
        this.validateType(newType);
        const oldType = this.type;
        this.m_typeId = newType.id;
        this.dispatch('type-changed', newType, oldType);
    }

    /**
     * Get all SSA locations (registers/stack offsets) this value can be found in
     */
    get ssaLocations(): LocationSet {
        return this.m_ssaLocations;
    }

    /**
     * Get all SSA locations/versions for this value
     */
    get versions(): LocationMap<number[]> {
        return this.m_ssaVersions;
    }

    /**
     * Get all SSA versions for a specific location
     */
    getSSAVersions(location: Location): number[] {
        return this.m_ssaVersions.get(location) || [];
    }

    /**
     * Add a new SSA location where this value can be found
     */
    addSSALocation(location: Location, version: number): void {
        this.m_ssaLocations.add(location);

        const versions = this.m_ssaVersions.get(location) || [];
        if (!versions.includes(version)) {
            versions.push(version);
            this.m_ssaVersions.set(location, versions);

            this.dispatch('ssa-location-added', location, version);
        }
    }

    /**
     * Check if this value can be found in a specific SSA location with a specific version
     */
    hasSSAVersion(location: Location, version: number): boolean {
        const versions = this.m_ssaVersions.get(location);
        return versions ? versions.includes(version) : false;
    }

    static defaultName(type: DataType) {
        const idx = 0; // todo
        return `${type.name[0].toLowerCase()}Var${idx}`;
    }

    private validateType(type: DataType) {
        // todo
    }

    serialize(): SerializedValue {
        return {
            typeId: this.m_typeId,
            name: this.m_name,
            ssaLocations: this.m_ssaLocations.values,
            ssaVersions: this.m_ssaVersions.entries
        };
    }

    static deserialize(data: SerializedValue): Value {
        const value = new Value(data.typeId, data.name);
        value.m_ssaLocations = new LocationSet(data.ssaLocations);
        value.m_ssaVersions = new LocationMap();
        for (const [location, versions] of data.ssaVersions) {
            value.m_ssaVersions.set(location, versions);
        }
        return value;
    }
}
