import { i } from 'decoder';
import * as nodes from '../ast/nodes';
import { ControlFlowGraph } from './cfg';
import { SSAForm } from './ssa';
import { VariableDB } from './vardb';

export interface IASTAnalyzerPlugin {
    /**
     * Analyze the AST and identify/promote variables
     * @returns true if any changes were made
     */
    analyze(ast: nodes.Node): boolean;
}

export abstract class ASTAnalyzerPlugin implements IASTAnalyzerPlugin {
    protected m_ssa: SSAForm;
    protected m_vardb: VariableDB;
    protected m_cfg: ControlFlowGraph;

    constructor(ssa: SSAForm, vardb: VariableDB, cfg: ControlFlowGraph) {
        this.m_ssa = ssa;
        this.m_vardb = vardb;
        this.m_cfg = cfg;
    }

    analyzeRoot(ast: nodes.Node): boolean {
        return false;
    }

    analyze(ast: nodes.Node): boolean {
        let changed = false;

        if (!ast.parent) changed ||= this.analyzeRoot(ast);

        changed ||= this.analyzeAny(ast);

        switch (ast.type) {
            case nodes.NodeType.Block:
                changed ||= this.analyzeBlock(ast);
                break;
            case nodes.NodeType.Expression:
                changed ||= this.analyzeExpression(ast);
                break;
            case nodes.NodeType.Statement:
                changed ||= this.analyzeStatement(ast);
                break;
            case nodes.NodeType.If:
                changed ||= this.analyzeIf(ast);
                break;
            case nodes.NodeType.IfElse:
                changed ||= this.analyzeIf(ast);
                break;
            case nodes.NodeType.WhileLoop:
                changed ||= this.analyzeWhile(ast);
                break;
            case nodes.NodeType.ForLoop:
                changed ||= this.analyzeForLoop(ast);
                break;
            case nodes.NodeType.DoWhileLoop:
                changed ||= this.analyzeWhile(ast);
                break;
        }

        return changed;
    }

    analyzeAny(ast: nodes.Node) {
        return false;
    }

    analyzeBlock(ast: nodes.BlockNode) {
        let changed = false;
        for (const stmt of ast.statements) {
            changed ||= this.analyze(stmt);
        }

        return changed;
    }

    analyzeExpression(ast: nodes.ExpressionNode) {
        return false;
    }

    analyzeStatement(ast: nodes.StatementNode) {
        return this.analyze(ast.statement);
    }

    analyzeForLoop(ast: nodes.ForLoopNode) {
        let changed = false;
        changed ||= this.analyze(ast.init);
        changed ||= this.analyze(ast.step);
        changed ||= this.analyze(ast.body);
        return changed;
    }

    analyzeWhile(ast: nodes.WhileLoopNode | nodes.DoWhileLoopNode) {
        return this.analyze(ast.body);
    }

    analyzeIf(ast: nodes.IfNode | nodes.IfElseNode) {
        let changed = false;
        if (ast.type === nodes.NodeType.If) {
            changed ||= this.analyze(ast.body);
        } else {
            changed ||= this.analyze(ast.thenBody);
            changed ||= this.analyze(ast.elseBody);
        }
        return changed;
    }

    instructionsIn(ast: nodes.Node): i.Instruction[] {
        return this.collectInstructions(ast).sort((a, b) => a.address - b.address);
    }

    private collectInstructions(ast: nodes.Node): i.Instruction[] {
        const instructions: i.Instruction[] = [];

        switch (ast.type) {
            case nodes.NodeType.Block:
                for (const stmt of ast.statements) {
                    instructions.push(...this.collectInstructions(stmt));
                }
                break;
            case nodes.NodeType.Expression:
                instructions.push(ast.instruction);
                break;
            case nodes.NodeType.Statement:
                instructions.push(...this.collectInstructions(ast.statement));
                break;
            case nodes.NodeType.If:
                instructions.push(...this.collectInstructions(ast.body));
                break;
            case nodes.NodeType.IfElse:
                instructions.push(...this.collectInstructions(ast.thenBody));
                instructions.push(...this.collectInstructions(ast.elseBody));
                break;
            case nodes.NodeType.WhileLoop:
                instructions.push(...this.collectInstructions(ast.body));
                break;
            case nodes.NodeType.ForLoop:
                instructions.push(
                    ...this.collectInstructions(ast.body).filter(instr => {
                        if (instr === ast.condition.instruction) return false;
                        if (
                            ast.step.statement.type === nodes.NodeType.Expression &&
                            instr === ast.step.statement.instruction
                        )
                            return false;
                        return true;
                    })
                );
                break;
            case nodes.NodeType.DoWhileLoop:
                instructions.push(...this.collectInstructions(ast.body));
                break;
        }

        return instructions;
    }
}
