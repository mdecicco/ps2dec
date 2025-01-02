import { useEffect, useRef, useState } from 'react';

export function useElementHeight<ElementType extends HTMLElement>() {
    const [height, setHeight] = useState(0);
    const ref = useRef<ElementType | null>(null);

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            if (entries.length === 0) return;
            const { height } = entries[0].contentRect;
            setHeight(height);
        });

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, [ref.current]);

    return { height, ref };
}
