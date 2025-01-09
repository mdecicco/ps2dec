import { Expr } from 'decoder';
import { Decompiler } from 'decompiler';
import * as nodes from '../../ast/nodes';
import { ASTAnalyzerPlugin } from '../ast_plugin';

export class SubExpressionVariableAnalyzer extends ASTAnalyzerPlugin {
    analyzeRoot(root: nodes.Node): boolean {
        const decomp = Decompiler.current;

        const entry = this.m_cfg.getEntryBlock();
        if (!entry) return false;

        let changed = false;

        entry.walkForward(block => {
            block.each(instr => {
                const defs = this.m_func.getDefs(instr, true);
                if (defs.length === 0) return;

                for (const def of defs) {
                    if (def.assignedTo instanceof Expr.Imm) {
                        // Don't promote immediate values to variables...
                        continue;
                    }

                    const existing = decomp.vars.getVariable(def);
                    if (existing) {
                        // Already a variable
                        continue;
                    }

                    const uses = this.m_func.getUsesOf(def);

                    if (uses.length > 1) {
                        // Expression is used in multiple places, good candidate for a variable
                        decomp.promote(def);
                        changed = true;
                    }
                }
            });

            return true;
        });

        return changed;
    }
}
