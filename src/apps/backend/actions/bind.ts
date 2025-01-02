import { AddElfAction } from 'apps/backend/actions/AddElfAction';
import { MemoryRegionEntity } from 'apps/backend/entities/memory';
import Messager from 'apps/backend/message';
import { ProjectManager } from 'apps/backend/project';
import { AnnotationService, MemoryService } from 'apps/backend/services';
import { MainActionService } from 'apps/backend/services/ActionService';
import { FunctionService } from 'apps/backend/services/FunctionService';
import { BrowserWindow, dialog } from 'electron';

async function promptAddElf() {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return;

    const pm = ProjectManager.get();
    if (!pm || !pm.database) return;

    const repo = pm.database.getRepository(MemoryRegionEntity);
    const regionCount = await repo.count();
    if (regionCount > 0) {
        dialog.showMessageBox({
            title: 'ELF already loaded',
            message: 'Each project can only work on one ELF file.',
            buttons: ['Dang']
        });
        return;
    }

    const result = await dialog.showOpenDialog(window, {
        properties: ['openFile'],
        filters: [
            { name: 'ELF Files', extensions: ['elf'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (!result.canceled && result.filePaths[0]) {
        const action = new AddElfAction(result.filePaths[0]);
        action.addListener('executeComplete', () => {
            Messager.send('elfLoaded', { path: result.filePaths[0] });
            MemoryService.fetchRegions();
            AnnotationService.refetch();
            FunctionService.refetch();
        });
        MainActionService.submitAction(action);
    }

    Messager.send('elfLoadCancelled');
}

export function bindActionEvents() {
    Messager.on('promptLoadElf', promptAddElf);

    Messager.on('selectRows', async range => {
        Messager.send('selectRows', range);
    });

    Messager.on('gotoAddress', address => {
        Messager.send('gotoAddress', address);
    });
}
