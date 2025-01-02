import Messager from 'apps/frontend/message';
import React from 'react';

export type ActionProgress = {
    description: string;
    fraction: number;
};

export function useActions() {
    const [isWorking, setIsWorking] = React.useState(false);
    const [progress, setProgress] = React.useState<ActionProgress | null>(null);

    React.useEffect(() => {
        const unsub1 = Messager.on('actionStarted', event => {
            setIsWorking(true);
            setProgress(null);
        });
        const unsub2 = Messager.on('actionCompleted', event => {
            setIsWorking(false);
            setProgress(null);
        });
        const unsub3 = Messager.on('actionFailed', event => {
            setIsWorking(false);
            setProgress(null);
        });
        const unsub4 = Messager.on('actionProgress', event => {
            setProgress({
                description: event.description,
                fraction: event.progress
            });
        });

        return () => {
            unsub1();
            unsub2();
            unsub3();
            unsub4();
        };
    }, []);

    const undo = () => {
        Messager.send('actionUndo');
    };
    const redo = () => {
        Messager.send('actionRedo');
    };

    return {
        isWorking,
        progress,
        undo,
        redo
    };
}
