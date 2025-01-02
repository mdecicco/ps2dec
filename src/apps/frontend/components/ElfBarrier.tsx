import { Button, CircularProgress } from '@mui/material';
import { CenteredContent } from 'apps/frontend/components/CenteredContent';
import { LoadBarrier } from 'apps/frontend/components/LoadBarrier';
import { useMemory } from 'apps/frontend/hooks';
import * as React from 'react';
import { NoContent } from './NoContent';

type ElfBarrierProps = {
    children?: React.ReactNode;
};

export const ElfBarrier: React.FC<ElfBarrierProps> = ({ children }) => {
    const memory = useMemory();

    if (memory.loading) {
        return (
            <CenteredContent>
                <CircularProgress size={24} />
            </CenteredContent>
        );
    }

    if (memory.memoryRegions.length === 0) {
        return (
            <NoContent title='No ELF file loaded'>
                <Button variant='outlined' onClick={memory.loadElf}>
                    Load ELF
                </Button>
            </NoContent>
        );
    }

    return (
        <LoadBarrier
            isLoading={memory.loading}
            isLoaded={memory.memoryRegions.length > 0}
            message='No ELF file loaded'
            loadAction={memory.loadElf}
            loadActionText='Load ELF'
        >
            {children}
        </LoadBarrier>
    );
};
