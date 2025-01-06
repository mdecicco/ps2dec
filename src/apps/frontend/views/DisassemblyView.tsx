import { Typography } from '@mui/material';
import React from 'react';

import { useAnnotations, useProject } from 'apps/frontend/hooks';
import Messager from 'apps/frontend/message';
import { View } from 'apps/frontend/views/View';

import { ElfBarrier, VirtualScroll, VirtualScrollRef } from 'apps/frontend/components';
import { ClickAction } from 'packages/types';

export const DisassemblyView: React.FC = () => {
    const project = useProject();
    const { totalRows, getRowAtAddress, getRowInfo, renderRows } = useAnnotations();
    const [selectedRange, setSelectedRange] = React.useState<{
        startRow: number;
        startAddress: number;
        endRow: number;
        endAddress: number;
    } | null>(null);
    const [gotoStack, setGotoStack] = React.useState<number[]>([]);
    const [gotoStackIndex, setGotoStackIndex] = React.useState(0);
    const virtualScrollRef = React.useRef<VirtualScrollRef>(null);

    const [didGo, setDidGo] = React.useState(false);
    React.useEffect(() => {
        if (totalRows > 0 && !didGo) {
            setDidGo(true);
            Messager.send('gotoAddress', 0x00101480);
        }
    }, [totalRows, didGo]);

    const gotoAddress = React.useCallback(
        async (address: number, pushToStack: boolean) => {
            if (!virtualScrollRef.current) return;

            const row = await getRowAtAddress(address);
            if (row === -1) return;

            if (pushToStack) {
                const newStack = [...gotoStack.slice(0, gotoStackIndex + 1), address];
                setGotoStack(newStack);
                setGotoStackIndex(newStack.length - 1);
            }

            virtualScrollRef.current.scrollToRow(row);
        },
        [gotoStack.length, gotoStackIndex]
    );

    const gotoPrevious = React.useCallback(() => {
        if (gotoStack.length === 0 || gotoStackIndex <= 0) return;

        const address = gotoStack[gotoStackIndex - 1];
        setGotoStackIndex(gotoStackIndex - 1);
        gotoAddress(address, false);
    }, [gotoStack.length, gotoStackIndex]);

    const gotoNext = React.useCallback(() => {
        if (gotoStack.length === 0 || gotoStackIndex >= gotoStack.length - 1) return;

        const address = gotoStack[gotoStackIndex + 1];
        setGotoStackIndex(gotoStackIndex + 1);
        gotoAddress(address, false);
    }, [gotoStack.length, gotoStackIndex]);

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
        const onNavigate = (event: MouseEvent) => {
            if (event.button === 3) {
                gotoPrevious();
            } else if (event.button === 4) {
                gotoNext();
            }
        };

        window.addEventListener('mousedown', onNavigate);
        return () => window.removeEventListener('mousedown', onNavigate);
    }, [gotoPrevious, gotoNext, gotoStack.length, gotoStackIndex]);

    React.useEffect(() => {
        const unsub0 = Messager.on('selectRows', setSelectedRange);

        const unsub1 = Messager.on('gotoAddress', async address => {
            const row = await getRowAtAddress(address);
            if (row === -1) return;

            if (!virtualScrollRef.current || !virtualScrollRef.current.isRowInView(row)) {
                gotoAddress(address, true);
            }

            const rowInfo = await getRowInfo(row);
            if (!rowInfo) return;

            Messager.send('selectRows', {
                startRow: row,
                startAddress: address,
                endRow: row,
                endAddress: rowInfo.address + rowInfo.size
            });
        });

        return () => {
            unsub0();
            unsub1();
        };
    }, [gotoStack.length, gotoStackIndex]);

    const clickAction = (action: ClickAction) => {
        if (action.type === 'gotoAddress') {
            gotoAddress(action.address, true);
        }
    };

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
                <View.MenuItem onClick={() => project.showView('functions')}>Functions</View.MenuItem>
                <View.MenuItem onClick={() => project.showView('decompilation')}>Decompilation</View.MenuItem>
                <View.MenuItem onClick={() => Messager.send('openDevTools')}>Open DevTools</View.MenuItem>
            </View.Menu>
            <ElfBarrier>
                <VirtualScroll
                    ref={virtualScrollRef}
                    rowHeight={20}
                    totalRows={totalRows}
                    selection={selectedRange}
                    onSelectionChanged={async selection => {
                        if (!selection) return setSelectedRange(null);

                        const beginInfo = await getRowInfo(selection.startRow);
                        const endInfo = await getRowInfo(selection.endRow);
                        if (!beginInfo || !endInfo) return;

                        Messager.send('selectRows', {
                            startRow: selection.startRow,
                            startAddress: beginInfo.address,
                            endRow: selection.endRow,
                            endAddress: endInfo.address + endInfo.size
                        });
                    }}
                    renderRows={async (startRow, rowCount) => {
                        const elements: React.ReactNode[] = [];
                        const rows = await renderRows(startRow, rowCount);

                        rows.forEach((row, idx) => {
                            elements.push(
                                <Typography
                                    key={idx + startRow}
                                    sx={{
                                        fontFamily: 'Courier New',
                                        color: 'white',
                                        whiteSpace: 'pre'
                                    }}
                                >
                                    {row.segments.map((s, sidx) => (
                                        <span
                                            key={idx + startRow + sidx}
                                            style={{
                                                display: 'inline-block',
                                                cursor: s.clickAction ? 'pointer' : 'default',
                                                ...s.style
                                            }}
                                            onDoubleClick={
                                                s.clickAction ? () => clickAction(s.clickAction!) : undefined
                                            }
                                        >
                                            {s.content}
                                        </span>
                                    ))}
                                </Typography>
                            );
                        });

                        return elements;
                    }}
                    style={{ height: '100%', width: '100%' }}
                />
            </ElfBarrier>
        </View>
    );
};
