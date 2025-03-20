import React from 'react';
import { Box, Typography, Divider } from '@mui/material';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import PrayerCountdown from './PrayerCountdown';
import IslamicPatternBackground from './IslamicPatternBackground';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';

interface PrayerTimesPanelProps {
  variant: 'landscape' | 'portrait';
  onCountdownComplete?: () => void;
}

/**
 * PrayerTimesPanel component
 * 
 * Displays prayer times with countdown to next prayer
 * Can be configured for landscape or portrait mode
 */
const PrayerTimesPanel: React.FC<PrayerTimesPanelProps> = ({ 
  variant,
  onCountdownComplete 
}) => {
  const {
    todaysPrayerTimes,
    nextPrayer,
    isJumuahToday,
    jumuahDisplayTime,
  } = usePrayerTimes();
  
  const { fontSizes, screenSize } = useResponsiveFontSize();

  const isLandscape = variant === 'landscape';

  // Keyframes for smooth animation
  const pulseKeyframes = `
    @keyframes pulseShadow {
      0% {
        box-shadow: 0 0 10px rgba(33, 140, 116, 0.4);
      }
      50% {
        box-shadow: 0 0 20px rgba(33, 140, 116, 0.7);
      }
      100% {
        box-shadow: 0 0 10px rgba(33, 140, 116, 0.4);
      }
    }
    
    @keyframes pulseScale {
      0% {
        transform: scale(1.01);
      }
      50% {
        transform: scale(1.025);
      }
      100% {
        transform: scale(1.01);
      }
    }
    
    @keyframes pulseGlow {
      0% {
        border-color: rgba(46, 204, 113, 0.6);
      }
      50% {
        border-color: rgba(46, 204, 113, 0.9);
      }
      100% {
        border-color: rgba(46, 204, 113, 0.6);
      }
    }
  `;

  return (
    <>
      <style>
        {pulseKeyframes}
      </style>
      
      {/* Next Prayer Countdown */}
      {nextPrayer && (
        <Box 
          sx={{ 
            background: 'linear-gradient(90deg, #0A2647 0%, #144272 100%)',
            color: 'white',
            py: 2,
            px: 2.5,
            textAlign: 'center',
            borderBottom: '2px solid',
            borderImage: 'linear-gradient(90deg, #DAA520 0%, #F1C40F 100%) 1',
            position: 'relative',
            zIndex: 1,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <Typography sx={{ 
            fontSize: fontSizes.h5,
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 600,
            mb: 1,
            color: '#F1C40F',
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
            letterSpacing: '0.5px',
          }}>
            Next Prayer: <strong>{nextPrayer.name}</strong>
          </Typography>
          <PrayerCountdown 
            prayerName={nextPrayer.name}
            prayerTime={nextPrayer.time}
            onCountdownComplete={onCountdownComplete}
          />
          {nextPrayer.displayJamaat && (
            <Typography sx={{ 
              fontSize: fontSizes.body1,
              fontFamily: "'Poppins', sans-serif",
              mt: 1.5,
              color: '#F1C40F',
              fontWeight: 'bold',
              letterSpacing: '0.5px',
              display: 'inline-block',
              px: 2,
              py: 0.25,
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.1)',
            }}>
              Jamaa't: {nextPrayer.displayJamaat}
            </Typography>
          )}
        </Box>
      )}
      
      {/* Prayer Times Panel */}
      <Box 
        sx={{ 
          display: 'flex',
          flexDirection: 'column',
          p: 2,
          justifyContent: 'flex-start',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
          bgcolor: 'rgba(250, 250, 250, 0.98)',
          flex: 1,
          ...(isLandscape ? {
            minWidth: screenSize.isLargeScreen ? '400px' : '350px',
            borderRight: '1px solid',
            borderColor: 'rgba(218, 165, 32, 0.3)',
            boxShadow: '4px 0 12px rgba(0, 0, 0, 0.08)',
          } : {
            borderBottom: '1px solid',
            borderColor: 'rgba(218, 165, 32, 0.3)',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.05)',
          }),
        }}
      >
        {/* Header row with divider */}
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            mb: 1, 
            px: isLandscape ? 1.5 : 1,
            py: 1,
            backgroundColor: 'rgba(10, 38, 71, 0.05)',
            borderRadius: '6px',
            border: '1px solid rgba(10, 38, 71, 0.07)',
          }}>
            {isLandscape ? (
              <>
                <Typography sx={{ 
                  fontSize: fontSizes.body1, 
                  fontWeight: 'bold',
                  color: '#0A2647',
                  letterSpacing: '0.3px',
                }}>
                  Start Time
                </Typography>
                <Typography sx={{ 
                  fontSize: fontSizes.body1, 
                  fontWeight: 'bold',
                  color: '#0A2647',
                  letterSpacing: '0.3px',
                }}>
                  Prayer
                </Typography>
                <Typography sx={{ 
                  fontSize: fontSizes.body1, 
                  fontWeight: 'bold',
                  color: '#0A2647',
                  letterSpacing: '0.3px',
                }}>
                  Jamaa't
                </Typography>
              </>
            ) : (
              <>
                <Typography sx={{ 
                  fontSize: fontSizes.body1, 
                  fontWeight: 'bold', 
                  width: '30%',
                  color: '#0A2647',
                  fontFamily: "'Poppins', sans-serif",
                  letterSpacing: '0.3px',
                }}>
                  Prayer
                </Typography>
                <Typography sx={{ 
                  fontSize: fontSizes.body1, 
                  fontWeight: 'bold', 
                  width: '35%', 
                  textAlign: 'center',
                  color: '#0A2647',
                  fontFamily: "'Poppins', sans-serif",
                  letterSpacing: '0.3px',
                }}>
                  Start
                </Typography>
                <Typography sx={{ 
                  fontSize: fontSizes.body1, 
                  fontWeight: 'bold', 
                  width: '35%', 
                  textAlign: 'right',
                  color: '#0A2647',
                  fontFamily: "'Poppins', sans-serif",
                  letterSpacing: '0.3px',
                }}>
                  Jamaa't
                </Typography>
              </>
            )}
          </Box>
          <Divider sx={{ 
            borderColor: 'rgba(10, 38, 71, 0.07)',
            mb: 1.5
          }} />
        </Box>
        
        {/* Prayer times list */}
        <Box
          sx={{ 
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            zIndex: 1,
            width: '100%',
            px: isLandscape ? 0.5 : 0.25,
            // Add subtle background stripes for better readability
            backgroundImage: 'linear-gradient(rgba(246, 248, 250, 0.5) 50%, transparent 50%)',
            backgroundSize: '100% 80px',
            pb: 1,
            gap: 1.5,
          }}
        >
          {todaysPrayerTimes.map((prayer, index) => (
            <Box
              key={prayer.name}
              sx={{ 
                p: isLandscape ? 1.25 : 1.1, 
                borderRadius: 1.5,
                background: 'transparent',
                color: (prayer.isNext || prayer.isCurrent) ? 'white' : 'text.primary',
                boxShadow: prayer.isNext 
                  ? 'none' // Remove direct shadow, will be applied via animation
                  : prayer.isCurrent
                    ? '0 3px 8px rgba(10, 38, 71, 0.15)'
                    : index % 2 === 0 ? 'rgba(0, 0, 0, 0.02) 0px 1px 3px 0px' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.3s ease-in-out',
                animation: prayer.isNext 
                  ? 'pulseShadow 3s infinite ease-in-out, pulseScale 3s infinite ease-in-out, pulseGlow 3s infinite ease-in-out' 
                  : 'none',
                border: prayer.isNext 
                  ? '2px solid rgba(46, 204, 113, 0.8)' 
                  : prayer.isCurrent 
                    ? '1px solid rgba(33, 150, 243, 0.5)' 
                    : '1px solid rgba(0, 0, 0, 0.03)',
                height: isLandscape ? '70px' : '60px',
                minHeight: isLandscape ? '70px' : '60px',
                position: 'relative',
                overflow: 'hidden',
                mx: prayer.isNext ? 0.5 : 0,
                backgroundColor: !prayer.isNext && !prayer.isCurrent 
                  ? (index % 2 === 0 ? 'rgba(250, 250, 250, 0.9)' : 'rgba(255, 255, 255, 0.9)')
                  : 'transparent',
              }}
            >
              {(prayer.isCurrent || prayer.isNext) && (
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
                  <IslamicPatternBackground 
                    variant={prayer.isNext ? "dark" : "default"}
                  >
                    <Box sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      background: prayer.isCurrent 
                        ? 'linear-gradient(90deg, #144272 0%, #0A2647 100%)' 
                        : 'linear-gradient(90deg, #218c74 0%, #1e8c68 100%)',
                      opacity: 0.85,
                      zIndex: -1
                    }} />
                  </IslamicPatternBackground>
                </Box>
              )}
              
              {isLandscape ? (
                <>
                  {/* Time - Landscape */}
                  <Typography 
                    sx={{ 
                      fontWeight: 'bold',
                      fontSize: prayer.isNext ? fontSizes.h4 : fontSizes.h5,
                      width: '33%',
                      textAlign: 'left',
                      pl: 1.5,
                      fontFamily: "'Poppins', sans-serif",
                      zIndex: 1,
                      color: prayer.isCurrent 
                        ? '#FFFFFF' 
                        : prayer.isNext 
                          ? '#FFFFFF' 
                          : '#144272',
                    }}
                  >
                    {prayer.displayTime}
                  </Typography>
                  
                  {/* Prayer Name - Landscape */}
                  <Typography 
                    sx={{ 
                      fontWeight: 'bold',
                      fontSize: prayer.isNext ? fontSizes.h4 : fontSizes.h5,
                      width: '33%',
                      textAlign: 'center',
                      fontFamily: "'Poppins', sans-serif",
                      zIndex: 1,
                      color: prayer.isCurrent 
                        ? '#FFFFFF' 
                        : prayer.isNext 
                          ? '#FFFFFF' 
                          : '#0A2647',
                    }}
                  >
                    {prayer.name}
                  </Typography>
                  
                  {/* Jamaat Time - Landscape */}
                  <Typography 
                    sx={{ 
                      fontWeight: prayer.displayJamaat ? 'bold' : 'normal',
                      fontSize: prayer.displayJamaat 
                        ? (prayer.isNext ? fontSizes.h4 : fontSizes.h5) 
                        : fontSizes.body1,
                      width: '33%',
                      textAlign: 'right',
                      pr: 1.5,
                      fontStyle: prayer.displayJamaat ? 'normal' : 'italic',
                      opacity: prayer.displayJamaat ? 1 : 0.7,
                      fontFamily: "'Poppins', sans-serif",
                      zIndex: 1,
                      color: prayer.isCurrent 
                        ? '#FFFFFF' 
                        : prayer.isNext 
                          ? '#FFFFFF' 
                          : '#144272',
                    }}
                  >
                    {prayer.displayJamaat || 'N/A'}
                  </Typography>
                </>
              ) : (
                <>
                  {/* Prayer Name - Portrait */}
                  <Typography 
                    sx={{ 
                      fontWeight: 'bold',
                      fontSize: fontSizes.body1,
                      width: '30%',
                      fontFamily: "'Poppins', sans-serif",
                      zIndex: 1,
                      color: prayer.isCurrent 
                        ? '#FFFFFF' 
                        : prayer.isNext 
                          ? '#FFFFFF' 
                          : '#0A2647',
                      pl: 0.5,
                    }}
                  >
                    {prayer.name}
                  </Typography>
                  
                  {/* Time - Portrait */}
                  <Typography 
                    sx={{ 
                      fontWeight: 'bold',
                      fontSize: fontSizes.h5,
                      width: '35%',
                      textAlign: 'center',
                      fontFamily: "'Poppins', sans-serif",
                      zIndex: 1,
                      color: prayer.isCurrent 
                        ? '#FFFFFF' 
                        : prayer.isNext 
                          ? '#FFFFFF' 
                          : '#144272',
                      letterSpacing: 0.5,
                    }}
                  >
                    {prayer.displayTime}
                  </Typography>
                  
                  {/* Jamaat - Portrait */}
                  <Typography 
                    sx={{ 
                      fontWeight: prayer.displayJamaat ? 'medium' : 'normal',
                      fontSize: prayer.displayJamaat ? fontSizes.body1 : fontSizes.caption,
                      width: '35%',
                      textAlign: 'right',
                      fontStyle: prayer.displayJamaat ? 'normal' : 'italic',
                      opacity: prayer.displayJamaat ? 1 : 0.7,
                      fontFamily: "'Poppins', sans-serif",
                      zIndex: 1,
                      color: prayer.isCurrent 
                        ? '#FFFFFF' 
                        : prayer.isNext 
                          ? '#FFFFFF' 
                          : '#144272',
                      pr: 0.5,
                    }}
                  >
                    {prayer.displayJamaat || 'N/A'}
                  </Typography>
                </>
              )}
            </Box>
          ))}
          
          {isJumuahToday && (
            <Box
              sx={{ 
                p: isLandscape ? 1.25 : 1.1,
                mb: 0.5,
                borderRadius: 1.5,
                background: 'linear-gradient(90deg, #F1C40F 0%, #DAA520 100%)',
                color: '#0A2647',
                boxShadow: '0 3px 8px rgba(218, 165, 32, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: isLandscape ? '75px' : '65px',
                minHeight: isLandscape ? '75px' : '65px',
                mx: isLandscape ? 0.5 : 0.25,
                border: '1px solid rgba(218, 165, 32, 0.4)',
                position: 'relative',
                overflow: 'hidden',
                mt: 0.5,
              }}
            >
              {/* Background pattern for Jumuah */}
              <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
                pointerEvents: 'none',
                opacity: 0.3,
              }}>
                <IslamicPatternBackground 
                  variant="default"
                  height="100%"
                  width="100%"
                />
              </Box>
              
              {isLandscape ? (
                <>
                  {/* Time - Landscape */}
                  <Typography 
                    sx={{ 
                      fontWeight: 'bold',
                      fontSize: fontSizes.h4,
                      width: '33%',
                      textAlign: 'left',
                      pl: 1.5,
                      fontFamily: "'Poppins', sans-serif",
                      zIndex: 1,
                      color: '#0A2647',
                    }}
                  >
                    {jumuahDisplayTime}
                  </Typography>
                  
                  {/* Prayer Name - Landscape */}
                  <Typography 
                    sx={{ 
                      fontWeight: 'bold',
                      fontSize: fontSizes.h4,
                      width: '33%',
                      textAlign: 'center',
                      fontFamily: "'Poppins', sans-serif",
                      zIndex: 1,
                      color: '#0A2647',
                    }}
                  >
                    Jumu'ah
                  </Typography>
                  
                  {/* Empty slot for consistency - Landscape */}
                  <Typography 
                    sx={{ 
                      width: '33%',
                      textAlign: 'right',
                      pr: 1.5,
                      zIndex: 1,
                    }}
                  >
                    &nbsp;
                  </Typography>
                </>
              ) : (
                <>
                  {/* Prayer Name - Portrait */}
                  <Typography 
                    sx={{ 
                      fontWeight: 'bold',
                      fontSize: fontSizes.body1,
                      width: '30%',
                      fontFamily: "'Poppins', sans-serif",
                      zIndex: 1,
                      color: '#0A2647',
                      pl: 0.5,
                    }}
                  >
                    Jumu'ah
                  </Typography>
                  
                  {/* Time - Portrait */}
                  <Typography 
                    sx={{ 
                      fontWeight: 'bold',
                      fontSize: fontSizes.h5,
                      width: '35%',
                      textAlign: 'center',
                      fontFamily: "'Poppins', sans-serif",
                      zIndex: 1,
                      color: '#0A2647',
                      letterSpacing: 0.5,
                    }}
                  >
                    {jumuahDisplayTime}
                  </Typography>
                  
                  {/* Empty space for consistency - Portrait */}
                  <Typography 
                    sx={{ 
                      width: '35%',
                      textAlign: 'right',
                      zIndex: 1,
                      pr: 0.5,
                    }}
                  >
                    &nbsp;
                  </Typography>
                </>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
};

export default PrayerTimesPanel; 