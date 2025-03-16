import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient, { ApiCredentials } from '../api/client';
import { PairingRequest, PairingResponse, ApiResponse } from '../api/models';

interface AuthContextType {
  isAuthenticated: boolean;
  isPairing: boolean;
  screenId: string | null;
  pairingError: string | null;
  pairScreen: (pairingCode: string) => Promise<boolean>;
  unpairScreen: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isPairing, setIsPairing] = useState<boolean>(false);
  const [screenId, setScreenId] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we have stored credentials
    const storedCredentials = localStorage.getItem('masjidconnect_credentials');
    if (storedCredentials) {
      try {
        const credentials: ApiCredentials = JSON.parse(storedCredentials);
        setScreenId(credentials.screenId);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Failed to parse stored credentials', error);
        localStorage.removeItem('masjidconnect_credentials');
      }
    }
  }, []);

  const pairScreen = async (pairingCode: string): Promise<boolean> => {
    setIsPairing(true);
    setPairingError(null);
    
    try {
      // Get screen orientation
      const orientation = window.matchMedia('(orientation: portrait)').matches ? 'PORTRAIT' : 'LANDSCAPE';
      
      const pairingData: PairingRequest = {
        pairingCode,
        deviceInfo: {
          deviceType: 'WEB',
          orientation,
        }
      };
      
      console.log('Sending pairing request with data:', pairingData);
      
      const response = await apiClient.pairScreen(pairingData);
      
      if (!response.success || !response.data) {
        const errorMessage = response.error || 'Failed to pair screen';
        console.error('Pairing failed:', errorMessage);
        setPairingError(errorMessage);
        setIsPairing(false);
        return false;
      }
      
      const { screen } = response.data;
      console.log('Pairing successful, received screen data:', screen);
      
      // Save credentials
      const credentials: ApiCredentials = {
        apiKey: screen.apiKey,
        screenId: screen.id,
      };
      
      apiClient.setCredentials(credentials);
      setScreenId(screen.id);
      setIsAuthenticated(true);
      setIsPairing(false);
      
      return true;
    } catch (error: any) {
      console.error('Error pairing screen:', error);
      
      // Provide more detailed error messages based on the error type
      let errorMessage = 'Failed to connect to server';
      
      if (error.message) {
        if (error.message.includes('Network Error')) {
          errorMessage = 'Network error: Please check your internet connection';
        } else if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          errorMessage = `Server error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`;
        } else if (error.request) {
          // The request was made but no response was received
          errorMessage = 'No response from server: The server may be down or unreachable';
        }
      }
      
      setPairingError(errorMessage);
      setIsPairing(false);
      return false;
    }
  };

  const unpairScreen = (): void => {
    apiClient.clearCredentials();
    setIsAuthenticated(false);
    setScreenId(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isPairing,
        screenId,
        pairingError,
        pairScreen,
        unpairScreen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 