import React from 'react';
import { Box, Typography, Link, CircularProgress, useTheme } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeDisplayProps {
  qrCodeUrl: string;
  pairingCode: string | null;
  isPairing: boolean;
  logoSrc: string;
  adminBaseUrl: string;
}

/**
 * Displays a QR code for pairing
 */
const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  qrCodeUrl,
  pairingCode,
  isPairing,
  logoSrc,
  adminBaseUrl
}) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ textAlign: 'center' }}>
      {/* QR Code Container - Fixed size to prevent layout shifts */}
      <Box
        sx={{
          position: 'relative',
          width: 280,
          height: 280,
          mx: 'auto',
          bgcolor: 'white',
          borderRadius: 2,
          p: 2,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Loading Overlay */}
        {isPairing && (
          <Box 
            sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              backgroundColor: 'rgba(255,255,255,0.7)', 
              borderRadius: 2,
              zIndex: 2
            }}
          >
            <CircularProgress size={60} />
          </Box>
        )}
        
        {/* Actual QR Code or Loading Placeholder */}
        {pairingCode ? (
          /* Key is set to the pairing code to force re-render when code changes */
          <QRCodeSVG
            key={`qr-${pairingCode}`}
            value={qrCodeUrl}
            size={250}
            bgColor={"#ffffff"}
            fgColor={"#0A2647"}
            level={"H"}
            includeMargin={false}
            imageSettings={{
              src: logoSrc,
              x: undefined,
              y: undefined,
              height: 50,
              width: 50,
              excavate: true,
            }}
          />
        ) : (
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Generating QR code...
            </Typography>
          </Box>
        )}
      </Box>
      
      <Typography variant="body2" color="rgba(255, 255, 255, 0.7)" align="center" sx={{ mt: 3 }}>
        Scan this QR code with the MasjidConnect app or visit{' '}
        <Link 
          href={`${adminBaseUrl}/pair`}
          target="_blank" 
          rel="noopener"
          sx={{ color: theme.palette.warning.main }}
        >
          {adminBaseUrl}/pair
        </Link>
      </Typography>
    </Box>
  );
};

export default QRCodeDisplay; 