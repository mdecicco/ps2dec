import { FunctionCall } from '../../shared/ipc/types';
import { ActionData } from '../models/StoredAction';
import { Action } from './Action';

export class AddFunctionCallAction extends Action {
    public static readonly ActionName = 'AddFunctionCall';
    private callId: number | null;
    private call: Omit<FunctionCall, 'id'>;
    public description: string;

    constructor(call: Omit<FunctionCall, 'id'>) {
        super();
        this.callId = null;
        this.call = call;
        this.description = `Add call @ 0x${call.address.toString(16)}`;
    }

    protected async execute(): Promise<void> {
        const call = await this.database.functionCalls.create(this.call);
        if (!call) throw new Error('Failed to create annotation');

        this.callId = call.id;
    }

    protected async rollback(): Promise<void> {
        if (this.callId) {
            const didSucceed = await this.database.functionCalls.delete(this.callId);
            if (!didSucceed) throw new Error('Failed to delete function call');

            this.callId = null;
        }
    }

    serialize(): ActionData {
        return {
            type: AddFunctionCallAction.ActionName,
            parameters: {
                id: this.callId,
                call: this.call
            }
        };
    }

    static deserialize(data: ActionData['parameters']): AddFunctionCallAction {
        const action = new AddFunctionCallAction(data.call);
        action.callId = data.id;
        return action;
    }
}

// Register the action type
Action.registerActionType(AddFunctionCallAction);
