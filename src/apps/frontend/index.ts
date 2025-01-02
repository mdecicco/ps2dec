import App from 'apps/frontend/App';
import Messager from 'apps/frontend/message';
import React from 'react';
import { createRoot } from 'react-dom/client';

Messager.initialize();

const container = document.getElementById('root');
if (!container) {
    throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(React.createElement(React.StrictMode, undefined, React.createElement(App)));
