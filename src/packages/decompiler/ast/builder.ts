import { Expr, i } from 'decoder';
import { DecompVariable } from 'packages/decompiler/analysis';
import { InductionVariable } from '../analysis/flow_loops';
import * as nodes from './nodes';

export class ASTBuilder {
    /**
     * Create a new block node
     */
    createBlock(statements: nodes.StatementNode[]): nodes.BlockNode {
        return {
            type: nodes.NodeType.Block,
            parent: null,
            statements
        };
    }

    /**
     * Create an expression node from an expression
     */
    createExpression(
        instruction: i.Instruction,
        omit: boolean,
        expressionGen: () => Expr.Expression | null
    ): nodes.ExpressionNode {
        return {
            type: nodes.NodeType.Expression,
            parent: null,
            instruction,
            omit,
            expressionGen
        };
    }

    /**
     * Create a statement node from an expression
     */
    createStatement(statement: nodes.Statement): nodes.StatementNode {
        return {
            type: nodes.NodeType.Statement,
            parent: null,
            statement
        };
    }

    /**
     * Create a variable declaration node
     */
    createVariableDeclaration(
        variable: DecompVariable,
        initializer: nodes.ExpressionNode | null
    ): nodes.VariableDeclarationNode {
        return {
            type: nodes.NodeType.VariableDeclaration,
            parent: null,
            variable,
            initializer
        };
    }

    /**
     * Create a for loop node
     */
    createForLoop(
        init: nodes.StatementNode | null,
        condition: nodes.ExpressionNode,
        step: nodes.ExpressionNode | null,
        body: nodes.BlockNode,
        inductionVariable: InductionVariable
    ): nodes.ForLoopNode {
        const node: nodes.ForLoopNode = {
            type: nodes.NodeType.ForLoop,
            parent: null,
            init,
            condition,
            step,
            body,
            inductionVariable
        };

        if (init) init.parent = node;
        if (step) step.parent = node;
        body.parent = node;

        return node;
    }

    /**
     * Create a while loop node
     */
    createWhileLoop(condition: nodes.ExpressionNode, body: nodes.BlockNode): nodes.WhileLoopNode {
        const node: nodes.WhileLoopNode = {
            type: nodes.NodeType.WhileLoop,
            parent: null,
            condition,
            body
        };

        body.parent = node;
        return node;
    }

    /**
     * Create a do-while loop node
     */
    createDoWhileLoop(condition: nodes.ExpressionNode, body: nodes.BlockNode): nodes.DoWhileLoopNode {
        const node: nodes.DoWhileLoopNode = {
            type: nodes.NodeType.DoWhileLoop,
            parent: null,
            condition,
            body
        };

        body.parent = node;
        return node;
    }

    /**
     * Create an if node (no else)
     */
    createIf(condition: nodes.ExpressionNode, body: nodes.BlockNode): nodes.IfNode {
        const node: nodes.IfNode = {
            type: nodes.NodeType.If,
            parent: null,
            condition,
            body
        };

        body.parent = node;
        return node;
    }

    /**
     * Create an if-else node
     */
    createIfElse(
        condition: nodes.ExpressionNode,
        thenBody: nodes.BlockNode,
        elseBody: nodes.BlockNode
    ): nodes.IfElseNode {
        const node: nodes.IfElseNode = {
            type: nodes.NodeType.IfElse,
            parent: null,
            condition,
            thenBody,
            elseBody
        };

        thenBody.parent = node;
        elseBody.parent = node;
        return node;
    }

    /**
     * Add a statement to a block, setting up parent relationship
     */
    addStatement(block: nodes.BlockNode, statement: nodes.StatementNode): void {
        statement.parent = block;
        block.statements.push(statement);
    }
}
