import { Tooltip } from '@mui/material';
import React from 'react';
import { DataType, PrimitiveType } from 'typesys';

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

type PrimitiveTypeDetailsProps = {
    type: PrimitiveType;
};

const PrimitiveTypeDetails: React.FC<PrimitiveTypeDetailsProps> = props => {
    const type = props.type;
    return (
        <>
            <InfoRow>
                <span>Type</span>
                <span>{type.isFloatingPoint ? 'Floating Point' : 'Integer'}</span>
            </InfoRow>
            {!type.isFloatingPoint && (
                <InfoRow>
                    <span>Signed</span>
                    <span>{type.isSigned ? 'Yes' : 'No'}</span>
                </InfoRow>
            )}
        </>
    );
};

type DataTypeTooltipProps = {
    dataType: DataType;
};

const DataTypeTooltip: React.FC<DataTypeTooltipProps> = props => {
    const type = props.dataType;

    let details: React.ReactNode = null;
    let classType: string | null = null;

    if (type instanceof PrimitiveType) {
        details = <PrimitiveTypeDetails type={type} />;
        classType = 'Primitive';
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <InfoRow>
                <span style={{ color: 'orange' }}>{type.name}</span>
                <span style={{ color: '#ccc' }}>{classType}</span>
            </InfoRow>
            <InfoRow style={{ borderBottom: '1px solid #ccc' }}>
                <span>Size</span>
                <span>
                    {type.size} (0x{type.size.toString(16)})
                </span>
            </InfoRow>
            {details}
        </div>
    );
};

type DataTypeHoverProps<T extends HTMLElement> = {
    dataType: DataType;
    children: React.ReactElement<React.HTMLProps<T>>;
};

export const DataTypeHover: React.FC<DataTypeHoverProps<any>> = props => {
    return (
        <Tooltip
            title={<DataTypeTooltip dataType={props.dataType} />}
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
