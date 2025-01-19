import { Reg } from 'decoder';
import { Location, VersionedLocation } from 'types';
import { DataType, PointerType, TypeSystem } from 'typesys';
import { EventListener, EventProducer, LocationMap, LocationSet } from 'utils';

import { FunctionCode } from '../input';
import { LocationDef } from '../types';

type ValueEvents = {
    'name-changed': (newName: string | null, oldName: string | null) => void;
    'type-changed': (newType: DataType, oldType: DataType) => void;
    'ssa-location-added': (location: Location, version: number) => void;
};

export type SerializedValue = {
    typeId: number;
    name: string | null;
    nameAssigned: boolean;
    ssaLocations: Location[];
    ssaVersions: [Location, number[]][];
};

type VarVersionMap = Map<number, Value>;

export class Value extends EventProducer<ValueEvents> {
    private m_typeId: number;
    private m_name: string;
    private m_ssaLocations: LocationSet;
    private m_ssaVersions: LocationMap<number[]>;
    private m_func: FunctionCode;
    private m_db: VariableDB;
    private m_nameAssigned: boolean;
    private m_typeListener: EventListener | null;
    public hasDeclaration: boolean;

    constructor(type: DataType | number | string, name: string | null | undefined, func: FunctionCode, db: VariableDB) {
        const tp = type instanceof DataType ? type : TypeSystem.get().getType(type);

        super();
        this.m_typeId = tp.id;
        this.m_ssaLocations = new LocationSet();
        this.m_ssaVersions = new LocationMap<number[]>();
        this.m_nameAssigned = !!name;
        this.m_func = func;
        this.m_db = db;
        this.hasDeclaration = false;

        if (!name) {
            this.m_name = this.m_db.getDefaultVarName(this);
            this.m_typeListener = this.addListener('type-changed', () => {
                this.m_name = this.m_db.getDefaultVarName(this);
            });
        } else {
            this.m_name = name;
            this.m_typeListener = null;
        }
    }

    get nameIsAssigned(): boolean {
        return this.m_nameAssigned;
    }

    get name(): string {
        return this.m_name;
    }

    set name(name: string) {
        const oldName = this.m_name;
        this.m_name = name;

        this.m_nameAssigned = true;

        if (this.m_typeListener) {
            this.m_typeListener.remove();
            this.m_typeListener = null;
        }

        this.dispatch('name-changed', name, oldName);
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

    get ssaLocations(): LocationSet {
        return this.m_ssaLocations;
    }

    get versions(): LocationMap<number[]> {
        return this.m_ssaVersions;
    }

    getSSAVersions(location: Location): number[] {
        return this.m_ssaVersions.get(location) || [];
    }

    addSSALocation(location: Location, version: number): void {
        this.m_ssaLocations.add(location);

        const versions = this.m_ssaVersions.get(location) || [];
        if (!versions.includes(version)) {
            versions.push(version);
            this.m_ssaVersions.set(location, versions);

            this.dispatch('ssa-location-added', location, version);
        }
    }

    hasSSAVersion(location: Location, version: number): boolean {
        const versions = this.m_ssaVersions.get(location);
        return versions ? versions.includes(version) : false;
    }

    toString(): string {
        const locs: string[] = [];

        const versionStr = (loc: Location, version: number) => {
            const def = this.m_func.getDefOf({ value: loc, version });
            if (!def) return version.toString();

            if (!def.instruction) return `[v${version}:initial]`;

            return `[v${version}: ${def.instruction} @ 0x${def.instruction.address.toString(16).padStart(8, '0')}]`;
        };

        this.versions.entries.forEach(([loc, versions]) => {
            if (typeof loc === 'number') {
                locs.push(`stack[0x${loc.toString(16)}](${versions.map(v => versionStr(loc, v)).join(', ')})`);
            } else {
                locs.push(`${Reg.formatRegister(loc)}(${versions.map(v => versionStr(loc, v)).join(', ')})`);
            }
        });

        return `${this.name}: [${locs.join(', ')}]`;
    }

    serialize(): SerializedValue {
        return {
            typeId: this.m_typeId,
            name: this.name,
            nameAssigned: this.m_nameAssigned,
            ssaLocations: this.m_ssaLocations.values,
            ssaVersions: this.m_ssaVersions.entries
        };
    }

    static defaultName(type: DataType) {
        const idx = 0; // todo
        return `${type.name[0].toLowerCase()}Var${idx}`;
    }

    static deserialize(data: SerializedValue, func: FunctionCode, db: VariableDB): Value {
        const value = new Value(data.typeId, data.nameAssigned ? data.name : null, func, db);
        value.m_ssaLocations = new LocationSet(data.ssaLocations);
        value.m_ssaVersions = new LocationMap();
        for (const [location, versions] of data.ssaVersions) {
            value.m_ssaVersions.set(location, versions);
        }
        return value;
    }

    private validateType(type: DataType) {
        // todo
    }
}

export class VariableDB {
    private m_func: FunctionCode;
    private m_variables: Value[];
    private m_valueListeners: EventListener[];
    private m_varMap: LocationMap<VarVersionMap>;

    constructor(func: FunctionCode) {
        this.m_func = func;
        this.m_variables = [];
        this.m_valueListeners = [];
        this.m_varMap = new LocationMap();
    }

    get all(): Value[] {
        return this.m_variables;
    }

    private mapVariable(location: Location, version: number, value: Value) {
        const map = this.m_varMap.get(location);
        if (!map) {
            this.m_varMap.set(location, new Map([[version, value]]));
            return;
        }

        map.set(version, value);
    }

    reset() {
        this.m_valueListeners.forEach(listener => listener.remove());
        this.m_variables = [];
        this.m_valueListeners = [];
        this.m_varMap.clear();
    }

    addVariable(location: VersionedLocation, value: Value): void;
    addVariable(location: Location, atAddress: number, value: Value): void;
    addVariable(location: Location | VersionedLocation, addressOrValue: number | Value, maybeValue?: Value): void {
        let def: LocationDef | null = null;
        let loc: Location;
        let value: Value;

        if (typeof location !== 'number' && 'version' in location && addressOrValue instanceof Value) {
            def = this.m_func.getDefOf(location);
            loc = def.value;
            value = addressOrValue;
        } else if (
            (typeof location === 'number' || 'type' in location) &&
            !(addressOrValue instanceof Value) &&
            maybeValue
        ) {
            def = this.m_func.getDefAt(location, addressOrValue);
            loc = location;
            value = maybeValue;

            if (!def) {
                throw new Error(
                    `Cannot find definition for ${
                        typeof location === 'number'
                            ? `stack[0x${location.toString(16)}]`
                            : Reg.formatRegister(location)
                    } at 0x${addressOrValue.toString(16).padStart(8, '0')}`
                );
            }
        } else {
            throw new Error('VariableDB.addVariable: Invalid arguments');
        }

        value.addSSALocation(def.value, def.version);
        this.mapVariable(loc, def.version, value);

        if (!this.m_variables.includes(value)) {
            this.m_variables.push(value);
            const locListener = value.addListener('ssa-location-added', (newLoc, version) => {
                this.mapVariable(newLoc, version, value);

                if (!this.m_func.isRebuilding) {
                    // rebuild expression trees that use this location
                    this.m_func.getUsesOf({ value: newLoc, version }).forEach(use => {
                        use.instruction.generate();
                    });
                }
            });

            const typeListener = value.addListener('type-changed', () => {
                if (this.m_func.isRebuilding) return;

                value.versions.entries.forEach(([loc, versions]) => {
                    versions.forEach(version => {
                        this.m_func.getUsesOf({ value: loc, version }).forEach(use => {
                            use.instruction.generate();
                        });
                    });
                });
            });

            this.m_valueListeners.push(locListener);
            this.m_valueListeners.push(typeListener);
        }

        this.m_func.getUsesOf(def).forEach(use => {
            if (this.m_func.isRebuilding) return;

            use.instruction.generate();
        });
    }

    promote(location: VersionedLocation, name?: string): Value;
    promote(location: Location, atAddress: number, name?: string): Value;
    promote(
        location: Location | VersionedLocation,
        atAddressOrName: number | string | undefined,
        maybeName?: string
    ): Value {
        let loc: Location;
        let version: number;
        let name: string | undefined = undefined;

        if (
            typeof location !== 'number' &&
            'version' in location &&
            (!atAddressOrName || typeof atAddressOrName === 'string')
        ) {
            loc = location.value;
            version = location.version;
            name = atAddressOrName as string | undefined;
        } else if ((typeof location === 'number' || 'type' in location) && typeof atAddressOrName === 'number') {
            loc = location;
            name = maybeName;

            const def = this.m_func.getDefAt(location, atAddressOrName);
            if (!def) {
                throw new Error('Cannot find definition to promote to variable');
            }

            version = def.version;
        } else {
            throw new Error('VariableDB.promote: Invalid arguments');
        }

        // see if it already exists
        const existing = this.getVariable({ value: loc, version });
        if (existing) return existing;

        const value = this.m_func.getValueOf({ value: loc, version });
        const variable = new Value(value.type, name, this.m_func, this);
        variable.addSSALocation(loc, version);
        this.addVariable({ value: loc, version }, variable);

        return variable;
    }

    getVariable(location: VersionedLocation): Value | null;
    getVariable(location: Location, atAddress: number): Value | null;
    getVariable(location: Location | VersionedLocation, address?: number): Value | null {
        let loc: Location;
        let version: number;

        if ((typeof location === 'number' || 'type' in location) && address) {
            const def = this.m_func.getDefAt(location, address);
            if (!def) return null;

            loc = def.value;
            version = def.version;
        } else if (typeof location !== 'number' && 'version' in location) {
            loc = location.value;
            version = location.version;
        } else {
            throw new Error('VariableDB.getVariable: Invalid arguments');
        }

        const map = this.m_varMap.get(loc);
        if (!map) return null;

        return map.get(version) || null;
    }

    getDefaultVarName(variable: Value): string {
        const prefix = this.getVarNamePrefix(variable.type);
        let count = 0;
        let name = `${prefix}Var0`;

        this.m_variables.forEach(v => {
            if (v === variable) return;

            if (v.name === name) {
                count++;
                name = `${prefix}Var${count}`;
            }
        });

        return name;
    }

    createVariable(type: DataType | number | string, name?: string | null): Value {
        const value = new Value(type, name, this.m_func, this);
        this.m_variables.push(value);
        const locListener = value.addListener('ssa-location-added', (newLoc, version) => {
            this.mapVariable(newLoc, version, value);

            if (!this.m_func.isInitialized) return;

            // rebuild expression trees that use this location
            this.m_func.getUsesOf({ value: newLoc, version }).forEach(use => {
                use.instruction.generate();
            });
        });

        const typeListener = value.addListener('type-changed', () => {
            if (!this.m_func.isInitialized) return;
            value.versions.entries.forEach(([loc, versions]) => {
                versions.forEach(version => {
                    this.m_func.getUsesOf({ value: loc, version }).forEach(use => {
                        use.instruction.generate();
                    });
                });
            });
        });

        this.m_valueListeners.push(locListener);
        this.m_valueListeners.push(typeListener);

        return value;
    }

    print() {
        console.log('------ Variables:');

        this.m_variables.forEach(v => {
            console.log(v.toString());
        });
    }

    private getVarNamePrefix(type: DataType): string {
        let prefix = '';

        while (type instanceof PointerType) {
            prefix += 'p';
            type = type.pointsTo;
        }

        return prefix + type.name[0].toLowerCase();
    }
}
