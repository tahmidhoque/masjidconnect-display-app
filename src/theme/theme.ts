import { createTheme } from '@mui/material/styles';
import { TypographyProps } from '@mui/material/Typography';
import { getDevicePerformanceProfile } from '../utils/performanceUtils';

// Get device performance profile for theme optimization
const deviceProfile = getDevicePerformanceProfile();

// Define a consistent gold gradient to use across the app - simplified for low-power devices
export const goldGradient = deviceProfile.profile === 'low' 
  ? '#DAA520' // Solid color for low-power devices
  : 'linear-gradient(90deg, #F1C40F 0%, #DAA520 100%)';

// Extend Typography variant types to include our custom variants
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    goldText: true;
    arabicText: true;
  }
}

// Performance-optimized shadows
const getShadows = () => {
  if (deviceProfile.profile === 'low') {
    return {
      card: '0 1px 3px rgba(0, 0, 0, 0.1)',
      elevated: '0 2px 4px rgba(0, 0, 0, 0.15)',
    };
  } else if (deviceProfile.profile === 'medium') {
    return {
      card: '0 2px 8px rgba(0, 0, 0, 0.1)',
      elevated: '0 4px 12px rgba(0, 0, 0, 0.15)',
    };
  } else {
    return {
      card: '0 4px 12px rgba(0, 0, 0, 0.05)',
      elevated: '0 8px 24px rgba(0, 0, 0, 0.1)',
    };
  }
};

const shadows = getShadows();

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
          // Simplified transitions for low-power devices
          transition: deviceProfile.profile === 'low' 
            ? 'background-color 150ms ease' 
            : 'all 200ms ease',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: shadows.card,
          // Disable backdrop filters on low-power devices
          ...(deviceProfile.profile === 'low' && {
            backdropFilter: 'none',
            background: 'rgba(255, 255, 255, 0.9)',
          }),
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          // Optimize Paper components for performance
          ...(deviceProfile.profile === 'low' && {
            backdropFilter: 'none',
            background: 'rgba(255, 255, 255, 0.95)',
          }),
        },
        elevation1: {
          boxShadow: shadows.card,
        },
        elevation4: {
          boxShadow: shadows.elevated,
        },
      },
    },

    MuiTypography: {
      styleOverrides: {
        root: {
          // Optimize text rendering
          ...(deviceProfile.profile === 'low' && {
            textRendering: 'optimizeSpeed',
            fontSmooth: 'never',
            WebkitFontSmoothing: 'subpixel-antialiased',
          }),
        },
      },
      variants: [
        {
          props: { variant: 'goldText' },
          style: {
            fontWeight: 'bold',
            // Use solid color for low-power devices, gradient for others
            ...(deviceProfile.profile === 'low' ? {
              color: '#DAA520',
            } : {
              background: 'linear-gradient(90deg, #F1C40F 0%, #DAA520 100%)',
              backgroundClip: 'text',
              textFillColor: 'transparent',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }),
            letterSpacing: '0.5px',
            // Simplified shadow for low-power devices
            textShadow: deviceProfile.profile === 'low' 
              ? 'none' 
              : '0 2px 4px rgba(0, 0, 0, 0.2)',
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
            // Performance optimizations for Arabic text
            ...(deviceProfile.profile === 'low' && {
              textRendering: 'optimizeSpeed',
              fontFeatureSettings: 'normal',
            }),
          },
        },
      ],
    },

  },
  // Custom theme properties for performance optimization
  custom: {
    performance: {
      profile: deviceProfile.profile,
      animationDuration: deviceProfile.recommendations.animationDuration,
      shadows,
    },
  },
});

// Add custom properties to theme interface
declare module '@mui/material/styles' {
  interface Theme {
    custom: {
      performance: {
        profile: 'ultra-low' | 'low' | 'medium' | 'high';
        animationDuration: number;
        shadows: {
          card: string;
          elevated: string;
        };
      };
    };
  }
  interface ThemeOptions {
    custom?: {
      performance?: {
        profile?: 'ultra-low' | 'low' | 'medium' | 'high';
        animationDuration?: number;
        shadows?: {
          card?: string;
          elevated?: string;
        };
      };
    };
  }
}

export default theme; 