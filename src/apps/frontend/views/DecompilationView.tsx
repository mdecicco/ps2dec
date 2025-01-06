import React from 'react';

import { Box } from '@mui/material';
import { ElfBarrier, NoContent } from 'apps/frontend/components';
import { useElementSize, useMemory } from 'apps/frontend/hooks';
import { useFunctions } from 'apps/frontend/hooks/useFunctions';
import Messager from 'apps/frontend/message';
import { View } from 'apps/frontend/views/View';
import { decode, i } from 'decoder';
import {
    Decompilation,
    Decompiler,
    DecompilerCache,
    SerializedSourceAnnotation,
    SourceAnnotationType,
    SourceLocation
} from 'decompiler';
import { FunctionModel } from 'types';
import { useProject } from '../hooks/useProject';

type AddressRange = {
    startAddress: number;
    endAddress: number;
};

type PixelCoord = {
    x: number;
    y: number;
};

type CharSize = {
    width: number;
    height: number;
};

function lineSelectionMapToTextRange(map: Map<number, Set<number>>): SourceLocation[] {
    const textRanges: SourceLocation[] = [];

    for (const [line, selectedCols] of map.entries()) {
        const sortedCols = Array.from(selectedCols.values()).sort((a, b) => a - b);
        let startCol = sortedCols[0];
        let lastCol = sortedCols[0];

        if (sortedCols.length === 1) {
            textRanges.push({
                startLine: line,
                endLine: line,
                startColumn: startCol,
                endColumn: lastCol,

                // Don't care about these
                startOffset: 0,
                endOffset: 0
            });

            continue;
        }

        for (let i = 1; i < sortedCols.length; i++) {
            const curCol = sortedCols[i];

            if (curCol !== lastCol + 1) {
                textRanges.push({
                    startLine: line,
                    endLine: line,
                    startColumn: startCol,
                    endColumn: lastCol,

                    // Don't care about these
                    startOffset: 0,
                    endOffset: 0
                });

                startCol = curCol;
                lastCol = curCol;
            }

            lastCol = curCol;
        }

        if (startCol !== lastCol) {
            textRanges.push({
                startLine: line,
                endLine: line,
                startColumn: startCol,
                endColumn: lastCol,

                // Don't care about these
                startOffset: 0,
                endOffset: 0
            });
        }
    }

    return textRanges;
}

function addressRangeToTextRange(range: AddressRange, decompilation: Decompilation): SourceLocation[] {
    const lineSelMap = new Map<number, Set<number>>();

    const markSelection = (line: number, startCol: number, endCol: number, lineRange: SourceLocation) => {
        let set = lineSelMap.get(line);
        if (!set) {
            set = new Set<number>();
            lineSelMap.set(line, set);
        }

        for (let i = startCol; i < endCol && i < lineRange.endColumn; i++) set.add(i);
    };

    for (let addr = range.startAddress; addr < range.endAddress; addr += 4) {
        const locs = decompilation.getLocationsForAddress(addr);
        locs.forEach(loc => {
            if (loc.startLine != loc.endLine) {
                for (let l = loc.startLine; l < loc.endLine; l++) {
                    const range = decompilation.lineRanges.get(l);
                    if (!range) continue;

                    markSelection(
                        l,
                        l === loc.startLine ? loc.startColumn : range.startColumn,
                        l === loc.endLine - 1 ? loc.endColumn : range.endColumn,
                        range
                    );
                }
            } else {
                const range = decompilation.lineRanges.get(loc.startLine);
                if (range) markSelection(loc.startLine, loc.startColumn, loc.endColumn, range);
            }
        });
    }

    return lineSelectionMapToTextRange(lineSelMap);
}

function pixelRangeToTextRange(
    downPos: PixelCoord,
    curPos: PixelCoord,
    charSize: CharSize,
    decompilation: Decompilation
): SourceLocation[] {
    const minX = Math.min(downPos.x, curPos.x);
    const minY = Math.min(downPos.y, curPos.y);
    const maxX = Math.max(downPos.x, curPos.x);
    const maxY = Math.max(downPos.y, curPos.y);

    const startLine = Math.floor(minY / charSize.height) + 1;
    const startColumn = Math.floor(minX / charSize.width) + 1;
    const endLine = Math.ceil(maxY / charSize.height) + 1;
    const endColumn = Math.ceil(maxX / charSize.width) + 1;

    const lineSelMap = new Map<number, Set<number>>();
    const markSelection = (line: number, startCol: number, endCol: number, lineRange: SourceLocation) => {
        let set = lineSelMap.get(line);
        if (!set) {
            set = new Set<number>();
            lineSelMap.set(line, set);
        }

        for (let i = startCol; i < endCol && i < lineRange.endColumn; i++) set.add(i);
    };

    if (startLine != endLine) {
        for (let l = startLine; l < endLine; l++) {
            const range = decompilation.lineRanges.get(l);
            if (!range) continue;

            markSelection(
                l,
                l === startLine ? startColumn : range.startColumn,
                l === endLine - 1 ? endColumn : range.endColumn,
                range
            );
        }
    } else {
        const range = decompilation.lineRanges.get(startLine);
        if (range) markSelection(startLine, startColumn, endColumn, range);
    }

    return lineSelectionMapToTextRange(lineSelMap);
}

function getAnnotationLength(annotation: SerializedSourceAnnotation) {
    switch (annotation.type) {
        case SourceAnnotationType.Variable:
            return annotation.variable.name?.length || 0;
        case SourceAnnotationType.DataType:
            return annotation.dataTypeName.length;
        case SourceAnnotationType.Function:
            return annotation.funcName.length;
        case SourceAnnotationType.Keyword:
        case SourceAnnotationType.Literal:
        case SourceAnnotationType.Punctuation:
        case SourceAnnotationType.Comment:
        case SourceAnnotationType.PlainText:
            return annotation.content.length;
        case SourceAnnotationType.Whitespace:
            return annotation.length;
    }
}

type DecompilationProps = {
    decompilation: Decompilation;
};

type CodeLineProps = {
    line: number;
    decompilation: Decompilation;
    annotations: SerializedSourceAnnotation[];
};

const CodeLine: React.FC<CodeLineProps> = ({ line, decompilation, annotations }) => {
    const functions = useFunctions();
    return (
        <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
            {annotations.map((annotation, idx) => {
                switch (annotation.type) {
                    case SourceAnnotationType.Variable:
                        return <span key={idx}>{annotation.variable.name}</span>;
                    case SourceAnnotationType.DataType:
                        return (
                            <span key={idx} style={{ color: 'pink' }}>
                                {annotation.dataTypeName}
                            </span>
                        );
                    case SourceAnnotationType.Function:
                        return (
                            <span
                                key={idx}
                                style={{ color: '#509663', cursor: 'pointer' }}
                                onDoubleClick={() => {
                                    const func = functions.getFunctionById(annotation.funcId);
                                    if (func) Messager.send('gotoAddress', func.address);
                                }}
                            >
                                {annotation.funcName}
                            </span>
                        );
                    case SourceAnnotationType.Keyword:
                        return (
                            <span key={idx} style={{ color: '#6c78b8' }}>
                                {annotation.content}
                            </span>
                        );
                    case SourceAnnotationType.Literal:
                        return (
                            <span key={idx} style={{ color: '#bd2b2b' }}>
                                {annotation.content}
                            </span>
                        );
                    case SourceAnnotationType.Punctuation:
                        return (
                            <span key={idx} style={{ color: '#6e6a5e' }}>
                                {annotation.content}
                            </span>
                        );
                    case SourceAnnotationType.Comment:
                        return (
                            <span key={idx} style={{ color: '#6e6a5e' }}>
                                {annotation.content}
                            </span>
                        );
                    case SourceAnnotationType.Whitespace:
                        if (annotation.length === 0) return null;
                        return <span key={idx}>{'\u00A0'.repeat(annotation.length)}</span>;
                    case SourceAnnotationType.PlainText:
                        return (
                            <span key={idx} style={{ color: '#d5d7e3' }}>
                                {annotation.content}
                            </span>
                        );
                }
            })}
        </div>
    );
};

const CodeView: React.FC<DecompilationProps> = ({ decompilation }) => {
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
                    userSelect: 'none'
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

export const DecompilationView: React.FC = () => {
    const project = useProject();
    const functions = useFunctions();
    const memory = useMemory();
    const [currentFunction, setCurrentFunction] = React.useState<FunctionModel | null>(null);
    const [decompilation, setDecompilation] = React.useState<Decompilation | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey && event.key === 'z') {
                project.undo();
            } else if (event.ctrlKey && event.shiftKey && event.key === 'z') {
                project.redo();
            } else if (event.ctrlKey && event.key === 'o') {
                project.open();
            } else if (event.ctrlKey && event.key === 'n') {
                project.create();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    React.useEffect(() => {
        return Messager.on('selectRows', async range => {
            const func = functions.getFunctionContainingAddress(range.startAddress);
            if (!func) return;

            if (func === currentFunction) return;

            const bytes = await memory.readBytes(func.address, func.endAddress - func.address);
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            const instructions: i.Instruction[] = [];

            for (let i = 0; i < bytes.byteLength; i += 4) {
                const op = view.getUint32(i, true);
                try {
                    const instruction = decode(op, func.address + i);
                    instructions.push(instruction);
                } catch (e) {
                    console.error(
                        `Failed to decode instruction at 0x${(func.address + i).toString(16).padStart(8, '0')}`,
                        e
                    );
                }
            }

            try {
                const decomp = Decompiler.get();
                const cache = new DecompilerCache(functions.getFunctionById(func.id));
                const output = decomp
                    .decompile(instructions, cache, {
                        findFunctionByAddress: (address: number) => {
                            const func = functions.getFunctionContainingAddress(address);
                            if (!func) return null;
                            return functions.getFunctionById(func.id);
                        },
                        findFunctionById: (id: number) => {
                            return functions.getFunctionById(id);
                        }
                    })
                    .serialize();

                setCurrentFunction(func);
                setError(null);
                setDecompilation(new Decompilation(output));
            } catch (e) {
                console.error(`Failed to decompile function ${func.id}`, e);
                if (e instanceof Error) {
                    setCurrentFunction(null);
                    setError(`${e.name}: ${e.message}, ${e.stack}`);
                } else {
                    setCurrentFunction(null);
                    setError(String(e));
                }
            }

            // const decompilation = await Messager.invoke('decompileFunction', func.id);
            // if ('error' in decompilation) {
            //     setCurrentFunction(null);
            //     setError(decompilation.error);
            // } else {
            //     setCurrentFunction(func);
            //     setError(null);
            //     setDecompilation(new Decompilation(decompilation));
            // }
        });
    }, [functions.data.length, currentFunction]);

    return (
        <View style={{ overflowY: 'auto' }}>
            <View.Menu label='File'>
                <View.MenuItem onClick={project.create} tooltip='Ctrl+N'>
                    New Project
                </View.MenuItem>
                <View.MenuItem onClick={project.open} tooltip='Ctrl+O'>
                    Open Project
                </View.MenuItem>
            </View.Menu>
            <View.Menu label='Edit'>
                <View.MenuItem onClick={project.undo} tooltip='Ctrl+Z'>
                    Undo
                </View.MenuItem>
                <View.MenuItem onClick={project.redo} tooltip='Ctrl+Shift+Z'>
                    Redo
                </View.MenuItem>
            </View.Menu>
            <View.Menu label='View'>
                <View.MenuItem onClick={() => project.showView('disassembly')}>Disassembly</View.MenuItem>
                <View.MenuItem onClick={() => project.showView('functions')}>Functions</View.MenuItem>
                <View.MenuItem onClick={() => Messager.send('openDevTools')}>Open DevTools</View.MenuItem>
            </View.Menu>
            <ElfBarrier>
                {error ? (
                    <NoContent title='Error'>
                        <div className='text-red-500'>{error}</div>
                    </NoContent>
                ) : decompilation ? (
                    <CodeView decompilation={decompilation} />
                ) : (
                    <NoContent title='Select a function to decompile' />
                )}
            </ElfBarrier>
        </View>
    );
};
