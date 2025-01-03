import { SerializedDecompilation } from 'decompiler';
import { ClientMessagePayloads, ClientMessageType } from 'packages/messages/client';
import { MainMessagePayloads, MainMessageType } from 'packages/messages/main';
import { AnnotationModel, DataTypeModel, FunctionModel, MemoryRegionModel, RenderedRow, VTableModel } from 'types';

export * from './client';
export * from './main';

export type ClientMessage<Type extends ClientMessageType> = {
    type: ClientMessageType;
    payload: ClientMessagePayloads[Type];
};

export type MainMessage<Type extends MainMessageType> = {
    type: MainMessageType;
    payload: MainMessagePayloads[Type];
};

export type Invocation<Request, Response> = {
    request: Request;
    response: Response;
};

export type InvocationMap = {
    getRowCount: Invocation<AnnotationModel, number>;
    getConsumedSize: Invocation<AnnotationModel, number>;
    getTotalRows: Invocation<never, number>;
    getRowInfo: Invocation<number, { address: number; size: number }>;
    getAddressAtRow: Invocation<number, { address: number; annotationIndex: number; annotationRowOffset: number }>;
    getAnnotations: Invocation<number, AnnotationModel[]>;
    getRowAtAddress: Invocation<number, number>;
    getMemoryRegions: Invocation<never, MemoryRegionModel[]>;
    getFunctions: Invocation<never, FunctionModel[]>;
    getDataTypes: Invocation<never, DataTypeModel[]>;
    getVTables: Invocation<never, VTableModel[]>;
    renderAnnotation: Invocation<AnnotationModel, RenderedRow[]>;
    renderRows: Invocation<{ startRow: number; rowCount: number }, RenderedRow[]>;
    readBytes: Invocation<{ address: number; count: number }, Uint8Array>;
    decompileFunction: Invocation<number, SerializedDecompilation | { error: string }>;
};
