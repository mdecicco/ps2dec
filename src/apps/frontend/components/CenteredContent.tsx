import { Box } from '@mui/material';
import * as React from 'react';

type CenteredContentProps = {
    children?: React.ReactNode;
};

export const CenteredContent: React.FC<CenteredContentProps> = ({ children }) => {
    return (
        <Box
            display='flex'
            flexDirection='column'
            alignItems='center'
            justifyContent='center'
            alignSelf='center'
            justifySelf='center'
        >
            {children}
        </Box>
    );
};
