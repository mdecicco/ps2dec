import { FunctionService } from 'apps/backend/services/FunctionService';
import { FunctionAnnotation } from 'packages/types';
import { AnnotationService } from '../AnnotationService';

export function registerFunctionAnnotation() {
    AnnotationService.registerAnnotationType('function', {
        getRowCount: (annotation: FunctionAnnotation) => 2,
        getConsumedSize: (annotation: FunctionAnnotation) => 0,
        render: (annotation: FunctionAnnotation) => {
            const func = FunctionService.getFunctionByAddress(annotation.functionAddress);
            return [
                {
                    consumedSize: 0,
                    segments: [
                        {
                            content: '',
                            clickAction: null,
                            style: {}
                        }
                    ]
                },
                {
                    consumedSize: 0,
                    segments: [
                        {
                            clickAction: null,
                            style: { color: 'white' },
                            content: func
                                ? func.name
                                : `FUN_${annotation.functionAddress.toString(16).padStart(8, '0')}`
                        }
                    ]
                }
            ];
        }
    });
}
