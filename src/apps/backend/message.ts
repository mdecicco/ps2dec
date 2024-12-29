import { BrowserWindow, ipcMain } from 'electron';
import {
    ClientMessage,
    ClientMessagePayloads,
    ClientMessageType,
    MainMessage,
    MainMessagePayloads,
    MainMessageType
} from 'messages';

type MessageHandler<Type extends MainMessageType> = {
    source: BrowserWindow | null;
    callback: (message: MainMessagePayloads[Type]) => void;
};

export default class Messager {
    private static initialized: boolean = false;
    private static handlers: Map<MainMessageType, MessageHandler<any>[]> = new Map();

    static send<Type extends ClientMessageType>(
        type: Type,
        target: BrowserWindow,
        message: ClientMessagePayloads[Type]
    ): void;
    static send<Type extends ClientMessageType>(type: Type, message: ClientMessagePayloads[Type]): void;
    static send<Type extends ClientMessageType>(
        type: Type,
        dataOrTarget: ClientMessagePayloads[Type] | BrowserWindow,
        data?: ClientMessagePayloads[Type]
    ): void {
        if (dataOrTarget instanceof BrowserWindow) {
            if (!data) {
                throw new Error('Message data not specified for target');
            }
            const message: ClientMessage<Type> = {
                type,
                payload: data
            };
            dataOrTarget.webContents.send('message', message);
        } else {
            const message: ClientMessage<Type> = {
                type,
                payload: dataOrTarget
            };
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('message', message);
            });
        }
    }

    static on<Type extends MainMessageType>(
        message: Type,
        from: BrowserWindow,
        handler: (data: MainMessagePayloads[Type]) => void
    ): () => void;
    static on<Type extends MainMessageType>(
        message: Type,
        handler: (data: MainMessagePayloads[Type]) => void
    ): () => void;
    static on<Type extends MainMessageType>(
        message: Type,
        handlerOrSource: BrowserWindow | ((data: MainMessagePayloads[Type]) => void),
        handler?: (data: MainMessagePayloads[Type]) => void
    ): () => void {
        let handlers = this.handlers.get(message);
        if (!handlers) {
            handlers = [];
            this.handlers.set(message, handlers);
        }

        if (handlerOrSource instanceof BrowserWindow) {
            if (!handler) {
                throw new Error('Handler not specified for source');
            }
            handlers.push({ source: handlerOrSource, callback: handler });
        } else {
            handlers.push({ source: null, callback: handlerOrSource });
        }

        return () => {
            const idx = handlers.findIndex(h => h.callback === handler);
            if (idx === -1) return;

            handlers.splice(idx, 1);

            if (handlers.length === 0) this.handlers.delete(message);
        };
    }

    static initialize(): void {
        if (this.initialized) return;
        this.initialized = true;

        ipcMain.handle('message', (event, message: MainMessage<any>) => {
            const handlers = this.handlers.get(message.type);
            if (!handlers) return;
            for (const handler of handlers) {
                try {
                    if (handler.source && handler.source.webContents.id !== event.sender.id) continue;
                    handler.callback(message);
                } catch (error) {
                    console.error(`Error handling message ${message.type}`, error);
                }
            }
        });
    }
}
