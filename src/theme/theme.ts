import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0A2647', // Midnight Blue
    },
    secondary: {
      main: '#2A9D8F', // Emerald Green
    },
    error: {
      main: '#E76F51', // Error Red
    },
    warning: {
      main: '#E9C46A', // Golden Yellow
    },
    info: {
      main: '#66D1FF', // Sky Blue
    },
    background: {
      default: '#F4F4F4', // Soft White
    },
  },
  typography: {
    fontFamily: 'Poppins, Montserrat, Lato, sans-serif',
    h1: {
      fontSize: '40px',
      fontWeight: 700,
    },
    h2: {
      fontSize: '32px',
      fontWeight: 600,
    },
    h3: {
      fontSize: '24px',
      fontWeight: 500,
    },
    body1: {
      fontSize: '16px',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '14px',
      lineHeight: 1.6,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          padding: '8px 24px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        },
      },
    },
  },
});

export default theme; 