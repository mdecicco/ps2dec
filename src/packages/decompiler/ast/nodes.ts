import { i } from 'decoder';
import { InductionVariable } from '../analysis/flow_loops';
import { Expression } from '../expr';

export enum NodeType {
    Block = 'Block',
    Statement = 'Statement',
    ForLoop = 'ForLoop',
    WhileLoop = 'WhileLoop',
    DoWhileLoop = 'DoWhileLoop',
    If = 'If',
    IfElse = 'IfElse',
    Expression = 'Expression'
}

export interface ASTNode {
    type: NodeType;
    parent: Node | null;
}

export interface ExpressionNode extends ASTNode {
    type: NodeType.Expression;
    expressionGen: () => Expression;
    instruction: i.Instruction;
    omit: boolean;
}

export interface BlockNode extends ASTNode {
    type: NodeType.Block;
    statements: StatementNode[];
}

export interface StatementNode extends ASTNode {
    type: NodeType.Statement;
    statement: Statement;
}

export interface ForLoopNode extends ASTNode {
    type: NodeType.ForLoop;
    init: StatementNode;
    condition: ExpressionNode;
    step: StatementNode;
    body: BlockNode;
    inductionVariable: InductionVariable;
}

export interface WhileLoopNode extends ASTNode {
    type: NodeType.WhileLoop;
    condition: ExpressionNode;
    body: BlockNode;
}

export interface DoWhileLoopNode extends ASTNode {
    type: NodeType.DoWhileLoop;
    condition: ExpressionNode;
    body: BlockNode;
}

export interface IfNode extends ASTNode {
    type: NodeType.If;
    condition: ExpressionNode;
    body: BlockNode;
}

export interface IfElseNode extends ASTNode {
    type: NodeType.IfElse;
    condition: ExpressionNode;
    thenBody: BlockNode;
    elseBody: BlockNode;
}

export type Statement = ExpressionNode | ForLoopNode | WhileLoopNode | DoWhileLoopNode | IfNode | IfElseNode;
export type Node =
    | ExpressionNode
    | BlockNode
    | StatementNode
    | ForLoopNode
    | WhileLoopNode
    | DoWhileLoopNode
    | IfNode
    | IfElseNode;
