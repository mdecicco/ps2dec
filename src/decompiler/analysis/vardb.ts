import { Location, VersionedLocation } from 'decompiler/analysis/ssa';

import { LocationMap } from 'utils';

import { SSAForm } from 'decompiler/analysis/ssa';
import { Decompiler } from 'decompiler/decompiler';
import { DataType, PointerType } from 'decompiler/typesys';
import { Value } from 'decompiler/value';
import * as i from 'instructions';
import { Reg } from 'types';
import { EventListener } from 'utils';

type VarVersionMap = Map<number, DecompVariable>;

export class DecompVariable extends Value {
    private m_ssaForm: SSAForm;
    public hasDeclaration: boolean;

    constructor(type: DataType | number, name: string | null, ssaForm: SSAForm) {
        super(type, name);
        this.m_ssaForm = ssaForm;
        this.hasDeclaration = false;
    }

    toString(): string {
        const locs: string[] = [];

        const versionStr = (loc: Location, version: number) => {
            const def = this.m_ssaForm.getVersionInfo(loc, version);
            if (!def) return version.toString();

            return `[${def.instruction} @ 0x${def.instruction.address.toString(16).padStart(8, '0')}]`;
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
}

export class VariableDB {
    private m_ssaForm: SSAForm;
    private m_variables: DecompVariable[];
    private m_valueListeners: EventListener[];
    private m_varMap: LocationMap<VarVersionMap>;
    private m_varNameCounterMap: Map<string, number>; // prefix -> counter

    constructor(ssaForm: SSAForm) {
        this.m_ssaForm = ssaForm;
        this.m_variables = [];
        this.m_valueListeners = [];
        this.m_varMap = new LocationMap();
        this.m_varNameCounterMap = new Map();
    }

    get all(): Value[] {
        return this.m_variables;
    }

    private mapVariable(location: Location, version: number, value: DecompVariable) {
        const map = this.m_varMap.get(location);
        if (!map) {
            this.m_varMap.set(location, new Map([[version, value]]));
            return;
        }

        map.set(version, value);
    }

    private getInstruction(instrOrAddress: number | i.Instruction): i.Instruction {
        if (typeof instrOrAddress === 'number') {
            return Decompiler.get().getInstruction(instrOrAddress);
        }

        return instrOrAddress;
    }

    reset() {
        this.m_valueListeners.forEach(listener => listener.remove());
        this.m_variables = [];
        this.m_valueListeners = [];
        this.m_varMap.clear();
        this.m_varNameCounterMap.clear();
    }

    addVariable(location: Location, atAddress: number, value: DecompVariable): void;
    addVariable(location: Location, atInstruction: i.Instruction, value: DecompVariable): void;
    addVariable(location: Location, instrOrAddress: number | i.Instruction, value: DecompVariable): void {
        const instr = this.getInstruction(instrOrAddress);
        const def = this.m_ssaForm.getMostRecentDefInfo(instr, location, false);
        if (!def) {
            throw new Error(
                `Cannot find definition for ${
                    typeof location === 'number' ? `stack[0x${location.toString(16)}]` : Reg.formatRegister(location)
                } at ${instr.address}`
            );
        }

        value.addSSALocation(def.location, def.version);
        this.mapVariable(location, def.version, value);

        this.m_ssaForm.getInstructionsUsingLocation(location, def.version).forEach(instr => {
            instr.toExpression();
        });

        if (!this.m_variables.includes(value)) {
            this.m_variables.push(value);
            const locListener = value.addListener('ssa-location-added', (newLoc, version) => {
                this.mapVariable(newLoc, version, value);

                // rebuild expression trees that use this location
                this.m_ssaForm.getInstructionsUsingLocation(newLoc, version).forEach(instr => {
                    instr.toExpression();
                });
            });

            const typeListener = value.addListener('type-changed', newType => {
                this.m_ssaForm.getInstructionsUsingLocation(location, def.version).forEach(instr => {
                    instr.toExpression();
                });
            });

            this.m_valueListeners.push(locListener);
            this.m_valueListeners.push(typeListener);
        }
    }

    promote(location: Location, atAddress: number, name?: string): DecompVariable;
    promote(location: Location, atInstruction: i.Instruction, name?: string): DecompVariable;
    promote(location: Location, instrOrAddress: number | i.Instruction, name?: string): DecompVariable {
        const instr = this.getInstruction(instrOrAddress);

        // see if it already exists
        const existing = this.getVariable(location, instr);
        if (existing) return existing;

        const def = this.m_ssaForm.getDef(instr, location);
        if (!def) {
            throw new Error('Cannot find definition to promote to variable');
        }

        const variable = new DecompVariable(
            def.value.type,
            name || this.getDefaultVarName(def.value.type),
            this.m_ssaForm
        );
        variable.addSSALocation(location, def.version);
        this.addVariable(location, instr, variable);
        return variable;
    }

    promoteVersion(location: VersionedLocation, name?: string): DecompVariable {
        // see if it already exists
        const existing = this.getVariableWithVersion(location.value, location.version);
        if (existing) return existing;

        const def = this.m_ssaForm.getVersionInfo(location.value, location.version);
        if (!def) {
            throw new Error('Cannot find definition to promote to variable');
        }

        if (!('value' in def)) {
            throw new Error('Found definition for variable but no value');
        }

        const variable = new DecompVariable(
            def.value.type,
            name || this.getDefaultVarName(def.value.type),
            this.m_ssaForm
        );
        variable.addSSALocation(location.value, def.version);

        this.addVariable(location.value, def.instruction, variable);
        return variable;
    }

    getVariableWithVersion(location: Location, version: number): DecompVariable | null {
        const map = this.m_varMap.get(location);
        if (!map) return null;

        return map.get(version) || null;
    }

    getVariable(location: Location, atAddress: number): DecompVariable | null;
    getVariable(location: Location, atInstruction: i.Instruction): DecompVariable | null;
    getVariable(location: Location, instrOrAddress: number | i.Instruction): DecompVariable | null {
        const instr = this.getInstruction(instrOrAddress);
        const def = this.m_ssaForm.getMostRecentDefInfo(instr, location, false);
        if (!def) return null;

        return this.getVariableWithVersion(location, def.version);
    }

    getDefaultVarName(type: DataType): string {
        let prefix = '';

        while (type instanceof PointerType) {
            prefix += 'p';
            type = type.pointsTo;
        }

        prefix += type.name[0].toLowerCase();

        const counter = this.m_varNameCounterMap.get(prefix) || 0;
        this.m_varNameCounterMap.set(prefix, counter + 1);
        return `${prefix}Var${counter}`;
    }

    print() {
        console.log('------ Variables:');

        const versionStr = (loc: Location, version: number) => {
            const def = this.m_ssaForm.getVersionInfo(loc, version);
            if (!def) return version.toString();

            return `[${def.instruction} @ 0x${def.instruction.address.toString(16).padStart(8, '0')}]`;
        };

        this.m_variables.forEach(v => {
            console.log(v.toString());
        });
    }
}
