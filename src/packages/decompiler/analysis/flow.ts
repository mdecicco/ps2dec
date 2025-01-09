import { Expr, i, Op, Reg } from 'decoder';
import { PrimitiveType } from 'decompiler';
import { compareVersionedLocations, formatVersionedLocation } from 'utils';
import { ASTBuilder } from '../ast/builder';
import * as nodes from '../ast/nodes';
import { CodeBuilder } from '../codegen/codebuilder';
import { Location } from '../common';
import { Decompiler } from '../decompiler';
import { FunctionCode } from '../input';
import { BasicBlock, ControlFlowGraph } from './cfg';
import { BranchAnalyzer, BranchChain, IfStatement } from './flow_branches';
import { Loop, LoopAnalyzer, LoopType } from './flow_loops';

export class ControlFlowAnalyzer {
    private m_loops: Loop[] = [];
    private m_branches: IfStatement[] = [];
    private m_branchChains: BranchChain[] = [];
    private m_builder: ASTBuilder = new ASTBuilder();
    private m_astLoopStack: Loop[] = [];
    private m_func: FunctionCode;
    private m_cfg: ControlFlowGraph;

    constructor(func: FunctionCode) {
        this.m_func = func;
        this.m_cfg = func.cfg;
    }

    analyze() {
        // Find loops first
        const loopAnalyzer = new LoopAnalyzer(this.m_func);
        this.m_loops = loopAnalyzer.findLoops();

        // Get all loop branch instructions
        const loopBranches = this.m_loops.flatMap(loop => (loop.condition ? [loop.condition.instruction] : []));

        // Find non-loop branches
        const branchAnalyzer = new BranchAnalyzer(this.m_cfg, loopBranches);
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
                // If the blocks have any phi nodes that don't get initialized to a value
                // within the preBlocks, we need to declare them as variables.

                const preInstructions: i.Instruction[] = [];
                for (const block of preBlocks) {
                    const phis = this.m_func.getBlockPhis(block);
                    for (const phi of phis) {
                        let wasDefined = false;
                        block.each(instr => {
                            const defs = this.m_func.getDefs(instr);

                            for (const phiDef of phi.definitions) {
                                for (const instDef of defs) {
                                    if (compareVersionedLocations(phiDef, instDef)) {
                                        // Phi has a definition in this block, don't declare it now because an instruction will
                                        // generate it later with an initialization.
                                        wasDefined = true;
                                        return true;
                                    }
                                }
                            }
                        });

                        if (!wasDefined) {
                            // If the phi node is not defined in this block, we need to declare it as a variable
                            statements.push(
                                this.m_builder.createStatement(
                                    this.m_builder.createVariableDeclaration(phi.variable.value, null)
                                )
                            );
                        }
                    }

                    block.each(instr => {
                        preInstructions.push(instr);
                    });
                }

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
            const remainingInstructions: i.Instruction[] = [];
            for (const block of remainingBlocks) {
                const phis = this.m_func.getBlockPhis(block);

                for (const phi of phis) {
                    let wasDefined = false;
                    block.each(instr => {
                        const defs = this.m_func.getDefs(instr);

                        for (const phiDef of phi.definitions) {
                            for (const instDef of defs) {
                                if (compareVersionedLocations(phiDef, instDef)) {
                                    // Phi has a definition in this block, don't declare it now because an instruction will
                                    // generate it later with an initialization.
                                    wasDefined = true;
                                    return true;
                                }
                            }
                        }
                    });

                    if (!wasDefined) {
                        // If the phi node is not defined in this block, we need to declare it as a variable
                        statements.push(
                            this.m_builder.createStatement(
                                this.m_builder.createVariableDeclaration(phi.variable.value, null)
                            )
                        );
                    }
                }

                block.each(instr => {
                    remainingInstructions.push(instr);
                });
            }

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
        const decomp = Decompiler.current;
        const stmts: nodes.StatementNode[] = [];

        const allowedBranches = new Set([Op.Code.b, Op.Code.jal, Op.Code.jalr, Op.Code.j, Op.Code.jr]);

        const handleInstr = (instr: i.Instruction) => {
            if (instr.isBranch && !allowedBranches.has(instr.code)) return;

            if (decomp.isAddressIgnored(instr.address)) return;

            // If this is the step instruction for any loop we're in, skip it
            if (this.m_astLoopStack.some(loop => loop.inductionVar?.stepInstruction === instr)) return;

            if (instr.code === Op.Code.jr && Reg.compare(instr.reads[0], { type: Reg.Type.EE, id: Reg.EE.RA })) {
                let retString = 'return';

                const currentFunc = decomp.cache.func;
                if (currentFunc.returnLocation) {
                    if ('reg' in currentFunc.returnLocation) {
                        const returnExpr = this.m_func.getValueAt(currentFunc.returnLocation.reg, instr.address);
                        retString += ` ${returnExpr}`;
                    } else {
                        const returnExpr = this.m_func.getValueAt(currentFunc.returnLocation.offset, instr.address);
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
                                    retExpr = this.m_func.getValueAt(currentFunc.returnLocation.reg, instr.address);
                                } else {
                                    retExpr = this.m_func.getValueAt(currentFunc.returnLocation.offset, instr.address);
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
                const func = Decompiler.findFunctionByAddress(target);
                if (func && func.returnLocation) {
                    let location: Location;
                    if ('reg' in func.returnLocation) {
                        location = func.returnLocation.reg;
                    } else {
                        location = func.returnLocation.offset;
                    }

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
        let condition = loop.condition?.instruction.generate();
        if (condition instanceof Expr.ConditionalBranch) {
            condition = condition.condition;
        }

        const condExpr = this.m_builder.createExpression(loop.condition!.instruction, false, () => {
            let expr = loop.condition!.instruction.generate();
            if (!expr) return null;

            if (expr instanceof Expr.ConditionalBranch) {
                expr = expr.condition;
            }

            expr.address = loop.condition!.instruction.address;
            return expr;
        });

        switch (loop.type) {
            case LoopType.For: {
                // get expression that corresponds to induction variable initialization
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

        let thenBody = thenBlocks.size > 0 ? this.processBlocks(thenBlocks, branch) : undefined;
        let elseBody = elseBlocks.size > 0 ? this.processBlocks(elseBlocks, branch) : undefined;

        // Get condition expression
        let condition = branch.condition.generate();
        if (condition) condition = condition.reduce();
        if (condition instanceof Expr.ConditionalBranch) {
            condition = condition.condition.reduce();
        }

        const condExpr = this.m_builder.createExpression(branch.condition, false, () => {
            const cond = branch.condition.generate();
            if (!cond) return null;
            let expr = cond;

            expr = expr.reduce();
            if (expr instanceof Expr.ConditionalBranch) {
                expr = expr.condition.reduce();
            }
            expr.address = branch.condition.address;

            if (!thenBody && elseBody) {
                // If block with inverted condition
                if (Expr.isLogical(expr)) expr = expr.logicalInversion();
                else expr = new Expr.Not(expr).copyFrom(expr);

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
            console.log(
                `${ast.instruction.toString(true).padEnd(40, ' ')}: ${variable.toString()} (${formatVersionedLocation(
                    def
                )}) defined as ${def.assignedTo}`
            );

            // If the variable is just being moved to another location, skip it
            if (def.assignedTo instanceof Expr.Variable && def.assignedTo.value === variable) return;

            const versions = variable.getSSAVersions(def.value).sort((a, b) => a - b);
            if (versions[0] === def.version) {
                if (!variable.hasDeclaration) {
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
                }
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
                if ('reg' in func.returnLocation) {
                    const def = this.m_func.getDefAt(func.returnLocation.reg, ast.instruction.address);
                    if (!def) throw new Error('Failed to find def for call return location');

                    if (this.m_func.getUsesOf(def).length > 0) return false;
                } else {
                    const def = this.m_func.getDefAt(func.returnLocation.offset, ast.instruction.address);
                    if (!def) throw new Error('Failed to find def for call return location');

                    if (this.m_func.getUsesOf(def).length > 0) return false;
                }
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
