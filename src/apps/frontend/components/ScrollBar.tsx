import { Box } from '@mui/material';
import { useEffect, useState } from 'react';

type ScrollBarProps = {
    viewHeight: number;
    virtualHeight: number;
    scrollPos: number;
    onScrollPosChanged: (scrollPos: number) => void;
};

function getHandlePosition(viewHeight: number, virtualHeight: number, scrollPos: number) {
    return Math.min(Math.max(4, (scrollPos / virtualHeight) * (viewHeight - 24)), viewHeight - 24);
}

function getScrollPos(scrollFraction: number, virtualHeight: number, viewHeight: number) {
    return Math.min(Math.max(0, scrollFraction * virtualHeight - viewHeight), virtualHeight - viewHeight);
}

export const ScrollBar: React.FC<ScrollBarProps> = props => {
    const [handlePosition, setHandlePosition] = useState(
        getHandlePosition(props.viewHeight, props.virtualHeight, props.scrollPos)
    );
    const [tracking, setTracking] = useState(false);
    const [dragStart, setDragStart] = useState(0);
    const [handleStart, setHandleStart] = useState(0);
    const [savedScrollPos, setSavedScrollPos] = useState(props.scrollPos);
    const [savedViewHeight, setSavedViewHeight] = useState(props.viewHeight);
    const [savedVirtualHeight, setSavedVirtualHeight] = useState(props.virtualHeight);

    useEffect(() => {
        const frac = (handlePosition - 4) / (props.viewHeight - 28);
        const newScrollPos = getScrollPos(frac, props.virtualHeight, props.viewHeight);
        if (tracking && newScrollPos !== props.scrollPos) {
            setSavedScrollPos(newScrollPos);
            props.onScrollPosChanged(newScrollPos);
        }
    }, [tracking, handlePosition, props.scrollPos]);

    useEffect(() => {
        const mouseMove = (e: MouseEvent) => {
            if (!tracking) return;
            e.preventDefault();
            e.stopPropagation();

            const newHandlePosition = Math.min(Math.max(4, handleStart + e.clientY - dragStart), props.viewHeight - 24);
            setHandlePosition(newHandlePosition);

            const frac = (newHandlePosition - 4) / (props.viewHeight - 28);
            const scrollPos = getScrollPos(frac, props.virtualHeight, props.viewHeight);
            setSavedScrollPos(scrollPos);
            props.onScrollPosChanged(scrollPos);
        };

        const mouseUp = () => {
            setTracking(false);
        };

        window.addEventListener('mousemove', mouseMove);
        window.addEventListener('mouseup', mouseUp);

        return () => {
            window.removeEventListener('mousemove', mouseMove);
            window.removeEventListener('mouseup', mouseUp);
        };
    }, [tracking, handlePosition, props.viewHeight, props.virtualHeight, handleStart, dragStart]);

    useEffect(() => {
        let needsUpdate = false;
        if (props.viewHeight !== savedViewHeight) {
            setSavedViewHeight(props.viewHeight);
            needsUpdate = true;
        }
        if (props.virtualHeight !== savedVirtualHeight) {
            setSavedVirtualHeight(props.virtualHeight);
            needsUpdate = true;
        }
        if (props.scrollPos !== savedScrollPos) {
            setSavedScrollPos(props.scrollPos);
            needsUpdate = true;
        }
        if (!needsUpdate) return;

        setHandlePosition(getHandlePosition(props.viewHeight, props.virtualHeight, props.scrollPos));
    }, [props.viewHeight, props.scrollPos, props.virtualHeight]);

    return (
        <Box
            style={{
                height: '100%',
                minWidth: '20px',
                maxWidth: '20px',
                backgroundColor: '#292929',
                position: 'relative'
            }}
        >
            <Box
                style={{
                    top: `${handlePosition}px`,
                    left: '4px',
                    position: 'absolute',
                    width: '12px',
                    height: '20px',
                    borderRadius: '2px',
                    backgroundColor: '#ff9900'
                }}
                onMouseDown={e => {
                    setTracking(true);
                    setDragStart(e.clientY);
                    setHandleStart(handlePosition);
                }}
            />
        </Box>
    );
};
