import { BrowserWindow, ipcMain } from 'electron';
import {
    ClientMessage,
    ClientMessagePayloads,
    ClientMessageType,
    InvocationMap,
    MainMessage,
    MainMessagePayloads,
    MainMessageType
} from 'messages';
import { isMainThread } from 'worker_threads';

type MessageHandler = {
    source: BrowserWindow | null;
    callback: (...args: any[]) => void;
};

export default class Messager {
    private static initialized: boolean = false;
    private static handlers: Map<MainMessageType, MessageHandler[]> = new Map();

    static send<Type extends ClientMessageType>(
        type: Type,
        target: BrowserWindow,
        ...args: ClientMessagePayloads[Type] extends never ? [] : [message: ClientMessagePayloads[Type]]
    ): void;
    static send<Type extends ClientMessageType>(
        type: Type,
        ...args: ClientMessagePayloads[Type] extends never ? [] : [message: ClientMessagePayloads[Type]]
    ): void;
    static send<Type extends ClientMessageType>(
        type: Type,
        dataOrTarget?: ClientMessagePayloads[Type] | BrowserWindow,
        data?: ClientMessagePayloads[Type]
    ): void {
        if (!isMainThread) return;

        if (dataOrTarget && dataOrTarget instanceof BrowserWindow) {
            if (!data) {
                throw new Error('Message data not specified for target');
            }
            const message: ClientMessage<Type> = {
                type,
                payload: data
            };
            dataOrTarget.webContents.send('message', message);
        } else {
            const message: Partial<ClientMessage<Type>> = { type };
            if (dataOrTarget) message.payload = dataOrTarget;
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('message', message);
            });
        }
    }

    static on<Type extends MainMessageType>(
        message: Type,
        from: BrowserWindow,
        handler: (
            ...args: MainMessagePayloads[Type] extends never
                ? [sender: BrowserWindow]
                : [message: MainMessagePayloads[Type], sender: BrowserWindow]
        ) => void
    ): () => void;
    static on<Type extends MainMessageType>(
        message: Type,
        handler: (
            ...args: MainMessagePayloads[Type] extends never
                ? [sender: BrowserWindow]
                : [message: MainMessagePayloads[Type], sender: BrowserWindow]
        ) => void
    ): () => void;
    static on<Type extends MainMessageType>(
        message: Type,
        handlerOrSource:
            | BrowserWindow
            | ((
                  ...args: MainMessagePayloads[Type] extends never
                      ? [sender: BrowserWindow]
                      : [message: MainMessagePayloads[Type], sender: BrowserWindow]
              ) => void),
        handler?: (
            ...args: MainMessagePayloads[Type] extends never
                ? [sender: BrowserWindow]
                : [message: MainMessagePayloads[Type], sender: BrowserWindow]
        ) => void
    ): () => void {
        if (!isMainThread) return () => {};

        let handlers = this.handlers.get(message);
        if (!handlers) {
            handlers = [];
            this.handlers.set(message, handlers);
        }

        let callback: MessageHandler['callback'];

        if (handlerOrSource instanceof BrowserWindow) {
            if (!handler) {
                throw new Error('Handler not specified for source');
            }
            callback = handler;
            handlers.push({ source: handlerOrSource, callback });
        } else {
            callback = handlerOrSource;
            handlers.push({ source: null, callback });
        }

        return () => {
            const idx = handlers.findIndex(h => h.callback === callback);
            if (idx === -1) return;

            handlers.splice(idx, 1);

            if (handlers.length === 0) this.handlers.delete(message);
        };
    }

    static func<Fn extends keyof InvocationMap>(
        func: Fn,
        handler: (request: InvocationMap[Fn]['request']) => InvocationMap[Fn]['response']
    ): void {
        if (!isMainThread) return;

        ipcMain.removeHandler(func);
        ipcMain.handle(func, (event, request: InvocationMap[Fn]['request']) => {
            return handler(request);
        });
    }

    static initialize(): void {
        if (this.initialized || !isMainThread) return;
        this.initialized = true;

        ipcMain.handle('message', (event, message: MainMessage<any>) => {
            const handlers = this.handlers.get(message.type);
            if (!handlers) return;
            for (const handler of handlers) {
                try {
                    if (handler.source && handler.source.webContents.id !== event.sender.id) continue;
                    const sender = BrowserWindow.getAllWindows().find(
                        window => window.webContents.id === event.sender.id
                    );
                    if (message.payload) handler.callback(message.payload, sender);
                    else handler.callback(sender);
                } catch (error) {
                    console.error(`Error handling message ${message.type}`, error);
                }
            }
        });
    }
}
