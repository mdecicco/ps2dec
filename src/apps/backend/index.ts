import { app, BrowserWindow } from 'electron';
import path from 'path';
import { register } from 'tsconfig-paths';

// Register path aliases for the compiled output
register({
    baseUrl: path.join(__dirname, '../..'),
    paths: {
        decompiler: ['packages/decompiler'],
        decoder: ['packages/decoder'],
        utils: ['packages/utils']
    }
});

app.once('ready', () => {
    console.log('App is ready');

    const win = new BrowserWindow({
        width: 600,
        height: 400,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    if (process.env.NODE_ENV === 'development') {
        // In development, load from Vite dev server
        win.loadURL('http://localhost:5173').catch(e => console.error(e));

        // Open DevTools automatically in development
        win.webContents.openDevTools();
    } else {
        // In production, load the built file
        const rendererHtmlPath = path.join(__dirname, '../frontend/index.html');
        win.loadFile(rendererHtmlPath).catch(e => console.error(e));
    }
});
