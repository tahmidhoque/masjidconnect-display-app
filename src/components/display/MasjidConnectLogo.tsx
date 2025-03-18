import React from 'react';
import { Box, keyframes, styled } from '@mui/material';
import logoBlue from '../../assets/logos/logo-blue.svg';
import logoGold from '../../assets/logos/logo-gold.svg';
import logoNotextBlue from '../../assets/logos/logo-notext-blue.svg';
import logoNotextGold from '../../assets/logos/logo-notext-gold.svg';

interface MasjidConnectLogoProps {
  variant?: 'full' | 'icon';
  color?: 'blue' | 'gold';
  size?: 'small' | 'medium' | 'large';
  withAnimation?: boolean;
}

// Define animations
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const pulse = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
`;

// Styled component for the logo
const LogoContainer = styled(Box, {
  shouldForwardProp: (prop) => 
    prop !== 'withAnimation' && 
    prop !== 'sizeValue',
})<{ withAnimation?: boolean; sizeValue: string }>(
  ({ theme, withAnimation, sizeValue }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: withAnimation 
      ? `${fadeIn} 1s ease-out, ${pulse} 5s infinite ease-in-out` 
      : 'none',
    width: sizeValue,
    height: 'auto',
    transition: 'all 0.3s ease',
    
    '& img': {
      width: '100%',
      height: 'auto',
    },
    
    '&:hover': {
      transform: 'scale(1.02)',
    },
  })
);

/**
 * MasjidConnectLogo component
 * 
 * Displays the MasjidConnect logo in different variants and colors
 */
const MasjidConnectLogo: React.FC<MasjidConnectLogoProps> = ({
  variant = 'full',
  color = 'blue',
  size = 'medium',
  withAnimation = true,
}) => {
  // Determine which logo to use
  const getLogo = () => {
    if (variant === 'full') {
      return color === 'blue' ? logoBlue : logoGold;
    }
    return color === 'blue' ? logoNotextBlue : logoNotextGold;
  };
  
  // Determine size based on props
  const getSizeValue = () => {
    if (variant === 'icon') {
      switch (size) {
        case 'small': return '40px';
        case 'large': return '100px';
        default: return '60px';
      }
    } else {
      switch (size) {
        case 'small': return '120px';
        case 'large': return '240px';
        default: return '180px';
      }
    }
  };

  return (
    <LogoContainer 
      withAnimation={withAnimation}
      sizeValue={getSizeValue()}
    >
      <img 
        src={getLogo()} 
        alt="MasjidConnect" 
      />
    </LogoContainer>
  );
};

export default MasjidConnectLogo; 