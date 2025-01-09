import App from 'apps/frontend/App';
import Messager from 'apps/frontend/message';
import { Decompiler } from 'decompiler';
import React from 'react';
import { createRoot } from 'react-dom/client';

Messager.initialize();

Decompiler.initialize({
    findFunctionByAddress: (address: number) => {
        throw new Error('Not initialized');
    },
    findFunctionById: (id: number) => {
        throw new Error('Not initialized');
    },
    getInstructionAtAddress: (address: number) => {
        throw new Error('Not initialized');
    },
    getCacheForFunctionId: (id: number) => null
});

const container = document.getElementById('root');
if (!container) {
    throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(React.createElement(React.StrictMode, undefined, React.createElement(App)));
