import { BrowserWindow, dialog, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { ViewId } from 'types';

import { createDatabase } from 'apps/backend/db';
import { WindowEntity } from 'apps/backend/entities';
import Messager from 'apps/backend/message';
import { MainActionService } from 'apps/backend/services/ActionService';
import { AnnotationService } from 'apps/backend/services/AnnotationService';
import { DataTypeService } from 'apps/backend/services/DataTypeService';
import { DecompilerService } from 'apps/backend/services/DecompilerService';
import { FunctionService } from 'apps/backend/services/FunctionService';
import { MemoryService } from 'apps/backend/services/MemoryService';
import storage from 'apps/backend/storage';

export class ProjectManager {
    private static instance: ProjectManager | null = null;
    private m_windows: Map<ViewId, BrowserWindow>;
    private m_database: DataSource | null;
    private m_projectPath: string | null;

    constructor() {
        this.m_windows = new Map();
        this.m_database = null;
        this.m_projectPath = null;

        Messager.on('getRecentProjects', sender => {
            const paths: string[] = [];
            storage.get('recentProjects').forEach(p => {
                if (!fs.existsSync(p)) return;
                paths.push(p);
            });
            storage.set('recentProjects', paths);
            Messager.send('setRecentProjects', sender, { projectPaths: paths });
        });

        Messager.on('showWindow', (viewId: ViewId) => {
            this.spawnWindow(viewId);
        });

        Messager.on('getProject', () => {
            Messager.send('setProject', { path: this.m_projectPath });
        });

        Messager.on('openProject', async (projectPath: string | null) => {
            if (projectPath) {
                this.openProject(projectPath);
            } else {
                const result = await dialog.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'ps2dec Project', extensions: ['ps2proj'] }]
                });

                if (!result.canceled && result.filePaths[0]) {
                    this.openProject(result.filePaths[0]);
                    return;
                }

                Messager.send('projectLoadCancelled');
            }
        });

        Messager.on('createProject', async () => {
            const result = await dialog.showSaveDialog({
                filters: [{ name: 'ps2dec Project', extensions: ['ps2proj'] }]
            });

            if (!result.canceled && result.filePath) {
                this.createProject(result.filePath);
                return;
            }

            Messager.send('projectLoadCancelled');
        });
    }

    public static get(): ProjectManager {
        if (!ProjectManager.instance) {
            ProjectManager.instance = new ProjectManager();
        }

        return ProjectManager.instance;
    }

    public shutdown() {
        this.m_database?.close();
        this.m_database = null;
        ProjectManager.instance = null;
    }

    public get windows(): BrowserWindow[] {
        return Array.from(this.m_windows.values());
    }

    public get database() {
        return this.m_database;
    }

    public get projectPath(): string | null {
        return this.m_projectPath;
    }

    public hasActiveProject(): boolean {
        return this.m_database !== null;
    }

    public static async promptCreateProject() {
        const result = await dialog.showSaveDialog({
            filters: [{ name: 'PS2 Analyzer Project', extensions: ['ps2proj'] }]
        });

        if (!result.canceled && result.filePath) {
            return ProjectManager.get().createProject(result.filePath);
        }

        return { success: false, error: 'No file selected' };
    }

    public async spawnWindow(viewId: ViewId) {
        const existingWindow = this.m_windows.get(viewId);
        if (existingWindow) {
            existingWindow.focus();
            return;
        }

        if (!this.m_database) return;
        const windowRepository = this.m_database.getRepository(WindowEntity);

        let window: WindowEntity | null = null;

        let windows = await windowRepository.find({ where: { viewId } });
        if (windows.length > 0) window = windows[0];

        if (!window) {
            const newWindow = new WindowEntity();
            newWindow.viewId = viewId;
            newWindow.width = 1200;
            newWindow.height = 800;
            newWindow.positionX = screen.getPrimaryDisplay().workArea.width / 2 - newWindow.width / 2;
            newWindow.positionY = screen.getPrimaryDisplay().workArea.height / 2 - newWindow.height / 2;
            newWindow.isOpen = true;

            try {
                await windowRepository.save(newWindow);
            } catch (error) {
                dialog.showErrorBox('Error', 'Failed to create window');
                return;
            }

            window = newWindow;
        }

        this.openWindow(window);
    }

    public async openWindow(window: WindowEntity) {
        if (!this.m_database) return;
        const windowRepository = this.m_database.getRepository(WindowEntity);

        const existingWindow = this.m_windows.get(window.viewId);
        if (existingWindow) {
            existingWindow.focus();
            return;
        }

        if (!window.isOpen) {
            window.isOpen = true;
            try {
                await windowRepository.save(window);
            } catch (error) {
                dialog.showErrorBox('Error', 'Failed to open window');
                return;
            }
        }

        const windowTitles = new Map<ViewId, string>([
            ['welcome', 'Welcome'],
            ['disassembly', 'Disassembly'],
            ['functions', 'Functions']
        ]);

        const bw = new BrowserWindow({
            title: windowTitles.get(window.viewId) || window.viewId,
            width: window.width,
            height: window.height,
            x: window.positionX,
            y: window.positionY,
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });

        this.m_windows.set(window.viewId, bw);

        bw.on('closed', async () => {
            if (!this.m_database) return;

            window.isOpen = false;
            try {
                await windowRepository.save(window);
            } catch (error) {
                dialog.showErrorBox('Error', 'Failed to close window');
                return;
            }

            this.m_windows.delete(window.viewId);
        });

        bw.on('resize', async () => {
            if (!this.m_database) return;

            window.width = bw.getSize()[0];
            window.height = bw.getSize()[1];

            try {
                await windowRepository.save(window);
            } catch (error) {
                dialog.showErrorBox('Error', 'Failed to save window');
                return;
            }
        });

        bw.on('move', async () => {
            if (!this.m_database) return;

            window.positionX = bw.getPosition()[0];
            window.positionY = bw.getPosition()[1];

            try {
                await windowRepository.save(window);
            } catch (error) {
                dialog.showErrorBox('Error', 'Failed to save window');
                return;
            }
        });

        const unbind1 = Messager.on('getViewId', bw, async () => {
            Messager.send('setViewId', bw, window.viewId);
        });

        const unbind2 = Messager.on('openDevTools', bw, () => {
            bw.webContents.openDevTools();
        });

        bw.on('close', () => {
            this.m_windows.delete(window.viewId);
            unbind1();
            unbind2();
        });

        // bw.webContents.openDevTools();

        if (process.env.NODE_ENV === 'development') {
            bw.loadURL('http://localhost:5173');
        } else {
            bw.loadFile(path.join(__dirname, '../frontend/index.html'));
        }
    }

    public async createProject(projectPath: string) {
        try {
            this.m_database = await createDatabase(projectPath);
            this.m_projectPath = projectPath;

            const recentProjects = storage.get('recentProjects');
            if (!recentProjects.includes(projectPath)) {
                recentProjects.unshift(projectPath);
                if (recentProjects.length > 10) recentProjects.pop();
                storage.set('recentProjects', recentProjects);
            } else {
                recentProjects.splice(recentProjects.indexOf(projectPath), 1);
                recentProjects.unshift(projectPath);
                storage.set('recentProjects', recentProjects);
            }

            const windows = await this.m_database.getRepository(WindowEntity).find({ where: { isOpen: true } });
            for (const window of windows) {
                this.openWindow(window);
            }

            await MemoryService.initialize(this.m_database);
            await FunctionService.initialize(this.m_database);
            await DataTypeService.initialize(this.m_database);
            await AnnotationService.initialize(this.m_database);
            await DecompilerService.initialize();
            await MainActionService.onDatabaseOpen(this.m_database, projectPath);

            Messager.send('projectLoaded', { path: projectPath });
        } catch (error) {
            console.error('Error creating project:', error);
            Messager.send('projectLoadFailed', { error: String(error) });
        }
    }

    public static async promptOpenProject() {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'ps2dec Project', extensions: ['ps2proj'] }]
        });

        if (!result.canceled && result.filePaths[0]) {
            ProjectManager.get().openProject(result.filePaths[0]);
        }
        Messager.send('projectLoadCancelled');
    }

    public openProject(projectPath: string) {
        if (this.m_projectPath === projectPath) return;

        this.createProject(projectPath);
    }
}
