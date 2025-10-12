import React from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import GlassmorphicCard from './GlassmorphicCard';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import { getCurrentVersion, formatVersionDisplay } from '../../utils/versionManager';

interface GlassmorphicFooterProps {
  logoSrc: string;
  orientation?: 'portrait' | 'landscape';
  showVersion?: boolean;
}

const GlassmorphicFooter: React.FC<GlassmorphicFooterProps> = ({
  logoSrc,
  orientation = 'landscape',
  showVersion = true,
}) => {
  const theme = useTheme();
  const { fontSizes, getSizeRem } = useResponsiveFontSize();

  const isPortrait = orientation === 'portrait';
  const currentVersion = getCurrentVersion();

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
        shadowIntensity={0.1}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: getSizeRem(0.5),
          px: getSizeRem(1.0),
          py: getSizeRem(0.3),
          color: '#fff',
          backgroundColor: alpha(theme.palette.primary.dark, 0.15),
          borderTop: `1px solid ${alpha('#ffffff', 0.2)}`,
          borderLeft: `1px solid ${alpha('#ffffff', 0.2)}`,
          maxWidth: 'fit-content',
        }}
      >
        <Typography
          sx={{
            fontSize: isPortrait ? fontSizes.small : fontSizes.body2,
            color: alpha('#fff', 0.75),
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 400,
            letterSpacing: '0.3px',
          }}
        >
          Powered by
        </Typography>

        <img
          src={logoSrc}
          alt="MasjidConnect Logo"
          style={{
            height: `${getSizeRem(1.0).replace('rem', '')}rem`,
            width: 'auto',
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15))',
          }}
        />

        {showVersion && (
          <Typography
            sx={{
              fontSize: isPortrait ? fontSizes.caption : fontSizes.small,
              color: alpha('#fff', 0.5),
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 300,
              letterSpacing: '0.2px',
              ml: getSizeRem(0.5),
            }}
          >
            {formatVersionDisplay(currentVersion)}
          </Typography>
        )}
      </GlassmorphicCard>
    </Box>
  );
};

export default GlassmorphicFooter;
