import Store from 'electron-store';

type StorageType = { recentProjects: string[] };

const storage = new Store<StorageType>({
    defaults: {
        recentProjects: []
    }
}) as Store<StorageType> & {
    get: (key: keyof StorageType) => StorageType[keyof StorageType];
    set: (key: keyof StorageType, value: StorageType[keyof StorageType]) => void;
};

export default storage;
