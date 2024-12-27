import { Location } from 'decompiler/analysis/ssa';
import { LocationMap } from 'utils';

export class LocationSet {
    private m_map: LocationMap<boolean>;
    private m_cachedValues: Location[];
    private m_cacheInvalid: boolean;

    constructor(values: Location[] = []) {
        this.m_map = new LocationMap();
        this.m_cachedValues = [];
        this.m_cacheInvalid = values.length > 0;

        for (const value of values) {
            this.m_map.set(value, true);
        }
    }

    get values() {
        if (this.m_cacheInvalid) {
            this.m_cachedValues = this.m_map.entries.map(e => e[0]);
            this.m_cacheInvalid = false;
        }

        return this.m_cachedValues;
    }

    get size() {
        return this.m_cachedValues.length;
    }

    add(location: Location) {
        this.m_map.set(location, true);
        this.m_cacheInvalid = true;
    }

    has(location: Location): boolean {
        return this.m_map.get(location) !== null;
    }

    delete(location: Location): boolean {
        const didDelete = this.m_map.delete(location);
        if (didDelete) {
            this.m_cacheInvalid = true;
        }

        return didDelete;
    }

    clear() {
        this.m_map.clear();
        this.m_cachedValues = [];
        this.m_cacheInvalid = false;
    }
}
