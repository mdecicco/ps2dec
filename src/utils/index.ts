import { Location, VersionedLocation } from 'decompiler/analysis/ssa';
import { Reg } from 'types';

export * from './event';
export * from './location_map';
export * from './location_set';

export function compareLocations(a: Location, b: Location): boolean {
    if (typeof a === 'number') {
        if (typeof b === 'number') return a === b;
        return false;
    }

    if (typeof b === 'number') return false;
    return Reg.compare(a, b);
}

export function formatLocation(location: Location): string {
    if (typeof location === 'number') return `stack_${location.toString(16)}`;
    return Reg.formatRegister(location).slice(1);
}

export function compareVersionedLocations(a: VersionedLocation, b: VersionedLocation): boolean {
    return compareLocations(a.value, b.value) && a.version === b.version;
}

export function formatVersionedLocation(location: VersionedLocation): string {
    return `${formatLocation(location.value)}_${location.version}`;
}
