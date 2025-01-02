import { Button, CircularProgress } from '@mui/material';
import { CenteredContent } from 'apps/frontend/components/CenteredContent';
import * as React from 'react';
import { NoContent } from './NoContent';

type LoadBarrierProps = {
    isLoading: boolean;
    isLoaded?: boolean;
    message?: string;
    loadAction?: () => void;
    loadActionText?: string;
    children?: React.ReactNode;
};

export const LoadBarrier: React.FC<LoadBarrierProps> = ({
    isLoading,
    isLoaded,
    message,
    loadAction,
    loadActionText,
    children
}) => {
    if (isLoading) {
        return (
            <CenteredContent>
                <CircularProgress size={24} />
            </CenteredContent>
        );
    }

    if (isLoaded === false) {
        return (
            <NoContent title={message || 'No Data'}>
                {loadAction && (
                    <Button variant='outlined' onClick={loadAction}>
                        {loadActionText || 'Load Data'}
                    </Button>
                )}
            </NoContent>
        );
    }

    return <>{children}</>;
};
