import Messager from 'apps/frontend/message';
import { AnnotationModel } from 'packages/types';
import { useEffect, useState } from 'react';

export function useAnnotations() {
    const [totalRows, setTotalRows] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const unsub = Messager.on('setTotalRows', (totalRows: number) => {
            setTotalRows(totalRows);
        });

        if (!loading && totalRows === 0) {
            setLoading(true);
            Messager.invoke('getTotalRows').then(count => {
                setTotalRows(count);
                setLoading(false);
            });
        }

        return () => unsub();
    }, []);

    return {
        totalRows,
        getAddressAtRow: (row: number) => {
            return Messager.invoke('getAddressAtRow', row);
        },
        getRowAtAddress: (address: number) => {
            return Messager.invoke('getRowAtAddress', address);
        },
        getAnnotations: (address: number) => {
            return Messager.invoke('getAnnotations', address);
        },
        getRowInfo: (row: number) => {
            return Messager.invoke('getRowInfo', row);
        },
        setRowInfo: (row: number, info: { address: number; size: number }) => {
            Messager.send('setRowInfo', { row, ...info });
        },
        getRowCount: (annotation: AnnotationModel) => {
            return Messager.invoke('getRowCount', annotation);
        },
        getConsumedSize: (annotation: AnnotationModel) => {
            return Messager.invoke('getConsumedSize', annotation);
        },
        renderAnnotation: (annotation: AnnotationModel) => {
            return Messager.invoke('renderAnnotation', annotation);
        },
        renderRows: (startRow: number, rowCount: number) => {
            return Messager.invoke('renderRows', { startRow, rowCount });
        }
    };
}
