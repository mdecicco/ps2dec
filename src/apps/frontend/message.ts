const { ipcRenderer } = window.require('electron');
import {
    ClientMessage,
    ClientMessagePayloads,
    ClientMessageType,
    InvocationMap,
    MainMessage,
    MainMessagePayloads,
    MainMessageType
} from 'messages';

type MessageHandler<Type extends ClientMessageType> = (...args: any[]) => void;

export default class Messager {
    private static initialized: boolean = false;
    private static handlers: Map<ClientMessageType, MessageHandler<any>[]> = new Map();

    static send<Type extends MainMessageType>(
        type: Type,
        ...args: MainMessagePayloads[Type] extends never ? [] : [data: MainMessagePayloads[Type]]
    ): void {
        const message: Partial<MainMessage<Type>> = { type };
        if (args.length > 0) message.payload = args[0];
        ipcRenderer.invoke('message', message);
    }

    static invoke<Fn extends keyof InvocationMap>(
        func: Fn,
        ...args: InvocationMap[Fn]['request'] extends never ? [] : [data: InvocationMap[Fn]['request']]
    ): Promise<InvocationMap[Fn]['response']> {
        return ipcRenderer.invoke(func, args[0]);
    }

    static on<Type extends ClientMessageType>(
        message: Type,
        handler: (...args: ClientMessagePayloads[Type] extends never ? [] : [data: ClientMessagePayloads[Type]]) => void
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
                    handler(message.payload);
                } catch (error) {
                    console.error(`Error handling message ${message.type}`, error);
                }
            }
        });
    }
}
