import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient, { ApiCredentials } from '../api/client';
import { PairingRequest, ApiResponse, RequestPairingCodeResponse, CheckPairingStatusResponse } from '../api/models';

export interface AuthContextType {
  isAuthenticated: boolean;
  isPairing: boolean;
  pairingError: string | null;
  screenId: string | null;
  requestPairingCode: () => Promise<string | null>;
  checkPairingStatus: (pairingCode: string) => Promise<boolean>;
  logout: () => void;
  pairingCode: string | null;
  pairingCodeExpiresAt: string | null;
  isPairingCodeExpired: boolean;
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
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingCodeExpiresAt, setPairingCodeExpiresAt] = useState<string | null>(null);
  const [isPairingCodeExpired, setIsPairingCodeExpired] = useState<boolean>(false);
  const [pollingTimer, setPollingTimer] = useState<NodeJS.Timeout | null>(null);
  const [lastPairingCodeRequestTime, setLastPairingCodeRequestTime] = useState<number | null>(null);

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

    // Check if we have a stored pairing code and expiration time
    const storedPairingCode = localStorage.getItem('pairingCode');
    const storedPairingCodeExpiresAt = localStorage.getItem('pairingCodeExpiresAt');
    const storedLastRequestTime = localStorage.getItem('lastPairingCodeRequestTime');
    
    if (storedPairingCode && storedPairingCodeExpiresAt) {
      const expiresAt = new Date(storedPairingCodeExpiresAt);
      const now = new Date();
      
      // Only restore the pairing code if it hasn't expired
      if (expiresAt > now) {
        console.log('Restoring saved pairing code:', storedPairingCode);
        setPairingCode(storedPairingCode);
        setPairingCodeExpiresAt(storedPairingCodeExpiresAt);
      } else {
        // Clear expired pairing code
        localStorage.removeItem('pairingCode');
        localStorage.removeItem('pairingCodeExpiresAt');
      }
    }
    
    if (storedLastRequestTime) {
      setLastPairingCodeRequestTime(parseInt(storedLastRequestTime, 10));
    }

    // Clean up polling timer on unmount
    return () => {
      if (pollingTimer) {
        clearTimeout(pollingTimer);
      }
    };
  }, []);

  // Check if pairing code is expired
  useEffect(() => {
    if (pairingCodeExpiresAt) {
      const checkExpiration = () => {
        const now = new Date();
        const expiresAt = new Date(pairingCodeExpiresAt);
        const isExpired = now > expiresAt;
        setIsPairingCodeExpired(isExpired);
        
        if (isExpired) {
          console.log('Pairing code has expired');
          // Clear stored pairing code if expired
          localStorage.removeItem('pairingCode');
          localStorage.removeItem('pairingCodeExpiresAt');
        }
      };

      // Check immediately
      checkExpiration();

      // Set up interval to check every minute
      const interval = setInterval(checkExpiration, 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [pairingCodeExpiresAt]);

  /**
   * Step 1: Request a pairing code from the server
   */
  const requestPairingCode = async (): Promise<string | null> => {
    // If already pairing, don't start another pairing process
    if (isPairing) {
      console.log('Already in pairing process, ignoring new request');
      return pairingCode;
    }
    
    // Check if we've requested a code recently (within the last 15 minutes)
    // unless it's a manual refresh or the code has expired
    const now = Date.now();
    const fifteenMinutesInMs = 15 * 60 * 1000;
    
    if (lastPairingCodeRequestTime && (now - lastPairingCodeRequestTime < fifteenMinutesInMs) && pairingCode && !isPairingCodeExpired) {
      console.log('Pairing code was requested recently and is still valid. Reusing existing code:', pairingCode);
      return pairingCode;
    }
    
    // Set isPairing to true to prevent duplicate requests
    setIsPairing(true);
    setPairingError(null);
    
    // Check if we're in development mode
    // First try the NODE_ENV environment variable
    let isDevelopment = process.env.NODE_ENV === 'development';
    // If NODE_ENV is not set, check if we're using localhost
    if (!isDevelopment && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      isDevelopment = false;
      console.log('Detected localhost, but not setting development mode');
    }
    
    console.log(`AuthContext - Current NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`AuthContext - isDevelopment: ${isDevelopment}`);
    console.log(`AuthContext - window.location.hostname: ${window.location.hostname}`);
    console.log(`Requesting pairing code in ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
    
    try {
      // Get screen orientation
      const orientation = window.matchMedia('(orientation: portrait)').matches ? 'PORTRAIT' : 'LANDSCAPE';
      
      const deviceInfo = {
        deviceType: 'WEB',
        orientation,
      };
      
      console.log('Requesting pairing code with device info:', deviceInfo);
      
      // Check if we already have a valid pairing code in localStorage
      const storedPairingCode = localStorage.getItem('pairingCode');
      const storedPairingCodeExpiresAt = localStorage.getItem('pairingCodeExpiresAt');
      
      if (storedPairingCode && storedPairingCodeExpiresAt) {
        const expiresAt = new Date(storedPairingCodeExpiresAt);
        const now = new Date();
        
        // If the stored code is still valid, use it instead of making a new request
        if (expiresAt > now) {
          console.log('Using stored pairing code:', storedPairingCode);
          setPairingCode(storedPairingCode);
          setPairingCodeExpiresAt(storedPairingCodeExpiresAt);
          setIsPairingCodeExpired(false);
          setLastPairingCodeRequestTime(Date.now());
          setIsPairing(false);
          return storedPairingCode;
        } else {
          // Clear expired pairing code
          localStorage.removeItem('pairingCode');
          localStorage.removeItem('pairingCodeExpiresAt');
        }
      }
      
      const response = await apiClient.requestPairingCode(deviceInfo);
      
      if (!response.success || !response.data) {
        const errorMessage = response.error || 'Failed to request pairing code';
        console.error('Pairing code request failed:', errorMessage);
        setPairingError(errorMessage);
        
        // Add a small delay before setting isPairing to false to prevent rapid re-attempts
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsPairing(false);
        return null;
      }
      
      const { pairingCode, expiresAt } = response.data;
      console.log('Pairing code received:', pairingCode, 'Expires at:', expiresAt);
      
      // Store the pairing code and expiration time
      setPairingCode(pairingCode);
      setPairingCodeExpiresAt(expiresAt);
      setIsPairingCodeExpired(false);
      
      // Store the request time
      const requestTime = now;
      setLastPairingCodeRequestTime(requestTime);
      localStorage.setItem('lastPairingCodeRequestTime', requestTime.toString());
      
      // Store in localStorage for persistence across refreshes
      localStorage.setItem('pairingCode', pairingCode);
      localStorage.setItem('pairingCodeExpiresAt', expiresAt);
      
      setIsPairing(false);
      
      return pairingCode;
    } catch (error: any) {
      console.error('Error requesting pairing code:', error);
      
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
      
      if (isDevelopment) {
        errorMessage += ' (Development mode: Check if localhost:3000 is running)';
      }
      
      setPairingError(errorMessage);
      
      // Add a small delay before setting isPairing to false to prevent rapid re-attempts
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsPairing(false);
      return null;
    }
  };

  /**
   * Step 3: Poll for pairing status
   */
  const checkPairingStatus = async (pairingCode: string): Promise<boolean> => {
    if (!pairingCode) {
      console.error('No pairing code provided');
      return false;
    }
    
    if (isPairingCodeExpired) {
      console.error('Pairing code has expired');
      setPairingError('Pairing code has expired. Please request a new code.');
      return false;
    }
    
    // Don't set isPairing to true if we're just polling
    if (!isPairing) {
      setIsPairing(true);
    }
    
    try {
      console.log('Checking pairing status for code:', pairingCode);
      
      const isPaired = await apiClient.checkPairingStatus(pairingCode);
      
      if (!isPaired) {
        console.log('Device not yet paired');
        
        // Schedule next check based on the polling interval from the API client
        if (pollingTimer) {
          clearTimeout(pollingTimer);
        }
        
        const pollingInterval = apiClient.getPollingInterval();
        console.log(`Will check again in ${pollingInterval / 1000} seconds`);
        
        const timer = setTimeout(() => {
          // Only check again if we still have the same pairing code
          if (pairingCode === getPairingCode()) {
            checkPairingStatus(pairingCode);
          } else {
            console.log('Pairing code has changed, stopping polling');
          }
        }, pollingInterval);
        
        setPollingTimer(timer);
        setIsPairing(false);
        return false;
      }
      
      console.log('Device has been paired successfully!');
      
      // Get the credentials from localStorage (set by the API client)
      const apiKey = localStorage.getItem('apiKey');
      const screenId = localStorage.getItem('screenId');
      
      if (apiKey && screenId) {
        // Set the credentials in the API client
        apiClient.setCredentials({ apiKey, screenId });
        
        // Update state
        setIsAuthenticated(true);
        setScreenId(screenId);
        
        // Clear pairing state
        setPairingCode(null);
        setPairingCodeExpiresAt(null);
        localStorage.removeItem('pairingCode');
        localStorage.removeItem('pairingCodeExpiresAt');
        localStorage.removeItem('lastPairingCodeRequestTime');
        
        // Store in localStorage
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('screenId', screenId);
        
        // Clear polling timer
        if (pollingTimer) {
          clearTimeout(pollingTimer);
          setPollingTimer(null);
        }
        
        setIsPairing(false);
        return true;
      } else {
        console.error('Missing API key or screen ID after successful pairing');
        setPairingError('Authentication failed: Missing credentials');
        setIsPairing(false);
        return false;
      }
    } catch (error: any) {
      console.error('Error checking pairing status:', error);
      
      // Provide more detailed error messages
      let errorMessage = 'Failed to connect to server';
      
      if (error.message) {
        if (error.message.includes('Network Error')) {
          errorMessage = 'Network error: Please check your internet connection';
        } else if (error.response) {
          errorMessage = `Server error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`;
        } else if (error.request) {
          errorMessage = 'No response from server: The server may be down or unreachable';
        }
      }
      
      setPairingError(errorMessage);
      setIsPairing(false);
      return false;
    }
  };

  const logout = () => {
    apiClient.clearCredentials();
    setIsAuthenticated(false);
    setScreenId(null);
    
    // Clear pairing state
    setPairingCode(null);
    setPairingCodeExpiresAt(null);
    setIsPairingCodeExpired(false);
    
    // Clear polling timer
    if (pollingTimer) {
      clearTimeout(pollingTimer);
      setPollingTimer(null);
    }
  };

  // Helper function to get the current pairing code
  const getPairingCode = () => pairingCode;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isPairing,
        pairingError,
        screenId,
        requestPairingCode,
        checkPairingStatus,
        logout,
        pairingCode,
        pairingCodeExpiresAt,
        isPairingCodeExpired,
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