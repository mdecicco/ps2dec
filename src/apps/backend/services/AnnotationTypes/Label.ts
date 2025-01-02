import { LabelAnnotation } from 'packages/types';
import { AnnotationService } from '../AnnotationService';

export function registerLabelAnnotation() {
    AnnotationService.registerAnnotationType('label', {
        getRowCount: (annotation: LabelAnnotation) => 2,
        getConsumedSize: (annotation: LabelAnnotation) => 0,
        render: (annotation: LabelAnnotation) => {
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
                            content: annotation.label,
                            clickAction: null,
                            style: { marginLeft: 20, color: 'gray' }
                        }
                    ]
                }
            ];
        }
    });
}
