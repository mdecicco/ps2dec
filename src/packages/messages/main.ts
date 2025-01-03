import { AnnotationModel } from 'packages/types';
import { ViewId } from 'packages/types/views';

export type MainMessagePayloads = {
    // Views
    getViewId: never;
    showWindow: ViewId;
    openDevTools: never;

    // Actions
    actionUndo: never;
    actionRedo: never;

    // Projects
    createProject: never;
    openProject: string | null;
    getRecentProjects: never;
    getProject: never;

    // Memory
    promptLoadElf: never;

    // Annotations
    addAnnotation: AnnotationModel;
    removeAnnotation: number;
    rebuildChunks: never;
    setRowInfo: { row: number; address: number; size: number };

    // Disassembly
    selectRows: {
        startRow: number;
        startAddress: number;
        endRow: number;
        endAddress: number;
    };
    gotoAddress: number;
};
export type MainMessageType = keyof MainMessagePayloads;
