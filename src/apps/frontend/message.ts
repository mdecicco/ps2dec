const { ipcRenderer } = window.require('electron');
import {
    ClientMessage,
    ClientMessagePayloads,
    ClientMessageType,
    MainMessage,
    MainMessagePayloads,
    MainMessageType
} from 'messages';

type MessageHandler<Type extends ClientMessageType> = (message: ClientMessagePayloads[Type]) => void;

export default class Messager {
    private static initialized: boolean = false;
    private static handlers: Map<ClientMessageType, MessageHandler<any>[]> = new Map();

    static send<Type extends MainMessageType>(type: Type, data: MainMessagePayloads[Type]): void {
        const message: MainMessage<Type> = {
            type,
            payload: data
        };
        ipcRenderer.invoke('message', message);
    }

    static on<Type extends ClientMessageType>(
        message: Type,
        handler: (data: ClientMessagePayloads[Type]) => void
    ): () => void {
        let handlers = this.handlers.get(message);
        if (!handlers) {
            handlers = [];
            this.handlers.set(message, handlers);
        }

        handlers.push(handler);

        return () => {
            const idx = handlers.findIndex(h => h === handler);
            if (idx === -1) return;

            handlers.splice(idx, 1);

            if (handlers.length === 0) this.handlers.delete(message);
        };
    }

    static initialize(): void {
        if (this.initialized) return;
        this.initialized = true;

        ipcRenderer.on('message', (event: any, message: ClientMessage<any>) => {
            const handlers = this.handlers.get(message.type);
            if (!handlers) return;
            for (const handler of handlers) {
                try {
                    handler(message);
                } catch (error) {
                    console.error(`Error handling message ${message.type}`, error);
                }
            }
        });
    }
}
