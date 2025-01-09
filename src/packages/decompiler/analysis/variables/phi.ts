import * as nodes from '../../ast/nodes';
import { ASTAnalyzerPlugin } from '../ast_plugin';

export class PhiVariableAnalyzer extends ASTAnalyzerPlugin {
    analyzeRoot(root: nodes.Node): boolean {
        // now handled by FunctionCode
        return false;
    }
}
