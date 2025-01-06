import { Decompiler, Expr } from 'decompiler';
import * as nodes from '../../ast/nodes';
import { ASTAnalyzerPlugin } from '../ast_plugin';

export class SubExpressionVariableAnalyzer extends ASTAnalyzerPlugin {
    analyzeRoot(root: nodes.Node): boolean {
        const decomp = Decompiler.get();

        const entry = this.m_cfg.getEntryBlock();
        if (!entry) return false;

        let changed = false;

        entry.walkForward(block => {
            block.each(instr => {
                const defs = this.m_ssa.getAllDefsWithValues(instr);
                if (defs.length === 0) return;

                for (const def of defs) {
                    if (def.value instanceof Expr.Imm) {
                        // Don't promote immediate values to variables...
                        continue;
                    }

                    const existing = decomp.vars.getVariableWithVersion(def.location, def.version);
                    if (existing) {
                        // Already a variable
                        continue;
                    }

                    const uses = this.m_ssa.getAllUses(def.location, def.version);

                    if (uses.length > 1) {
                        // Expression is used in multiple places, good candidate for a variable
                        decomp.promoteVersionToVariable({ value: def.location, version: def.version });
                        changed = true;
                    }
                }
            });

            return true;
        });

        return changed;
    }
}
