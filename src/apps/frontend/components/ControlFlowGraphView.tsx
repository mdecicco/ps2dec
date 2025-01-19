import {
    Background,
    BackgroundVariant,
    Controls,
    Edge,
    Handle,
    Node,
    Position,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState
} from '@xyflow/react';
import ELK, { ElkExtendedEdge, ElkNode } from 'elkjs';
import React, { memo } from 'react';

import { SmartBezierEdge } from './SmartBezierEdge';

import '@xyflow/react/dist/style.css';

import { Instruction } from 'apps/frontend/components';
import { BasicBlock, ControlFlowGraph } from 'decompiler';

const elk = new ELK();

type BlockData = {
    block: BasicBlock;
};

type EdgeData = {
    color: string;
};

async function getLayoutedElements(
    nodes: (ElkNode & { data: BlockData })[],
    edges: (ElkExtendedEdge & { data: EdgeData })[]
): Promise<{ nodes: Node<BlockData>[]; edges: Edge[] }> {
    const graph: ElkNode = {
        id: 'root',
        layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.layered.spacing.nodeNodeBetweenLayers': '100',
            'elk.spacing.nodeNode': '80',
            'elk.spacing.edgeEdge': '100',
            'elk.edgeRouting': 'ORTHOGONAL',
            'elk.compaction.orthogonal': 'true',
            'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
            'elk.layered.spacing.edgeNodeBetweenLayers': '40',
            'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
            'elk.layered.nodePlacement.favorStraightEdges': 'true',
            'elk.layered.wrapping.strategy': 'SINGLE_EDGE',
            'elk.layered.wrapping.correctionFactor': '100',
            'elk.direction': 'DOWN'
        },
        children: nodes,
        edges
    };

    try {
        const layout = await elk.layout(graph);

        return {
            nodes: (layout.children || []).map(n => {
                const node = n as ElkNode & { data: BlockData };
                return {
                    ...node,
                    type: 'block',
                    position: { x: node.x || 0, y: node.y || 0 },
                    connectable: false
                };
            }),
            edges: (layout.edges || []).map(e => {
                const edge = e as ElkExtendedEdge & { data: EdgeData };
                return {
                    ...edge,
                    type: 'smart',
                    source: edge.sources[0],
                    target: edge.targets[0],
                    style: { stroke: edge.data.color }
                };
            })
        };
    } catch (error) {
        console.error(error);
        return { nodes: [], edges: [] };
    }
}

type CfgContextType = {
    cfg: ControlFlowGraph | null;
    hoveredBlock: BasicBlock | null;
    setHoveredBlock: (block: BasicBlock | null) => void;
};

const CfgContext = React.createContext<CfgContextType>({
    cfg: null,
    hoveredBlock: null,
    setHoveredBlock: () => {}
});

const CfgContextProvider = ({ cfg, children }: { cfg: ControlFlowGraph; children: React.ReactNode }) => {
    const [hoveredBlock, setHoveredBlock] = React.useState<BasicBlock | null>(null);
    return <CfgContext.Provider value={{ cfg, hoveredBlock, setHoveredBlock }}>{children}</CfgContext.Provider>;
};

const BlockNode: React.FC<{ data: BlockData; isConnectable: boolean }> = ({ data, isConnectable }) => {
    const { hoveredBlock } = React.useContext(CfgContext);

    let backgroundColor = '#4a4a4a';
    let borderColor = '#5a5a5a';
    let headerColor = 'white';
    if (hoveredBlock) {
        const self = data.block;

        const hoveredDominanceFrontier = hoveredBlock.dominanceFrontier;
        const isDominatedByHovered = hoveredBlock.strictlyDominates(self);
        const dominatesHovered = self.strictlyDominates(hoveredBlock);
        const isInHoveredDominanceFrontier = hoveredDominanceFrontier.has(self);
        const isHoveredImmediateDominator = self === hoveredBlock.immediateDominator;

        if (isDominatedByHovered) {
            backgroundColor = '#696740';
        } else if (dominatesHovered) {
            backgroundColor = '#406967';
        }

        if (isDominatedByHovered && dominatesHovered) {
            backgroundColor = '#694940';
        }

        if (isInHoveredDominanceFrontier) {
            borderColor = '#bd76e3';
        }

        if (isHoveredImmediateDominator) {
            headerColor = '#dbda97';
        }
    }

    return (
        <>
            <Handle type='target' position={Position.Top} style={{ opacity: 0 }} isConnectable={isConnectable} />
            <div
                style={{
                    backgroundColor,
                    width: '100%',
                    height: '100%',
                    borderRadius: '0.25rem',
                    padding: '5px',
                    fontFamily: 'Courier New',
                    color: 'white',
                    whiteSpace: 'pre',
                    display: 'flex',
                    flexDirection: 'column',
                    fontSize: '12px',
                    lineHeight: '12px',
                    border: `1px solid ${borderColor}`
                }}
            >
                <div
                    style={{
                        color: headerColor,
                        fontFamily: 'Courier New',
                        textAlign: 'center',
                        borderBottom: '1px solid #5a5a5a',
                        width: 'calc(100% - 10px)',
                        marginBottom: '5px'
                    }}
                >
                    {data.block.startAddressHex}
                </div>
                {data.block.instructions.map(instruction => (
                    <Instruction key={instruction.address} instruction={instruction} />
                ))}
            </div>
            <Handle type='source' position={Position.Bottom} style={{ opacity: 0 }} isConnectable={isConnectable} />
        </>
    );
};

const edgeTypes = {
    smart: SmartBezierEdge
};

const nodeTypes = {
    block: memo(BlockNode)
};

const ControlFlowGraphInner: React.FC = () => {
    const { cfg, setHoveredBlock } = React.useContext(CfgContext);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<BlockData>>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [building, setBuilding] = React.useState(false);
    const [storedCfg, setStoredCfg] = React.useState<ControlFlowGraph | null>(null);

    React.useEffect(() => {
        if (!cfg) return;

        const build = async () => {
            setBuilding(true);

            const elkNodes: (ElkNode & { data: BlockData })[] = [];
            const elkEdges: (ElkExtendedEdge & { data: EdgeData })[] = [];

            cfg.getAllBlocks().forEach(block => {
                elkNodes.push({
                    id: `${block.id}`,
                    data: { block },
                    width: 240,
                    // block.length + 1 for the instructions + header
                    // * 12 for the line height
                    // + 10 for the node padding (5px all around)
                    // + 5 for margin under the header
                    // + 2 for the border (1px all around)
                    height: (block.instructions.length + 1) * 12 + 10 + 5 + 2
                });

                block.successors.forEach(successor => {
                    let isTargeted = false;
                    if (block.branchInstruction) {
                        const target = block.branchInstruction.operands[block.branchInstruction.operands.length - 1];
                        if (typeof target === 'number') {
                            if (target === successor.startAddress) {
                                isTargeted = true;
                            }
                        }
                    }

                    elkEdges.push({
                        id: `${block.id}-${successor.id}`,
                        sources: [`${block.id}`],
                        targets: [`${successor.id}`],
                        data: {
                            color: isTargeted ? 'white' : 'gray'
                        }
                    });
                });
            });

            const result = await getLayoutedElements(elkNodes, elkEdges);
            setNodes(result.nodes);
            setEdges(result.edges);
            setBuilding(false);
        };

        if (cfg !== storedCfg && !building) {
            setStoredCfg(cfg);
            build();
        }
    }, [building, cfg, storedCfg]);

    return (
        <ReactFlow
            style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'transparent'
            }}
            nodes={nodes}
            edges={edges}
            edgeTypes={edgeTypes}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeMouseEnter={(e, node) => {
                setHoveredBlock(node.data.block);
            }}
            onNodeMouseLeave={() => setHoveredBlock(null)}
            fitView
            colorMode='dark'
            minZoom={0.1}
        >
            <Controls />
            <Background bgColor='#1e1e1e' variant={BackgroundVariant.Dots} />
        </ReactFlow>
    );
};

export const ControlFlowGraphView: React.FC<{ cfg: ControlFlowGraph }> = ({ cfg }) => {
    return (
        <ReactFlowProvider>
            <CfgContextProvider cfg={cfg}>
                <ControlFlowGraphInner />
            </CfgContextProvider>
        </ReactFlowProvider>
    );
};
