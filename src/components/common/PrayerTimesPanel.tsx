import React, { useMemo } from 'react';
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

  // Memoize the keyframes to prevent recalculation on every render
  const pulseKeyframes = useMemo(() => `
    @keyframes pulseShadow {
      0% {
        box-shadow: 0 0 10px rgba(33, 140, 116, 0.4);
      }
      50% {
        box-shadow: 0 0 15px rgba(33, 140, 116, 0.6);
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
        transform: scale(1.05);
      }
      100% {
        transform: scale(1.01);
      }
    }
    
    @keyframes pulseGlow {
      0% {
        border-color: rgba(46, 204, 113, 0.7);
        box-shadow: 0 0 8px rgba(46, 204, 113, 0.5), 0 0 15px rgba(46, 204, 113, 0.3);
      }
      50% {
        border-color: rgba(46, 204, 113, 1);
        box-shadow: 0 0 15px rgba(46, 204, 113, 0.8), 0 0 25px rgba(46, 204, 113, 0.5);
      }
      100% {
        border-color: rgba(46, 204, 113, 0.7);
        box-shadow: 0 0 8px rgba(46, 204, 113, 0.5), 0 0 15px rgba(46, 204, 113, 0.3);
      }
    }
    
    @keyframes currentPrayerGlow {
      0% {
        border-color: rgba(20, 66, 114, 0.6);
      }
      50% {
        border-color: rgba(20, 66, 114, 0.9);
      }
      100% {
        border-color: rgba(20, 66, 114, 0.6);
      }
    }
    
    @keyframes pulseBackground {
      0% {
        background-color: rgba(33, 140, 116, 0.8);
      }
      50% {
        background-color: rgba(46, 204, 113, 0.9);
      }
      100% {
        background-color: rgba(33, 140, 116, 0.8);
      }
    }
    
    @keyframes nextPrayerShine {
      0% {
        background-position: -100% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }
    
    @keyframes headerGlow {
      0% {
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }
      50% {
        text-shadow: 0 1px 12px rgba(241, 196, 15, 0.7), 0 0 20px rgba(241, 196, 15, 0.4);
      }
      100% {
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }
    }
    
    @keyframes headerBorderGlow {
      0% {
        border-image: linear-gradient(90deg, #DAA520 0%, #F1C40F 100%) 1;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      }
      50% {
        border-image: linear-gradient(90deg, #F1C40F 0%, #FFD700 100%) 1;
        box-shadow: 0 4px 20px rgba(241, 196, 15, 0.3), 0 8px 25px rgba(0,0,0,0.2);
      }
      100% {
        border-image: linear-gradient(90deg, #DAA520 0%, #F1C40F 100%) 1;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      }
    }
  `, []);

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
            py: screenSize.is720p ? 1.8 : 2.5,
            px: screenSize.is720p ? 2 : 3,
            textAlign: 'center',
            borderBottom: '3px solid',
            borderImage: 'linear-gradient(90deg, #DAA520 0%, #F1C40F 100%) 1',
            position: 'relative',
            zIndex: 1,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            animation: 'headerBorderGlow 2.5s infinite ease-in-out',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '200%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
              animation: 'nextPrayerShine 3s infinite linear',
              zIndex: 0
            }
          }}
        >
          <Typography sx={{ 
            fontSize: fontSizes.h4,
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 700,
            mb: 1,
            color: '#F1C40F',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            letterSpacing: '0.5px',
            // animation: 'headerGlow 2.5s infinite ease-in-out',
            position: 'relative',
            zIndex: 1
          }}>
            Next Prayer: <strong>{nextPrayer.name}</strong>
          </Typography>
          <PrayerCountdown 
            prayerName={nextPrayer.name}
            prayerTime={nextPrayer.time}
            timeUntilNextPrayer={nextPrayer.timeUntil}
            onCountdownComplete={onCountdownComplete}
            key={`${nextPrayer.name}-${nextPrayer.time}`}
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
          p: screenSize.is720p ? 1.5 : 2,
          justifyContent: 'flex-start',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
          bgcolor: 'rgba(250, 250, 250, 0.98)',
          flex: 1,
          ...(isLandscape ? {
            minWidth: screenSize.is720p 
              ? '300px' 
              : (screenSize.isLargeScreen ? '400px' : '350px'),
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
          {todaysPrayerTimes.length > 0 ? (
            todaysPrayerTimes.map((prayer, index) => (
              <Box
                key={prayer.name}
                data-prayer-name={prayer.name}
                data-prayer-time={prayer.time}
                data-is-current={prayer.isCurrent}
                data-is-next={prayer.isNext}
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  height: isLandscape ? '60px' : '48px',
                  pl: isLandscape ? 3 : 1.5,
                  pr: isLandscape ? 3 : 1.5,
                  position: 'relative',
                  borderRadius: prayer.isNext || prayer.isCurrent ? '8px' : '0px',
                  borderBottom: index < todaysPrayerTimes.length - 1 ? '1px solid rgba(0, 0, 0, 0.05)' : 'none',
                  border: prayer.isNext 
                    ? '3px solid #2A9D8F'
                    : prayer.isCurrent
                      ? '2px solid rgba(20, 66, 114, 0.9)'
                      : 'none',
                  transition: 'all 0.3s ease',
                  transform: prayer.isNext 
                    ? 'scale(1.05)' 
                    : prayer.isCurrent
                      ? 'scale(1.01)'
                      : 'scale(1)',
                  boxShadow: prayer.isNext 
                    ? '0 6px 16px rgba(33, 140, 116, 0.4), 0 0 15px rgba(46, 204, 113, 0.4)' 
                    : prayer.isCurrent
                      ? '0 2px 8px rgba(20, 66, 114, 0.3)'
                      : 'none',
                  overflow: 'hidden',
                  mx: prayer.isNext ? 1 : 0,
                  my: prayer.isNext ? 0.9 : 0,
                  backgroundColor: prayer.isNext 
                    ? 'rgba(46, 204, 113, 0.8)'
                    : prayer.isCurrent
                      ? 'rgba(20, 66, 114, 0.8)'
                      : index % 2 === 0 
                        ? 'rgba(246, 248, 250, 0.5)' 
                        : 'transparent',
                  zIndex: prayer.isNext || prayer.isCurrent ? 2 : 1,
                  animation: prayer.isNext 
                    ? 'pulseBackground 2s infinite ease-in-out, pulseGlow 2s infinite ease-in-out, pulseScale 3s infinite ease-in-out' 
                    : prayer.isCurrent
                      ? 'currentPrayerGlow 3s infinite ease-in-out'
                      : 'none',
                  '&::before': prayer.isNext ? {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '200%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                    animation: 'nextPrayerShine 2.5s infinite linear',
                    zIndex: 0
                  } : {},
                }}
              >
                {(prayer.isCurrent || prayer.isNext) && (
                  <Box 
                    sx={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      right: 0, 
                      bottom: 0, 
                      zIndex: 0,
                      overflow: 'hidden',
                      backgroundColor: prayer.isCurrent 
                        ? 'rgba(20, 66, 114, 0.95)' 
                        : '#2A9D8F',
                    }}
                  >
                    <IslamicPatternBackground 
                      variant="custom"
                      width="100%"
                      height="100%"
                      patternColor={prayer.isCurrent ? '#0A2647' : '#27ae60'}
                      backgroundColor="transparent"
                      opacity={prayer.isNext ? 0.4 : 0.3}
                      patternSize={prayer.isNext ? 70 : 80}
                      embossStrength={prayer.isNext ? "medium" : "light"}
                    />
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
                        textShadow: (prayer.isNext || prayer.isCurrent) ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
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
                        textShadow: (prayer.isNext || prayer.isCurrent) ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
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
                        textShadow: (prayer.isNext || prayer.isCurrent) ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
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
                        textShadow: (prayer.isNext || prayer.isCurrent) ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
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
                        textShadow: (prayer.isNext || prayer.isCurrent) ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
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
                        textShadow: (prayer.isNext || prayer.isCurrent) ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                      }}
                    >
                      {prayer.displayJamaat || 'N/A'}
                    </Typography>
                  </>
                )}
              </Box>
            ))
          ) : (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%',
              p: 4,
              textAlign: 'center'
            }}>
              <Typography 
                sx={{ 
                  fontSize: fontSizes.h4,
                  fontWeight: 'medium',
                  color: 'text.secondary',
                  mb: 2
                }}
              >
                Prayer times not available
              </Typography>
              <Typography
                sx={{ 
                  fontSize: fontSizes.body1,
                  color: 'text.secondary',
                }}
              >
                Please check your internet connection or try again later.
              </Typography>
            </Box>
          )}
          
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

// Export with React.memo to prevent unnecessary re-renders
export default React.memo(PrayerTimesPanel, (
  prevProps: PrayerTimesPanelProps, 
  nextProps: PrayerTimesPanelProps
): boolean => {
  // Only re-render if props actually changed
  return prevProps.variant === nextProps.variant;
}); 