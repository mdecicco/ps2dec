import { AppContext } from 'apps/frontend/context';
import React from 'react';

export function useDataTypes() {
    const { dataTypes, loadingDataTypes } = React.useContext(AppContext);

    return {
        data: dataTypes,
        loading: loadingDataTypes
    };
}
