import * as nodes from '../../ast/nodes';
import { Decompiler } from '../../decompiler';
import * as Expr from '../../expr';
import { ASTAnalyzerPlugin } from '../ast_plugin';

export class LoopVariableAnalyzer extends ASTAnalyzerPlugin {
    analyzeForLoop(loop: nodes.ForLoopNode): boolean {
        if (!loop.inductionVariable || loop.inductionVariable.variable) return false;

        const decomp = Decompiler.get();
        decomp.currentInstruction = loop.inductionVariable.initInstruction;

        const existingValue = decomp.vars.getVariable(
            loop.inductionVariable.register,
            loop.inductionVariable.initInstruction
        );

        if (existingValue) return false;

        decomp.currentInstruction = loop.inductionVariable.initInstruction;
        const value = decomp.promoteToVariable(loop.inductionVariable.register);
        value.hasDeclaration = true;
        value.addSSALocation(loop.inductionVariable.register, loop.inductionVariable.initVersion);
        value.addSSALocation(loop.inductionVariable.register, loop.inductionVariable.stepVersion);

        loop.inductionVariable.variable = value;

        const loopInstrs = this.instructionsIn(loop);
        loopInstrs.some(instr => {
            if (instr === loop.inductionVariable.initInstruction) return false;
            if (instr === loop.inductionVariable.stepInstruction) return false;

            // Look for uses of the induction variable
            const use = this.m_ssa.getUse(instr, loop.inductionVariable.register);
            if (use) value.addSSALocation(loop.inductionVariable.register, use.version);

            const def = this.m_ssa.getDef(instr, loop.inductionVariable.register, false);
            if (def && !value.hasSSAVersion(loop.inductionVariable.register, def.version)) {
                // Check if the definition is just assigning the induction variable to a different version of itself

                if (!('value' in def)) {
                    // This shouldn't happen, but if it does there's nothing we can do
                    return true;
                }

                if (def.value instanceof Expr.SSAVariable) {
                    const srcLoc = def.value.location;
                    if (!srcLoc) {
                        // This shouldn't happen, but if it does there's nothing we can do
                        return true;
                    }

                    if (!value.hasSSAVersion(srcLoc.value, srcLoc.version)) {
                        // It's not being assigned to a version of itself
                        return true;
                    }

                    // It's being assigned to a version of itself
                    return false;
                }

                if (def.value instanceof Expr.Variable) {
                    const assignedTo = def.value.value;

                    if (assignedTo === value) {
                        // Unlikely, but hey
                        return false;
                    }

                    return true;
                }

                // Couldn't determine if it's being assigned to a version of itself
                // Assume the register is being repurposed for something else
                return true;
            }

            return false;
        });

        return true;
    }
}
