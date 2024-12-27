import { ASTAnalyzerPlugin } from 'decompiler/analysis/ast_plugin';
import * as nodes from 'decompiler/ast/nodes';
import { Decompiler } from 'decompiler/decompiler';
import * as Expr from 'decompiler/expr/base';
import { DataType, PrimitiveType } from 'decompiler/typesys';

export class ArrayAccessAnalyzer extends ASTAnalyzerPlugin {
    analyzeExpression(ast: nodes.ExpressionNode): boolean {
        let expr = ast.expressionGen();
        if (expr instanceof Expr.Store) {
            const dest = expr.dest;
            const source = expr.source;

            const mem = Expr.extractMemoryReference(dest.reduce());
            if (mem === null) return false;
            if (mem.offset instanceof Expr.Imm) return false;

            this.analyzeStore(mem.base, mem.offset, source.type, expr.size);
        } else if (expr instanceof Expr.Load) {
            const source = expr.source;

            const mem = Expr.extractMemoryReference(source.reduce());
            if (mem === null) return false;
            if (mem.offset instanceof Expr.Imm) return false;

            this.analyzeLoad(mem.base, mem.offset);
        }

        return false;
    }

    private analyzeStore(
        base: Expr.Expression,
        offset: Expr.Expression,
        targetType: DataType,
        storeSize: number
    ): boolean {
        if (!(offset instanceof Expr.BinaryExpression)) return false;

        const info = Expr.getIndexInfo(offset);
        if (info === null) return false;

        if (info.elementSize !== storeSize) {
            // Don't know what it's doing
            return false;
        }

        if (info.index instanceof Expr.Variable) {
            // Already a variable, nothing to do
            return false;
        }

        if (info.indexLocation === null) {
            // Don't know where it is, play it safe
            return false;
        }

        const existingVariable = Decompiler.get().vars.getVariableWithVersion(
            info.indexLocation.value,
            info.indexLocation.version
        );
        if (existingVariable) {
            // Already a variable, nothing to do
            return false;
        }

        // bingo
        const decomp = Decompiler.get();
        const index = decomp.promoteVersionToVariable(info.indexLocation);
        if (!(index.type instanceof PrimitiveType) || index.type.name.includes('undefined')) {
            index.type = 'i32';
        }

        return true;
    }

    private analyzeLoad(base: Expr.Expression, offset: Expr.Expression): boolean {
        return false;
    }
}
