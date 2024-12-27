import { IASTAnalyzerPlugin } from 'decompiler/analysis/ast_plugin';
import { ControlFlowGraph } from 'decompiler/analysis/cfg';
import { SSAForm } from 'decompiler/analysis/ssa';
import { VariableDB } from 'decompiler/analysis/vardb';
import { ArrayAccessAnalyzer, LoopVariableAnalyzer } from 'decompiler/analysis/variables';
import * as nodes from 'decompiler/ast/nodes';

export class ASTAnalyzer {
    private m_plugins: IASTAnalyzerPlugin[] = [];

    constructor(ssa: SSAForm, vardb: VariableDB, cfg: ControlFlowGraph) {
        this.m_plugins.push(new LoopVariableAnalyzer(ssa, vardb, cfg), new ArrayAccessAnalyzer(ssa, vardb, cfg));
    }

    analyze(ast: nodes.Node) {
        let changed: boolean;
        do {
            changed = false;
            for (const plugin of this.m_plugins) {
                changed ||= plugin.analyze(ast);
            }
        } while (changed);
    }
}
