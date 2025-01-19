import { Expr, i, Op, Reg } from 'decoder';
import { PrimitiveType } from 'typesys';

import { ASTBuilder } from '../ast/builder';
import * as nodes from '../ast/nodes';
import { CodeBuilder } from '../codegen/codebuilder';
import { Decompiler } from '../decompiler';
import { FunctionCode } from '../input';
import { IfRegion, LoopRegion, Region } from '../types';
import { BasicBlock, ControlFlowGraph } from './cfg';
import * as Pass from './passes';
import { StructureAnalyzer } from './structure';
import { IStructurePass } from './structure_pass';

export class ControlFlowAnalyzer {
    private m_builder: ASTBuilder;
    private m_loopRegionStack: LoopRegion[];
    private m_loopHeaderStack: BasicBlock[];
    private m_structurePasses: IStructurePass[];
    private m_func: FunctionCode;
    private m_cfg: ControlFlowGraph;

    constructor(func: FunctionCode) {
        this.m_builder = new ASTBuilder();
        this.m_loopRegionStack = [];
        this.m_loopHeaderStack = [];
        this.m_structurePasses = [];
        this.m_func = func;
        this.m_cfg = func.cfg;

        this.m_structurePasses.push(
            new Pass.Structure.SimplifyBranches(),
            new Pass.Structure.SequenceMerge(),
            new Pass.Structure.BlockMerge(),
            new Pass.Structure.EliminateUnreachable()
        );
    }

    analyze() {}

    buildAST(): nodes.BlockNode {
        this.m_loopRegionStack = [];

        const structureAnalyzer = new StructureAnalyzer(this.m_func);
        let root = structureAnalyzer.analyze();

        let changed: boolean;
        do {
            changed = false;
            this.m_structurePasses.forEach(p => {
                p.initialize({
                    func: this.m_func,
                    regionMap: structureAnalyzer.regionMap,
                    root
                });

                changed ||= p.execute(root);

                root = p.root;
            });
        } while (changed);

        // StructureAnalyzer.debugPrint(root);
        console.log(root);

        return this.m_builder.createBlock([this.processRegion(root)]);
    }

    //
    // CFG -> Loops, Branches
    //

    private processRegion(region: Region): nodes.StatementNode {
        switch (region.type) {
            case 'sequence': {
                const statements: nodes.StatementNode[] = [];

                region.sequence.forEach(stmt => {
                    statements.push(this.processRegion(stmt));
                });

                return this.m_builder.createStatement(this.m_builder.createBlock(statements));
            }
            case 'block': {
                return this.m_builder.createStatement(
                    this.m_builder.createBlock(this.instructionsToStatements(region.instructions))
                );
            }
            case 'if': {
                return this.buildBranchNode(region);
            }
            case 'loop': {
                return this.buildLoopNode(region);
            }
            case 'ref': {
                return this.m_builder.createStatement(
                    this.m_builder.createGoto(region.targetHeader, region.branchInstr)
                );
            }
        }
    }

    //
    // CFG, Loops, Branches -> AST
    //

    private instructionsToStatements(instructions: i.Instruction[]): nodes.StatementNode[] {
        const decomp = Decompiler.current;
        const stmts: nodes.StatementNode[] = [];

        const allowedBranches = new Set([Op.Code.jal, Op.Code.jalr, Op.Code.jr]);

        const handleInstr = (instr: i.Instruction) => {
            if (instr.isBranch && !allowedBranches.has(instr.code)) return;

            if (decomp.isAddressIgnored(instr.address)) return;

            // If this is the step instruction for any loop we're in, skip it
            const isLoopIncrement = this.m_loopRegionStack.some(loop => {
                if (!loop.condition) return false;

                const condBlock = this.m_cfg.getBlock(loop.condition.address);
                const isForLoop =
                    condBlock &&
                    condBlock === loop.header &&
                    loop.inductionVar &&
                    (loop.inductionVar.initInstruction || loop.inductionVar.stepInstruction);
                if (!isForLoop) return false;

                return loop.inductionVar!.stepInstruction === instr;
            });
            if (isLoopIncrement) return;

            if (instr.code === Op.Code.jr && Reg.compare(instr.reads[0], { type: Reg.Type.EE, id: Reg.EE.RA })) {
                let retString = 'return';

                const currentFunc = decomp.cache.func;
                if (currentFunc.returnLocation) {
                    const returnExpr = this.m_func.getValueAt(currentFunc.returnLocation, instr.address);
                    retString += ` ${returnExpr}`;
                }

                const stmt = this.m_builder.createStatement(
                    this.m_builder.createExpression(instr, false, () => {
                        const gen = new Expr.RawString(retString, null, code => {
                            code.keyword('return');

                            if (currentFunc.returnLocation) {
                                code.whitespace(1);

                                let retExpr = this.m_func.getValueAt(currentFunc.returnLocation, instr.address);

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
                const func = Decompiler.findFunctionByAddress(target);
                if (func && func.returnLocation) {
                    let location = func.returnLocation;
                    const def = this.m_func.getDef(instr, location);
                    if (this.m_func.getUsesOf(def).length > 0) omit = true;
                }
            } else if (instr.code === Op.Code.jalr) {
                // Indirect calls are more complicated, just log it as is for now
            }

            const stmt = this.m_builder.createStatement(
                this.m_builder.createExpression(instr, omit, () => instr.generate())
            );
            stmts.push(stmt);
        };

        for (let i = 0; i < instructions.length; i++) {
            const instr = instructions[i];
            handleInstr(instr);
        }

        return stmts;
    }

    private buildLoopNode(loop: LoopRegion): nodes.StatementNode {
        this.m_loopRegionStack.push(loop);
        const body = this.m_builder.createBlock([this.processRegion(loop.body)]);

        // Get condition expression
        let condition = loop.condition?.generate();
        if (condition instanceof Expr.ConditionalBranch) {
            condition = condition.condition;
        }

        let condExpr: nodes.ExpressionNode;

        if (loop.condition) {
            condExpr = this.m_builder.createExpression(loop.condition!, false, () => {
                let expr = loop.condition!.generate();
                if (!expr) return null;

                if (expr instanceof Expr.ConditionalBranch) {
                    expr = expr.condition;
                }

                expr.address = loop.condition!.address;
                return expr;
            });
        } else {
            condExpr = this.m_builder.createExpression(new i.nop(loop.header.startAddress), false, () => {
                const result = Expr.Imm.bool(true);
                result.address = loop.header.startAddress;
                return result;
            });
        }

        if (loop.condition) {
            const condBlock = this.m_cfg.getBlock(loop.condition.address);
            if (condBlock !== loop.header) {
                const stmt = this.m_builder.createStatement(
                    this.m_builder.createDoWhileLoop(loop.header, condExpr, body)
                );
                this.m_loopRegionStack.pop();
                return stmt;
            }

            if (loop.inductionVar && (loop.inductionVar.initInstruction || loop.inductionVar.stepInstruction)) {
                const initInstr = loop.inductionVar!.initInstruction;
                const stepInstr = loop.inductionVar!.stepInstruction;

                const init = initInstr
                    ? this.m_builder.createStatement(
                          this.m_builder.createExpression(initInstr, false, () => {
                              const gen = initInstr.generate();
                              if (!gen) return null;

                              gen.address = initInstr.address;
                              return gen;
                          })
                      )
                    : null;
                const step = stepInstr
                    ? this.m_builder.createExpression(stepInstr, false, () => {
                          const gen = stepInstr.generate();
                          if (!gen) return null;

                          gen.address = stepInstr.address;
                          return gen;
                      })
                    : null;
                const stmt = this.m_builder.createStatement(
                    this.m_builder.createForLoop(loop.header, init, condExpr, step, body, loop.inductionVar!)
                );

                this.m_loopRegionStack.pop();
                return stmt;
            }
        }

        const stmt = this.m_builder.createStatement(this.m_builder.createWhileLoop(loop.header, condExpr, body));
        this.m_loopRegionStack.pop();
        return stmt;
    }

    private buildBranchNode(region: IfRegion): nodes.StatementNode {
        let thenBody = this.m_builder.createBlock([this.processRegion(region.thenRegion)]);
        let elseBody = region.elseRegion ? this.m_builder.createBlock([this.processRegion(region.elseRegion)]) : null;

        // Get condition expression
        let condition = region.condition.generate();
        if (condition) condition = condition.reduce();
        if (condition instanceof Expr.ConditionalBranch) {
            condition = condition.condition.reduce();
        }

        const condExpr = this.m_builder.createExpression(region.condition, false, () => {
            const cond = region.condition.generate();
            if (!cond) return null;
            let expr = cond;

            expr = expr.reduce();
            if (expr instanceof Expr.ConditionalBranch) {
                expr = expr.condition.reduce();
            }
            expr.address = region.condition.address;

            if (region.invertCondition) {
                // If block with inverted condition
                if (Expr.isLogical(expr)) expr = expr.logicalInversion();
                else expr = new Expr.Not(expr).copyFrom(expr);

                // reduce it using conditional branch logic
                const b = new Expr.ConditionalBranch(expr, 0).reduce() as Expr.ConditionalBranch;
                expr = b.condition;
            }

            return expr;
        });

        if (!elseBody) {
            // Simple if with no else
            return this.m_builder.createStatement(this.m_builder.createIf(condExpr, thenBody));
        }

        // If-else
        return this.m_builder.createStatement(this.m_builder.createIfElse(condExpr, thenBody, elseBody));
    }

    //
    // AST -> Code
    //

    public generateCondition(cond: Expr.Expression | null, code: CodeBuilder, invert?: boolean): void {
        if (!cond) return;

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
                if (this.generateExpression(ast, code)) code.punctuation(';');
                break;
            case nodes.NodeType.Statement:
                this.generate(ast.statement, code);
                break;
            case nodes.NodeType.ForLoop:
                this.generateForLoop(ast, code);
                break;
            case nodes.NodeType.WhileLoop:
                this.m_loopHeaderStack.push(ast.header);
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
                this.m_loopHeaderStack.pop();
                break;
            case nodes.NodeType.DoWhileLoop:
                this.m_loopHeaderStack.push(ast.header);
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
                this.m_loopHeaderStack.pop();
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
                this.generateIfElse(ast, code);
                break;
            case nodes.NodeType.VariableDeclaration:
                ast.variable.hasDeclaration = true;
                if (ast.initializer) {
                    code.pushAddress(ast.initializer.instruction.address);
                    code.dataType(ast.variable.type);
                    code.whitespace(1);
                    code.variable(ast.variable);
                    code.whitespace(1);
                    code.punctuation('=');
                    code.whitespace(1);
                    this.generateExpression(ast.initializer, code);
                    code.punctuation(';');
                    code.popAddress();
                } else {
                    code.dataType(ast.variable.type);
                    code.whitespace(1);
                    code.variable(ast.variable);
                    code.punctuation(';');
                }
                break;
            case nodes.NodeType.GoTo:
                code.pushAddress(ast.branchInstr.address);
                if (
                    this.m_loopHeaderStack.length > 0 &&
                    this.m_loopHeaderStack[this.m_loopHeaderStack.length - 1] === ast.targetHeader
                ) {
                    code.keyword('continue');
                    code.punctuation(';');
                } else {
                    code.keyword('goto');
                    code.whitespace(1);
                    code.miscReference(`LBL_${ast.targetHeader.startAddress.toString(16).padStart(8, '0')}`);
                    code.punctuation(';');
                }
                code.popAddress();
        }
    }

    private generateExpression(ast: nodes.ExpressionNode, code: CodeBuilder): boolean {
        // determine if this expression assignes a value to a variable
        const decomp = Decompiler.current;
        if (decomp.isAddressIgnored(ast.instruction.address)) return false;

        let didDeclareOrAssign = false;
        code.pushAddress(ast.instruction.address);

        this.m_func.getDefs(ast.instruction, true).forEach(def => {
            const variable = decomp.vars.getVariable(def);
            if (!variable) {
                return;
            }
            // console.log(
            //     `${ast.instruction.toString(true).padEnd(40, ' ')}: ${variable.toString()} (${formatVersionedLocation(
            //         def
            //     )}) defined as ${def.assignedTo}`
            // );

            // If the variable is just being moved to another location, skip it
            if (def.assignedTo instanceof Expr.Variable && def.assignedTo.value === variable) return;

            const versions = variable.getSSAVersions(def.value).sort((a, b) => a - b);
            if (versions[0] === def.version && !variable.hasDeclaration) {
                variable.hasDeclaration = true;
                // If it's the first one to write to the variable, declare it
                code.dataType(variable.type);
                code.whitespace(1);
                code.variable(variable);
                code.whitespace(1);
                code.punctuation('=');
                code.whitespace(1);
                code.expression(def.assignedTo);
                didDeclareOrAssign = true;
            } else {
                // Otherwise, just print the assignment

                const value = def.assignedTo;
                const tryMinify = (cls: typeof Expr.BinaryExpression, op: string, needsSelfAsLhs: boolean) => {
                    if (!(value instanceof cls)) return false;

                    let other: Expr.Expression | null = null;
                    if (value.lhs instanceof Expr.Variable && value.lhs.value === variable) {
                        other = value.rhs;
                    } else if (value.rhs instanceof Expr.Variable && value.rhs.value === variable && !needsSelfAsLhs) {
                        other = value.lhs;
                    } else {
                        // Expression not minifiable
                        return false;
                    }

                    if (cls === Expr.Add) {
                        if (other instanceof Expr.Imm) {
                            const type = other.type as PrimitiveType;
                            if (type.isFloatingPoint && other.toF32() === 1.0) {
                                code.variable(variable);
                                code.punctuation('++');
                                return true;
                            } else if (!type.isFloatingPoint && other.value === 1n) {
                                code.variable(variable);
                                code.punctuation('++');
                                return true;
                            } else if (type.isFloatingPoint && other.toF32() === -1.0) {
                                code.variable(variable);
                                code.punctuation('--');
                                return true;
                            } else if (!type.isFloatingPoint && other.value === -1n) {
                                code.variable(variable);
                                code.punctuation('--');
                                return true;
                            }

                            const zero = Expr.Imm.typed(0, other.type);
                            const isNeg = Expr.foldConstants(other, zero, 'lt').value === 1n;

                            if (isNeg) {
                                op = '-=';
                                other = Expr.foldConstants(other, other, 'neg');
                            }
                        }
                    } else if (cls === Expr.Sub) {
                        if (other instanceof Expr.Imm) {
                            const type = other.type as PrimitiveType;
                            if (type.isFloatingPoint && other.toF32() === 1.0) {
                                code.variable(variable);
                                code.punctuation('--');
                                return true;
                            } else if (!type.isFloatingPoint && other.value === 1n) {
                                code.variable(variable);
                                code.punctuation('--');
                                return true;
                            } else if (type.isFloatingPoint && other.toF32() === -1.0) {
                                code.variable(variable);
                                code.punctuation('++');
                                return true;
                            } else if (!type.isFloatingPoint && other.value === -1n) {
                                code.variable(variable);
                                code.punctuation('++');
                                return true;
                            }

                            const zero = Expr.Imm.typed(0, other.type);
                            const isNeg = Expr.foldConstants(other, zero, 'lt').value === 1n;

                            if (isNeg) {
                                op = '+=';
                                other = Expr.foldConstants(other, other, 'neg');
                            }
                        }
                    }

                    code.variable(variable);
                    code.whitespace(1);
                    code.punctuation(op);
                    code.whitespace(1);
                    code.expression(other);

                    return true;
                };

                const minifyEntries: [typeof Expr.BinaryExpression, string, boolean][] = [
                    [Expr.Add, '+=', false],
                    [Expr.Sub, '-=', true],
                    [Expr.Mul, '*=', false],
                    [Expr.Div, '/=', true],
                    [Expr.BitwiseAnd, '&=', false],
                    [Expr.BitwiseOr, '|=', false],
                    [Expr.BitwiseXOr, '^=', false],
                    [Expr.ShiftLeft, '<<=', true],
                    [Expr.ShiftRight, '>>=', true],
                    [Expr.Mod, '%=', true]
                ];

                let didMinify = false;
                for (const [cls, op, needsSelfAsLhs] of minifyEntries) {
                    if (tryMinify(cls, op, needsSelfAsLhs)) {
                        didMinify = true;
                        break;
                    }
                }

                if (!didMinify) {
                    code.variable(variable);
                    code.whitespace(1);
                    code.punctuation('=');
                    code.whitespace(1);
                    code.expression(def.assignedTo);
                }

                didDeclareOrAssign = true;
            }
        });

        code.popAddress();
        if (didDeclareOrAssign) return true;

        const expr = ast.expressionGen();
        if (!expr) return false;

        if (expr instanceof Expr.Call) {
            // Calls will have an effect on the program state, so we MUST ensure that if the call sets a register,
            // if that register is never used again, the call should still be shown in the AST
            // Find out if the register set by the call is used again
            const func = expr.target;
            if (func && func.returnLocation) {
                const def = this.m_func.getDefAt(func.returnLocation, ast.instruction.address);
                if (!def) throw new Error('Failed to find def for call return location');

                if (this.m_func.getUsesOf(def).length > 0) return false;
            }
        } else if (expr instanceof Expr.IndirectCall) {
            // Indirect calls are more complicated, just log it as is for now
        } else {
            // Skip instructions that set registers (they will appear in other expressions that use the results)
            if (ast.instruction.writes.length > 0) return false;
        }

        code.pushAddress(ast.instruction.address);
        code.expression(expr);
        code.popAddress();

        return true;
    }

    private generateForLoop(ast: nodes.ForLoopNode, code: CodeBuilder): void {
        this.m_loopHeaderStack.push(ast.header);

        code.pushAddress(ast.condition.instruction.address);
        code.keyword('for');
        code.whitespace(1);
        code.punctuation('(');

        if (ast.init) {
            if (ast.inductionVariable.variable) ast.inductionVariable.variable.hasDeclaration = false;
            this.generate(ast.init.statement, code);
        } else code.punctuation(';');

        code.whitespace(1);
        this.generateCondition(ast.condition.expressionGen(), code);
        code.punctuation(';');
        code.whitespace(1);

        if (ast.step) this.generateExpression(ast.step, code);

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
                if (ast.step && stmt.statement.instruction === ast.step.instruction) return;
                this.generateExpression(stmt.statement, code);
            } else this.generate(stmt.statement, code);

            didGenerate = code.code.length > curLen;
        });

        code.unindent();
        code.newLine();
        code.punctuation('}');
        code.popAddress();
        this.m_loopHeaderStack.pop();
    }

    private generateIfElse(ast: nodes.IfElseNode, code: CodeBuilder): void {
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
            return;
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
            return;
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
            return;
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
    }
}
