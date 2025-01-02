import { registerFunctionAnnotation } from './Function';
import { registerInstructionAnnotation } from './Instruction';
import { registerLabelAnnotation } from './Label';
import { registerRawByteAnnotation } from './RawByte';
import { registerRegionStartAnnotation } from './RegionStart';

export function registerAnnotationTypes() {
    registerLabelAnnotation();
    registerInstructionAnnotation();
    registerRegionStartAnnotation();
    registerFunctionAnnotation();
    registerRawByteAnnotation();
}
