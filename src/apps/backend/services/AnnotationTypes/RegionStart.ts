import { MemoryService } from 'apps/backend/services/MemoryService';
import { RegionStartAnnotation } from 'packages/types';
import { AnnotationService } from '../AnnotationService';

export function registerRegionStartAnnotation() {
    AnnotationService.registerAnnotationType('region_start', {
        getRowCount: (annotation: RegionStartAnnotation) => 4,
        getConsumedSize: (annotation: RegionStartAnnotation) => 0,
        render: (annotation: RegionStartAnnotation) => {
            const region = MemoryService.regions.find(r => r.start === annotation.address)!;
            return [
                {
                    consumedSize: 0,
                    segments: [
                        {
                            content: '//',
                            clickAction: null,
                            style: { color: 'green', fontStyle: 'italic' }
                        }
                    ]
                },
                {
                    consumedSize: 0,
                    segments: [
                        {
                            content: `// ${region.name}`,
                            clickAction: null,
                            style: { color: 'green', fontStyle: 'italic' }
                        }
                    ]
                },
                {
                    consumedSize: 0,
                    segments: [
                        {
                            content: '//',
                            clickAction: null,
                            style: { color: 'green', fontStyle: 'italic', marginRight: '4px' }
                        },
                        {
                            content: `0x${region.start.toString(16).padStart(8, '0')}`,
                            clickAction: { type: 'gotoAddress', address: region.start },
                            style: { color: 'yellow' }
                        },
                        {
                            content: '-',
                            clickAction: null,
                            style: { color: 'green', fontStyle: 'italic', marginLeft: '4px', marginRight: '4px' }
                        },
                        {
                            content: `0x${region.end.toString(16).padStart(8, '0')}`,
                            clickAction: { type: 'gotoAddress', address: region.end - 1 },
                            style: { color: 'yellow' }
                        }
                    ]
                },
                {
                    consumedSize: 0,
                    segments: [
                        {
                            content: `//`,
                            clickAction: null,
                            style: { color: 'green', fontStyle: 'italic' }
                        }
                    ]
                }
            ];
        }
    });
}
