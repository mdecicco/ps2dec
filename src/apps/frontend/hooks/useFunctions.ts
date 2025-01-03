import { AppContext } from 'apps/frontend/context';
import React from 'react';

export function useFunctions() {
    const ctx = React.useContext(AppContext);

    const getFunctionContainingAddress = (address: number) => {
        for (let addr = address; addr >= 0; addr--) {
            const funcModel = ctx.getFunctionModelByAddress(addr);
            if (!funcModel) continue;

            if (funcModel.endAddress >= address) return funcModel;

            break;
        }

        return null;
    };

    return {
        data: ctx.functions,
        loading: ctx.loadingFunctions,
        getFunctionByAddress: ctx.getFunctionByAddress,
        getFunctionById: ctx.getFunctionById,
        getFunctionContainingAddress
    };
}
