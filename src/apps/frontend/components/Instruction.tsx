import { i, Op, Reg } from 'decoder';
import React from 'react';

type InstructionProps = {
    instruction: i.Instruction;
};

export const Instruction: React.FC<InstructionProps> = ({ instruction }) => {
    const parts = instruction.toStrings();
    return (
        <div>
            <span style={{ display: 'inline-block', color: 'lightblue', fontFamily: 'Courier New', width: '5rem' }}>
                {parts[0]}
            </span>
            {instruction.operands.map((op, idx) => (
                <React.Fragment key={idx}>
                    {idx > 0 && <span style={{ color: 'gray', marginRight: '0.2rem' }}>,</span>}
                    {typeof op === 'number' ? (
                        <span style={{ color: '#bd2b2b', fontFamily: 'Courier New' }}>{Op.formatOperand(op)}</span>
                    ) : 'type' in op ? (
                        <span style={{ color: '#acb900', fontFamily: 'Courier New' }}>{Reg.formatRegister(op)}</span>
                    ) : (
                        <>
                            <span style={{ color: '#bd2b2b', fontFamily: 'Courier New' }}>
                                {Op.formatOperand(op.offset)}
                            </span>
                            <span style={{ color: 'gray', fontFamily: 'Courier New' }}>(</span>
                            <span style={{ color: '#acb900', fontFamily: 'Courier New' }}>
                                {Reg.formatRegister(op.base)}
                            </span>
                            <span style={{ color: 'gray', fontFamily: 'Courier New' }}>)</span>
                        </>
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};
