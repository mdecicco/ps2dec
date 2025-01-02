import { Box } from '@mui/material';
import { useElementHeight } from 'apps/frontend/hooks';
import React, { ForwardedRef, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ScrollBar } from './ScrollBar';

interface RowProps {
    selected: boolean;
    height: number;
    children: React.ReactNode;
    onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseLeave: (isBelow: boolean, e: React.MouseEvent<HTMLDivElement>) => void;
    style?: React.CSSProperties;
}

export const Row: React.FC<RowProps> = props => {
    return (
        <Box
            sx={{
                display: 'flex',
                height: props.height,
                alignItems: 'center',
                userSelect: 'none',
                backgroundColor: props.selected ? 'rgba(200, 200, 255, 0.1) !important' : 'transparent',
                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.01)' },
                ...props.style
            }}
            onMouseEnter={props.onMouseEnter}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                const rect = e.currentTarget.getBoundingClientRect();
                props.onMouseLeave(e.clientY >= rect.bottom, e);
            }}
            onMouseDown={props.onMouseDown}
            onMouseUp={props.onMouseUp}
        >
            {props.children}
        </Box>
    );
};

export type Selection = {
    startRow: number;
    endRow: number;
};

type VirtualScrollProps = {
    rowHeight: number;
    totalRows: number;
    style?: React.CSSProperties;
    selection?: Selection | null;
    renderRows: (startRow: number, rowCount: number) => React.ReactNode[] | Promise<React.ReactNode[]>;
    onSelectionChanged?: (selection: Selection | null) => void;
};

type RowPage = {
    startIndex: number;
    rows: React.ReactNode[];
};

export type VirtualScrollRef = {
    scrollToRow: (row: number) => void;
    isRowInView: (row: number) => boolean;
};

export const VirtualScroll = forwardRef((props: VirtualScrollProps, ref: ForwardedRef<VirtualScrollRef>) => {
    const [scrollPos, setScrollPos] = useState(0);
    const [selectionStart, setSelectionStart] = useState<number | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
    const [pages, setPages] = useState<RowPage[]>([]);
    const [loadingRows, setLoadingRows] = useState(false);
    const loadTimeout = useRef<number | null>(null);
    const box = useElementHeight<HTMLDivElement>();

    const totalHeight = props.totalRows * props.rowHeight + 20;
    const viewSize = box.height;
    const viewSizeInRows = Math.ceil(viewSize / props.rowHeight);
    const startRow = Math.floor(scrollPos / props.rowHeight);
    const selectionDisabled = props.selection === undefined || props.onSelectionChanged === undefined;

    const setScrollPosSafe = (pos: number) => {
        setScrollPos(Math.min(Math.max(0, pos), totalHeight - viewSize));
    };

    const beginSelection = (row: number) => {
        if (selectionDisabled) return;
        setSelectionStart(row);
    };

    const endSelection = (row: number) => {
        if (selectionDisabled) return;
        setSelectionEnd(row);
    };

    const isRowSelected = (row: number) => {
        if (selectionDisabled) return false;

        if (props.selection && row >= props.selection.startRow && row <= props.selection.endRow) {
            return true;
        }

        if (selectionStart !== null && selectionEnd !== null) {
            const beginRow = Math.min(selectionStart, selectionEnd);
            const endRow = Math.max(selectionStart, selectionEnd);

            return row >= beginRow && row <= endRow;
        }

        return false;
    };

    useImperativeHandle(
        ref,
        () => ({
            scrollToRow: (row: number) => {
                setScrollPosSafe(row * props.rowHeight);
            },
            isRowInView: (row: number) => {
                return row >= startRow && row < startRow + viewSizeInRows;
            }
        }),
        [props.rowHeight, totalHeight, viewSize, startRow, viewSizeInRows]
    );

    useEffect(() => {
        if (props.totalRows <= 0) return;

        if (startRow + viewSizeInRows > props.totalRows + 1) {
            const diff = startRow + viewSizeInRows - props.totalRows - 1;
            setScrollPosSafe(scrollPos - diff * props.rowHeight);
        }
    }, [box.height, scrollPos, props.rowHeight, props.totalRows, totalHeight, viewSize]);

    const rowCount = Math.min(viewSizeInRows, props.totalRows - startRow);

    const bufferSize = 16384;

    const pageUnloadCriteria = (page: RowPage) => {
        // false = filtered out
        const pageStart = page.startIndex;
        const pageEnd = pageStart + page.rows.length;
        const unloadDist = bufferSize * 2;

        if (pageEnd < startRow - unloadDist) return false;
        if (pageStart > startRow + rowCount + unloadDist) return false;
        return true;
    };

    useEffect(() => {
        const updatePages = async () => {
            if (loadingRows || viewSizeInRows === 0) return;
            loadTimeout.current = null;

            if (pages.length === 0) {
                setLoadingRows(true);
                const result = await props.renderRows(0, bufferSize * 2);
                setPages([
                    { startIndex: 0, rows: result.slice(0, bufferSize) },
                    { startIndex: bufferSize, rows: result.slice(bufferSize) }
                ]);
                setLoadingRows(false);
                return;
            }

            let minLoadedRow = pages[0].startIndex;
            let maxLoadedRow = pages[pages.length - 1].startIndex + pages[pages.length - 1].rows.length;

            if (maxLoadedRow < startRow - bufferSize || minLoadedRow > startRow + rowCount + bufferSize) {
                // Scrolling really fast
                const loadStart = Math.max(0, startRow - bufferSize);
                const loadCount = Math.min(bufferSize * 2, props.totalRows - loadStart);
                setLoadingRows(true);
                const result = await props.renderRows(loadStart, loadCount);
                setPages([
                    { startIndex: loadStart, rows: result.slice(0, bufferSize) },
                    { startIndex: startRow, rows: result.slice(bufferSize) }
                ]);
                setLoadingRows(false);
                return;
            }

            // If the start row is within bufferSize of the minimum loaded row, load a previous page of results
            if (startRow - bufferSize <= minLoadedRow) {
                const startIndex = Math.max(0, minLoadedRow - bufferSize);
                if (startIndex < minLoadedRow) {
                    setLoadingRows(true);
                    const rows = await props.renderRows(startIndex, bufferSize);
                    const newPages = [{ startIndex, rows }, ...pages.filter(pageUnloadCriteria)];
                    setPages(newPages);
                    setLoadingRows(false);
                    return;
                }
            }

            // If the end row is within bufferSize of the maximum loaded row, load a next page of results
            if (startRow + rowCount + bufferSize >= maxLoadedRow) {
                const startIndex = maxLoadedRow;
                const loadCount = Math.min(bufferSize, props.totalRows - maxLoadedRow);
                if (loadCount > 0) {
                    setLoadingRows(true);
                    const rows = await props.renderRows(startIndex, loadCount);
                    const newPages = [...pages.filter(pageUnloadCriteria), { startIndex, rows }];
                    setPages(newPages);
                    setLoadingRows(false);
                    return;
                }
            }

            const filtered = pages.filter(pageUnloadCriteria);
            if (filtered.length !== pages.length) {
                setPages(filtered);
            }
        };

        if (loadTimeout.current) {
            clearTimeout(loadTimeout.current);
            loadTimeout.current = null;
        }
        loadTimeout.current = setTimeout(updatePages, 20) as unknown as number;
        // updatePages();
        return () => {
            if (loadTimeout.current) clearTimeout(loadTimeout.current);
            loadTimeout.current = null;
        };
    }, [startRow, rowCount, pages, viewSizeInRows, props.totalRows, loadingRows]);

    if (props.totalRows === 0) {
        return (
            <Box
                sx={{
                    ...props.style,
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden'
                }}
            >
                <div>No Data</div>
            </Box>
        );
    }

    const rows: React.ReactNode[] = [];

    // Extract startRow, rowCount rows from pages
    if (pages.length > 0) {
        let lastPageIdx = 0;
        let idx = startRow;

        while (rows.length < rowCount && lastPageIdx < pages.length && idx < props.totalRows) {
            const pageStart = pages[lastPageIdx].startIndex;
            const pageEnd = pageStart + pages[lastPageIdx].rows.length;

            if (idx >= pageStart && idx < pageEnd) {
                rows.push(pages[lastPageIdx].rows[idx - pageStart]);
                idx++;
                continue;
            }

            lastPageIdx++;
        }
    }

    return (
        <Box
            sx={{
                ...props.style,
                display: 'flex',
                flexDirection: 'row',
                overflow: 'hidden'
            }}
        >
            <Box
                ref={box.ref}
                sx={{
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    flexGrow: 1
                }}
                onWheel={e => {
                    setScrollPosSafe(scrollPos + (e.deltaY / 100) * props.rowHeight);
                }}
            >
                {rows.map((row, index) => {
                    const rowIdx = startRow + index;

                    return (
                        <Row
                            key={startRow + index}
                            selected={isRowSelected(rowIdx)}
                            height={props.rowHeight}
                            onMouseEnter={e => {
                                if (selectionStart === null || selectionEnd === null || selectionDisabled) return;

                                if (e.shiftKey) {
                                    // 'painting' the current selection
                                    if (rowIdx > selectionEnd) {
                                        endSelection(rowIdx);
                                    } else if (rowIdx < selectionStart) {
                                        beginSelection(rowIdx);
                                    }
                                } else {
                                    endSelection(rowIdx);
                                }
                            }}
                            onMouseLeave={(isBelow, e) => {
                                if (selectionStart === null || selectionDisabled) return;

                                if (e.shiftKey) {
                                    // 'painting' the current selection, so the mouse leaving the row is irrelevant
                                    return;
                                }

                                if (selectionStart < rowIdx) {
                                    // selection starts above this row
                                    if (isBelow) {
                                        // selection includes this row
                                        endSelection(rowIdx);
                                    } else {
                                        // selection should end one row before this row
                                        endSelection(rowIdx - 1);
                                    }
                                } else if (selectionStart > rowIdx) {
                                    // selection starts below this row
                                    if (!isBelow) {
                                        // selection includes this row
                                        endSelection(rowIdx);
                                    } else {
                                        // selection should end one row after this row
                                        endSelection(rowIdx + 1);
                                    }
                                }
                            }}
                            onMouseDown={e => {
                                if (e.button !== 0 || selectionDisabled) return;
                                if (e.shiftKey && props.selection) {
                                    // extending current selection

                                    const beginRow = Math.min(props.selection.startRow, rowIdx);
                                    const endRow = Math.max(props.selection.endRow, rowIdx);

                                    if (props.onSelectionChanged)
                                        props.onSelectionChanged({ startRow: beginRow, endRow });
                                    beginSelection(beginRow);
                                    endSelection(endRow);
                                } else {
                                    // starting new selection

                                    if (props.onSelectionChanged) props.onSelectionChanged(null);
                                    beginSelection(rowIdx);
                                    endSelection(rowIdx);
                                }
                            }}
                            onMouseUp={e => {
                                if (selectionStart === null || e.button !== 0 || selectionDisabled) return;

                                const beginRow = Math.min(selectionStart, selectionEnd || selectionStart);
                                const endRow = Math.max(selectionStart, selectionEnd || selectionStart);

                                if (props.onSelectionChanged) {
                                    props.onSelectionChanged({ startRow: beginRow, endRow });
                                }

                                setSelectionStart(null);
                                setSelectionEnd(null);
                            }}
                        >
                            {row}
                        </Row>
                    );
                })}
            </Box>
            <ScrollBar
                viewHeight={box.height}
                virtualHeight={totalHeight}
                scrollPos={scrollPos}
                onScrollPosChanged={setScrollPosSafe}
            />
        </Box>
    );
});
