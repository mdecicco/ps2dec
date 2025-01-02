import { ActionData } from '../models/StoredAction';
import { Action } from './Action';

export class Transaction extends Action {
    public static readonly ActionName = 'Transaction';
    private actions: Action[] = [];

    constructor(public description: string) {
        super();
    }

    add(action: Action): this {
        this.actions.push(action);
        return this;
    }

    protected async execute(): Promise<void> {
        const executed: Action[] = [];
        try {
            let startTime = new Date().getTime();
            for (const action of this.actions) {
                const currentTime = new Date().getTime();
                if (currentTime - startTime > 5000) {
                    startTime = currentTime;
                    console.log(
                        `Executing ${this.description}: ${executed.length} / ${this.actions.length} (${(
                            (executed.length / this.actions.length) *
                            100
                        ).toFixed(2)}%)`
                    );
                }

                await action.execute();
                executed.push(action);
            }
        } catch (error) {
            // Rollback executed actions in reverse order
            for (const action of executed.reverse()) {
                try {
                    await action.rollback();
                } catch (rollbackError) {
                    console.error('Error during rollback:', rollbackError);
                    // Continue rolling back other actions
                }
            }
            throw error;
        }
    }

    protected async rollback(): Promise<void> {
        // Create a backup of the database in case we need to restore it
        this.database.backup();

        let startTime = new Date().getTime();
        let i = 0;
        for (const action of [...this.actions].reverse()) {
            const currentTime = new Date().getTime();
            if (currentTime - startTime > 5000) {
                startTime = currentTime;
                console.log(
                    `Rolling back ${this.description}: ${i} / ${this.actions.length} (${(
                        (i / this.actions.length) *
                        100
                    ).toFixed(2)}%)`
                );
            }

            try {
                await action.rollback();
            } catch (error) {
                console.error('Error during rollback:', error);
                console.log('Restoring database from backup...');
                this.database.restore();
                break;
            }

            i++;
        }
    }

    serialize(): ActionData {
        return {
            type: Transaction.ActionName,
            parameters: {
                description: this.description,
                actions: this.actions.map(a => a.serialize())
            }
        };
    }

    static deserialize(data: ActionData['parameters']): Transaction {
        const transaction = new Transaction(data.description);

        for (const actionData of data.actions) {
            const action = Action.deserialize(actionData);
            if (action) {
                transaction.add(action);
            }
        }

        return transaction;
    }
}

// Register the action type
Action.registerActionType(Transaction);
