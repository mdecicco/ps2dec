import Messager from 'apps/frontend/message';
import { MemoryRegionModel } from 'packages/types';
import React from 'react';

export function useMemory() {
    const [loading, setLoading] = React.useState(false);
    const [memoryRegions, setMemoryRegions] = React.useState<MemoryRegionModel[]>([]);
    const loadElf = () => {
        Messager.send('promptLoadElf');
    };

    const loadMemoryRegions = async () => {
        setLoading(true);
        const regions = await Messager.invoke('getMemoryRegions');
        setMemoryRegions(regions);
        setLoading(false);
    };

    React.useEffect(() => {
        const unbind: (() => void)[] = [
            Messager.on('setMemoryRegions', data => {
                setMemoryRegions(data.regions);
                setLoading(false);
            }),
            Messager.on('memoryRegionAdded', region => {
                setMemoryRegions([...memoryRegions, region]);
            }),
            Messager.on('memoryRegionRemoved', data => {
                setMemoryRegions(memoryRegions.filter(region => region.id !== data.id));
            })
        ];

        if (!loading) loadMemoryRegions();

        return () => {
            unbind.forEach(fn => fn());
        };
    }, []);

    return {
        memoryRegions,
        loading,
        loadElf
    };
}
