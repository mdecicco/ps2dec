import Messager from 'apps/frontend/message';
import { ViewId } from 'packages/types';
import * as React from 'react';

export function useRecentProjects() {
    const [projects, setProjects] = React.useState<string[]>([]);

    React.useEffect(() => {
        const unbind = Messager.on('setRecentProjects', data => {
            setProjects(data.projectPaths);
        });

        Messager.send('getRecentProjects');

        return unbind;
    }, []);

    return projects;
}

export function useProject() {
    const [loading, setLoading] = React.useState(false);
    const [path, setPath] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const create = () => {
        setLoading(true);
        Messager.send('createProject');
    };

    const open = (path?: string) => {
        setLoading(true);
        Messager.send('openProject', path || null);
    };

    const showView = (view: ViewId) => {
        Messager.send('showWindow', view);
    };

    const undo = () => {
        Messager.send('actionUndo');
    };

    const redo = () => {
        Messager.send('actionRedo');
    };

    React.useEffect(() => {
        const unsub1 = Messager.on('projectLoaded', data => {
            setPath(data.path);
            setLoading(false);
        });

        const unsub4 = Messager.on('projectLoadCancelled', () => {
            setError(null);
            setLoading(false);
        });

        const unsub2 = Messager.on('setProject', data => {
            setPath(data.path);
            setLoading(false);
        });

        const unsub3 = Messager.on('projectLoadFailed', data => {
            setError(data.error);
            setLoading(false);
        });

        Messager.send('getProject');

        return () => {
            unsub1();
            unsub2();
            unsub3();
            unsub4();
        };
    }, []);

    return {
        create,
        open,
        showView,
        undo,
        redo,
        loading,
        path,
        error
    };
}
