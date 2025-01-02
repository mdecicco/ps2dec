import { Box, Button, List, ListItem, Typography } from '@mui/material';
import React from 'react';

import Messager from 'apps/frontend/message';
import { View } from 'apps/frontend/views/View';
import { useProject, useRecentProjects } from '../hooks/useProject';

export const WelcomeView: React.FC = () => {
    const project = useProject();
    const recentProjects = useRecentProjects();

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
                <View.MenuItem onClick={() => project.showView('disassembly')}>Disassembly</View.MenuItem>
                <View.MenuItem onClick={() => project.showView('functions')}>Functions</View.MenuItem>
                <View.MenuItem onClick={() => project.showView('decompilation')}>Decompilation</View.MenuItem>
                <View.MenuItem onClick={() => Messager.send('openDevTools')}>Open DevTools</View.MenuItem>
            </View.Menu>
            <Box
                sx={{
                    alignSelf: 'center',
                    justifySelf: 'center'
                }}
            >
                <Box display='flex' gap={2}>
                    <Button variant='outlined' onClick={project.create}>
                        Create New Project
                    </Button>
                    <Button variant='outlined' onClick={() => project.open()}>
                        Open Project
                    </Button>
                </Box>
                {recentProjects.length > 0 && (
                    <>
                        <Typography variant='h6' gutterBottom color='text.primary' mt={4}>
                            Recent Projects
                        </Typography>
                        <List>
                            {recentProjects.map((p, index) => (
                                <ListItem key={index} sx={{ py: 0.3 }}>
                                    <Button variant='text' onClick={() => project.open(p)}>
                                        <Typography textTransform='none' color='text.secondary'>
                                            {p}
                                        </Typography>
                                    </Button>
                                </ListItem>
                            ))}
                        </List>
                    </>
                )}
            </Box>
        </View>
    );
};
