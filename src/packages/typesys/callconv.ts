import { Reg } from 'decoder';
import { Location } from 'types';
import { ArrayType, DataType, PointerType, PrimitiveType, StructureType } from './datatype';

export type CallConfig = {
    thisArgumentLocation: Location | null;
    argumentLocations: Location[];
    returnValueLocation: Location | null;
};

export enum CallConv {
    CDecl
}

function cdeclConfig(returnType: DataType, argumentTypes: DataType[], thisType?: DataType): CallConfig {
    const conf: CallConfig = {
        thisArgumentLocation: null,
        argumentLocations: [],
        returnValueLocation: null
    };

    // todo: this, but correctly
    if (returnType.size > 0) {
        if (returnType instanceof PrimitiveType) {
            if (returnType.isFloatingPoint) {
                conf.returnValueLocation = { type: Reg.Type.COP1, id: Reg.COP1.F0 };
            } else {
                conf.returnValueLocation = { type: Reg.Type.EE, id: Reg.EE.V0 };
            }
        } else if (returnType instanceof PointerType) {
            conf.returnValueLocation = { type: Reg.Type.EE, id: Reg.EE.V0 };
        } else {
            // honk honk
        }
    }

    let nextGP: Reg.EE = Reg.EE.A0;
    let nextFP: Reg.COP1 = Reg.COP1.F12;
    let nextT: Reg.EE = Reg.EE.T0;
    let nextStackOffset = 0;

    if (thisType) {
        conf.thisArgumentLocation = { type: Reg.Type.EE, id: nextGP++ };
    }

    argumentTypes.forEach(arg => {
        if (arg instanceof StructureType) {
            // honk honk
            return;
        }

        if (arg instanceof ArrayType) {
            // honk honk
            return;
        }

        let useStack = false;
        let useT = false;
        if (arg instanceof PrimitiveType && arg.isFloatingPoint) {
            if (nextFP === Reg.COP1.F20) useT = true;
            else conf.argumentLocations.push({ type: Reg.Type.COP1, id: nextFP++ });
        } else {
            if (nextGP > Reg.EE.A3) useT = true;
            else conf.argumentLocations.push({ type: Reg.Type.EE, id: nextGP++ });
        }

        if (useT) {
            if (nextT === Reg.EE.T4) useStack = true;
            else conf.argumentLocations.push({ type: Reg.Type.EE, id: nextT++ });
        }

        if (useStack) {
            conf.argumentLocations.push(nextStackOffset);

            nextStackOffset += 8;
        }
    });

    return conf;
}

export function getCallConfig(conv: CallConv, returnType: DataType, argumentTypes: DataType[], thisType?: DataType) {
    switch (conv) {
        case CallConv.CDecl:
            return cdeclConfig(returnType, argumentTypes, thisType);
    }
}
