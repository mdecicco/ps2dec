import 'reflect-metadata';

import { app, BrowserWindow } from 'electron';
import path from 'path';

import Messager from 'apps/backend/message';

import { bindActionEvents } from 'apps/backend/actions/bind';
import { ProjectManager } from 'apps/backend/project';

import { MainActionService } from 'apps/backend/services/ActionService';

let mainWindow: BrowserWindow | null = null;

app.once('ready', () => {
    Messager.initialize();
    MainActionService.initialize();
    bindActionEvents();
    ProjectManager.get();

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        title: 'ps2dec',
        autoHideMenuBar: true
    });
    mainWindow = win;

    Messager.on('getViewId', win, () => {
        Messager.send('setViewId', win, 'welcome');
    });

    if (process.env.NODE_ENV === 'development') {
        win.loadURL('http://localhost:5173').catch(e => console.error(e));
        // win.webContents.openDevTools();
    } else {
        const rendererHtmlPath = path.join(__dirname, '../frontend/index.html');
        win.loadFile(rendererHtmlPath).catch(e => console.error(e));
    }
});

app.on('window-all-closed', async () => {
    if (process.platform !== 'darwin') {
        await ProjectManager.get().shutdown();
        await MainActionService.shutdown();
        app.quit();
    }
});

export function getMainWindow(): BrowserWindow | null {
    return mainWindow;
}
