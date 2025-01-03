import { i, Op, Reg } from 'decoder';
import { ASTBuilder } from '../ast/builder';
import * as nodes from '../ast/nodes';
import { CodeBuilder } from '../codegen/codebuilder';
import { Decompiler } from '../decompiler';
import * as Expr from '../expr/base';
import { PrimitiveType } from '../typesys';
import { BasicBlock, ControlFlowGraph } from './cfg';
import { DominatorInfo } from './dominators';
import { BranchChain, IfStatement, SSABranchAnalyzer } from './flow_branches';
import { Loop, LoopType, SSALoopAnalyzer } from './flow_loops';
import { SSAForm } from './ssa';

export class SSAControlFlowAnalyzer {
    private m_loops: Loop[] = [];
    private m_branches: IfStatement[] = [];
    private m_branchChains: BranchChain[] = [];
    private m_dominators: DominatorInfo;
    private m_builder: ASTBuilder = new ASTBuilder();
    private m_cfg: ControlFlowGraph;
    private m_ssa: SSAForm;
    private m_astLoopStack: Loop[] = [];

    constructor(cfg: ControlFlowGraph, dominators: DominatorInfo, ssa: SSAForm) {
        this.m_cfg = cfg;
        this.m_dominators = dominators;
        this.m_ssa = ssa;
    }

    analyze() {
        // Find loops first
        const loopAnalyzer = new SSALoopAnalyzer(this.m_cfg, this.m_dominators, this.m_ssa);
        this.m_loops = loopAnalyzer.findLoops();

        // Get all loop branch instructions
        const loopBranches = this.m_loops.flatMap(loop => (loop.condition ? [loop.condition.instruction] : []));

        // Find non-loop branches
        const branchAnalyzer = new SSABranchAnalyzer(this.m_cfg, this.m_dominators, this.m_ssa, loopBranches);
        const branchResult = branchAnalyzer.findBranches();
        this.m_branches = branchResult.branches;
        this.m_branchChains = branchResult.chains;
    }

    buildAST(): nodes.BlockNode {
        this.m_astLoopStack = [];
        return this.processBlocks(new Set(this.m_cfg.getAllBlocks()));
    }

    private processBlocks(blocks: Set<BasicBlock>, currentStructure?: Loop | IfStatement): nodes.BlockNode {
        // Find structures contained within these blocks, excluding the current structure
        const containedLoops = this.m_loops.filter(
            loop => loop !== currentStructure && Array.from(loop.blocks).every(b => blocks.has(b))
        );

        const containedBranches = this.m_branches.filter(
            branch => branch !== currentStructure && blocks.has(this.m_cfg.getBlock(branch.condition.address)!)
        );

        // Get outermost structures
        const outerLoops = containedLoops.filter(
            loop => !this.isContainedInAnyStructure(loop, containedLoops, containedBranches)
        );

        const outerBranches = containedBranches.filter(
            branch => !this.isContainedInAnyStructure(branch, containedLoops, containedBranches)
        );

        // Sort structures by address
        const structures = [
            ...outerLoops.map(l => ({ type: 'loop' as const, struct: l })),
            ...outerBranches.map(b => ({ type: 'branch' as const, struct: b }))
        ].sort((a, b) => this.getStructureAddress(a) - this.getStructureAddress(b));

        // Process blocks and structures in order
        const statements: nodes.StatementNode[] = [];
        let remainingBlocks = new Set(blocks);

        for (const struct of structures) {
            // Add statements from blocks before this structure
            const structAddr = this.getStructureAddress(struct);
            const preBlocks = this.getBlocksBefore(remainingBlocks, structAddr);
            if (preBlocks.size > 0) {
                const preInstructions = Array.from(preBlocks).flatMap(b => b.instructions);
                statements.push(...this.instructionsToStatements(preInstructions));
                preBlocks.forEach(b => remainingBlocks.delete(b));
            }

            // Process the structure
            if (struct.type === 'loop') {
                statements.push(this.buildLoopNode(struct.struct, remainingBlocks));
                struct.struct.blocks.forEach(b => remainingBlocks.delete(b));
            } else {
                statements.push(this.buildBranchNode(struct.struct, remainingBlocks));
                struct.struct.thenBlocks.forEach(b => remainingBlocks.delete(b));
                struct.struct.elseBlocks.forEach(b => remainingBlocks.delete(b));
            }
        }

        // Add statements from any remaining blocks
        if (remainingBlocks.size > 0) {
            const remainingInstructions = Array.from(remainingBlocks).flatMap(b => b.instructions);
            statements.push(...this.instructionsToStatements(remainingInstructions));
        }

        return this.m_builder.createBlock(statements);
    }

    private getBlocksBefore(blocks: Set<BasicBlock>, address: number): Set<BasicBlock> {
        const result = new Set<BasicBlock>();
        for (const block of blocks) {
            if (block.startAddress < address) {
                result.add(block);
            }
        }
        return result;
    }

    private isContainedInAnyStructure(structure: Loop | IfStatement, loops: Loop[], branches: IfStatement[]): boolean {
        if ('joinBlock' in structure) {
            const condBlock = this.m_cfg.getBlock(structure.condition.address)!;

            // Check if contained in any loop
            if (loops.some(loop => loop.blocks.has(condBlock))) {
                return true;
            }

            // Check if contained in another branch
            return branches.some(
                other => other !== structure && (other.thenBlocks.has(condBlock) || other.elseBlocks.has(condBlock))
            );
        }

        const blocks = Array.from(structure.blocks);

        // Check if contained in another loop
        if (loops.some(other => other !== structure && blocks.every(b => other.blocks.has(b)))) {
            return true;
        }

        // Check if contained in any branch
        return branches.some(other => blocks.every(b => other.thenBlocks.has(b) || other.elseBlocks.has(b)));
    }

    private instructionsToStatements(instructions: i.Instruction[]): nodes.StatementNode[] {
        const decomp = Decompiler.get();
        const stmts: nodes.StatementNode[] = [];

        const allowedBranches = new Set([Op.Code.b, Op.Code.jal, Op.Code.jalr, Op.Code.j, Op.Code.jr]);
        const skipIndices = new Set<number>();

        const handleInstr = (instr: i.Instruction) => {
            if (instr.isBranch && !allowedBranches.has(instr.code)) return;

            if (decomp.isAddressIgnored(instr.address)) return;

            // If this is the step instruction for any loop we're in, skip it
            if (this.m_astLoopStack.some(loop => loop.inductionVar!.stepInstruction === instr)) return;

            if (instr.code === Op.Code.jr && Reg.compare(instr.reads[0], { type: Reg.Type.EE, id: Reg.EE.RA })) {
                let retString = 'return';

                const currentFunc = decomp.cache.func;
                if (currentFunc.returnLocation) {
                    if ('reg' in currentFunc.returnLocation) {
                        const returnExpr = this.m_ssa.getMostRecentDef(instr, currentFunc.returnLocation.reg);
                        retString += ` ${returnExpr}`;
                    } else {
                        const returnExpr = this.m_ssa.getMostRecentDef(instr, currentFunc.returnLocation.offset);
                        retString += ` ${returnExpr}`;
                    }
                }

                const stmt = this.m_builder.createStatement(
                    this.m_builder.createExpression(instr, false, () => {
                        const gen = new Expr.RawString(retString, null, code => {
                            code.keyword('return');

                            if (currentFunc.returnLocation) {
                                code.whitespace(1);

                                let retExpr: Expr.Expression | null = null;
                                if ('reg' in currentFunc.returnLocation) {
                                    retExpr = this.m_ssa.getMostRecentDef(instr, currentFunc.returnLocation.reg);
                                } else {
                                    retExpr = this.m_ssa.getMostRecentDef(instr, currentFunc.returnLocation.offset);
                                }

                                if (retExpr) code.expression(retExpr);
                                else code.comment('Failed to determine return value');
                            }
                        });
                        gen.address = instr.address;
                        return gen;
                    })
                );
                stmts.push(stmt);
                return;
            }

            let omit = false;

            if (instr.code === Op.Code.jal) {
                // Calls will have an effect on the program state, so we MUST ensure that if the call sets a register,
                // if that register is never used again, the call should still be shown in the AST
                // Find out if the register set by the call is used again
                const target = instr.operands[instr.operands.length - 1] as number;
                const func = Decompiler.get().funcDb.findFunctionByAddress(target);
                if (func && func.returnLocation) {
                    if ('reg' in func.returnLocation) {
                        const reg = func.returnLocation.reg;
                        if (this.m_ssa.hasUses(instr, reg)) omit = true;
                    } else {
                        const offset = func.returnLocation.offset;
                        if (this.m_ssa.hasUses(instr, offset)) omit = true;
                    }
                }
            } else if (instr.code === Op.Code.jalr) {
                // Indirect calls are more complicated, just log it as is for now
            } else {
                // Skip instructions that set registers (they will appear in other expressions that use the results)
                if (instr.writes.length > 0) omit = true;
            }

            const stmt = this.m_builder.createStatement(
                this.m_builder.createExpression(instr, omit, () => instr.toExpression())
            );
            stmts.push(stmt);
        };

        for (let i = 0; i < instructions.length; i++) {
            if (skipIndices.has(i)) continue;

            const instr = instructions[i];
            if (instr.isBranch && !instr.isLikelyBranch) {
                skipIndices.add(i + 1);
                handleInstr(instructions[i + 1]);
            }

            handleInstr(instr);
        }

        return stmts;
    }

    private getStructureAddress(
        struct: { type: 'loop'; struct: Loop } | { type: 'branch'; struct: IfStatement }
    ): number {
        if (struct.type === 'loop') {
            return struct.struct.header.startAddress;
        } else {
            return struct.struct.condition.address;
        }
    }

    private buildLoopNode(loop: Loop, remainingBlocks: Set<BasicBlock>): nodes.StatementNode {
        this.m_astLoopStack.push(loop);
        const bodyBlocks = new Set(Array.from(remainingBlocks).filter(b => loop.blocks.has(b)));
        const body = this.processBlocks(bodyBlocks, loop);

        // Get condition expression
        let condition = loop.condition?.instruction.toExpression();
        if (condition instanceof Expr.ConditionalBranch) {
            condition = condition.condition;
        }

        // get expression that corresponds to induction variable initialization
        const initInstr = loop.inductionVar!.initInstruction;
        const stepInstr = loop.inductionVar!.stepInstruction;

        const condExpr = this.m_builder.createExpression(loop.condition!.instruction, false, () => {
            let expr = loop.condition!.instruction.toExpression();
            if (expr instanceof Expr.ConditionalBranch) {
                expr = expr.condition;
            }

            expr.address = loop.condition!.instruction.address;
            return expr;
        });

        switch (loop.type) {
            case LoopType.For: {
                const init = this.m_builder.createStatement(
                    this.m_builder.createExpression(initInstr, false, () => {
                        const gen = initInstr.toExpression();
                        gen.address = initInstr.address;
                        return gen;
                    })
                );
                const step = this.m_builder.createStatement(
                    this.m_builder.createExpression(stepInstr, false, () => {
                        const gen = stepInstr.toExpression();
                        gen.address = stepInstr.address;
                        return gen;
                    })
                );
                const stmt = this.m_builder.createStatement(
                    this.m_builder.createForLoop(init, condExpr, step, body, loop.inductionVar!)
                );

                this.m_astLoopStack.pop();
                return stmt;
            }

            case LoopType.While: {
                const stmt = this.m_builder.createStatement(this.m_builder.createWhileLoop(condExpr, body));
                this.m_astLoopStack.pop();
                return stmt;
            }

            case LoopType.DoWhile: {
                const stmt = this.m_builder.createStatement(this.m_builder.createDoWhileLoop(condExpr, body));
                this.m_astLoopStack.pop();
                return stmt;
            }

            default:
                // Fallback to while loop
                const stmt = this.m_builder.createStatement(this.m_builder.createWhileLoop(condExpr, body));
                this.m_astLoopStack.pop();
                return stmt;
        }
    }

    private buildBranchNode(branch: IfStatement, remainingBlocks: Set<BasicBlock>): nodes.StatementNode {
        const thenBlocks = new Set(Array.from(remainingBlocks).filter(b => branch.thenBlocks.has(b)));
        const elseBlocks = new Set(Array.from(remainingBlocks).filter(b => branch.elseBlocks.has(b)));

        const thenBody = thenBlocks.size > 0 ? this.processBlocks(thenBlocks, branch) : undefined;
        const elseBody = elseBlocks.size > 0 ? this.processBlocks(elseBlocks, branch) : undefined;

        // Get condition expression
        let condition = branch.condition.toExpression().reduce();
        if (condition instanceof Expr.ConditionalBranch) {
            condition = condition.condition.reduce();
        }

        const condExpr = this.m_builder.createExpression(branch.condition, false, () => {
            let expr = branch.condition.toExpression().reduce();
            if (expr instanceof Expr.ConditionalBranch) {
                expr = expr.condition.reduce();
            }
            expr.address = branch.condition.address;

            if (!thenBody && elseBody) {
                // If block with inverted condition
                if (Expr.isLogical(condition)) expr = condition.logicalInversion();
                else expr = new Expr.Not(condition).copyFrom(condition);

                // reduce it using conditional branch logic
                const b = new Expr.ConditionalBranch(expr, 0).reduce() as Expr.ConditionalBranch;
                expr = b.condition;
            }

            return expr;
        });

        if (!thenBody && elseBody) {
            return this.m_builder.createStatement(this.m_builder.createIf(condExpr, elseBody));
        }

        if (thenBody && !elseBody) {
            // Simple if with no else
            return this.m_builder.createStatement(this.m_builder.createIf(condExpr, thenBody));
        }

        if (!(thenBody && elseBody)) {
            throw new Error('No then or else body found for branch');
        }

        // If-else
        return this.m_builder.createStatement(this.m_builder.createIfElse(condExpr, thenBody, elseBody));
    }

    public generateCondition(cond: Expr.Expression, code: CodeBuilder, invert?: boolean): void {
        if (invert) {
            if (Expr.isLogical(cond)) cond = cond.logicalInversion();
            else cond = new Expr.Not(cond).copyFrom(cond);
        }

        // reduce it using conditional branch logic
        const b = new Expr.ConditionalBranch(cond, 0).reduce() as Expr.ConditionalBranch;
        cond = b.condition;

        code.expression(cond);
    }

    public generate(ast: nodes.Node, code: CodeBuilder): void {
        switch (ast.type) {
            case nodes.NodeType.Block:
                let didGenerate = false;
                for (let i = 0; i < ast.statements.length; i++) {
                    if (didGenerate) code.newLine();
                    didGenerate = false;
                    let curLen = code.code.length;
                    const stmt = ast.statements[i];
                    this.generate(stmt.statement, code);
                    didGenerate = code.code.length > curLen;
                }
                break;
            case nodes.NodeType.Expression:
                this.generateExpression(ast, code);
                break;
            case nodes.NodeType.Statement:
                this.generate(ast.statement, code);
                break;
            case nodes.NodeType.ForLoop:
                this.generateForLoop(ast, code);
                break;
            case nodes.NodeType.WhileLoop:
                code.pushAddress(ast.condition.instruction.address);
                code.keyword('while');
                code.whitespace(1);
                code.punctuation('(');
                this.generateCondition(ast.condition.expressionGen(), code);
                code.punctuation(')');
                code.whitespace(1);
                code.punctuation('{');
                code.popAddress();

                code.indent();
                code.newLine();
                this.generate(ast.body, code);
                code.unindent();
                code.newLine();

                code.pushAddress(ast.condition.instruction.address);
                code.punctuation('}');
                code.popAddress();
                break;
            case nodes.NodeType.DoWhileLoop:
                code.pushAddress(ast.condition.instruction.address);
                code.keyword('do');
                code.whitespace(1);
                code.punctuation('{');
                code.popAddress();

                code.indent();
                code.newLine();
                this.generate(ast.body, code);
                code.unindent();
                code.newLine();

                code.pushAddress(ast.condition.instruction.address);
                code.punctuation('}');
                code.whitespace(1);
                code.keyword('while');
                code.whitespace(1);
                code.punctuation('(');
                this.generateCondition(ast.condition.expressionGen(), code);
                code.punctuation(')');
                code.popAddress();
                break;
            case nodes.NodeType.If:
                code.pushAddress(ast.condition.instruction.address);
                code.keyword('if');
                code.whitespace(1);
                code.punctuation('(');
                this.generateCondition(ast.condition.expressionGen(), code);
                code.punctuation(')');
                code.whitespace(1);
                code.punctuation('{');
                code.popAddress();

                code.indent();
                code.newLine();
                this.generate(ast.body, code);
                code.unindent();
                code.newLine();

                code.pushAddress(ast.condition.instruction.address);
                code.punctuation('}');
                code.popAddress();
                break;
            case nodes.NodeType.IfElse:
                const thenIsEmpty = !ast.thenBody.statements.some(
                    stmt => stmt.statement.type !== nodes.NodeType.Expression || !stmt.statement.omit
                );
                const elseIsEmpty = !ast.elseBody.statements.some(
                    stmt => stmt.statement.type !== nodes.NodeType.Expression || !stmt.statement.omit
                );

                if (thenIsEmpty && elseIsEmpty) {
                    code.pushAddress(ast.condition.instruction.address);
                    code.comment('// Empty if-else');
                    code.popAddress();
                    code.newLine();

                    // still need to run the expression generators
                    ast.thenBody.statements.forEach(stmt => {
                        if (stmt.statement.type === nodes.NodeType.Expression) {
                            stmt.statement.expressionGen();
                        }
                    });
                    ast.elseBody.statements.forEach(stmt => {
                        if (stmt.statement.type === nodes.NodeType.Expression) {
                            stmt.statement.expressionGen();
                        }
                    });
                    break;
                }

                if (elseIsEmpty) {
                    code.pushAddress(ast.condition.instruction.address);
                    code.keyword('if');
                    code.whitespace(1);
                    code.punctuation('(');
                    this.generateCondition(ast.condition.expressionGen(), code);
                    code.punctuation(')');
                    code.whitespace(1);
                    code.punctuation('{');
                    code.popAddress();

                    code.indent();
                    code.newLine();
                    this.generate(ast.thenBody, code);
                    code.unindent();
                    code.newLine();

                    code.pushAddress(ast.condition.instruction.address);
                    code.punctuation('}');
                    code.popAddress();

                    // still need to run the expression generators
                    ast.elseBody.statements.forEach(stmt => {
                        if (stmt.statement.type === nodes.NodeType.Expression) {
                            stmt.statement.expressionGen();
                        }
                    });
                    break;
                }

                if (thenIsEmpty) {
                    // If block with inverted condition

                    // still need to run the expression generators
                    ast.thenBody.statements.forEach(stmt => {
                        if (stmt.statement.type === nodes.NodeType.Expression) {
                            stmt.statement.expressionGen();
                        }
                    });

                    let cond = ast.condition.expressionGen();

                    code.pushAddress(ast.condition.instruction.address);
                    code.keyword('if');
                    code.whitespace(1);
                    code.punctuation('(');
                    this.generateCondition(cond, code, true);
                    code.punctuation(')');
                    code.whitespace(1);
                    code.punctuation('{');
                    code.popAddress();

                    code.indent();
                    code.newLine();
                    this.generate(ast.elseBody, code);
                    code.unindent();
                    code.newLine();

                    code.pushAddress(ast.condition.instruction.address);
                    code.punctuation('}');
                    code.popAddress();
                    break;
                }

                code.pushAddress(ast.condition.instruction.address);
                code.keyword('if');
                code.whitespace(1);
                code.punctuation('(');
                this.generateCondition(ast.condition.expressionGen(), code);
                code.punctuation(')');
                code.whitespace(1);
                code.punctuation('{');
                code.popAddress();

                code.indent();
                code.newLine();
                this.generate(ast.thenBody, code);
                code.unindent();
                code.newLine();

                code.pushAddress(ast.condition.instruction.address);
                code.punctuation('}');
                code.whitespace(1);
                code.keyword('else');
                code.whitespace(1);
                code.punctuation('{');
                code.popAddress();

                code.indent();
                code.newLine();
                this.generate(ast.elseBody, code);
                code.unindent();
                code.newLine();

                code.pushAddress(ast.condition.instruction.address);
                code.punctuation('}');
                code.popAddress();
                break;
        }
    }

    private generateExpression(ast: nodes.ExpressionNode, code: CodeBuilder): void {
        // determine if this expression assignes a value to a variable
        const decomp = Decompiler.get();
        if (decomp.isAddressIgnored(ast.instruction.address)) return;

        let didDeclareOrAssign = false;
        code.pushAddress(ast.instruction.address);

        ast.instruction.writes.forEach(w => {
            const def = this.m_ssa.getDef(ast.instruction, w);
            if (!def) return;

            const v = decomp.vars.getVariableWithVersion(w, def.version);
            if (!v) return;

            // If the variable is just being moved to another location, skip it
            if (def.value instanceof Expr.Variable && def.value.value === v) return;

            const versions = v.getSSAVersions(w).sort((a, b) => a - b);
            if (versions[0] === def.version) {
                if (!v.hasDeclaration) {
                    // If it's the first one to write to the variable, declare it
                    code.dataType(v.type);
                    code.whitespace(1);
                    code.variable(v);
                    code.whitespace(1);
                    code.keyword('=');
                    code.whitespace(1);
                    code.expression(def.value);
                    code.punctuation(';');
                }
            } else {
                // Otherwise, just print the assignment
                code.variable(v);
                code.whitespace(1);
                code.keyword('=');
                code.whitespace(1);
                code.expression(def.value);
                code.punctuation(';');
            }

            didDeclareOrAssign = true;
        });

        code.popAddress();
        if (didDeclareOrAssign) return;

        const expr = ast.expressionGen();
        if (expr instanceof Expr.Call) {
            // Calls will have an effect on the program state, so we MUST ensure that if the call sets a register,
            // if that register is never used again, the call should still be shown in the AST
            // Find out if the register set by the call is used again
            const func = expr.target;
            if (func && func.returnLocation) {
                if ('reg' in func.returnLocation) {
                    const reg = func.returnLocation.reg;
                    if (this.m_ssa.hasUses(ast.instruction, reg)) return;
                } else {
                    const offset = func.returnLocation.offset;
                    if (this.m_ssa.hasUses(ast.instruction, offset)) return;
                }
            }
        } else if (expr instanceof Expr.IndirectCall) {
            // Indirect calls are more complicated, just log it as is for now
        } else {
            // Skip instructions that set registers (they will appear in other expressions that use the results)
            if (ast.instruction.writes.length > 0) return;
        }

        if (expr instanceof Expr.Null) return;
        code.pushAddress(ast.instruction.address);
        code.expression(expr);
        code.punctuation(';');
        code.popAddress();
    }

    private generateForLoop(ast: nodes.ForLoopNode, code: CodeBuilder): void {
        const decomp = Decompiler.get();

        const ivar = decomp.vars.getVariableWithVersion(
            ast.inductionVariable.register,
            ast.inductionVariable.initVersion
        );

        code.pushAddress(ast.condition.instruction.address);
        code.keyword('for');
        code.whitespace(1);
        code.punctuation('(');

        if (ast.init.type === nodes.NodeType.Statement && ast.init.statement.type === nodes.NodeType.Expression) {
            if (ivar) {
                let expr: Expr.Expression | null = ast.init.statement.expressionGen();
                if (expr instanceof Expr.Null) {
                    expr = decomp.ssa.getValueForVersion(
                        ast.inductionVariable.register,
                        ast.inductionVariable.initVersion
                    );
                }

                if (expr) {
                    code.pushAddress(ast.init.statement.instruction.address);
                    code.dataType(ivar.type);
                    code.whitespace(1);
                    code.variable(ivar);
                    code.whitespace(1);
                    code.punctuation('=');
                    code.whitespace(1);
                    code.expression(expr);
                    code.punctuation(';');
                    code.popAddress();
                }
            } else {
                code.pushAddress(ast.init.statement.instruction.address);
                code.expression(ast.init.statement.expressionGen());
                code.punctuation(';');
                code.popAddress();
            }
        } else {
            code.comment('/* init expr not found */');
            code.punctuation(';');
        }

        code.whitespace(1);
        this.generateCondition(ast.condition.expressionGen(), code);
        code.punctuation(';');
        code.whitespace(1);

        if (ast.step.type === nodes.NodeType.Statement && ast.step.statement.type === nodes.NodeType.Expression) {
            code.pushAddress(ast.step.statement.instruction.address);
            let didMinify = false;
            if (ivar) {
                let expr: Expr.Expression | null = ast.step.statement.expressionGen();
                if (expr instanceof Expr.Null) {
                    expr = decomp.ssa.getValueForVersion(
                        ast.inductionVariable.register,
                        ast.inductionVariable.stepVersion
                    );
                }

                if (expr) {
                    if (expr instanceof Expr.Add) {
                        if (expr.lhs instanceof Expr.Variable && expr.lhs.value === ivar) {
                            if (expr.rhs instanceof Expr.Imm) {
                                const type = expr.rhs.type as PrimitiveType;
                                if (type.isFloatingPoint && expr.rhs.toF32() === 1.0) {
                                    code.variable(ivar);
                                    code.punctuation('++');
                                    didMinify = true;
                                } else if (!type.isFloatingPoint && expr.rhs.value === 1n) {
                                    code.variable(ivar);
                                    code.punctuation('++');
                                    didMinify = true;
                                }
                            }

                            if (!didMinify) {
                                code.variable(ivar);
                                code.whitespace(1);
                                code.punctuation('+=');
                                code.whitespace(1);
                                code.expression(expr.rhs);
                                didMinify = true;
                            }
                        }
                    } else if (expr instanceof Expr.Sub) {
                        if (expr.lhs instanceof Expr.Variable && expr.lhs.value === ivar) {
                            if (expr.rhs instanceof Expr.Imm) {
                                const type = expr.rhs.type as PrimitiveType;
                                if (type.isFloatingPoint && expr.rhs.toF32() === 1.0) {
                                    code.variable(ivar);
                                    code.punctuation('--');
                                    didMinify = true;
                                } else if (!type.isFloatingPoint && expr.rhs.value === 1n) {
                                    code.variable(ivar);
                                    code.punctuation('--');
                                    didMinify = true;
                                }
                            }

                            if (!didMinify) {
                                code.variable(ivar);
                                code.whitespace(1);
                                code.punctuation('-=');
                                code.whitespace(1);
                                code.expression(expr.rhs);
                                didMinify = true;
                            }
                        }
                    }

                    if (!didMinify) {
                        code.variable(ivar);
                        code.whitespace(1);
                        code.punctuation('=');
                        code.whitespace(1);
                        code.expression(expr);
                        didMinify = true;
                    }
                }
            }

            if (!didMinify) code.expression(ast.step.statement.expressionGen());
            code.popAddress();
        }

        code.punctuation(')');
        code.whitespace(1);
        code.punctuation('{');
        code.indent();
        code.newLine();

        let didGenerate = false;
        ast.body.statements.forEach((stmt, idx) => {
            if (didGenerate) code.newLine();
            didGenerate = false;
            let curLen = code.code.length;

            if (stmt.statement.type === nodes.NodeType.Expression) {
                if (stmt.statement.instruction === ast.condition.instruction) return;
                if (
                    ast.step.statement.type === nodes.NodeType.Expression &&
                    stmt.statement.instruction === ast.step.statement.instruction
                )
                    return;
                this.generateExpression(stmt.statement, code);
            } else this.generate(stmt.statement, code);

            didGenerate = code.code.length > curLen;
        });

        code.unindent();
        code.newLine();
        code.punctuation('}');
        code.popAddress();
    }
}
