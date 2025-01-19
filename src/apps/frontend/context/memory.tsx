import { useProject } from 'apps/frontend/hooks';
import Messager from 'apps/frontend/message';
import { decode, i } from 'decoder';
import { Decompiler } from 'decompiler';
import React from 'react';
import { MemoryRegionModel } from 'types';
import { formatAddress } from 'utils';

interface MemContextType {
    regions: MemoryRegionModel[];
    loadingRegions: boolean;
    read8: (address: number) => number;
    read16: (address: number) => number;
    read32: (address: number) => number;
    getInstructionAtAddress: (address: number) => i.Instruction | null;
}

export const MemContext = React.createContext<MemContextType>({
    regions: [],
    loadingRegions: false,
    read8: () => 0,
    read16: () => 0,
    read32: () => 0,
    getInstructionAtAddress: () => null
});

export const MemoryProvider: React.FC<{ children?: React.ReactNode; withData: boolean }> = props => {
    const project = useProject();
    const [regions, setRegions] = React.useState<MemoryRegionModel[]>([]);
    const [loadingRegions, setLoadingRegions] = React.useState(false);
    const [didLoad, setDidLoad] = React.useState(false);
    const [loadingData, setLoadingData] = React.useState(false);
    const regionDataMap = React.useRef<Map<number, Uint8Array>>(new Map());
    const regionViewMap = React.useRef<Map<number, DataView>>(new Map());
    const instructionMap = React.useRef<Map<number, i.Instruction | null>>(new Map());

    const handleRegionsAdded = async (regions: MemoryRegionModel[]) => {
        if (!props.withData) return;

        setLoadingData(true);

        for (const region of regions) {
            if (region.start === 0 || region.size === 0) continue;

            let bytes: Uint8Array;
            try {
                bytes = await Messager.invoke('readBytes', { address: region.start, count: region.size });
            } catch (e) {
                console.error(e);
                bytes = new Uint8Array(region.size);
            }

            regionDataMap.current.set(region.id, bytes);
            regionViewMap.current.set(region.id, new DataView(bytes.buffer));
        }

        setLoadingData(false);
    };

    const handleRegionRemoved = (id: number) => {
        if (!props.withData) return;

        regionDataMap.current.delete(id);
        regionViewMap.current.delete(id);
    };

    React.useEffect(() => {
        if (didLoad || !project.path || regions.length > 0) return;
        const loadRegions = async () => {
            setLoadingRegions(true);
            const loadedRegions = await Messager.invoke('getMemoryRegions');
            setRegions(loadedRegions);
            handleRegionsAdded(loadedRegions);
            setLoadingRegions(false);
            setDidLoad(true);
        };

        loadRegions();
    }, [project.path, loadingRegions, didLoad, regions]);

    const getRegionForAddress = (address: number) => {
        const region = regions.find(region => address >= region.start && address < region.end);
        if (!region) return null;

        if (region.start === 0 || region.size === 0) return null;

        return region;
    };

    const read8 = (address: number) => {
        const region = getRegionForAddress(address);
        if (!region) return 0;

        const view = regionViewMap.current.get(region.id);
        if (!view) return 0;

        try {
            return view.getUint8(address - region.start);
        } catch (e) {
            console.error(`Failed to read u8 at ${formatAddress(address)}`);
        }

        return 0;
    };

    const read16 = (address: number) => {
        const region = getRegionForAddress(address);
        if (!region) return 0;

        const view = regionViewMap.current.get(region.id);
        if (!view) return 0;

        try {
            return view.getUint16(address - region.start, true);
        } catch (e) {
            console.error(`Failed to read u16 at ${formatAddress(address)}`);
        }

        return 0;
    };

    const read32 = (address: number) => {
        const region = getRegionForAddress(address);
        if (!region) return 0;

        const view = regionViewMap.current.get(region.id);
        if (!view) return 0;

        try {
            return view.getUint32(address - region.start, true);
        } catch (e) {
            console.error(`Failed to read u32 at ${formatAddress(address)}`);
        }

        return 0;
    };

    const getInstructionAtAddress = (address: number) => {
        const existing = instructionMap.current.get(address);
        if (existing) return existing;

        const op = read32(address);

        try {
            const instruction = decode(op, address);
            instructionMap.current.set(address, instruction);
            return instruction;
        } catch (e) {
            console.error(`Failed to decode instruction at ${formatAddress(address)}`);
            instructionMap.current.set(address, null);
        }

        return null;
    };

    React.useEffect(() => {
        const listeners: (() => void)[] = [];

        listeners.push(
            Messager.on('setMemoryRegions', data => {
                setRegions(data.regions);
                handleRegionsAdded(data.regions);
                setLoadingRegions(false);
            })
        );

        listeners.push(
            Messager.on('memoryRegionAdded', region => {
                setRegions([...regions, region]);
                handleRegionsAdded([region]);
            })
        );

        listeners.push(
            Messager.on('memoryRegionRemoved', data => {
                setRegions(regions.filter(region => region.id !== data.id));
                handleRegionRemoved(data.id);
            })
        );

        Decompiler.dataSource.getInstructionAtAddress = (address: number) => {
            const existing = instructionMap.current.get(address);
            if (existing) return existing;

            return getInstructionAtAddress(address);
        };

        return () => {
            listeners.forEach(l => l());
        };
    }, [regions]);

    return (
        <MemContext.Provider
            value={{
                regions,
                loadingRegions: loadingRegions || loadingData,
                read8,
                read16,
                read32,
                getInstructionAtAddress
            }}
        >
            {props.children}
        </MemContext.Provider>
    );
};
