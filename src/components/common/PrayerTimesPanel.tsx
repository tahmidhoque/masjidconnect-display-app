import React, { useMemo } from 'react';
import { Box, Typography, Divider } from '@mui/material';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import PrayerCountdown from './PrayerCountdown';
import IslamicPatternBackground from './IslamicPatternBackground';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';

interface PrayerTimesPanelProps {
  variant: 'landscape' | 'portrait';
  onCountdownComplete?: (isJamaat: boolean) => void;
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

  const { fontSizes, layout, screenSize, getSizeRem, getSizePx } = useResponsiveFontSize();

  const isLandscape = variant === 'landscape';

  // Memoize the keyframes to prevent recalculation on every render
  const pulseKeyframes = useMemo(() => `
    @keyframes pulseShadow {
      0% {
        box-shadow: 0 0 10px rgba(42, 157, 143, 0.4);
      }
      50% {
        box-shadow: 0 0 15px rgba(42, 157, 143, 0.6);
      }
      100% {
        box-shadow: 0 0 10px rgba(42, 157, 143, 0.4);
      }
    }
    
    @keyframes pulseScale {
      0% {
        transform: scale(1.01);
      }
      50% {
        transform: scale(1.03);
      }
      100% {
        transform: scale(1.01);
      }
    }
    
    @keyframes pulseGlow {
      0% {
        box-shadow: 0 4px 10px rgba(42, 157, 143, 0.4), 0 0 15px rgba(42, 157, 143, 0.3);
      }
      50% {
        box-shadow: 0 4px 18px rgba(42, 157, 143, 0.6), 0 0 25px rgba(42, 157, 143, 0.5);
      }
      100% {
        box-shadow: 0 4px 10px rgba(42, 157, 143, 0.4), 0 0 15px rgba(42, 157, 143, 0.3);
      }
    }
    
    @keyframes currentPrayerGlow {
      0% {
        box-shadow: 0 2px 8px rgba(20, 66, 114, 0.4);
      }
      50% {
        box-shadow: 0 2px 15px rgba(20, 66, 114, 0.7);
      }
      100% {
        box-shadow: 0 2px 8px rgba(20, 66, 114, 0.4);
      }
    }
    
    @keyframes pulseOpacity {
      0% {
        opacity: 0.95;
      }
      50% {
        opacity: 1;
      }
      100% {
        opacity: 0.95;
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
    
    @keyframes gradientFlow {
      0% {
        background-position: 0% 50%;
      }
      50% {
        background-position: 100% 50%;
      }
      100% {
        background-position: 0% 50%;
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
            backgroundSize: '200% 200%',
            animation: 'gradientFlow 10s ease infinite',
            color: '#fff',
            py: getSizeRem(1.2),
            px: getSizeRem(2.0),
            textAlign: 'center',
            borderBottom: '3px solid',
            borderImage: 'linear-gradient(90deg, #DAA520 0%, #F1C40F 100%) 1',
            position: 'relative',
            zIndex: 1,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            height: 'auto',
            width: '100%',
            boxSizing: 'border-box',
            minHeight: layout.countdownHeight,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
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
            fontSize: fontSizes.nextPrayerTitle,
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 700,
            mb: getSizeRem(0.5),
            color: '#F1C40F',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            letterSpacing: '0.5px',
            position: 'relative',
            zIndex: 1
          }}>
            Next Prayer: <strong>{nextPrayer.name}</strong>
          </Typography>
          <PrayerCountdown 
            prayerName={nextPrayer.name}
            prayerTime={nextPrayer.time}
            jamaatTime={nextPrayer.jamaat}
            timeUntilNextPrayer={nextPrayer.timeUntil}
            onCountdownComplete={onCountdownComplete}
            key={`${nextPrayer.name}-${nextPrayer.time}`}
          />
          {nextPrayer.displayJamaat && (
            <Typography sx={{ 
              fontSize: fontSizes.caption,
              fontFamily: "'Poppins', sans-serif",
              mt: getSizeRem(0.5),
              color: '#F1C40F',
              fontWeight: 'bold',
              letterSpacing: '0.5px',
              display: 'inline-block',
              px: getSizeRem(1.0),
              py: getSizeRem(0.2),
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
          p: layout.standardPadding,
          pt: getSizeRem(0.6),
          px: getSizeRem(0.6),
          pb: 0,
          justifyContent: 'flex-start',
          position: 'relative',
          zIndex: 1,
          bgcolor: 'rgba(250, 250, 250, 0.98)',
          flex: 1,
          height: '100%',
          width: '100%',
          boxSizing: 'border-box',
          ...(isLandscape ? {
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
        <Box sx={{ mb: getSizeRem(0.4) }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            mb: getSizeRem(0.4),
            px: getSizeRem(0.8),
            py: getSizeRem(0.5),
            backgroundColor: 'rgba(10, 38, 71, 0.05)',
            borderRadius: '6px',
            border: '1px solid rgba(10, 38, 71, 0.07)',
          }}>
            {isLandscape ? (
              <>
                <Typography sx={{ 
                  fontSize: fontSizes.headerText, 
                  fontWeight: 'bold',
                  color: '#0A2647',
                  letterSpacing: '0.3px',
                  width: '33%',
                }}>
                  Start Time
                </Typography>
                <Typography sx={{ 
                  fontSize: fontSizes.headerText, 
                  fontWeight: 'bold',
                  color: '#0A2647',
                  letterSpacing: '0.3px',
                  width: '33%',
                  textAlign: 'center',
                }}>
                  Prayer
                </Typography>
                <Typography sx={{ 
                  fontSize: fontSizes.headerText, 
                  fontWeight: 'bold',
                  color: '#0A2647',
                  letterSpacing: '0.3px',
                  width: '33%',
                  textAlign: 'right',
                }}>
                  Jamaa't
                </Typography>
              </>
            ) : (
              <>
                <Typography sx={{ 
                  fontSize: fontSizes.headerText, 
                  fontWeight: 'bold', 
                  width: '32%',
                  color: '#0A2647',
                  fontFamily: "'Poppins', sans-serif",
                  letterSpacing: '0.3px',
                }}>
                  Start Time
                </Typography>
                <Typography sx={{ 
                  fontSize: fontSizes.headerText, 
                  fontWeight: 'bold', 
                  width: '36%', 
                  textAlign: 'center',
                  color: '#0A2647',
                  fontFamily: "'Poppins', sans-serif",
                  letterSpacing: '0.3px',
                }}>
                  Prayer
                </Typography>
                <Typography sx={{ 
                  fontSize: fontSizes.headerText, 
                  fontWeight: 'bold', 
                  width: '32%', 
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
            mb: getSizeRem(0.4),
            mt: getSizeRem(0.4),
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
            boxSizing: 'border-box',
            backgroundImage: 'linear-gradient(rgba(246, 248, 250, 0.5) 50%, transparent 50%)',
            backgroundSize: `100% ${layout.prayerRowHeight}`,
            pb: getSizeRem(1.0),
            gap: getSizeRem(0.4),
            overflow: 'visible',
            height: '100%',
            maxHeight: 'none',
            px: getSizeRem(0.8),
            mx: 0,
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
                  height: layout.prayerRowHeight,
                  pl: getSizeRem(0.6),
                  pr: getSizeRem(0.6),
                  position: 'relative',
                  borderRadius: prayer.isNext || prayer.isCurrent ? '8px' : '0px',
                  borderBottom: index < todaysPrayerTimes.length - 1 ? '1px solid rgba(0, 0, 0, 0.05)' : 'none',
                  border: prayer.isNext 
                    ? '2px solid #1E796F'
                    : prayer.isCurrent
                      ? '2px solid #0A2647'
                      : 'none',
                  transition: 'all 0.3s ease',
                  transform: prayer.isNext 
                    ? 'scale(1.02)'
                    : prayer.isCurrent
                      ? 'scale(1.01)'
                      : 'scale(1)',
                  boxShadow: prayer.isNext 
                    ? '0 4px 12px rgba(42, 157, 143, 0.4), 0 0 15px rgba(42, 157, 143, 0.3)' 
                    : prayer.isCurrent
                      ? '0 2px 8px rgba(20, 66, 114, 0.3)'
                      : 'none',
                  overflow: 'visible',
                  mx: prayer.isNext ? getSizeRem(0.4) : 0,
                  my: prayer.isNext ? getSizeRem(0.8) : getSizeRem(0.2),
                  backgroundColor: (!prayer.isNext && !prayer.isCurrent) ? 
                    (index % 2 === 0 ? 'rgba(246, 248, 250, 0.5)' : 'transparent') : 
                    'transparent',
                  zIndex: prayer.isNext ? 5 : (prayer.isCurrent ? 4 : 1),
                  animation: prayer.isNext 
                    ? 'pulseGlow 3s infinite ease-in-out, pulseScale 3s infinite ease-in-out' 
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
                    animation: 'nextPrayerShine 3s infinite linear',
                    zIndex: 0
                  } : {},
                  '& .MuiTypography-root': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }
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
                      background: prayer.isCurrent 
                        ? 'linear-gradient(90deg, #0A2647 0%, #144272 100%)' 
                        : 'linear-gradient(90deg, #2A9D8F 0%, #1E796F 100%)',
                      backgroundSize: '200% 200%',
                      animation: 'gradientFlow 10s ease infinite',
                    }}
                  >
                    <IslamicPatternBackground 
                      variant="custom"
                      width="100%"
                      height="100%"
                      patternColor={prayer.isCurrent ? '#0A2647' : '#2A9D8F'}
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
                        fontSize: prayer.isNext 
                          ? fontSizes.prayerTime
                          : fontSizes.prayerName,
                        width: '33%',
                        textAlign: 'left',
                        pl: getSizeRem(0.5),
                        fontFamily: "'Poppins', sans-serif",
                        zIndex: 1,
                        color: prayer.isCurrent 
                          ? '#FFFFFF' 
                          : prayer.isNext 
                            ? '#FFFFFF' 
                            : '#144272',
                        textShadow: (prayer.isNext || prayer.isCurrent) ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {prayer.displayTime}
                    </Typography>
                    
                    {/* Prayer Name - Landscape */}
                    <Typography 
                      sx={{ 
                        fontWeight: 'bold',
                        fontSize: prayer.isNext 
                          ? fontSizes.prayerTime
                          : fontSizes.prayerName,
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
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {prayer.name}
                    </Typography>
                    
                    {/* Jamaat Time - Landscape */}
                    <Typography 
                      sx={{ 
                        fontWeight: prayer.displayJamaat ? 'bold' : 'normal',
                        fontSize: prayer.displayJamaat 
                          ? (prayer.isNext ? fontSizes.prayerTime : fontSizes.prayerName)
                          : fontSizes.caption,
                        width: '33%',
                        textAlign: 'right',
                        pr: getSizeRem(0.5),
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
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {prayer.displayJamaat || 'N/A'}
                    </Typography>
                  </>
                ) : (
                  <>
                    {/* Start Time - Portrait */}
                    <Typography 
                      sx={{ 
                        fontWeight: 'bold',
                        fontSize: fontSizes.prayerName,
                        width: '32%',
                        fontFamily: "'Poppins', sans-serif",
                        zIndex: 1,
                        color: prayer.isCurrent 
                          ? '#FFFFFF' 
                          : prayer.isNext 
                            ? '#FFFFFF' 
                            : '#144272',
                        pl: getSizeRem(0.3),
                        textShadow: (prayer.isNext || prayer.isCurrent) ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {prayer.displayTime}
                    </Typography>
                    
                    {/* Prayer Name - Portrait */}
                    <Typography 
                      sx={{ 
                        fontWeight: 'bold',
                        fontSize: fontSizes.prayerTime,
                        width: '36%',
                        textAlign: 'center',
                        fontFamily: "'Poppins', sans-serif",
                        zIndex: 1,
                        color: prayer.isCurrent 
                          ? '#FFFFFF' 
                          : prayer.isNext 
                            ? '#FFFFFF' 
                            : '#0A2647',
                        letterSpacing: 0.5,
                        textShadow: (prayer.isNext || prayer.isCurrent) ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {prayer.name}
                    </Typography>
                    
                    {/* Jamaat - Portrait */}
                    <Typography 
                      sx={{ 
                        fontWeight: prayer.displayJamaat ? 'medium' : 'normal',
                        fontSize: prayer.displayJamaat 
                          ? fontSizes.prayerName
                          : fontSizes.caption,
                        width: '32%',
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
                        pr: getSizeRem(0.3),
                        textShadow: (prayer.isNext || prayer.isCurrent) ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
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
                p: getSizeRem(0.7),
                mb: getSizeRem(0.4),
                mt: getSizeRem(0.4),
                borderRadius: getSizeRem(0.8),
                background: 'linear-gradient(90deg, #F1C40F 0%, #DAA520 100%)',
                color: '#0A2647',
                boxShadow: '0 3px 8px rgba(218, 165, 32, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: layout.prayerRowHeight,
                border: '1px solid rgba(218, 165, 32, 0.4)',
                position: 'relative',
                overflow: 'hidden',
                '& .MuiTypography-root': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }
              }}
            >
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
                      fontSize: fontSizes.prayerName,
                      width: '33%',
                      textAlign: 'left',
                      pl: getSizeRem(0.5),
                      fontFamily: "'Poppins', sans-serif",
                      zIndex: 1,
                      color: '#0A2647',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {jumuahDisplayTime}
                  </Typography>
                  
                  {/* Prayer Name - Landscape */}
                  <Typography 
                    sx={{ 
                      fontWeight: 'bold',
                      fontSize: fontSizes.prayerName,
                      width: '33%',
                      textAlign: 'center',
                      fontFamily: "'Poppins', sans-serif",
                      zIndex: 1,
                      color: '#0A2647',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Jumu'ah
                  </Typography>
                  
                  {/* Empty slot for consistency - Landscape */}
                  <Typography 
                    sx={{ 
                      width: '33%',
                      textAlign: 'right',
                      pr: getSizeRem(1),
                      zIndex: 1,
                    }}
                  >
                    &nbsp;
                  </Typography>
                </>
              ) : (
                <>
                  {/* Time - Portrait */}
                  <Typography 
                    sx={{ 
                      fontWeight: 'bold',
                      fontSize: fontSizes.prayerName,
                      width: '32%',
                      fontFamily: "'Poppins', sans-serif",
                      zIndex: 1,
                      color: '#0A2647',
                      pl: getSizeRem(0.3),
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {jumuahDisplayTime}
                  </Typography>
                  
                  {/* Prayer Name - Portrait */}
                  <Typography 
                    sx={{ 
                      fontWeight: 'bold',
                      fontSize: fontSizes.prayerTime,
                      width: '36%',
                      textAlign: 'center',
                      fontFamily: "'Poppins', sans-serif",
                      zIndex: 1,
                      color: '#0A2647',
                      letterSpacing: 0.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Jumu'ah
                  </Typography>
                  
                  {/* Empty space for consistency - Portrait */}
                  <Typography 
                    sx={{ 
                      width: '32%',
                      textAlign: 'right',
                      zIndex: 1,
                      pr: getSizeRem(0.3),
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