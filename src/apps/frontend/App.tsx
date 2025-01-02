import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import React from 'react';

import { useProject } from 'apps/frontend/hooks/useProject';
import Messager from 'apps/frontend/message';
import { darkTheme } from 'apps/frontend/theme';
import { DecompilationView } from 'apps/frontend/views/DecompilationView';
import { DisassemblyView } from 'apps/frontend/views/DisassemblyView';
import { FunctionView } from 'apps/frontend/views/FunctionView';
import { WelcomeView } from 'apps/frontend/views/WelcomeView';
import { ViewId } from 'packages/types';

const App: React.FC = () => {
    const [view, setView] = React.useState<ViewId | null>(null);
    const project = useProject();

    React.useEffect(() => {
        const unbind = Messager.on('setViewId', (viewId: ViewId) => {
            setView(viewId);
        });

        Messager.send('getViewId');

        return () => {
            unbind();
        };
    }, []);

    if (!project.path && view !== 'welcome') {
        return (
            <ThemeProvider theme={darkTheme}>
                <CssBaseline />
                <GlobalStyles styles={{ body: { backgroundColor: '#1e1e1e' } }} />
            </ThemeProvider>
        );
    }

    switch (view) {
        case 'welcome':
            return (
                <ThemeProvider theme={darkTheme}>
                    <CssBaseline />
                    <GlobalStyles styles={{ body: { backgroundColor: '#1e1e1e' } }} />
                    <WelcomeView />
                </ThemeProvider>
            );
        case 'disassembly':
            return (
                <ThemeProvider theme={darkTheme}>
                    <CssBaseline />
                    <GlobalStyles styles={{ body: { backgroundColor: '#1e1e1e' } }} />
                    <DisassemblyView />
                </ThemeProvider>
            );
        case 'decompilation':
            return (
                <ThemeProvider theme={darkTheme}>
                    <CssBaseline />
                    <GlobalStyles styles={{ body: { backgroundColor: '#1e1e1e' } }} />
                    <DecompilationView />
                </ThemeProvider>
            );
        case 'functions':
            return (
                <ThemeProvider theme={darkTheme}>
                    <CssBaseline />
                    <GlobalStyles styles={{ body: { backgroundColor: '#1e1e1e' } }} />
                    <FunctionView />
                </ThemeProvider>
            );
        default:
            return (
                <ThemeProvider theme={darkTheme}>
                    <CssBaseline />
                    <GlobalStyles styles={{ body: { backgroundColor: '#1e1e1e' } }} />
                </ThemeProvider>
            );
    }
};

export default App;
