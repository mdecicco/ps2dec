import { FunctionEntity } from 'apps/backend/entities';
import { FunctionService } from 'apps/backend/services/FunctionService';
import { Action, ActionData } from './Action';

export class AddFunctionAction extends Action {
    public static readonly ActionName = 'AddFunction';
    private functionId: number | null;
    private function: FunctionEntity;
    public description: string;

    constructor(func: FunctionEntity) {
        super();
        this.functionId = null;
        this.function = func;
        this.description = `Add function ${func.name}`;
    }

    protected async execute(): Promise<void> {
        await FunctionService.addFunction(this.function);

        this.functionId = this.function.id;
    }

    protected async rollback(): Promise<void> {
        if (this.functionId) {
            await FunctionService.removeFunction(this.functionId);

            this.functionId = null;
        }
    }

    serialize(): ActionData {
        return {
            type: AddFunctionAction.ActionName,
            parameters: {
                id: this.functionId,
                function: {
                    id: this.function.id,
                    address: this.function.address,
                    endAddress: this.function.endAddress,
                    name: this.function.name,
                    signatureId: this.function.signatureId,
                    methodOfId: this.function.methodOfId
                }
            }
        };
    }

    setFrom(data: ActionData): void {
        this.functionId = data.parameters.id;
        this.function = data.parameters.function;
    }

    static deserialize(data: ActionData['parameters']): AddFunctionAction {
        const func = new FunctionEntity();
        func.id = data.function.id;
        func.address = data.function.address;
        func.endAddress = data.function.endAddress;
        func.name = data.function.name;
        func.signatureId = data.function.signatureId;
        func.methodOfId = data.function.methodOfId;

        const action = new AddFunctionAction(func);
        action.functionId = data.id;
        return action;
    }
}

// Register the action type
Action.registerActionType(AddFunctionAction);
