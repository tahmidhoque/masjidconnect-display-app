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
        position: 'absolute',
        bottom: getSizeRem(1.5),
        right: getSizeRem(1.5),
        zIndex: 10,
      }}
    >
      <GlassmorphicCard
        opacity={0.2}
        blurIntensity={8}
        borderRadius={4}
        borderWidth={1}
        borderOpacity={0.25}
        borderColor={alpha('#ffffff', 0.25)}
        shadowIntensity={0.3}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: getSizeRem(0.7),
          px: getSizeRem(1.2),
          py: getSizeRem(0.6),
          color: '#fff',
          backgroundColor: alpha(theme.palette.primary.dark, 0.3),
          borderTop: `1px solid ${alpha('#ffffff', 0.5)}`,
          borderLeft: `1px solid ${alpha('#ffffff', 0.5)}`,
        }}
      >
        <Typography
          sx={{
            fontSize: fontSizes.caption,
            color: alpha('#fff', 0.85),
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 400,
          }}
        >
          Powered by
        </Typography>
        
        <img 
          src={logoSrc} 
          alt="MasjidConnect Logo" 
          style={{ 
            height: `${getSizeRem(1.2).replace('rem', '')}rem`,
            width: 'auto',
            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))'
          }}
        />
      </GlassmorphicCard>
    </Box>
  );
};

export default GlassmorphicFooter;