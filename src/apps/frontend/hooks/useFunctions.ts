import Messager from 'apps/frontend/message';
import { Func, FunctionSignatureType, Method, MethodSignatureType, TypeSystem } from 'decompiler';
import { FunctionModel } from 'packages/types';
import React from 'react';

export function useFunctions() {
    const [loading, setLoading] = React.useState(false);
    const [models, setModels] = React.useState<FunctionModel[]>([]);
    const [functions, setFunctions] = React.useState<(Func | Method)[]>([]);
    const [sortedIndices, setSortedIndices] = React.useState<number[]>([]);
    const functionIndicesByAddress = React.useRef(new Map<number, number>());
    const functionIndicesById = React.useRef(new Map<number, number>());

    const transformFunction = (func: FunctionModel) => {
        const sig = TypeSystem.get().getType(func.signatureId);

        if (func.signatureId) {
            return new Method(func.id, func.address, sig as MethodSignatureType);
        }

        return new Func(func.id, func.address, sig as FunctionSignatureType);
    };

    const loadFunctions = async () => {
        setLoading(true);
        const newFunctions = await Messager.invoke('getFunctions');

        for (let i = 0; i < newFunctions.length; i++) {
            functionIndicesByAddress.current.set(newFunctions[i].address, i);
            functionIndicesById.current.set(newFunctions[i].id, i);
        }

        const indices = Array.from({ length: newFunctions.length }, (_, idx) => idx);
        indices.sort((i, j) => newFunctions[i].address - newFunctions[j].address);

        setSortedIndices(indices);
        setModels(newFunctions);
        // setFunctions(newFunctions.map(transformFunction));
        setLoading(false);
    };

    React.useEffect(() => {
        const unbind: (() => void)[] = [
            Messager.on('setFunctions', data => {
                setModels(data);
                // setFunctions(data.map(transformFunction));
                setLoading(false);
            }),
            Messager.on('functionAdded', func => {
                setModels([...models, func]);
                // setFunctions([...functions, transformFunction(func)]);
                functionIndicesByAddress.current.set(func.address, functions.length);
                functionIndicesById.current.set(func.id, functions.length);
            }),
            Messager.on('functionUpdated', data => {
                setModels(models.map(func => (func.id === data.previous.id ? data.current : func)));
                // setFunctions(
                //     functions.map(func => (func.id === data.previous.id ? transformFunction(data.current) : func))
                // );

                if (data.current.isDeleted && !data.previous.isDeleted) {
                    functionIndicesByAddress.current.delete(data.previous.address);
                    functionIndicesById.current.delete(data.previous.id);
                }
            })
        ];

        if (!loading) loadFunctions();

        return () => {
            unbind.forEach(fn => fn());
        };
    }, []);

    const getFunctionByAddress = (address: number) => {
        const index = functionIndicesByAddress.current.get(address);
        if (index === undefined) return null;
        return models[index];
    };

    const getFunctionContainingAddress = (address: number) => {
        for (const func of models) {
            if (address >= func.address && address < func.endAddress) return func;
        }

        return null;
    };

    const getFunctionById = (id: number) => {
        const index = functionIndicesById.current.get(id);
        if (index === undefined) return null;
        return models[index];
    };

    return {
        data: sortedIndices.map(idx => models[idx]),
        loading,
        getFunctionByAddress,
        getFunctionById,
        getFunctionContainingAddress
    };
}
