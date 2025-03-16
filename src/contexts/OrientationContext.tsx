import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Orientation = 'LANDSCAPE' | 'PORTRAIT';

interface OrientationContextType {
  orientation: Orientation;
}

const OrientationContext = createContext<OrientationContextType | undefined>(undefined);

interface OrientationProviderProps {
  children: ReactNode;
}

export const OrientationProvider: React.FC<OrientationProviderProps> = ({ children }) => {
  const [orientation, setOrientation] = useState<Orientation>(
    window.matchMedia('(orientation: portrait)').matches ? 'PORTRAIT' : 'LANDSCAPE'
  );

  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(
        window.matchMedia('(orientation: portrait)').matches ? 'PORTRAIT' : 'LANDSCAPE'
      );
    };

    // Add event listener
    window.addEventListener('resize', handleOrientationChange);

    // Initial check
    handleOrientationChange();

    // Clean up
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  // We can also use window dimensions to determine orientation
  useEffect(() => {
    const handleResize = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      setOrientation(isPortrait ? 'PORTRAIT' : 'LANDSCAPE');
    };

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Initial check
    handleResize();

    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <OrientationContext.Provider value={{ orientation }}>
      {children}
    </OrientationContext.Provider>
  );
};

export const useOrientation = (): OrientationContextType => {
  const context = useContext(OrientationContext);
  if (context === undefined) {
    throw new Error('useOrientation must be used within an OrientationProvider');
  }
  return context;
}; 