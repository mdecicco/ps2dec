import { CircularProgress, CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import React from 'react';

import { CenteredContent, NoContent } from 'apps/frontend/components';
import { AppProvider } from 'apps/frontend/context';
import { useProject } from 'apps/frontend/hooks/useProject';
import Messager from 'apps/frontend/message';
import { darkTheme } from 'apps/frontend/theme';
import { DecompilationView } from 'apps/frontend/views/DecompilationView';
import { DisassemblyView } from 'apps/frontend/views/DisassemblyView';
import { FunctionView } from 'apps/frontend/views/FunctionView';
import { WelcomeView } from 'apps/frontend/views/WelcomeView';
import { ViewId } from 'packages/types';

type TopLevelProps = {
    viewId: ViewId;
};

const TopLevel: React.FC<TopLevelProps> = props => {
    switch (props.viewId) {
        case 'welcome':
            return <WelcomeView />;
        case 'disassembly':
            return <DisassemblyView />;
        case 'decompilation':
            return <DecompilationView />;
        case 'functions':
            return <FunctionView />;
    }
};

const App: React.FC = () => {
    const project = useProject();
    const [view, setView] = React.useState<ViewId | null>(null);
    React.useEffect(() => {
        const unbind = Messager.on('setViewId', (viewId: ViewId) => {
            setView(viewId);
        });

        Messager.send('getViewId');

        return () => {
            unbind();
        };
    }, []);

    if (!view) {
        return (
            <AppProvider>
                <ThemeProvider theme={darkTheme}>
                    <CssBaseline />
                    <GlobalStyles styles={{ body: { backgroundColor: '#1e1e1e' } }} />
                    <CenteredContent>
                        <CircularProgress />
                    </CenteredContent>
                </ThemeProvider>
            </AppProvider>
        );
    }

    if (!project.path && view !== 'welcome') {
        return (
            <AppProvider>
                <ThemeProvider theme={darkTheme}>
                    <CssBaseline />
                    <GlobalStyles styles={{ body: { backgroundColor: '#1e1e1e' } }} />
                    <NoContent title='No Project Loaded' />
                </ThemeProvider>
            </AppProvider>
        );
    }

    return (
        <AppProvider>
            <ThemeProvider theme={darkTheme}>
                <CssBaseline />
                <GlobalStyles styles={{ body: { backgroundColor: '#1e1e1e' } }} />
                <TopLevel viewId={view} />
            </ThemeProvider>
        </AppProvider>
    );
};

export default App;
