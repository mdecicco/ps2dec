import { Repository } from '../db/Repository';
import { ELFModel, ElfProgramModel, ElfSectionModel } from '../models/ElfFile';
import { FunctionCallModel, FunctionModel } from '../models/Function';
import { MemoryAnnotationModel } from '../models/MemoryAnnotation';
import { ActionData } from '../models/StoredAction';
import { Action } from './Action';

type ModelType = {
    elfFile: ELFModel;
    elfProgram: ElfProgramModel;
    elfSection: ElfSectionModel;
    function: FunctionModel;
    functionCall: FunctionCallModel;
    annotation: MemoryAnnotationModel;
};

export class BatchInsertAction<T extends keyof ModelType> extends Action {
    static ActionName = 'BatchInsert';
    private modelType: T;
    private models: Omit<ModelType[T], 'id'>[];
    private createdIds: number[];
    private repository: Repository<ModelType[T]>;
    public description: string;

    constructor(modelType: T, models: Omit<ModelType[T], 'id'>[], description: string) {
        super();
        this.modelType = modelType;
        this.models = models;
        this.createdIds = [];
        this.description = description;

        switch (modelType) {
            case 'elfFile':
                this.repository = this.database.elfFiles as Repository<ModelType[T]>;
                break;
            case 'elfProgram':
                this.repository = this.database.elfPrograms as Repository<ModelType[T]>;
                break;
            case 'elfSection':
                this.repository = this.database.elfSections as Repository<ModelType[T]>;
                break;
            case 'function':
                this.repository = this.database.functions as Repository<ModelType[T]>;
                break;
            case 'functionCall':
                this.repository = this.database.functionCalls as Repository<ModelType[T]>;
                break;
            case 'annotation':
                this.repository = this.database.annotations as Repository<ModelType[T]>;
                break;
            default:
                throw new Error('Invalid model type');
        }
    }

    protected async execute() {
        const created = this.repository.createMany(this.models);
        this.createdIds = created.map(c => c.id);

        if (this.createdIds.length !== this.models.length) {
            throw new Error('Failed to create all models');
        }
    }

    protected async rollback() {
        if (this.createdIds.length === 0) return;

        const didSucceed = this.repository.deleteMany(this.createdIds);
        if (!didSucceed) throw new Error('Failed to delete all models');
    }

    serialize(): ActionData {
        return {
            type: BatchInsertAction.ActionName,
            parameters: {
                modelType: this.modelType,
                models: this.models,
                createdIds: this.createdIds,
                description: this.description
            }
        };
    }

    static deserialize(data: ActionData['parameters']): BatchInsertAction<any> {
        const result = new BatchInsertAction<any>(data.modelType, data.models, data.description);
        result.createdIds = data.createdIds;
        return result;
    }
}

// Register the action type
Action.registerActionType(BatchInsertAction);
