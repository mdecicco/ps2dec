import * as nodes from '../ast/nodes';
import { IASTAnalyzerPlugin } from './ast_plugin';
import { ControlFlowGraph } from './cfg';
import { SSAForm } from './ssa';
import { VariableDB } from './vardb';
import {
    ArrayAccessAnalyzer,
    LoopVariableAnalyzer,
    PhiVariableAnalyzer,
    SubExpressionVariableAnalyzer
} from './variables';

export class ASTAnalyzer {
    private m_ssa: SSAForm;
    private m_plugins: IASTAnalyzerPlugin[] = [];

    constructor(ssa: SSAForm, vardb: VariableDB, cfg: ControlFlowGraph) {
        this.m_ssa = ssa;
        this.m_plugins.push(
            new LoopVariableAnalyzer(ssa, vardb, cfg),
            new ArrayAccessAnalyzer(ssa, vardb, cfg),
            new PhiVariableAnalyzer(ssa, vardb, cfg),
            new SubExpressionVariableAnalyzer(ssa, vardb, cfg)
        );
    }

    analyze(ast: nodes.Node) {
        let changed: boolean;
        do {
            changed = false;
            for (const plugin of this.m_plugins) {
                if (plugin.analyze(ast)) {
                    this.m_ssa.rebuildExpressions();
                    changed = true;
                }
            }
        } while (changed);
    }
}
