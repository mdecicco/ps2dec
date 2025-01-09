import { createTheme } from '@mui/material';

export const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        background: {
            default: '#1e1e1e',
            paper: '#252526'
        },
        primary: {
            main: '#007acc'
        }
    },
    typography: {
        fontFamily: `Roboto, Helvetica, Arial, sans-serif`
    }
});
