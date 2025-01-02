import { MemoryService } from 'apps/backend/services/MemoryService';
import { RawByteAnnotation } from 'packages/types';
import { AnnotationService } from '../AnnotationService';

export function registerRawByteAnnotation() {
    AnnotationService.registerAnnotationType('raw-byte', {
        getRowCount: (annotation: RawByteAnnotation) => 1,
        getConsumedSize: (annotation: RawByteAnnotation) => 1,
        render: (annotation: RawByteAnnotation) => {
            const byte = MemoryService.read8(annotation.address);
            return [
                {
                    consumedSize: 1,
                    segments: [
                        {
                            clickAction: null,
                            style: {
                                color: 'gray',
                                width: 100
                            },
                            content: annotation.address.toString(16).padStart(8, '0')
                        },
                        {
                            content: byte.toString(16).padStart(2, '0'),
                            style: { color: 'white' },
                            clickAction: null
                        }
                    ]
                }
            ];
        }
    });
}
