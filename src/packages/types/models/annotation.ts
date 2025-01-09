interface AnnotationBase {
    id: number;
    address: number;
}

export interface RawByteAnnotation extends AnnotationBase {
    type: 'raw-byte';
}

export interface InstructionAnnotation extends AnnotationBase {
    type: 'instruction';
    isDelaySlot: boolean;
}

export interface DataAnnotation extends AnnotationBase {
    type: 'data';
    typeId: number;
}

export interface LabelAnnotation extends AnnotationBase {
    type: 'label';
    label: string;
}

export interface CommentAnnotation extends AnnotationBase {
    type: 'comment';
    comment: string;
}

export interface RegionStartAnnotation extends AnnotationBase {
    type: 'region_start';
    name: string;
}

export interface FunctionAnnotation extends AnnotationBase {
    type: 'function';
    functionId: number;
    functionAddress: number;
}

export type AnnotationModel =
    | RawByteAnnotation
    | InstructionAnnotation
    | DataAnnotation
    | LabelAnnotation
    | CommentAnnotation
    | RegionStartAnnotation
    | FunctionAnnotation;
