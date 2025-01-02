export type EventMap = Record<string, (...args: any[]) => any>;

type ListenerMap<Events extends EventMap, EvtTp extends keyof Events> = Map<number, Events[EvtTp]>;
type EventListenerStorage<Events extends EventMap> = {
    [eventName in keyof Events]?: ListenerMap<Events, eventName>;
};

export interface EventListener {
    id: number;
    remove: () => void;
}

export class EventProducer<Events extends EventMap> {
    private m_nextId: number;
    private m_listeners: EventListenerStorage<Events>;
    private m_listenerTypeMap: Map<number, keyof Events>;

    constructor() {
        this.m_nextId = 1;
        this.m_listeners = {};
        this.m_listenerTypeMap = new Map();
    }

    addListener<Event extends keyof Events>(event: Event, callback: Events[Event]): EventListener {
        const id = this.m_nextId++;
        if (!(event in this.m_listeners)) {
            this.m_listeners[event] = new Map();
        }

        const map = this.m_listeners[event] as ListenerMap<Events, Event>;
        map.set(id, callback);
        this.m_listenerTypeMap.set(id, event);

        return {
            id,
            remove: () => {
                map.delete(id);
                this.m_listenerTypeMap.delete(id);
            }
        };
    }

    dispatch<Event extends keyof Events>(event: Event, ...args: Parameters<Events[Event]>) {
        if (!(event in this.m_listeners)) return [];
        const map = this.m_listeners[event] as ListenerMap<Events, Event>;
        map.forEach(cb => {
            try {
                cb(...args);
            } catch (err) {
                console.error(err);
            }
        });
    }
}
