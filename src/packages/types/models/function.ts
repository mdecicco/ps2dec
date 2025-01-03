import { FunctionSignatureModel, VTableMethodModel } from 'packages/types/models/datatype';

export interface FunctionModel {
    id: number;
    address: number;
    endAddress: number;
    stackSize: number;
    name: string;
    signatureId: number;
    signature: FunctionSignatureModel;
    methodOfId: number | null;
    vtableMethodId: number | null;
    vtableMethod: VTableMethodModel | null;
    isDeleted: boolean;
    isConstructor: boolean;
    isDestructor: boolean;
}
