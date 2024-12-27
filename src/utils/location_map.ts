import { Location } from 'decompiler/analysis/ssa';
import { Reg } from 'types';

type RegisterMap<T> = {
    [Reg.Type.EE]: { [k: number]: T };
    [Reg.Type.COP0]: { [k: number]: T };
    [Reg.Type.COP1]: { [k: number]: T };
    [Reg.Type.COP2_VI]: { [k: number]: T };
    [Reg.Type.COP2_Special]: { [k: number]: T };
    [Reg.Type.COP2_VF]: {
        // Vector register
        [k: number]: {
            // Vector component
            [k: number]: T;
        };
    };
};

export class LocationMap<T> {
    private m_allValues: T[];
    private m_allEntries: [loc: Location, value: T][];
    private m_stackMap: Map<number, T>;
    private m_registerMap: RegisterMap<T>;
    private m_equalityCheck: (a: T, b: T) => boolean;

    constructor(equalityCheck?: (a: T, b: T) => boolean) {
        this.m_allValues = [];
        this.m_allEntries = [];
        this.m_stackMap = new Map();
        this.m_registerMap = {
            [Reg.Type.EE]: {},
            [Reg.Type.COP0]: {},
            [Reg.Type.COP1]: {},
            [Reg.Type.COP2_VI]: {},
            [Reg.Type.COP2_Special]: {},
            [Reg.Type.COP2_VF]: {}
        };
        this.m_equalityCheck = equalityCheck || ((a, b) => a === b);
    }

    get values() {
        return this.m_allValues;
    }

    get entries() {
        return this.m_allEntries;
    }

    get size() {
        return this.m_allValues.length;
    }

    set(location: Location, value: T): boolean {
        let prevValue: T | null = null;
        if (typeof location === 'number') {
            const existing = this.m_stackMap.get(location);
            if (existing !== undefined && this.m_equalityCheck(existing, value)) {
                return true;
            }

            this.m_stackMap.set(location, value);
            prevValue = existing || null;
        } else {
            if (location.type === Reg.Type.COP2_VF) {
                if (!(location.id in this.m_registerMap[location.type])) {
                    this.m_registerMap[location.type][location.id] = {};
                }

                const existing = this.m_registerMap[location.type][location.id][location.comp];
                if (existing !== undefined && this.m_equalityCheck(existing, value)) {
                    return true;
                }

                this.m_registerMap[location.type][location.id][location.comp] = value;
                prevValue = existing || null;
            } else {
                const existing = this.m_registerMap[location.type][location.id];
                if (existing !== undefined && this.m_equalityCheck(existing, value)) {
                    return true;
                }

                this.m_registerMap[location.type][location.id] = value;
                prevValue = existing || null;
            }
        }

        if (prevValue) {
            for (let i = 0; i < this.m_allValues.length; i++) {
                if (this.m_equalityCheck(this.m_allValues[i], prevValue)) {
                    this.m_allValues[i] = value;
                    this.m_allEntries[i][1] = value;
                    break;
                }
            }
        } else {
            this.m_allValues.push(value);
            this.m_allEntries.push([location, value]);
        }

        return !!prevValue;
    }

    get(location: Location): T | null {
        if (typeof location === 'number') {
            return this.m_stackMap.get(location) || null;
        }

        if (location.type === Reg.Type.COP2_VF) {
            if (!(location.id in this.m_registerMap[location.type])) {
                return null;
            }

            if (!(location.comp in this.m_registerMap[location.type][location.id])) {
                return null;
            }

            return this.m_registerMap[location.type][location.id][location.comp];
        }

        if (!(location.id in this.m_registerMap[location.type])) {
            return null;
        }

        return this.m_registerMap[location.type][location.id];
    }

    delete(location: Location): boolean {
        if (typeof location === 'number') {
            const value = this.m_stackMap.get(location);
            if (!value) return false;

            this.m_stackMap.delete(location);

            this.m_allValues = this.m_allValues.filter(v => !this.m_equalityCheck(v, value));
            this.m_allEntries = this.m_allEntries.filter(e => e[0] !== location);
            return true;
        }

        if (location.type === Reg.Type.COP2_VF) {
            if (!(location.id in this.m_registerMap[location.type])) {
                return false;
            }

            if (!(location.comp in this.m_registerMap[location.type][location.id])) {
                return false;
            }

            const value = this.m_registerMap[location.type][location.id][location.comp];
            delete this.m_registerMap[location.type][location.id][location.comp];

            this.m_allValues = this.m_allValues.filter(v => !this.m_equalityCheck(v, value));
            this.m_allEntries = this.m_allEntries.filter(e => e[0] !== location);
            return true;
        }

        if (!(location.id in this.m_registerMap[location.type])) {
            return false;
        }

        const value = this.m_registerMap[location.type][location.id];
        delete this.m_registerMap[location.type][location.id];

        this.m_allValues = this.m_allValues.filter(v => !this.m_equalityCheck(v, value));
        this.m_allEntries = this.m_allEntries.filter(e => e[0] !== location);
        return true;
    }

    clear() {
        this.m_allValues = [];
        this.m_allEntries = [];
        this.m_stackMap.clear();
        this.m_registerMap = {
            [Reg.Type.EE]: {},
            [Reg.Type.COP0]: {},
            [Reg.Type.COP1]: {},
            [Reg.Type.COP2_VI]: {},
            [Reg.Type.COP2_Special]: {},
            [Reg.Type.COP2_VF]: {}
        };
    }
}
