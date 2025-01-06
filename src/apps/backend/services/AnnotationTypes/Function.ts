import { DataTypeService } from 'apps/backend/services/DataTypeService';
import { FunctionService } from 'apps/backend/services/FunctionService';
import { Op } from 'decoder';
import { FunctionAnnotation, RenderedRow, RowSegment } from 'types';
import { AnnotationService } from '../AnnotationService';

export function registerFunctionAnnotation() {
    AnnotationService.registerAnnotationType('function', {
        getRowCount: (annotation: FunctionAnnotation) => {
            const func = FunctionService.getFunctionById(annotation.functionId);
            const refRows = func ? FunctionService.getCallsToFunction(func.id).length : 0;
            return Math.min(refRows, 10) + 5;
        },
        getConsumedSize: (annotation: FunctionAnnotation) => 0,
        render: (annotation: FunctionAnnotation) => {
            const func = FunctionService.getFunctionById(annotation.functionId);

            const declSegs: RowSegment[] = [];
            if (func) {
                const retTp = DataTypeService.getDataTypeById(func.signature.returnTypeId)!;
                const args = func.signature.arguments.map(arg => {
                    const argTp = DataTypeService.getDataTypeById(arg.typeId)!;
                    const loc = func.signature.callConfig.argumentLocations[arg.index];
                    return [argTp.name, Op.formatOperand('reg' in loc ? loc.reg : loc)];
                });

                if (func.signature.isVariadic) {
                    args.push(['...']);
                }

                declSegs.push({
                    content: `${retTp.name} `,
                    clickAction: null,
                    style: { color: 'pink' }
                });

                declSegs.push({
                    content: `${func.name}`,
                    clickAction: null,
                    style: { color: '#1b5c2c' }
                });

                declSegs.push({
                    content: '(',
                    clickAction: null,
                    style: { color: 'gray' }
                });

                args.forEach((arg, idx) => {
                    if (idx > 0) {
                        declSegs.push({
                            content: ', ',
                            clickAction: null,
                            style: { color: 'gray' }
                        });
                    }

                    if (arg.length === 1) {
                        declSegs.push({
                            content: '...',
                            clickAction: null,
                            style: { color: 'gray' }
                        });
                    } else {
                        declSegs.push({
                            content: `${arg[0]} `,
                            clickAction: null,
                            style: { color: 'pink' }
                        });

                        declSegs.push({
                            content: arg[1],
                            clickAction: null,
                            style: { color: 'white' }
                        });
                    }
                });

                declSegs.push({
                    content: ')',
                    clickAction: null,
                    style: { color: 'gray' }
                });
            } else {
                declSegs.push({
                    content: `void `,
                    clickAction: null,
                    style: { color: 'pink' }
                });

                declSegs.push({
                    content: `FUN_${annotation.functionAddress.toString(16).padStart(8, '0')}`,
                    clickAction: null,
                    style: { color: '#1b5c2c' }
                });

                declSegs.push({
                    content: '()',
                    clickAction: null,
                    style: { color: 'gray' }
                });
            }

            const rows: RenderedRow[] = [
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
                            content: '/* * * * * * * * * * * * * * * * * * * * * * * * * */',
                            clickAction: null,
                            style: { color: 'green', fontStyle: 'italic' }
                        }
                    ]
                },
                {
                    consumedSize: 0,
                    segments: [
                        {
                            content: `/*                    FUNCTION                     */`,
                            clickAction: null,
                            style: { color: 'green', fontStyle: 'italic' }
                        }
                    ]
                },
                {
                    consumedSize: 0,
                    segments: [
                        {
                            content: '/* * * * * * * * * * * * * * * * * * * * * * * * * */',
                            clickAction: null,
                            style: { color: 'green', fontStyle: 'italic' }
                        }
                    ]
                },
                {
                    consumedSize: 0,
                    segments: declSegs
                }
            ];

            const callsTo = func ? FunctionService.getCallsToFunction(func.id) : [];
            if (callsTo.length > 0) {
                const callRows: RenderedRow[] = callsTo.slice(0, 10).map((call, idx) => {
                    const caller = FunctionService.getFunctionById(call.callerFunctionId)!;
                    return {
                        consumedSize: 0,
                        segments: [
                            {
                                content: `${idx !== 0 ? '          ' : ''}${caller.name}`,
                                clickAction: {
                                    type: 'gotoAddress',
                                    address: caller.address
                                },
                                style: { color: 'yellow' }
                            },
                            {
                                content: `: 0x${call.address.toString(16).padStart(8, '0')}`,
                                clickAction: {
                                    type: 'gotoAddress',
                                    address: call.address
                                },
                                style: { color: 'yellow' }
                            }
                        ]
                    };
                });

                if (callsTo.length > 10) {
                    callRows[9] = {
                        consumedSize: 0,
                        segments: [
                            {
                                content: `          ${callsTo.length - 10} more...`,
                                clickAction: null,
                                style: { color: 'gray' }
                            }
                        ]
                    };
                }

                rows.push(
                    {
                        consumedSize: 0,
                        segments: [
                            {
                                content: `    Refs: `,
                                clickAction: null,
                                style: { color: 'green', fontStyle: 'italic' }
                            },
                            ...(callRows.length > 0 ? callRows[0].segments : [])
                        ]
                    },
                    ...callRows.slice(1)
                );
            }

            return rows;
        }
    });
}
