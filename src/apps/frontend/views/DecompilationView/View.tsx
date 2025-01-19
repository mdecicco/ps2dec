import React from 'react';

import { CodeBuilder, Decompiler } from 'decompiler';
import { FunctionModel } from 'types';

import { ElfBarrier, LoadBarrier, NoContent } from 'apps/frontend/components';
import { useMemory } from 'apps/frontend/hooks';
import { useFunctions } from 'apps/frontend/hooks/useFunctions';
import { useProject } from 'apps/frontend/hooks/useProject';
import Messager from 'apps/frontend/message';
import { View } from 'apps/frontend/views/View';

import { CodeView } from './CodeView';

export const DecompilationView: React.FC = () => {
    const project = useProject();
    const functions = useFunctions();
    const memory = useMemory();
    const [currentFunction, setCurrentFunction] = React.useState<FunctionModel | null>(null);
    const [decompilation, setDecompilation] = React.useState<CodeBuilder | null>(null);
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

            try {
                const output = Decompiler.decompile(func.id);

                setCurrentFunction(func);
                setError(null);
                setDecompilation(output);

                // console.log(output.code);
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
                <View.MenuItem onClick={() => project.showView('control-flow')}>Control Flow</View.MenuItem>
                <View.MenuItem onClick={() => Messager.send('openDevTools')}>Open DevTools</View.MenuItem>
            </View.Menu>
            <ElfBarrier>
                <LoadBarrier isLoading={memory.loading}>
                    {error ? (
                        <NoContent title='Error'>
                            <div className='text-red-500'>{error}</div>
                        </NoContent>
                    ) : decompilation ? (
                        <CodeView decompilation={decompilation} />
                    ) : (
                        <NoContent title='Select a function to decompile' />
                    )}
                </LoadBarrier>
            </ElfBarrier>
        </View>
    );
};
