import { createTheme } from '@mui/material/styles';
import { TypographyProps } from '@mui/material/Typography';

// Define a consistent gold gradient to use across the app
export const goldGradient = 'linear-gradient(90deg, #F1C40F 0%, #DAA520 100%)';

// Extend Typography variant types to include our custom variants
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    goldText: true;
    arabicText: true;
  }
}

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
    MuiTypography: {
      variants: [
        {
          props: { variant: 'goldText' },
          style: {
            fontWeight: 'bold',
            background: 'linear-gradient(90deg, #F1C40F 0%, #DAA520 100%)',
            backgroundClip: 'text',
            textFillColor: 'transparent',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.5px',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          },
        },
        {
          props: { variant: 'arabicText' },
          style: {
            fontFamily: "'Amiri', 'Poppins', Arial, sans-serif",
            fontSize: '1.5rem',
            fontWeight: 400,
            letterSpacing: '0.01em',
            lineHeight: 1.8,
            direction: 'rtl',
          },
        },
      ],
    },
  },
});

export default theme; 