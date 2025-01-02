import { Typography } from '@mui/material';
import { CenteredContent } from 'apps/frontend/components/CenteredContent';
import * as React from 'react';

type NoContentProps = {
    title: string;
    children?: React.ReactNode;
};

export const NoContent: React.FC<NoContentProps> = ({ title, children }) => {
    return (
        <CenteredContent>
            <Typography variant='h6' color='text.secondary'>
                {title}
            </Typography>
            {children}
        </CenteredContent>
    );
};
