import { FunctionModel, MemoryRegionModel, ViewId } from 'packages/types';
import { DataTypeModel } from 'packages/types/models/datatype';

export type ClientMessagePayloads = {
    setViewId: ViewId;

    // Project
    setProject: {
        path: string | null;
    };
    projectLoaded: {
        path: string;
    };
    projectLoadFailed: {
        error: string;
    };
    projectLoadCancelled: never;
    projectCreateCancelled: never;
    setRecentProjects: {
        projectPaths: string[];
    };

    // ELF
    elfLoaded: {
        path: string;
    };
    elfLoadFailed: {
        error: string;
    };
    elfLoadCancelled: never;

    // Actions
    actionStarted: {
        description: string;
    };
    actionCompleted: {
        description: string;
    };
    actionFailed: {
        description: string;
        error: string;
    };
    actionProgress: {
        description: string;
        progress: number;
    };

    // Annotations
    annotationFailed: {
        error: string;
    };
    annotationRemoved: {
        id: number;
        address: number;
    };
    setTotalRows: number;

    // Memory
    setMemoryRegions: {
        regions: MemoryRegionModel[];
    };
    memoryRegionAdded: MemoryRegionModel;
    memoryRegionRemoved: { id: number };
    receiveData: {
        requestId: string;
        address: number;
        size: number;
        data: Uint8Array;
    };

    // Functions
    functionAdded: FunctionModel;
    functionUpdated: {
        previous: FunctionModel;
        current: FunctionModel;
    };
    setFunctions: FunctionModel[];

    // Data Types
    dataTypeAdded: DataTypeModel;
    dataTypeUpdated: {
        previous: DataTypeModel;
        current: DataTypeModel;
    };

    // Disassembly
    gotoAddress: number;
    selectRows: {
        startRow: number;
        startAddress: number;
        endRow: number;
        endAddress: number;
    };
};
export type ClientMessageType = keyof ClientMessagePayloads;
