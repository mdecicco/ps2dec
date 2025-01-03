import { useEffect, useRef, useState } from 'react';

export function useElementSize<ElementType extends HTMLElement>() {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const ref = useRef<ElementType | null>(null);

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            if (entries.length === 0) return;
            const { width, height } = entries[0].contentRect;
            setSize({ width, height });
        });

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, [ref.current]);

    return { width: size.width, height: size.height, ref };
}
