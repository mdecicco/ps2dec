import type { EdgeProps, InternalNode, Node } from '@xyflow/react';
import { BezierEdge, useNodes, useReactFlow } from '@xyflow/react';
import { pathfindingAStarDiagonal, svgDrawSmoothLinePath } from './functions';
import type { SmartEdgeOptions } from './SmartEdge';
import { SmartEdge } from './SmartEdge';

const BezierConfiguration: SmartEdgeOptions = {
    drawEdge: svgDrawSmoothLinePath,
    generatePath: pathfindingAStarDiagonal,
    fallback: BezierEdge
};

export function SmartBezierEdge(props: EdgeProps) {
    const { getInternalNode } = useReactFlow();
    const nodes = useNodes<Node>();

    const internalNodes: InternalNode[] = [];
    nodes.forEach(node => {
        const internalNode = getInternalNode(node.id);
        if (internalNode) {
            internalNodes.push(internalNode);
        }
    });

    return <SmartEdge {...props} options={BezierConfiguration} nodes={internalNodes} />;
}
