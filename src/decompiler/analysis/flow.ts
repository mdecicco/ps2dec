import { ASTBuilder } from 'decompiler/ast/builder';
import * as nodes from 'decompiler/ast/nodes';
import { Decompiler } from 'decompiler/decompiler';
import * as Expr from 'decompiler/expr/base';
import { PrimitiveType } from 'decompiler/typesys';
import * as i from 'instructions';
import { Op, Reg } from 'types';
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

        // Check if contained in any loop
        if (loops.some(other => other !== structure && blocks.some(b => other.blocks.has(b)))) {
            return true;
        }

        // Check if contained in another branch
        return branches.some(other => blocks.some(b => other.thenBlocks.has(b) || other.elseBlocks.has(b)));
    }

    private instructionsToStatements(instructions: i.Instruction[]): nodes.StatementNode[] {
        const decomp = Decompiler.get();
        const stmts: nodes.StatementNode[] = [];

        const allowedBranches = new Set([Op.Code.b, Op.Code.jal, Op.Code.jalr, Op.Code.j, Op.Code.jr]);

        for (const instr of instructions) {
            if (instr.isBranch && !allowedBranches.has(instr.code)) continue;

            if (decomp.isAddressIgnored(instr.address)) continue;

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
                    this.m_builder.createExpression(instr, () => {
                        const gen = new Expr.RawString(retString);
                        gen.address = instr.address;
                        return gen;
                    })
                );
                stmts.push(stmt);
                continue;
            }

            const stmt = this.m_builder.createStatement(
                this.m_builder.createExpression(instr, () => instr.toExpression())
            );
            stmts.push(stmt);
        }

        return stmts;
    }

    private __old__instructionsToStatements(instructions: i.Instruction[]): nodes.StatementNode[] {
        const decomp = Decompiler.get();
        const stmts: nodes.StatementNode[] = [];

        const allowedBranches = new Set([Op.Code.b, Op.Code.jal, Op.Code.jalr, Op.Code.j, Op.Code.jr]);

        for (const instr of instructions) {
            if (instr.isBranch && !allowedBranches.has(instr.code)) continue;

            if (decomp.isAddressIgnored(instr.address)) continue;
            const expr = instr.toExpression();

            // Skip instructions that yield no expression
            if (expr instanceof Expr.Null) continue;

            // Skip instructions that are calls if they will appear in other expressions that use the results
            if (expr instanceof Expr.Call) {
                // Calls will have an effect on the program state, so we MUST ensure that if the call sets a register,
                // if that register is never used again, the call should still be shown in the AST
                // Find out if the register set by the call is used again
                const func = expr.target;
                if (func && func.returnLocation) {
                    if ('reg' in func.returnLocation) {
                        const reg = func.returnLocation.reg;
                        if (this.m_ssa.hasUses(instr, reg)) continue;
                    } else {
                        const offset = func.returnLocation.offset;
                        if (this.m_ssa.hasUses(instr, offset)) continue;
                    }
                }
            } else {
                // Skip instructions that set registers (they will appear in other expressions that use the results)
                if (instr.writes.length > 0) continue;
            }

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
                    this.m_builder.createExpression(instr, () => {
                        const gen = new Expr.RawString(retString);
                        gen.address = instr.address;
                        return gen;
                    })
                );
                stmts.push(stmt);
                continue;
            }

            const stmt = this.m_builder.createStatement(
                this.m_builder.createExpression(instr, () => instr.toExpression())
            );
            stmts.push(stmt);
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
        // const genInitExpr = this.m_ssa.getValueForVersion(loop.inductionVar!.register, loop.inductionVar!.initVersion);
        // const genStepExpr = this.m_ssa.getValueForVersion(loop.inductionVar!.register, loop.inductionVar!.stepVersion);

        const condExpr = this.m_builder.createExpression(loop.condition!.instruction, () => {
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
                    this.m_builder.createExpression(initInstr, () => {
                        const gen = initInstr.toExpression();
                        gen.address = initInstr.address;
                        return gen;
                    })
                );
                const step = this.m_builder.createStatement(
                    this.m_builder.createExpression(stepInstr, () => {
                        const gen = stepInstr.toExpression();
                        gen.address = stepInstr.address;
                        return gen;
                    })
                );
                return this.m_builder.createStatement(
                    this.m_builder.createForLoop(init, condExpr, step, body, loop.inductionVar!)
                );
            }

            case LoopType.While:
                return this.m_builder.createStatement(this.m_builder.createWhileLoop(condExpr, body));

            case LoopType.DoWhile:
                return this.m_builder.createStatement(this.m_builder.createDoWhileLoop(condExpr, body));

            default:
                // Fallback to while loop
                return this.m_builder.createStatement(this.m_builder.createWhileLoop(condExpr, body));
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

        const condExpr = this.m_builder.createExpression(branch.condition, () => {
            let expr = branch.condition.toExpression();
            if (expr instanceof Expr.ConditionalBranch) {
                expr = expr.condition;
            }
            expr.address = branch.condition.address;

            if (!thenBody && elseBody) {
                // If block with inverted condition
                if (Expr.isLogical(condition)) expr = condition.logicalInversion();
                else expr = new Expr.Not(condition).copyFrom(condition).reduce();
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

    /* Debug printing logic */

    debugPrint(): void {
        console.log('Loops found:');
        for (const loop of this.m_loops) {
            if (!loop.parent) {
                // Only print top-level loops
                this.printLoop(loop, 0);
            }
        }

        console.log('\nBranches found:');
        for (const branch of this.m_branches) {
            this.printBranch(branch);
        }
    }

    private printLoop(loop: Loop, depth: number): void {
        const indent = '  '.repeat(depth);
        console.log(`${indent}Loop header: 0x${loop.header.startAddress.toString(16)}`);
        console.log(`${indent}Back edge: 0x${loop.backEdge.startAddress.toString(16)}`);
        console.log(`${indent}Type: ${LoopType[loop.type]}`);

        if (loop.condition) {
            let expr = loop.condition.instruction.toExpression();
            if (expr instanceof Expr.ConditionalBranch) expr = expr.condition;
            console.log(`${indent}Condition: ${expr}`);
        }

        if (loop.inductionVar) {
            console.log(`${indent}Induction variable: ${Reg.formatRegister(loop.inductionVar.register)}`);
            console.log(`${indent}  Init: ${loop.inductionVar.initVersion}`);
            console.log(`${indent}  Step: ${loop.inductionVar.stepVersion}`);
        }

        console.log(
            `${indent}Blocks: ${Array.from(loop.blocks)
                .map(b => '0x' + b.startAddress.toString(16))
                .join(', ')}`
        );
        console.log(
            `${indent}Exits: ${Array.from(loop.exits)
                .map(b => '0x' + b.startAddress.toString(16))
                .join(', ')}`
        );

        for (const child of loop.children) {
            console.log(`${indent}Nested loop:`);
            this.printLoop(child, depth + 1);
        }
    }

    private printBranch(branch: IfStatement): void {
        console.log(`Branch at 0x${branch.condition.address.toString(16)}`);
        let cond = branch.condition.toExpression();
        if (cond instanceof Expr.ConditionalBranch) cond = cond.condition;
        console.log(`  Condition: ${cond}`);
        console.log(`  Then blocks: ${Array.from(branch.thenBlocks).map(b => '0x' + b.startAddress.toString(16))}`);
        console.log(`  Else blocks: ${Array.from(branch.elseBlocks).map(b => '0x' + b.startAddress.toString(16))}`);
        console.log(`  Join block: 0x${branch.joinBlock.startAddress.toString(16)}`);
    }

    public printAST(ast: nodes.Node, indent: string = ''): void {
        switch (ast.type) {
            case nodes.NodeType.Block:
                for (const stmt of ast.statements) {
                    this.printAST(stmt.statement, indent);
                }
                break;
            case nodes.NodeType.Expression:
                this.printExpression(ast, indent);
                break;
            case nodes.NodeType.Statement:
                this.printAST(ast.statement, indent);
                break;
            case nodes.NodeType.ForLoop:
                this.printForLoopAST(ast, indent);
                break;
            case nodes.NodeType.WhileLoop:
                console.log(`${indent}while (${ast.condition.expressionGen()}) {`);
                this.printAST(ast.body, indent + '    ');
                console.log(`${indent}}`);
                break;
            case nodes.NodeType.DoWhileLoop:
                console.log(`${indent}do {`);
                this.printAST(ast.body, indent + '    ');
                console.log(`${indent}} while(${ast.condition.expressionGen()});`);
                break;
            case nodes.NodeType.If:
                console.log(`${indent}if (${ast.condition.expressionGen()}) {`);
                this.printAST(ast.body, indent + '    ');
                console.log(`${indent}}`);
                break;
            case nodes.NodeType.IfElse:
                console.log(`${indent}if (${ast.condition.expressionGen()}) {`);
                this.printAST(ast.thenBody, indent + '    ');
                console.log(`${indent}}`);
                console.log(`${indent}else {`);
                this.printAST(ast.elseBody, indent + '    ');
                console.log(`${indent}}`);
                break;
        }
    }

    private printExpression(ast: nodes.ExpressionNode, indent: string): void {
        // determine if this expression assignes a value to a variable
        const decomp = Decompiler.get();
        if (decomp.isAddressIgnored(ast.instruction.address)) return;

        let didDeclareOrAssign = false;
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
                    console.log(`${indent}${v.type.name} ${v.name} = ${def.value};`);
                }
            } else {
                // Otherwise, just print the assignment
                console.log(`${indent}${v.name} = ${def.value};`);
            }

            didDeclareOrAssign = true;
        });

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
        } else {
            // Skip instructions that set registers (they will appear in other expressions that use the results)
            if (ast.instruction.writes.length > 0) return;
        }

        if (expr instanceof Expr.Null) return;
        console.log(`${indent}${expr};`);
    }

    private printForLoopAST(ast: nodes.ForLoopNode, indent: string): void {
        const decomp = Decompiler.get();

        let initStr = '/* init expr not found */';
        let stepStr = '/* step expr not found */';

        const ivar = decomp.vars.getVariableWithVersion(
            ast.inductionVariable.register,
            ast.inductionVariable.initVersion
        );

        if (ast.init.type === nodes.NodeType.Statement && ast.init.statement.type === nodes.NodeType.Expression) {
            if (ivar) {
                let expr: Expr.Expression | null = ast.init.statement.expressionGen();
                if (expr instanceof Expr.Null) {
                    expr = decomp.ssa.getValueForVersion(
                        ast.inductionVariable.register,
                        ast.inductionVariable.initVersion
                    );
                }

                if (expr) initStr = `${ivar.type.name} ${ivar.name} = ${expr}`;
            } else initStr = `${ast.init.statement.expressionGen()}`;
        }

        if (ast.step.type === nodes.NodeType.Statement && ast.step.statement.type === nodes.NodeType.Expression) {
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
                                    stepStr = `${ivar.name}++`;
                                    didMinify = true;
                                } else if (!type.isFloatingPoint && expr.rhs.value === 1n) {
                                    stepStr = `${ivar.name}++`;
                                    didMinify = true;
                                }
                            }

                            if (!didMinify) {
                                stepStr = `${ivar.name} += ${expr.rhs}`;
                                didMinify = true;
                            }
                        }
                    } else if (expr instanceof Expr.Sub) {
                        if (expr.lhs instanceof Expr.Variable && expr.lhs.value === ivar) {
                            if (expr.rhs instanceof Expr.Imm) {
                                const type = expr.rhs.type as PrimitiveType;
                                if (type.isFloatingPoint && expr.rhs.toF32() === 1.0) {
                                    stepStr = `${ivar.name}--`;
                                    didMinify = true;
                                } else if (!type.isFloatingPoint && expr.rhs.value === 1n) {
                                    stepStr = `${ivar.name}--`;
                                    didMinify = true;
                                }
                            }

                            if (!didMinify) {
                                stepStr = `${ivar.name} -= ${expr.rhs}`;
                                didMinify = true;
                            }
                        }
                    }

                    if (!didMinify) {
                        stepStr = `${ivar.name} = ${expr}`;
                        didMinify = true;
                    }
                }
            }

            if (!didMinify) stepStr = `${ast.step.statement.expressionGen()}`;
        }

        const cond = `${ast.condition.expressionGen()}`;
        console.log(`${indent}for (${initStr}; ${cond}; ${stepStr}) {`);
        ast.body.statements.forEach(stmt => {
            if (stmt.statement.type === nodes.NodeType.Expression) {
                if (stmt.statement.instruction === ast.condition.instruction) return;
                if (
                    ast.step.statement.type === nodes.NodeType.Expression &&
                    stmt.statement.instruction === ast.step.statement.instruction
                )
                    return;
                this.printExpression(stmt.statement, indent + '    ');
            } else this.printAST(stmt.statement, indent + '    ');
        });
        console.log(`${indent}}`);
    }
}
