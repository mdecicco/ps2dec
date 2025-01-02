export interface FunctionModel {
    id: number;
    address: number;
    endAddress: number;
    stackSize: number;
    name: string;
    signatureId: number;
    methodOfId: number | null;
    isDeleted: boolean;
}
