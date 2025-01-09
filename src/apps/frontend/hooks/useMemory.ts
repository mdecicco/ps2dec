import { MemContext } from 'apps/frontend/context';
import Messager from 'apps/frontend/message';
import React from 'react';

export function useMemory() {
    const memory = React.useContext(MemContext);
    const loadElf = () => {
        Messager.send('promptLoadElf');
    };

    return {
        memoryRegions: memory.regions,
        loading: memory.loadingRegions,
        loadElf,
        read8: memory.read8,
        read16: memory.read16,
        read32: memory.read32,
        getInstructionAtAddress: memory.getInstructionAtAddress
    };
}
