import { Box } from '@mui/material';
import React from 'react';

import { CodeBuilder, SourceAnnotationType, SourceLocation } from 'decompiler';

import { useElementSize } from 'apps/frontend/hooks/useElementSize';
import Messager from 'apps/frontend/message';
import { CodeLine } from './CodeLine';
import { addressRangeToTextRange, getAnnotationLength, pixelRangeToTextRange } from './common';

type DecompilationProps = {
    decompilation: CodeBuilder;
};

export const CodeView: React.FC<DecompilationProps> = ({ decompilation }) => {
    const textSizeSampler = useElementSize<HTMLSpanElement>();
    const [selections, setSelections] = React.useState<SourceLocation[]>([]);
    const [addrRange, setAddrRange] = React.useState<{ startAddress: number; endAddress: number } | null>(null);
    const [dragStart, setDragStart] = React.useState<{ x: number; y: number } | null>(null);
    const codeBoxRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        return Messager.on('selectRows', selection => {
            setSelections(addressRangeToTextRange(selection, decompilation));
        });
    }, [decompilation]);

    const fireDisasmSelect = (selection: SourceLocation[]) => {
        // todo: translate selections to addresses to select
        // todo: multi-selection in disassembly
    };

    const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
        setSelections([]);
        if (!codeBoxRef.current) return;
        const rect = codeBoxRef.current.getBoundingClientRect();
        setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handleDragEnd = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!codeBoxRef.current || !dragStart) return;
        const rect = codeBoxRef.current.getBoundingClientRect();
        const curPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const range = pixelRangeToTextRange(dragStart, curPos, textSizeSampler, decompilation);

        if (range.length === 1 && range[0].startColumn === range[0].endColumn) {
            let curCol = 0;
            const annotation = decompilation.getLineAnnotations(range[0].startLine).find(a => {
                const len = getAnnotationLength(a);

                if (curCol < range[0].startColumn && curCol + len >= range[0].startColumn) {
                    if (a.type === SourceAnnotationType.Whitespace) return true;

                    const selections = [
                        {
                            startLine: range[0].startLine,
                            endLine: range[0].endLine,
                            startColumn: curCol + 1,
                            endColumn: curCol + len,

                            // Don't care about these
                            startOffset: 0,
                            endOffset: 0
                        }
                    ];
                    fireDisasmSelect(selections);
                    setSelections(selections);

                    return true;
                }

                curCol += len;
                return false;
            });
            if (!annotation) {
                setSelections(range);
                fireDisasmSelect(range);
            }
        } else {
            setSelections(range);
            fireDisasmSelect(range);
        }
    };

    return (
        <Box
            sx={{
                fontFamily: 'Courier New, monospace',
                display: 'flex',
                flexDirection: 'row',
                width: '100%',
                lineHeight: '1.2rem'
            }}
        >
            <Box
                sx={{
                    textAlign: 'right',
                    paddingRight: '0.5rem',
                    paddingLeft: '0.5rem',
                    marginRight: '0.5rem',
                    borderRight: '2px solid #5a5a5a',
                    userSelect: 'none'
                }}
            >
                {Array.from({ length: decompilation.lineCount }, (_, i) => (
                    <div key={i}>{i + 1}</div>
                ))}
            </Box>
            <Box
                ref={codeBoxRef}
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    whiteSpace: 'pre',
                    userSelect: 'none',
                    zIndex: 1
                }}
                onMouseDown={handleDragStart}
                onMouseMove={handleDragEnd}
                onMouseUp={e => {
                    setDragStart(null);
                    handleDragEnd(e);
                }}
            >
                <span
                    ref={textSizeSampler.ref}
                    style={{ position: 'absolute', opacity: 0, userSelect: 'none', pointerEvents: 'none' }}
                >
                    0
                </span>
                {Array.from({ length: decompilation.lineCount }, (_, i) => (
                    <CodeLine
                        key={i}
                        line={i + 1}
                        decompilation={decompilation}
                        annotations={decompilation.getLineAnnotations(i + 1)}
                    />
                ))}
                {selections.map(r => {
                    const offsetY = (r.startLine - 1) * textSizeSampler.height;
                    const offsetX = (r.startColumn - 1) * textSizeSampler.width;
                    const width = (r.endColumn - r.startColumn + 1) * textSizeSampler.width;
                    return (
                        <div
                            key={`${r.startLine}.${r.startColumn}.${r.endColumn}`}
                            style={{
                                opacity: 0.125,
                                backgroundColor: 'white',
                                width: `${width}px`,
                                height: `${textSizeSampler.height}px`,
                                position: 'absolute',
                                top: `${offsetY}px`,
                                left: `${offsetX}px`,
                                pointerEvents: 'none'
                            }}
                        />
                    );
                })}
            </Box>
        </Box>
    );
};
