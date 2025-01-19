import * as nodes from '../ast/nodes';
import { IASTAnalyzerPlugin } from '../ast/plugin';
import { ArrayAccessAnalyzer, LoopVariableAnalyzer, SubExpressionVariableAnalyzer } from '../ast/plugins';
import { FunctionCode } from '../input';

export class ASTAnalyzer {
    private m_func: FunctionCode;
    private m_plugins: IASTAnalyzerPlugin[] = [];

    constructor(func: FunctionCode) {
        this.m_func = func;
        this.m_plugins.push(
            new LoopVariableAnalyzer(func),
            new ArrayAccessAnalyzer(func),
            new SubExpressionVariableAnalyzer(func)
        );
    }

    analyze(ast: nodes.Node) {
        let changed: boolean;
        do {
            changed = false;
            for (const plugin of this.m_plugins) {
                if (plugin.analyze(ast)) {
                    this.m_func.rebuildValues();
                    changed = true;
                }
            }
        } while (changed);
    }
}
