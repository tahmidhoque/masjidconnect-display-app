import React from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import GlassmorphicCard from './GlassmorphicCard';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';

interface GlassmorphicFooterProps {
  logoSrc: string;
  orientation?: 'portrait' | 'landscape';
}

const GlassmorphicFooter: React.FC<GlassmorphicFooterProps> = ({
  logoSrc,
  orientation = 'landscape'
}) => {
  const theme = useTheme();
  const { fontSizes, getSizeRem } = useResponsiveFontSize();
  
  const isPortrait = orientation === 'portrait';
  
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: 'auto',
        py: getSizeRem(0.3),
      }}
    >
      <GlassmorphicCard
        opacity={0.12}
        blurIntensity={5}
        borderRadius={2}
        borderWidth={1}
        borderOpacity={0.12}
        borderColor={alpha('#ffffff', 0.12)}
        shadowIntensity={0.10}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: getSizeRem(0.4),
          px: getSizeRem(0.7),
          py: getSizeRem(0.2),
          color: '#fff',
          backgroundColor: alpha(theme.palette.primary.dark, 0.15),
          borderTop: `1px solid ${alpha('#ffffff', 0.2)}`,
          borderLeft: `1px solid ${alpha('#ffffff', 0.2)}`,
          maxWidth: 'fit-content',
        }}
      >
        <Typography
          sx={{
            fontSize: fontSizes.small,
            color: alpha('#fff', 0.6),
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 300,
          }}
        >
          Powered by
        </Typography>
        
        <img 
          src={logoSrc} 
          alt="MasjidConnect Logo" 
          style={{ 
            height: `${getSizeRem(0.7).replace('rem', '')}rem`,
            width: 'auto',
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.12))'
          }}
        />
      </GlassmorphicCard>
    </Box>
  );
};

export default GlassmorphicFooter;