import { Box, Button, LinearProgress, Menu, MenuItem as MuiMenuItem, Paper, Typography } from '@mui/material';
import { useActions } from 'apps/frontend/hooks/useActions';
import React, { useState } from 'react';

type ViewBaseProps = {
    children: React.ReactNode;
    noProgressDisplay?: boolean;
    style?: React.CSSProperties;
};

type SubMenuItemProps = {
    onClick: () => void;
    disabled?: boolean;
    children?: React.ReactNode;
    tooltip?: string;
};

export const SubMenuItem: React.FC<SubMenuItemProps> = props => {
    return (
        <MuiMenuItem
            onClick={props.onClick}
            disabled={props.disabled}
            dense
            sx={{ minWidth: 200, px: 1.5, py: 0.0, display: 'flex', justifyContent: 'space-between' }}
        >
            <Typography variant='body2'>{props.children}</Typography>
            <Typography variant='body2' color='text.secondary' fontSize={10}>
                {props.tooltip}
            </Typography>
        </MuiMenuItem>
    );
};

type MenuItemProps = {
    label: string;
    children?: React.ReactNode;
    disabled?: boolean;
};

export const MenuItem: React.FC<MenuItemProps> = props => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    return (
        <>
            <Button
                onClick={handleClick}
                disabled={props.disabled}
                sx={{
                    color: 'text.primary',
                    minWidth: 'auto',
                    padding: '0px 8px',
                    textTransform: 'none'
                }}
            >
                {props.label}
            </Button>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                onClick={handleClose}
                elevation={0}
                transitionDuration={50}
                sx={{
                    overflow: 'visible',
                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))'
                }}
                transformOrigin={{ horizontal: 'left', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
            >
                {props.children}
            </Menu>
        </>
    );
};

const ViewComp: React.FC<ViewBaseProps> = props => {
    const { isWorking, progress } = useActions();
    const menuItems: React.ReactNode[] = [];
    const children: React.ReactNode[] = [];

    React.Children.forEach(props.children, child => {
        if (React.isValidElement(child)) {
            if (child.type === MenuItem) {
                menuItems.push(child);
            } else {
                children.push(child);
            }
        }
    });

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {menuItems.length > 0 && (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: 0.5,
                        px: 1,
                        borderBottom: 1,
                        borderColor: 'divider',
                        bgcolor: 'background.paper'
                    }}
                >
                    {menuItems.map((item, index) => (
                        <React.Fragment key={index}>{item}</React.Fragment>
                    ))}
                </Box>
            )}
            {!props.noProgressDisplay && isWorking ? (
                <Paper
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'absolute',
                        bottom: '10px',
                        left: '50vw',
                        transform: 'translateX(-50%)',
                        width: '400px',
                        gap: 1,
                        p: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}
                >
                    <Typography variant='body2' color='text.secondary' fontSize={10}>
                        {progress?.description || 'Working...'}
                    </Typography>
                    <LinearProgress
                        variant={progress ? 'determinate' : 'indeterminate'}
                        value={(progress?.fraction || 0) * 100.0}
                    />
                </Paper>
            ) : null}
            <Box sx={{ display: 'grid', flexGrow: 1, overflow: 'hidden', ...props.style }}>{children}</Box>
        </Box>
    );
};

export const View = Object.assign(ViewComp, {
    Menu: MenuItem,
    MenuItem: SubMenuItem
});
