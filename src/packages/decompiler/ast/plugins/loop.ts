import { Expr } from 'decoder';
import { compareLocations } from 'utils';

import { Decompiler } from '../../decompiler';
import * as nodes from '../nodes';
import { ASTAnalyzerPlugin } from '../plugin';

export class LoopVariableAnalyzer extends ASTAnalyzerPlugin {
    analyzeForLoop(loop: nodes.ForLoopNode): boolean {
        if (!loop.inductionVariable || loop.inductionVariable.variable || !loop.inductionVariable.initInstruction)
            return false;

        // TODO: Determine if the induction variable is used outside of the loop
        // If it is: don't set hasDeclaration to true (let it be declared where
        // it naturally would be)

        const decomp = Decompiler.current;

        const existingValue = decomp.vars.getVariable({
            value: loop.inductionVariable.register,
            version: loop.inductionVariable.initVersion
        });

        if (existingValue) {
            existingValue.hasDeclaration = true;
            loop.inductionVariable.variable = existingValue;
            return false;
        }

        decomp.currentInstruction = loop.inductionVariable.initInstruction;
        const value = decomp.promote({
            value: loop.inductionVariable.register,
            version: loop.inductionVariable.initVersion
        });

        value.hasDeclaration = true;
        value.addSSALocation(loop.inductionVariable.register, loop.inductionVariable.initVersion);
        value.addSSALocation(loop.inductionVariable.register, loop.inductionVariable.stepVersion);

        loop.inductionVariable.variable = value;

        // Widen the induction variable to include all uses in the loop before the register gets reassigned to something else
        const loopInstrs = this.instructionsIn(loop);
        loopInstrs.some(instr => {
            if (instr === loop.inductionVariable.initInstruction) return;
            if (instr === loop.inductionVariable.stepInstruction) return;

            const uses = this.m_func.getUses(instr);
            uses.forEach(use => {
                if (compareLocations(use.value, loop.inductionVariable.register)) {
                    value.addSSALocation(loop.inductionVariable.register, use.version);
                }
            });

            const defs = this.m_func.getDefs(instr);
            const wasReassigned = defs.some(def => {
                if (!compareLocations(def.value, loop.inductionVariable.register)) return false;

                // Check if the definition is just assigning the induction variable to a different version of itself
                if (value.hasSSAVersion(loop.inductionVariable.register, def.version)) return false;

                const assignedTo = this.m_func.getValueOf(def);

                if (assignedTo.location) {
                    if (!value.hasSSAVersion(assignedTo.location.value, assignedTo.location.version)) {
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
            });

            return wasReassigned;
        });

        return true;
    }
}
