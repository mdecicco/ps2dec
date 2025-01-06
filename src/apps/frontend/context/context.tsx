import { CircularProgress } from '@mui/material';
import { CenteredContent } from 'apps/frontend/components';
import { useProject } from 'apps/frontend/hooks';
import Messager from 'apps/frontend/message';
import {
    ArrayType,
    BitfieldType,
    EnumType,
    Func,
    FunctionSignatureType,
    Method,
    PointerType,
    PrimitiveType,
    StructureType,
    TypeInheritance,
    TypeSystem,
    VTable
} from 'decompiler';
import React from 'react';
import {
    DataTypeModel,
    FunctionModel,
    isArrayType,
    isBitfieldType,
    isEnumType,
    isFunctionSignatureType,
    isPointerType,
    isPrimitiveType,
    isStructureType,
    VTableModel
} from 'types';

const ts = TypeSystem.get();
ts.initialize();

interface AppContextType {
    dataTypes: DataTypeModel[];
    loadingDataTypes: boolean;
    vtables: VTableModel[];
    loadingVTables: boolean;
    functionModels: FunctionModel[];
    functions: (Func | Method)[];
    loadingFunctions: boolean;
    getFunctionById: (id: number) => Func | Method;
    getFunctionByAddress: (address: number) => Func | Method | null;
    getFunctionModelById: (id: number) => FunctionModel;
    getFunctionModelByAddress: (address: number) => FunctionModel | null;
}

export const AppContext = React.createContext<AppContextType>({
    dataTypes: [],
    loadingDataTypes: false,
    vtables: [],
    loadingVTables: false,
    functionModels: [],
    functions: [],
    loadingFunctions: false,
    getFunctionById: (id: number) => {
        throw new Error('Not implemented');
    },
    getFunctionByAddress: (address: number) => null,
    getFunctionModelById: (id: number) => {
        throw new Error('Not implemented');
    },
    getFunctionModelByAddress: (address: number) => null
});

function transformFunction(func: FunctionModel) {
    return Func.rehydrate({
        id: func.id,
        address: func.address,
        isConstructor: func.isConstructor,
        isDestructor: func.isDestructor,
        name: func.name,
        retLocation: func.signature.callConfig.returnValueLocation,
        signatureId: func.signatureId,
        methodInfo: func.methodOfId
            ? {
                  thisTypeId: func.methodOfId,
                  vtableMethod: func.vtableMethod
                      ? {
                            vtableId: func.vtableMethod.vtableId,
                            methodOffset: func.vtableMethod.offset
                        }
                      : null
              }
            : null,
        args: func.signature.arguments.map((a, idx) => ({
            name: `param_${idx + 1}`,
            typeId: a.typeId,
            ssaLocations: [],
            ssaVersions: []
        }))
    });
}

function processVTableAdded(vtable: VTableModel) {}

function processTypeAdded(type: DataTypeModel, funcMap: Map<number, number>, funcs: (Func | Method)[]) {
    try {
        // If an exception is not thrown, the type was already added
        ts.getType(type.id);
        return;
    } catch (e) {}

    if (isPrimitiveType(type)) {
        ts.addType(new PrimitiveType(type.id, type.isSigned, type.isFloatingPoint, type.size));
    } else if (isPointerType(type)) {
        ts.addType(PointerType.rehydrate(type.id, type.pointsToId, type.name));
    } else if (isArrayType(type)) {
        ts.addType(ArrayType.rehydrate(type.id, type.elementTypeId, type.length, type.size, type.name));
    } else if (isFunctionSignatureType(type)) {
        ts.addType(
            FunctionSignatureType.rehydrate(
                type.id,
                type.returnTypeId,
                type.thisTypeId,
                type.arguments.map(a => a.typeId),
                type.callConfig,
                type.name,
                type.isVariadic
            )
        );
    } else if (isEnumType(type)) {
        ts.addType(
            EnumType.rehydrate(
                type.id,
                type.underlyingTypeId,
                new Map(type.fields.map(f => [f.name, f.value])),
                type.name
            )
        );
    } else if (isBitfieldType(type)) {
        ts.addType(
            BitfieldType.rehydrate(
                type.id,
                type.underlyingTypeId,
                new Map(type.fields.map(f => [f.name, f.bitIndex])),
                type.name
            )
        );
    } else if (isStructureType(type)) {
        const methods: Method[] = [];
        for (const method of type.methods) {
            const methIdx = funcMap.get(method.methodId);
            if (methIdx === undefined) throw new Error('Failed to find method');
            methods.push(funcs[methIdx] as Method);
        }

        const baseTypes: TypeInheritance[] = [];
        for (const base of type.baseTypes) {
            let vtable: VTable | null = null;
            if (base.vtableId) {
                vtable = ts.getVtableById(base.vtableId);
                if (!vtable) throw new Error('Failed to find vtable');
            }

            baseTypes.push({
                offset: base.dataOffset,
                typeId: base.structureId,
                vtableInfo:
                    vtable && base.vtableOffset
                        ? {
                              offset: base.vtableOffset,
                              vtable
                          }
                        : null
            });
        }

        let vtable: VTable | null = null;
        if (type.vtableId) {
            vtable = ts.getVtableById(type.vtableId);
            if (!vtable) throw new Error('Failed to find vtable');
        }

        return StructureType.rehydrate(
            type.id,
            type.fields.map(f => ({ name: f.name, typeId: f.typeId, offset: f.offset })),
            methods,
            baseTypes,
            vtable,
            type.name
        );
    }
}

function processTypeUpdated(type: DataTypeModel, prev: DataTypeModel) {}

function processFunctionUpdated(func: Func | Method, prev: FunctionModel, current: FunctionModel) {}

export const AppProvider: React.FC<{ children?: React.ReactNode }> = props => {
    const project = useProject();
    const [dataTypes, setDataTypes] = React.useState<DataTypeModel[]>([]);
    const [loadingDataTypes, setLoadingDataTypes] = React.useState(false);
    const [loadedDataTypes, setLoadedDataTypes] = React.useState(false);
    const [vtables, setVtables] = React.useState<VTableModel[]>([]);
    const [loadingVTables, setLoadingVTables] = React.useState(false);
    const [loadedVTables, setLoadedVTables] = React.useState(false);
    const [functionModels, setFunctionModels] = React.useState<FunctionModel[]>([]);
    const [functions, setFunctions] = React.useState<(Func | Method)[]>([]);
    const [loadingFunctions, setLoadingFunctions] = React.useState(false);
    const [loadedFunctions, setLoadedFunctions] = React.useState(false);
    const [sortedFuncIndices, setSortedFuncIndices] = React.useState<number[]>([]);
    const functionIndicesByAddress = React.useRef(new Map<number, number>());
    const functionIndicesById = React.useRef(new Map<number, number>());

    React.useEffect(() => {
        const loadTypes = async () => {
            setLoadingDataTypes(true);
            const loadedTypes = await Messager.invoke('getDataTypes');
            loadedTypes.forEach(tp => processTypeAdded(tp, functionIndicesById.current, functions));
            setDataTypes(loadedTypes);
            setLoadingDataTypes(false);
            setLoadedDataTypes(true);
        };

        const loadVtables = async () => {
            setLoadingVTables(true);
            const loadedVTables = await Messager.invoke('getVTables');
            loadedVTables.forEach(processVTableAdded);
            setVtables(loadedVTables);
            setLoadingVTables(false);
            setLoadedVTables(true);
        };

        const loadFunctions = async () => {
            setLoadingFunctions(true);
            const loadedFunctions = await Messager.invoke('getFunctions');

            for (let i = 0; i < loadedFunctions.length; i++) {
                functionIndicesByAddress.current.set(loadedFunctions[i].address, i);
                functionIndicesById.current.set(loadedFunctions[i].id, i);
            }

            const indices = Array.from({ length: loadedFunctions.length }, (_, idx) => idx);
            indices.sort((i, j) => loadedFunctions[i].address - loadedFunctions[j].address);

            setSortedFuncIndices(indices);
            setFunctionModels(loadedFunctions);
            setFunctions(loadedFunctions.map(transformFunction));
            setLoadingFunctions(false);
            setLoadedFunctions(true);
        };

        if (project.path) {
            if (!loadedVTables) {
                loadVtables();
            }

            if (!loadedFunctions) {
                loadFunctions();
            }

            if (!loadedDataTypes && loadedVTables && loadedFunctions) {
                loadTypes();
            }
        }
    }, [project.path, loadedDataTypes, loadedVTables, loadedFunctions]);

    React.useEffect(() => {
        const listeners: (() => void)[] = [];

        listeners.push(
            Messager.on('dataTypeAdded', type => {
                processTypeAdded(type, functionIndicesById.current, functions);
                setDataTypes([...dataTypes, type]);
            })
        );

        listeners.push(
            Messager.on('dataTypeUpdated', ({ previous, current }) => {
                const idx = dataTypes.findIndex(tp => tp.id === previous.id);
                if (idx === -1) {
                    processTypeAdded(current, functionIndicesById.current, functions);
                    setDataTypes([...dataTypes, current]);
                    return;
                }

                processTypeUpdated(current, previous);
                setDataTypes(dataTypes.map(tp => (tp.id === previous.id ? current : tp)));
            })
        );

        listeners.push(
            Messager.on('functionAdded', func => {
                functionIndicesByAddress.current.set(func.address, functions.length);
                functionIndicesById.current.set(func.id, functions.length);

                const newModels = [...functionModels, func];
                const newFuncs = [...functions, transformFunction(func)];

                const indices = Array.from({ length: newFuncs.length }, (_, idx) => idx);
                indices.sort((i, j) => newFuncs[i].address - newFuncs[j].address);

                setSortedFuncIndices(indices);
                setFunctionModels(newModels);
                setFunctions(newFuncs);
            })
        );

        listeners.push(
            Messager.on('functionUpdated', ({ previous, current }) => {
                const idx = functionModels.findIndex(tp => tp.id === previous.id);
                if (idx === -1) {
                    functionIndicesByAddress.current.set(current.address, functions.length);
                    functionIndicesById.current.set(current.id, functions.length);

                    const newModels = [...functionModels, current];
                    const newFuncs = [...functions, transformFunction(current)];

                    const indices = Array.from({ length: newFuncs.length }, (_, idx) => idx);
                    indices.sort((i, j) => newFuncs[i].address - newFuncs[j].address);

                    setSortedFuncIndices(indices);
                    setFunctionModels(newModels);
                    setFunctions(newFuncs);
                    return;
                }

                if (!!current.methodOfId !== !!previous.methodOfId) {
                    // function and all references to it need to be replaced...
                    const newModels = Array.from(functionModels);
                    const newFuncs = Array.from(functions);

                    const newFunc = transformFunction(current);
                    const oldFunc = functions[idx];

                    newModels[idx] = current;
                    newFuncs[idx] = newFunc;

                    const indices = Array.from({ length: newFuncs.length }, (_, idx) => idx);
                    indices.sort((i, j) => newFuncs[i].address - newFuncs[j].address);

                    setSortedFuncIndices(indices);
                    setFunctionModels(newModels);
                    setFunctions(newFuncs);

                    if (oldFunc instanceof Method) {
                        // Update type system. New function is not a method, just remove it
                        const tp = oldFunc.signature.thisType as StructureType;
                        tp.removeMethod(oldFunc);
                    } else if (newFunc instanceof Method) {
                        // New function is a method, add it to the type it's a method of
                        const tp = newFunc.signature.thisType as StructureType;
                        tp.addMethod(newFunc);
                    }
                } else {
                    // update in place
                    processFunctionUpdated(functions[idx], current, previous);
                }
            })
        );

        return () => {
            listeners.forEach(l => l());
        };
    }, [dataTypes.length, vtables.length, functions.length]);

    return (
        <AppContext.Provider
            value={{
                dataTypes,
                loadingDataTypes,
                vtables,
                loadingVTables,
                functionModels,
                functions: sortedFuncIndices.map(idx => functions[idx]),
                loadingFunctions,
                getFunctionById: (id: number) => {
                    const idx = functionIndicesById.current.get(id);
                    if (!idx) throw new Error(`Function id ${id} not found`);
                    return functions[idx];
                },
                getFunctionByAddress: (address: number) => {
                    const idx = functionIndicesByAddress.current.get(address);
                    if (!idx) return null;
                    return functions[idx];
                },
                getFunctionModelById: (id: number) => {
                    const idx = functionIndicesById.current.get(id);
                    if (!idx) throw new Error(`Function id ${id} not found`);
                    return functionModels[idx];
                },
                getFunctionModelByAddress: (address: number) => {
                    const idx = functionIndicesByAddress.current.get(address);
                    if (!idx) return null;
                    return functionModels[idx];
                }
            }}
        >
            {loadedDataTypes && loadedVTables && loadedFunctions ? (
                props.children
            ) : (
                <CenteredContent>
                    <CircularProgress />
                </CenteredContent>
            )}
        </AppContext.Provider>
    );
};
