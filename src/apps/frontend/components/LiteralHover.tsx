import { Tooltip } from '@mui/material';
import { DataType } from 'decompiler';
import React from 'react';

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

type LiteralTooltipProps = {
    literal: string;
    dataType: DataType;
    value: bigint;
};

const convBuf = new Uint8Array(16);
const convView = new DataView(convBuf.buffer);

const fmt_char = () => String.fromCharCode(convView.getUint8(0));
const fmt_wchar = () => String.fromCharCode(convView.getUint16(0, true));
const fmt_u8 = () => `${convView.getUint8(0)}`;
const fmt_u16 = () => `${convView.getUint16(0, true)}`;
const fmt_u32 = () => `${convView.getUint32(0, true)}`;
const fmt_u64 = () => `${convView.getBigUint64(0, true)}`;
const fmt_i8 = () => `${convView.getInt8(0)}`;
const fmt_i16 = () => `${convView.getInt16(0, true)}`;
const fmt_i32 = () => `${convView.getInt32(0, true)}`;
const fmt_i64 = () => `${convView.getBigInt64(0, true)}`;
const fmt_f32 = () => `${convView.getFloat32(0, true)}`;
const fmt_f64 = () => `${convView.getFloat64(0, true)}`;
const fmt_str = (sz: number) => {
    let str = '';
    for (let i = 0; i < sz; i++) {
        str += String.fromCharCode(convView.getUint8(i));
    }
    return str;
};
const fmt_wstr = (sz: number) => {
    let str = '';
    for (let i = 0; i < sz; i += 2) {
        str += String.fromCharCode(convView.getUint16(i));
    }
    return str;
};

const fmtMap: Record<number, [label: string, fmt: () => string][]> = {
    1: [
        ['u8', fmt_u8],
        ['i8', fmt_i8],
        ['char', fmt_char]
    ],
    2: [
        ['u16', fmt_u16],
        ['i16', fmt_i16],
        ['wchar', fmt_wchar]
    ],
    4: [
        ['u32', fmt_u32],
        ['i32', fmt_i32],
        ['f32', fmt_f32]
    ],
    8: [
        ['u64', fmt_u64],
        ['i64', fmt_i64],
        ['f64', fmt_f64]
    ]
};

function calcByteLengthFromValue(value: bigint, max: number) {
    let sz = 0n;

    for (sz = BigInt(max * 8); sz != 0n; sz -= 8n) {
        if ((value >> (sz - 8n)) & 0xffn) {
            break;
        }
    }

    return Math.max(1, Math.floor(Number(sz) / 8));
}

const LiteralTooltip: React.FC<LiteralTooltipProps> = props => {
    const { literal, dataType, value } = props;

    convView.setBigUint64(0, value, true);

    const sz = calcByteLengthFromValue(value, dataType.size);
    const fmt: [label: string, fmt: () => string][] = [];

    for (let i = sz; i <= 8; i++) {
        if (i in fmtMap) {
            fmt.push(...fmtMap[i]);
            break;
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {fmt.map(([label, fmt]) => (
                <InfoRow key={label}>
                    <span>{label}</span>
                    <span>{fmt()}</span>
                </InfoRow>
            ))}
            <InfoRow>
                <span>char[{sz}]</span>
                <span>{fmt_str(sz)}</span>
            </InfoRow>
            {sz % 2 === 0 && (
                <InfoRow>
                    <span>wchar[{sz}]</span>
                    <span>{fmt_wstr(sz)}</span>
                </InfoRow>
            )}
        </div>
    );
};

type LiteralHoverProps<T extends HTMLElement> = {
    literal: string;
    dataType: DataType;
    value: bigint;
    children: React.ReactElement<React.HTMLProps<T>>;
};

export const LiteralHover: React.FC<LiteralHoverProps<any>> = props => {
    return (
        <Tooltip
            title={<LiteralTooltip literal={props.literal} dataType={props.dataType} value={props.value} />}
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
