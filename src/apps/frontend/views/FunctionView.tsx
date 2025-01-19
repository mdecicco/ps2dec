import React from 'react';

import { Typography } from '@mui/material';
import { LoadBarrier, Selection, VirtualScroll } from 'apps/frontend/components';
import { useFunctions } from 'apps/frontend/hooks/useFunctions';
import Messager from 'apps/frontend/message';
import { View } from 'apps/frontend/views/View';
import { useProject } from '../hooks/useProject';

export const FunctionView: React.FC = () => {
    const project = useProject();
    const functions = useFunctions();
    const [selection, setSelection] = React.useState<Selection | null>(null);

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
                <View.MenuItem onClick={() => project.showView('decompilation')}>Decompilation</View.MenuItem>
                <View.MenuItem onClick={() => project.showView('control-flow')}>Control Flow</View.MenuItem>
                <View.MenuItem onClick={() => Messager.send('openDevTools')}>Open DevTools</View.MenuItem>
            </View.Menu>
            <LoadBarrier isLoading={functions.loading} isLoaded={functions.data.length > 0} message='No Functions'>
                <VirtualScroll
                    rowHeight={20}
                    totalRows={functions.data.length}
                    selection={selection}
                    onSelectionChanged={selected => {
                        setSelection(selected);
                    }}
                    renderRows={async (startRow, rowCount) => {
                        const elements: React.ReactNode[] = [];

                        for (let i = startRow; i < startRow + rowCount; i++) {
                            if (i >= functions.data.length) break;
                            const func = functions.data[i];
                            elements.push(
                                <Typography
                                    key={func.id}
                                    sx={{
                                        fontFamily: 'Courier New',
                                        color: 'white',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => {
                                        Messager.send('gotoAddress', func.address);
                                    }}
                                >
                                    {func.name}
                                </Typography>
                            );
                        }

                        return elements;
                    }}
                    style={{ height: '100%', width: '100%' }}
                />
            </LoadBarrier>
        </View>
    );
};
