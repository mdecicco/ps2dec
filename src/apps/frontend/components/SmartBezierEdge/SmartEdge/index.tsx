import type { EdgeProps, InternalNode } from '@xyflow/react';
import { BaseEdge, BezierEdge } from '@xyflow/react';
import type { GetSmartEdgeOptions } from '../getSmartEdge';
import { getSmartEdge } from '../getSmartEdge';

export type EdgeElement = typeof BezierEdge;

export type SmartEdgeOptions = GetSmartEdgeOptions & {
    fallback?: EdgeElement;
};

export interface SmartEdgeProps extends EdgeProps {
    nodes: InternalNode[];
    options: SmartEdgeOptions;
}

export function SmartEdge({ nodes, options, ...edgeProps }: SmartEdgeProps) {
    const {
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        style,
        label,
        labelStyle,
        labelShowBg,
        labelBgStyle,
        labelBgPadding,
        labelBgBorderRadius,
        markerEnd,
        markerStart,
        interactionWidth
    } = edgeProps;

    const smartResponse = getSmartEdge({
        sourcePosition,
        targetPosition,
        sourceX,
        sourceY,
        targetX,
        targetY,
        options,
        nodes
    });

    const FallbackEdge = options.fallback || BezierEdge;

    if (smartResponse === null) {
        return <FallbackEdge {...edgeProps} />;
    }

    const { edgeCenterX, edgeCenterY, svgPathString } = smartResponse;

    return (
        <BaseEdge
            path={svgPathString}
            labelX={edgeCenterX}
            labelY={edgeCenterY}
            label={label}
            labelStyle={labelStyle}
            labelShowBg={labelShowBg}
            labelBgStyle={labelBgStyle}
            labelBgPadding={labelBgPadding}
            labelBgBorderRadius={labelBgBorderRadius}
            style={style}
            markerStart={markerStart}
            markerEnd={markerEnd}
            interactionWidth={interactionWidth}
        />
    );
}

export type SmartEdgeFunction = typeof SmartEdge;
