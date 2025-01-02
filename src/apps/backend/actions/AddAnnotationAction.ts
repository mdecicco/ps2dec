import { ActionData } from 'apps/backend/actions/Action';
import { AnnotationEntity } from 'apps/backend/entities';
import Messager from 'apps/backend/message';
import { Action } from './Action';

export class AddAnnotationAction extends Action {
    public static readonly ActionName = 'AddAnnotation';
    private annotationId: number | null;
    private annotation: AnnotationEntity;
    public description: string;

    constructor(annotation: AnnotationEntity) {
        super();
        this.annotationId = null;
        this.annotation = annotation;
        this.description = 'Add memory annotation';
    }

    protected async execute(): Promise<void> {
        const repo = this.database.getRepository(AnnotationEntity);
        try {
            const annotation = await repo.create(this.annotation);
            this.annotationId = annotation.id;

            // Messager.send('annotationAdded', annotation.data);
        } catch (error) {
            Messager.send('annotationFailed', { error: String(error) });
        }
    }

    protected async rollback(): Promise<void> {
        if (this.annotationId) {
            const repo = this.database.getRepository(AnnotationEntity);
            const didSucceed = await repo.delete(this.annotationId);
            if (!didSucceed) throw new Error('Failed to delete annotation');

            Messager.send('annotationRemoved', {
                id: this.annotationId,
                address: this.annotation.address
            });

            this.annotationId = null;
        }
    }

    serialize(): ActionData {
        return {
            type: AddAnnotationAction.ActionName,
            parameters: {
                id: this.annotationId,
                annotation: this.annotation.data
            }
        };
    }

    static deserialize(data: ActionData['parameters']): AddAnnotationAction {
        const annotation = new AnnotationEntity();
        if (data.id) annotation.id = data.id;
        annotation.address = data.address;
        annotation.data = data.annotation;

        const action = new AddAnnotationAction(annotation);
        action.annotationId = data.id;
        return action;
    }
}

// Register the action type
Action.registerActionType(AddAnnotationAction);
