import { createTheme } from '@mui/material/styles';
import { responsiveFontSizes } from '@mui/material/styles';

// Create a base theme
const baseTheme = createTheme({
  palette: {
    primary: {
      main: '#0A2647', // Deep blue-green
      light: '#144272',
      dark: '#071330',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#2A9D8F', // Islamic teal
      light: '#4FB3A9',
      dark: '#1C867A',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#E9C46A', // Golden yellow
      light: '#F1D68B',
      dark: '#E0B348',
      contrastText: '#000000',
    },
    error: {
      main: '#E76F51', // Coral red
      light: '#EB8E75',
      dark: '#D65A3A',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#66D1FF', // Light blue
      light: '#99E8FF',
      dark: '#33BBFF',
    },
    background: {
      default: '#F8F9FA', // Off-white
      paper: '#FFFFFF',
    },
    text: {
      primary: '#212529', // Dark gray for body text
      secondary: '#6C757D', // Medium gray for secondary text
    },
  },
  typography: {
    fontFamily: '"Poppins", "Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '3rem',
      fontWeight: 700,
      letterSpacing: '-0.01562em',
    },
    h2: {
      fontSize: '2.5rem',
      fontWeight: 700,
      letterSpacing: '-0.00833em',
    },
    h3: {
      fontSize: '2rem',
      fontWeight: 600,
      letterSpacing: '0em',
    },
    h4: {
      fontSize: '1.75rem',
      fontWeight: 600,
      letterSpacing: '0.00735em',
    },
    h5: {
      fontSize: '1.5rem',
      fontWeight: 600,
      letterSpacing: '0em',
    },
    h6: {
      fontSize: '1.25rem',
      fontWeight: 600,
      letterSpacing: '0.0075em',
    },
    subtitle1: {
      fontSize: '1.125rem',
      fontWeight: 500,
      letterSpacing: '0.00938em',
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      letterSpacing: '0.00714em',
    },
    body1: {
      fontSize: '1rem',
      fontWeight: 400,
      letterSpacing: '0.00938em',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: 400,
      letterSpacing: '0.01071em',
      lineHeight: 1.6,
    },
    button: {
      fontWeight: 600,
      letterSpacing: '0.02857em',
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
          textTransform: 'none',
          padding: '8px 24px',
          '&:hover': {
            boxShadow: '0 3px 8px rgba(0, 0, 0, 0.15)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        elevation1: {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        },
        elevation2: {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        },
        elevation3: {
          boxShadow: '0 6px 16px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.06)',
        },
      },
    },
  },
});

// Make typography responsive
const theme = responsiveFontSizes(baseTheme, { factor: 1.2 });

export default theme; 