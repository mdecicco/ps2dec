import { Reg } from 'decoder';

export type Location = number | Reg.Register;
export type VersionedLocation = { value: Location; version: number };
