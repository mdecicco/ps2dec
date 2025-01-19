// import { shell } from 'electron';
import { parentPort, Worker } from 'worker_threads';
import zlib from 'zlib';

import { Action, ActionData, ActionEventMap } from 'apps/backend/actions/Action';
import { createDatabase } from 'apps/backend/db';
import { ActionEntity } from 'apps/backend/entities/action';
import Messager from 'apps/backend/message';
import { EventListener } from 'packages/utils/event';
import { DataSource } from 'typeorm';

// Register action types
import 'apps/backend/actions/AddElfAction';
import 'apps/backend/actions/AddFunctionAction';
import { DataTypeService } from 'apps/backend/services/DataTypeService';
import { FunctionService } from 'apps/backend/services/FunctionService';

// import 'apps/backend/actions/AddAnnotationAction';
// import 'apps/backend/actions/AddFunctionCallAction';
// import 'apps/backend/actions/BatchInsertAction';
// import 'apps/backend/actions/Transaction';

type WorkerExitMessage = {
    type: 'exit';
};

type WorkerDatabaseMessage = {
    type: 'openDatabase';
    databasePath: string;
};

type WorkerActionMessage = {
    type: 'action';
    mode: 'execute' | 'revert';
    action: ActionData;
};

type MainWorkerErrorMessage = {
    type: 'error';
    error: string;
};

type MainWorkerTerminatedMessage = {
    type: 'workerTerminated';
};

type MainUpdateActionMessage = {
    type: 'updateAction';
    action: ActionData;
};

type MainActionEventMessage<T extends keyof ActionEventMap> = {
    type: 'actionEvent';
    event: T;
    data: Parameters<ActionEventMap[T]>;
};

type WorkerMessage = WorkerExitMessage | WorkerActionMessage | WorkerDatabaseMessage;
type MainMessage =
    | MainActionEventMessage<keyof ActionEventMap>
    | MainWorkerTerminatedMessage
    | MainWorkerErrorMessage
    | MainUpdateActionMessage;

export class MainActionService {
    private static m_worker: Worker | null = null;
    private static m_actionHistory: Action[] = [];
    private static m_redoStack: Action[] = [];
    private static m_currentAction: Action | null = null;
    private static m_database: DataSource | null = null;
    private static m_nextMessageId: number = 0;
    private static m_expectedMessageId: number = 0;

    static initialize() {
        MainActionService.m_worker = new Worker('./build/apps/backend/action_worker.js');

        const messageQueue: any[] = [];
        MainActionService.m_worker.on('message', async (message: any) => {
            if (message.id !== MainActionService.m_expectedMessageId) {
                messageQueue.push(message);
                return;
            }

            MainActionService.onMessage(message);
            MainActionService.m_expectedMessageId++;

            while (messageQueue.length > 0) {
                let found = false;
                for (let i = 0; i < messageQueue.length; i++) {
                    if (messageQueue[i].id === MainActionService.m_expectedMessageId) {
                        MainActionService.onMessage(messageQueue[i]);
                        MainActionService.m_expectedMessageId++;
                        messageQueue.splice(i, 1);
                        found = true;
                        break;
                    }
                }
            }
        });

        Messager.on('actionUndo', () => {
            MainActionService.undo();
        });
        Messager.on('actionRedo', () => {
            MainActionService.redo();
        });
    }

    private static onMessage(message: MainMessage) {
        console.log('Main:', message);

        if (message.type === 'workerTerminated') {
            MainActionService.m_worker = null;
            return;
        }

        if (message.type === 'error') {
            console.error('Action worker error:', message.error);
            process.exit(1);
            return;
        }

        if (message.type === 'updateAction') {
            if (!MainActionService.m_currentAction) return;
            MainActionService.m_currentAction.setFrom(message.action);
            return;
        }

        if (message.type === 'actionEvent') {
            if (!MainActionService.m_currentAction) return;
            MainActionService.m_currentAction.dispatch(message.event, ...message.data);
            const args = message.data;

            switch (message.event) {
                case 'beforeExecute':
                    MainActionService.onBeforeExecute();
                    break;
                case 'afterExecute':
                    MainActionService.onAfterExecute();
                    break;
                case 'executeComplete':
                    MainActionService.onExecuteComplete();
                    break;
                case 'executeFailed':
                    MainActionService.onExecuteFailed(args[0] as string);
                    break;
                case 'beforeRevert':
                    MainActionService.onBeforeRevert();
                    break;
                case 'afterRevert':
                    MainActionService.onAfterRevert();
                    break;
                case 'revertComplete':
                    MainActionService.onRevertComplete();
                    break;
                case 'revertFailed':
                    MainActionService.onRevertFailed(args[0] as string);
                    break;
                case 'progress':
                    MainActionService.onActionProgress(args[0] as string, args[1] as number);
                    break;
            }
        }
    }

    static async shutdown() {
        if (!MainActionService.m_worker) return;

        const result = new Promise<void>(resolve => {
            if (!MainActionService.m_worker) resolve();
            else MainActionService.m_worker.on('exit', resolve);
        });

        MainActionService.send({ type: 'exit' });

        await result;
    }

    static async onDatabaseOpen(db: DataSource, path: string) {
        MainActionService.m_database = db;

        const actionRepository = db.getRepository(ActionEntity);
        const stored = await actionRepository.find({ order: { timestamp: 'DESC' } });

        MainActionService.m_actionHistory = [];
        for (const storedAction of stored) {
            const action = Action.deserialize(storedAction);
            if (action) {
                MainActionService.m_actionHistory.push(action);
            }
        }

        MainActionService.send({ type: 'openDatabase', databasePath: path });
    }

    static submitAction(action: Action) {
        if (!MainActionService.m_worker) throw new Error('Worker not initialized');
        if (MainActionService.m_currentAction) {
            // shell.beep();
            console.error('Already working');
            return;
        }

        MainActionService.executeAction(action);
    }

    static undo() {
        if (!MainActionService.m_worker) throw new Error('Worker not initialized');
        if (MainActionService.m_currentAction) {
            // shell.beep();
            console.error('Already working');
            return;
        }

        const action = MainActionService.m_actionHistory.pop();
        if (!action) {
            // shell.beep();
            console.error('No action to undo');
            return;
        }

        MainActionService.revertAction(action);
    }

    static redo() {
        if (!MainActionService.m_worker) throw new Error('Worker not initialized');
        if (MainActionService.m_currentAction) {
            // shell.beep();
            console.error('Already working');
            return;
        }

        const action = MainActionService.m_redoStack.pop();
        if (!action) {
            // shell.beep();
            console.error('No action to redo');
            return;
        }

        MainActionService.executeAction(action);
    }

    private static onBeforeExecute() {
        Messager.send('actionStarted', { description: MainActionService.m_currentAction!.description });
    }
    private static onAfterExecute() {
        MainActionService.setCurrentAction(null);
    }
    private static async onExecuteComplete() {
        const action = MainActionService.m_currentAction!;

        if (!MainActionService.m_database) throw new Error('No database');

        try {
            const actionData = action.serialize();

            const actionRepository = MainActionService.m_database.getRepository(ActionEntity);

            const actionEntity = new ActionEntity();
            actionEntity.type = actionData.type;
            actionEntity.description = action.description;
            actionEntity.parameters = new Uint8Array(
                zlib.gzipSync(JSON.stringify(actionData.parameters), { level: 9 })
            );
            actionEntity.timestamp = new Date();

            await actionRepository.save(actionEntity);

            action.id = actionEntity.id;

            MainActionService.m_actionHistory.push(action);
            MainActionService.m_redoStack = [];

            action.status = 'committed';
            Messager.send('actionCompleted', { description: action.description });
        } catch (error) {
            console.log('Failed to save action', error);

            action.status = 'failed';
            Messager.send('actionFailed', { description: action.description, error: String(error) });
            MainActionService.revertAction(action);
        }
    }
    private static onExecuteFailed(error: string) {
        const action = MainActionService.m_currentAction!;
        action.status = 'failed';
        Messager.send('actionFailed', { description: action.description, error });
    }
    private static onBeforeRevert() {}
    private static onAfterRevert() {
        MainActionService.setCurrentAction(null);
    }
    private static onRevertComplete() {
        const action = MainActionService.m_currentAction!;

        if (action.id) {
            const actionRepository = MainActionService.m_database!.getRepository(ActionEntity);
            actionRepository.delete(action.id);
        }

        if (action.status === 'failed') {
            // No redoing failed actions
            return;
        }

        action.status = 'reverted';
        MainActionService.m_redoStack.push(action);
    }
    private static onRevertFailed(error: string) {
        const action = MainActionService.m_currentAction!;

        if (action.status !== 'failed') {
            // Not reverting because of an error, reverting because the user said to
            // That being the case, put this back here
            MainActionService.m_redoStack.push(action);
        }

        action.status = 'failed';
    }
    private static onActionProgress(message: string, progress: number) {
        Messager.send('actionProgress', { description: message, progress });
    }

    //
    // Communication
    //

    private static setCurrentAction(action: Action | null) {
        MainActionService.m_currentAction = action;
    }

    private static executeAction(action: Action) {
        if (!MainActionService.m_worker) throw new Error('Worker not initialized');

        MainActionService.setCurrentAction(action);
        MainActionService.send({
            type: 'action',
            mode: 'execute',
            action: action.serialize()
        });
    }

    private static revertAction(action: Action) {
        if (!MainActionService.m_worker) throw new Error('Worker not initialized');

        MainActionService.setCurrentAction(action);
        MainActionService.send({
            type: 'action',
            mode: 'revert',
            action: action.serialize()
        });
    }

    private static send(message: WorkerMessage) {
        if (!MainActionService.m_worker) throw new Error('Worker not initialized');
        MainActionService.m_worker.postMessage(Object.assign(message, { id: MainActionService.m_nextMessageId }));
        MainActionService.m_nextMessageId++;
    }
}

export class WorkerActionService {
    private static m_parent: NonNullable<typeof parentPort>;
    private static m_currentAction: Action | null = null;
    private static m_doExit = false;
    private static m_database: DataSource | null = null;
    private static m_nextMessageId: number = 0;
    private static m_expectedMessageId: number = 0;

    static initialize() {
        if (!parentPort) throw new Error('No parent port');
        WorkerActionService.m_parent = parentPort;

        const messageQueue: any[] = [];
        WorkerActionService.m_parent.on('message', async (message: any) => {
            if (message.id !== WorkerActionService.m_expectedMessageId) {
                messageQueue.push(message);
                return;
            }

            WorkerActionService.onMessage(message);
            WorkerActionService.m_expectedMessageId++;

            while (messageQueue.length > 0) {
                let found = false;
                for (let i = 0; i < messageQueue.length; i++) {
                    if (messageQueue[i].id === WorkerActionService.m_expectedMessageId) {
                        WorkerActionService.onMessage(messageQueue[i]);
                        WorkerActionService.m_expectedMessageId++;
                        messageQueue.splice(i, 1);
                        found = true;
                        break;
                    }
                }
            }
        });
    }

    private static async onMessage(message: WorkerMessage) {
        console.log('Worker:', message);

        try {
            if (message.type === 'exit') {
                if (WorkerActionService.m_currentAction) {
                    WorkerActionService.m_doExit = true;
                    return;
                }

                WorkerActionService.shutdown();
                return;
            }

            if (message.type === 'openDatabase') {
                WorkerActionService.m_database = await createDatabase(message.databasePath);
                DataTypeService.initialize(WorkerActionService.m_database);
                FunctionService.initialize(WorkerActionService.m_database);
                return;
            }

            if (message.type === 'action') {
                if (message.mode === 'execute') {
                    WorkerActionService.executeAction(Action.deserialize(message.action));
                } else if (message.mode === 'revert') {
                    WorkerActionService.revertAction(Action.deserialize(message.action));
                }
                return;
            }
        } catch (error) {
            console.error('Action worker error:', error);
            WorkerActionService.send({ type: 'error', error: String(error) });
            WorkerActionService.shutdown();
        }
    }

    private static executeAction(action: Action) {
        if (!WorkerActionService.m_database) throw new Error('No database');

        WorkerActionService.m_currentAction = action;
        action.database = WorkerActionService.m_database;

        const listeners: EventListener[] = [
            action.addListener('beforeExecute', (...args) => {
                WorkerActionService.send({ type: 'actionEvent', event: 'beforeExecute', data: args });
            }),
            action.addListener('afterExecute', (...args) => {
                WorkerActionService.m_currentAction = null;
                action.database = null;

                WorkerActionService.send({ type: 'actionEvent', event: 'afterExecute', data: args });
                listeners.forEach(listener => listener.remove());

                if (WorkerActionService.m_doExit) {
                    WorkerActionService.shutdown();
                }
            }),
            action.addListener('executeComplete', (...args) => {
                WorkerActionService.send({ type: 'updateAction', action: action.serialize() });
                WorkerActionService.send({ type: 'actionEvent', event: 'executeComplete', data: args });
            }),
            action.addListener('executeFailed', (...args) => {
                WorkerActionService.send({ type: 'actionEvent', event: 'executeFailed', data: args });
            }),
            action.addListener('beforeRevert', (...args) => {
                WorkerActionService.send({ type: 'actionEvent', event: 'beforeRevert', data: args });
            }),
            action.addListener('afterRevert', (...args) => {
                WorkerActionService.m_currentAction = null;
                action.database = null;

                WorkerActionService.send({ type: 'actionEvent', event: 'afterRevert', data: args });
                listeners.forEach(listener => listener.remove());

                if (WorkerActionService.m_doExit) {
                    WorkerActionService.shutdown();
                }
            }),
            action.addListener('revertComplete', (...args) => {
                WorkerActionService.send({ type: 'actionEvent', event: 'revertComplete', data: args });
            }),
            action.addListener('revertFailed', (...args) => {
                WorkerActionService.send({ type: 'actionEvent', event: 'revertFailed', data: args });
            }),
            action.addListener('progress', (...args) => {
                WorkerActionService.send({ type: 'actionEvent', event: 'progress', data: args });
            })
        ];

        Action.perform(action);
    }

    private static revertAction(action: Action) {
        if (!WorkerActionService.m_database) throw new Error('No database');

        WorkerActionService.m_currentAction = action;
        action.database = WorkerActionService.m_database;

        const listeners: EventListener[] = [
            action.addListener('beforeExecute', (...args) => {
                WorkerActionService.send({ type: 'actionEvent', event: 'beforeExecute', data: args });
            }),
            action.addListener('afterExecute', (...args) => {
                WorkerActionService.m_currentAction = null;
                action.database = null;

                WorkerActionService.send({ type: 'actionEvent', event: 'afterExecute', data: args });
                listeners.forEach(listener => listener.remove());

                if (WorkerActionService.m_doExit) {
                    WorkerActionService.shutdown();
                }
            }),
            action.addListener('executeComplete', (...args) => {
                WorkerActionService.send({ type: 'actionEvent', event: 'executeComplete', data: args });
            }),
            action.addListener('executeFailed', (...args) => {
                WorkerActionService.send({ type: 'actionEvent', event: 'executeFailed', data: args });
            }),
            action.addListener('beforeRevert', (...args) => {
                WorkerActionService.send({ type: 'actionEvent', event: 'beforeRevert', data: args });
            }),
            action.addListener('afterRevert', (...args) => {
                WorkerActionService.m_currentAction = null;
                action.database = null;

                WorkerActionService.send({ type: 'actionEvent', event: 'afterRevert', data: args });
                listeners.forEach(listener => listener.remove());

                if (WorkerActionService.m_doExit) {
                    WorkerActionService.shutdown();
                }
            }),
            action.addListener('revertComplete', (...args) => {
                WorkerActionService.send({ type: 'actionEvent', event: 'revertComplete', data: args });
            }),
            action.addListener('revertFailed', (...args) => {
                WorkerActionService.send({ type: 'actionEvent', event: 'revertFailed', data: args });
            }),
            action.addListener('progress', (...args) => {
                WorkerActionService.send({ type: 'actionEvent', event: 'progress', data: args });
            })
        ];

        Action.revert(action);
    }

    private static shutdown() {
        process.exit(0);
    }

    private static send(message: MainMessage) {
        if (!WorkerActionService.m_parent) throw new Error('Worker not initialized');
        WorkerActionService.m_parent.postMessage(Object.assign(message, { id: WorkerActionService.m_nextMessageId }));
        WorkerActionService.m_nextMessageId++;
    }
}
