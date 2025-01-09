import { Tooltip } from '@mui/material';
import { Op, Reg } from 'decoder';
import { DecompVariable, VariableStorage } from 'decompiler';
import React from 'react';
import { compareVersionedLocations } from 'utils';

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

type VariableTooltipProps = {
    variable: DecompVariable;
    storage: VariableStorage;
};

const VariableTooltip: React.FC<VariableTooltipProps> = props => {
    const variable = props.variable;
    const type = variable.type;

    const locations = variable.versions;

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <InfoRow style={{ borderBottom: '1px solid #ccc' }}>
                <span style={{ color: 'orange' }}>{variable.name}</span>
            </InfoRow>
            <InfoRow>
                <span>Type</span>
                <span>{type.name}</span>
            </InfoRow>
            <InfoRow>
                <span>Size</span>
                <span>
                    {type.size} (0x{type.size.toString(16)})
                </span>
            </InfoRow>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '1rem' }}>
                <InfoRow style={{ borderBottom: '1px solid #ccc' }}>
                    <span style={{ color: 'orange' }}>Locations</span>
                </InfoRow>
                {locations.entries.flatMap(e => {
                    const value = e[0];
                    return e[1].map(version => {
                        let formatted: string = '';
                        if (typeof value === 'number') {
                            formatted = Op.formatOperand({ base: { type: Reg.Type.EE, id: Reg.EE.SP }, offset: value });
                        } else {
                            formatted = Reg.formatRegister(value);
                        }

                        const isThisUse = compareVersionedLocations({ value, version }, props.storage.location);
                        return (
                            <InfoRow key={`${formatted}${version}`}>
                                <span style={{ color: isThisUse ? 'orange' : 'white' }}>{formatted}</span>
                                <span style={{ color: isThisUse ? 'orange' : 'white' }}>ver. {version}</span>
                            </InfoRow>
                        );
                    });
                })}
            </div>
        </div>
    );
};

type VariableHoverProps<T extends HTMLElement> = {
    variable: DecompVariable;
    storage: VariableStorage;
    children: React.ReactElement<React.HTMLProps<T>>;
};

export const VariableHover: React.FC<VariableHoverProps<any>> = props => {
    return (
        <Tooltip
            title={<VariableTooltip variable={props.variable} storage={props.storage} />}
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
