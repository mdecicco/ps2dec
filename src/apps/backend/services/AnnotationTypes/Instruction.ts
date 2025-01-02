import { FunctionService } from 'apps/backend/services/FunctionService';
import { MemoryService } from 'apps/backend/services/MemoryService';
import { decode, i, Op, Reg } from 'decoder';
import { InstructionAnnotation, RowSegment } from 'types';
import { AnnotationService } from '../AnnotationService';

export function registerInstructionAnnotation() {
    AnnotationService.registerAnnotationType('instruction', {
        getRowCount: (annotation: InstructionAnnotation) => 1,
        getConsumedSize: (annotation: InstructionAnnotation) => 4,
        render: (annotation: InstructionAnnotation) => {
            const segments: RowSegment[] = [];

            const op = MemoryService.read32(annotation.address);
            try {
                const instr = decode(op, annotation.address);
                segments.push(
                    {
                        clickAction: null,
                        style: {
                            color: 'gray',
                            width: 100
                        },
                        content: annotation.address.toString(16).padStart(8, '0')
                    },
                    {
                        clickAction: null,
                        style: {
                            ml: 2,
                            color: 'lightblue',
                            fontFamily: 'Courier New',
                            width: '5rem'
                        },
                        content: instr.toStrings()[0]
                    }
                );

                let idx = 0;
                const appendOperand = (op: Op.Operand) => {
                    if (idx > 0) {
                        segments.push({
                            clickAction: null,
                            style: { color: 'gray', marginRight: '0.2rem' },
                            content: ','
                        });
                    }
                    idx++;
                    if (typeof op === 'number') {
                        // immediate
                        segments.push({
                            clickAction: null,
                            style: {
                                color: '#bd2b2b',
                                fontFamily: 'Courier New'
                            },
                            content: Op.formatOperand(op)
                        });
                    } else if ('type' in op) {
                        // register
                        segments.push({
                            clickAction: null,
                            style: {
                                color: '#acb900',
                                fontFamily: 'Courier New'
                            },
                            content: Reg.formatRegister(op)
                        });
                    } else {
                        // memory
                        segments.push(
                            {
                                clickAction: null,
                                style: {
                                    color: '#bd2b2b',
                                    fontFamily: 'Courier New'
                                },
                                content: Op.formatOperand(op.offset)
                            },
                            {
                                clickAction: null,
                                style: {
                                    color: 'gray',
                                    fontFamily: 'Courier New'
                                },
                                content: '('
                            },
                            {
                                clickAction: null,
                                style: {
                                    color: '#acb900',
                                    fontFamily: 'Courier New'
                                },
                                content: Reg.formatRegister(op.base)
                            },
                            {
                                clickAction: null,
                                style: {
                                    color: 'gray',
                                    fontFamily: 'Courier New'
                                },
                                content: ')'
                            }
                        );
                    }
                };

                if (i.jal.is(instr)) {
                    const target = instr.operands[0] as number;
                    const func = FunctionService.getFunctionByAddress(target);
                    segments.push({
                        clickAction: {
                            type: 'gotoAddress',
                            address: target
                        },
                        style: {
                            color: '#1b5c2c',
                            fontFamily: 'Courier New'
                        },
                        content: func ? func.name : Op.formatOperand(target)
                    });
                } else if (instr.isBranch && typeof instr.operands[instr.operands.length - 1] === 'number') {
                    instr.operands.forEach((op, idx) => {
                        if (idx < instr.operands.length - 1) {
                            appendOperand(op);
                        }
                    });

                    if (instr.operands.length > 1) {
                        segments.push({
                            clickAction: null,
                            style: { color: 'gray', marginRight: '0.2rem' },
                            content: ','
                        });
                    }
                    const target = instr.operands[instr.operands.length - 1] as number;
                    const func = FunctionService.getFunctionByAddress(target);
                    const label = AnnotationService.getAnnotations(target).find(a => a.type === 'label');
                    segments.push({
                        clickAction: {
                            type: 'gotoAddress',
                            address: target
                        },
                        style: {
                            color: '#1b5c2c',
                            fontFamily: 'Courier New'
                        },
                        content: func?.name || label?.label || Op.formatOperand(target)
                    });
                } else {
                    instr.operands.forEach(appendOperand);
                }
            } catch (e) {
                segments.push({
                    clickAction: null,
                    style: {
                        color: 'red'
                    },
                    content: `<Failed to decode: ${String(e)}>`
                });
            }

            return [{ consumedSize: 4, segments }];
        }
    });
}
