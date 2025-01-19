import { Tooltip } from '@mui/material';
import { Op, Reg } from 'decoder';
import React from 'react';
import { Func, Method } from 'typesys';
import { formatAddress } from 'utils';

type InfoRowProps = {
    children: React.ReactNode;
    style?: React.CSSProperties;
};

const InfoRow: React.FC<InfoRowProps> = props => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: '30px',
                ...props.style
            }}
        >
            {props.children}
        </div>
    );
};

type FunctionTooltipProps = {
    func: Func | Method;
};

const FunctionTooltip: React.FC<FunctionTooltipProps> = props => {
    const func = props.func;
    const returnLoc = func.returnLocation;

    let returnLocStr: string | null = null;
    if (returnLoc) {
        if (typeof returnLoc === 'number') {
            returnLocStr = Op.formatOperand({
                base: { type: Reg.Type.EE, id: Reg.EE.SP },
                offset: returnLoc
            });
        } else returnLocStr = Reg.formatRegister(returnLoc);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <InfoRow style={{ borderBottom: '1px solid #ccc' }}>
                <span style={{ color: 'orange' }}>{func.name}</span>
            </InfoRow>
            <InfoRow>
                <span>Start Address</span>
                <span>{formatAddress(func.address)}</span>
            </InfoRow>
            <InfoRow>
                <span>End Address</span>
                <span>{formatAddress(func.endAddress)}</span>
            </InfoRow>
            <InfoRow>
                <span>Size</span>
                <span>0x{(func.endAddress - func.address).toString(16)}</span>
            </InfoRow>
            {func.arguments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: '1rem' }}>
                    <InfoRow style={{ borderBottom: '1px solid #ccc' }}>
                        <span style={{ color: 'orange' }}>Arguments</span>
                    </InfoRow>
                    {func.arguments.map((arg, idx) => {
                        const loc = func.signature.arguments[idx].location;
                        let locStr = '';
                        if (typeof loc === 'number') {
                            locStr = Op.formatOperand({
                                base: { type: Reg.Type.EE, id: Reg.EE.SP },
                                offset: loc
                            });
                        } else locStr = Reg.formatRegister(loc);

                        // todo: argument names
                        return (
                            <InfoRow key={locStr}>
                                <span>
                                    {arg.type.name} param_{idx + 1}
                                </span>
                                <span>{locStr}</span>
                            </InfoRow>
                        );
                    })}
                </div>
            )}
            {func.returnLocation && (
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: '1rem' }}>
                    <InfoRow style={{ borderBottom: '1px solid #ccc' }}>
                        <span style={{ color: 'orange' }}>Return Value</span>
                    </InfoRow>
                    <InfoRow>
                        <span>Type</span>
                        <span>{func.signature.returnType.name}</span>
                    </InfoRow>
                    <InfoRow>
                        <span>Location</span>
                        <span>{returnLocStr}</span>
                    </InfoRow>
                </div>
            )}
        </div>
    );
};

type FunctionHoverProps<T extends HTMLElement> = {
    func: Func | Method;
    children: React.ReactElement<React.HTMLProps<T>>;
};

export const FunctionHover: React.FC<FunctionHoverProps<any>> = props => {
    return (
        <Tooltip
            title={<FunctionTooltip func={props.func} />}
            slotProps={{
                popper: {
                    modifiers: [
                        {
                            name: 'offset',
                            options: {
                                offset: [0, -5]
                            }
                        }
                    ],
                    style: {
                        pointerEvents: 'none'
                    }
                }
            }}
            placement='right'
            arrow
        >
            {props.children}
        </Tooltip>
    );
};
