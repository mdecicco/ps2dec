import React from 'react';

import { Box } from '@mui/material';
import { ElfBarrier, NoContent } from 'apps/frontend/components';
import { useFunctions } from 'apps/frontend/hooks/useFunctions';
import Messager from 'apps/frontend/message';
import { View } from 'apps/frontend/views/View';
import { Decompilation, SerializedSourceAnnotation, SourceAnnotationType } from 'decompiler';
import { useProject } from '../hooks/useProject';

type DecompilationProps = {
    decompilation: Decompilation;
};

type CodeLineProps = {
    line: number;
    decompilation: Decompilation;
    annotations: SerializedSourceAnnotation[];
};

const CodeLine: React.FC<CodeLineProps> = ({ line, decompilation, annotations }) => {
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
                            <span key={idx} style={{ color: '#509663' }}>
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
                        return <span key={idx}>{annotation.content}</span>;
                    case SourceAnnotationType.Whitespace:
                        return (
                            <div key={idx} style={{ display: 'block' }}>
                                {'\u00A0'.repeat(annotation.length)}
                            </div>
                        );
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
    return (
        <Box
            sx={{
                fontFamily: 'Courier New',
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
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {Array.from({ length: decompilation.lineCount }, (_, i) => (
                    <CodeLine
                        key={i}
                        line={i + 1}
                        decompilation={decompilation}
                        annotations={decompilation.getLineAnnotations(i + 1)}
                    />
                ))}
            </Box>
        </Box>
    );
};

export const DecompilationView: React.FC = () => {
    const project = useProject();
    const functions = useFunctions();
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

            const decompilation = await Messager.invoke('decompileFunction', func.id);
            if ('error' in decompilation) {
                setError(decompilation.error);
            } else {
                setError(null);
                setDecompilation(new Decompilation(decompilation));
            }
        });
    }, [functions.data.length]);

    return (
        <View>
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
