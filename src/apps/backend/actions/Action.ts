import { DataSource } from 'typeorm';
import { EventProducer } from 'utils';

export interface ActionData {
    type: string;
    parameters: Record<string, any>;
}

export type ActionEventMap = {
    beforeExecute: () => void;
    afterExecute: () => void;
    executeComplete: () => void;
    executeFailed: (error: string) => void;
    beforeRevert: () => void;
    afterRevert: () => void;
    revertComplete: () => void;
    revertFailed: (error: string) => void;
    progress: (message: string, progress: number) => void;
};

type ActionStatus = 'pending' | 'committed' | 'reverted' | 'failed';

interface ActionDeserializer {
    new (params: any): Action;
    deserialize(data: ActionData['parameters']): Action;
}

export abstract class Action extends EventProducer<ActionEventMap> {
    private static actionTypes = new Map<string, ActionDeserializer>();
    private m_database: DataSource | null;
    private m_id: number | null;
    private m_status: ActionStatus;

    constructor() {
        super();
        this.m_database = null;
        this.m_id = null;
        this.m_status = 'pending';
    }

    get database(): DataSource {
        if (!this.m_database) throw new Error('No database');
        return this.m_database;
    }

    set database(db: DataSource | null) {
        this.m_database = db;
    }

    get id(): number | null {
        return this.m_id;
    }

    set id(id: number | null) {
        this.m_id = id;
    }

    get status(): ActionStatus {
        return this.m_status;
    }

    set status(status: ActionStatus) {
        this.m_status = status;
    }

    abstract get description(): string;

    protected abstract execute(): Promise<void>;

    protected abstract rollback(): Promise<void>;

    abstract serialize(): ActionData;

    abstract setFrom(data: ActionData): void;

    static async perform(action: Action) {
        action.dispatch('beforeExecute');
        try {
            await action.execute();
            action.dispatch('executeComplete');
        } catch (error) {
            await action.rollback();
            if (error instanceof Error) {
                action.dispatch('executeFailed', `${error.name}: ${error.message} @ ${error.stack}`);
            } else {
                action.dispatch('executeFailed', String(error));
            }
        }

        action.dispatch('afterExecute');
    }

    static async revert(action: Action) {
        action.dispatch('beforeRevert');

        try {
            await action.rollback();
            action.dispatch('revertComplete');
        } catch (error) {
            action.dispatch('revertFailed', String(error));
        }

        action.dispatch('afterRevert');
    }

    static deserialize(data: ActionData): Action {
        const actionClass = Action.actionTypes.get(data.type);
        if (!actionClass) {
            throw new Error(`Action type ${data.type} not found`);
        }

        return actionClass.deserialize(data.parameters);
    }

    static getActionClass(type: string): (new (params: any) => Action) | null {
        return Action.actionTypes.get(type) || null;
    }

    static registerActionType(actionClass: ActionDeserializer) {
        const type = (actionClass as any).name;
        if (!type) {
            throw new Error(`Action class ${actionClass.constructor.name} must have a static 'name' property`);
        }
        Action.actionTypes.set(type, actionClass);

        if ('listen' in actionClass && typeof actionClass.listen === 'function') {
            actionClass.listen();
        }
    }
}
