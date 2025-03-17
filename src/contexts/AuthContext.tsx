import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import masjidDisplayClient from '../api/masjidDisplayClient';
import { ApiCredentials, PairingRequest, ApiResponse, RequestPairingCodeResponse, CheckPairingStatusResponse } from '../api/models';

export interface AuthContextType {
  isAuthenticated: boolean;
  isPaired: boolean;
  setIsPaired: (isPaired: boolean) => void;
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
  const [isPaired, setIsPaired] = useState<boolean>(false);
  const [isPairing, setIsPairing] = useState<boolean>(false);
  const [screenId, setScreenId] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingCodeExpiresAt, setPairingCodeExpiresAt] = useState<string | null>(null);
  const [isPairingCodeExpired, setIsPairingCodeExpired] = useState<boolean>(false);
  const [pollingTimer, setPollingTimer] = useState<NodeJS.Timeout | null>(null);
  const [lastPairingCodeRequestTime, setLastPairingCodeRequestTime] = useState<number | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  useEffect(() => {
    // Check if we have stored credentials
    const apiKey = localStorage.getItem('masjid_api_key');
    const screenId = localStorage.getItem('masjid_screen_id');
    
    console.log('[AuthContext] Checking stored credentials:', { 
      hasApiKey: !!apiKey, 
      hasScreenId: !!screenId,
      apiKeyLength: apiKey?.length || 0,
      screenIdLength: screenId?.length || 0
    });
    
    if (apiKey && screenId) {
      try {
        setScreenId(screenId);
        setIsAuthenticated(true);
        setIsPaired(true);
        
        // Ensure the API client has the credentials
        masjidDisplayClient.setCredentials({ apiKey, screenId })
          .then(() => {
            console.log('[AuthContext] Credentials set successfully in client');
          })
          .catch(error => {
            console.error('[AuthContext] Error setting credentials in client:', error);
            // If setting credentials fails, reset auth state
            setIsAuthenticated(false);
            setIsPaired(false);
            setScreenId(null);
            localStorage.removeItem('masjid_api_key');
            localStorage.removeItem('masjid_screen_id');
          });
        
        // Log credentials status for debugging
        setTimeout(() => {
          masjidDisplayClient.logCredentialsStatus();
        }, 1000);
      } catch (error) {
        console.error('[AuthContext] Failed to set credentials', error);
        localStorage.removeItem('masjid_api_key');
        localStorage.removeItem('masjid_screen_id');
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

  // Effect to update isAuthenticated when isPaired changes
  useEffect(() => {
    if (isPaired) {
      setIsAuthenticated(true);
    }
  }, [isPaired]);

  /**
   * Step 1: Request a pairing code from the server
   */
  const requestPairingCode = async (): Promise<string | null> => {
    // If already pairing, don't start another pairing process
    if (isPairing) {
      console.log('[AuthContext] Already in pairing process, ignoring new request');
      return pairingCode;
    }
    
    // Check if we have a valid, non-expired code that we can reuse
    if (pairingCode && !isPairingCodeExpired) {
      console.log('[AuthContext] Reusing existing pairing code:', pairingCode);
      return pairingCode;
    }
    
    // Set isPairing to true to prevent duplicate requests
    setIsPairing(true);
    setPairingError(null);
    
    console.log('[AuthContext] Requesting pairing code');
    
    try {
      // Get screen orientation
      const orientation = window.matchMedia('(orientation: portrait)').matches ? 'PORTRAIT' : 'LANDSCAPE';
      
      const deviceInfo = {
        deviceType: 'WEB',
        orientation,
      };
      
      console.log('[AuthContext] Requesting pairing code with device info:', deviceInfo);
      
      const response = await masjidDisplayClient.requestPairingCode(deviceInfo);
      console.log('[AuthContext] Received response from API client:', JSON.stringify(response, null, 2));
      
      if (!response.success || !response.data) {
        const errorMessage = response.error || 'Failed to request pairing code';
        console.error('[AuthContext] Pairing code request failed:', errorMessage, response);
        setPairingError(errorMessage);
        
        // Add a small delay before setting isPairing to false to prevent rapid re-attempts
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsPairing(false);
        return null;
      }
      
      console.log('[AuthContext] Response data:', response.data);
      
      const { pairingCode, expiresAt } = response.data;
      console.log('[AuthContext] Extracted values - pairingCode:', pairingCode, 'expiresAt:', expiresAt);
      console.log('[AuthContext] Before setting state - current pairingCode state:', pairingCode);
      
      if (!pairingCode || !expiresAt) {
        console.error('[AuthContext] Missing pairing code or expiration time in response:', response.data);
        setPairingError('Invalid server response: Missing pairing code or expiration time');
        setIsPairing(false);
        return null;
      }
      
      // Store the pairing code and expiration time
      console.log('[AuthContext] Setting pairing code state:', pairingCode);
      setPairingCode(pairingCode);
      setPairingCodeExpiresAt(expiresAt);
      setIsPairingCodeExpired(false);
      
      // Store the request time
      const requestTime = Date.now();
      setLastPairingCodeRequestTime(requestTime);
      localStorage.setItem('lastPairingCodeRequestTime', requestTime.toString());
      
      // Store in localStorage for persistence across refreshes
      localStorage.setItem('pairingCode', pairingCode);
      localStorage.setItem('pairingCodeExpiresAt', expiresAt);
      
      console.log('[AuthContext] Pairing code successfully stored, returning:', pairingCode);
      setIsPairing(false);
      
      return pairingCode;
    } catch (error: any) {
      console.error('[AuthContext] Error requesting pairing code:', error);
      
      // Provide more detailed error messages based on the error type
      let errorMessage = 'Failed to connect to server';
      
      if (error.message) {
        if (error.message.includes('Network Error')) {
          errorMessage = 'Network error: Please check your internet connection';
        } else if (error.response) {
          console.error('[AuthContext] Error response data:', error.response.data);
          errorMessage = `Server error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`;
        } else if (error.request) {
          console.error('[AuthContext] No response received for request:', error.request);
          errorMessage = 'No response from server: The server may be down or unreachable';
        }
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
   * According to the Screen Pairing Guide, we should poll every 5 seconds until paired
   */
  const checkPairingStatus = async (pairingCode: string): Promise<boolean> => {
    if (!pairingCode) {
      console.error('[AuthContext] No pairing code provided');
      return false;
    }
    
    if (isPairingCodeExpired) {
      console.error('[AuthContext] Pairing code has expired');
      setPairingError('Pairing code has expired. Please request a new code.');
      return false;
    }
    
    // Don't set isPairing to true if we're just polling
    const wasPolling = isPolling;
    if (!isPairing && !isPolling) {
      setIsPairing(true);
    }
    
    try {
      console.log('[AuthContext] Checking pairing status for code:', pairingCode);
      
      const isPaired = await masjidDisplayClient.checkPairingStatus(pairingCode);
      
      if (!isPaired) {
        console.log('[AuthContext] Device not yet paired');
        
        // Check if the pairing code is still valid in localStorage
        // It might have been removed by the API client if it was invalid
        const storedPairingCode = localStorage.getItem('pairingCode');
        if (!storedPairingCode || storedPairingCode !== pairingCode) {
          console.log('[AuthContext] Pairing code was invalidated by the API client');
          setPairingCode(null);
          setPairingCodeExpiresAt(null);
          setIsPairingCodeExpired(true);
          setPairingError('Pairing code is invalid or expired. Please request a new code.');
          setIsPairing(false);
          setIsPolling(false);
          return false;
        }
        
        // Schedule next check based on the polling interval from the API client
        if (pollingTimer) {
          clearTimeout(pollingTimer);
        }
        
        // Use the polling interval from the API client (defaults to 5 seconds)
        const pollingInterval = masjidDisplayClient.getPollingInterval();
        console.log(`[AuthContext] Will check again in ${pollingInterval / 1000} seconds`);
        
        const timer = setTimeout(() => {
          // Only check again if we still have the same pairing code and it's not expired
          if (pairingCode === getPairingCode() && !isPairingCodeExpired) {
            console.log('[AuthContext] Checking pairing status again...');
            checkPairingStatus(pairingCode);
          } else {
            console.log('[AuthContext] Pairing code has changed or expired, stopping polling');
            setIsPolling(false);
          }
        }, pollingInterval);
        
        setPollingTimer(timer);
        
        // Reset the isPairing state but keep isPolling true
        if (!wasPolling) {
          setIsPairing(false);
          setIsPolling(true);
        }
        
        return false;
      }
      
      console.log('[AuthContext] Device has been paired successfully!');
      
      // Get the credentials from localStorage (set by the API client)
      const apiKey = localStorage.getItem('masjid_api_key');
      const screenId = localStorage.getItem('masjid_screen_id');
      
      if (apiKey && screenId) {
        console.log('[AuthContext] Credentials found, finalizing pairing...');
        
        // Set the credentials in the API client
        masjidDisplayClient.setCredentials({ apiKey, screenId });
        
        // Update state - set isPaired first to trigger App re-render
        setIsPaired(true);
        setIsAuthenticated(true);
        setScreenId(screenId);
        
        // Clear pairing state
        setPairingCode(null);
        setPairingCodeExpiresAt(null);
        localStorage.removeItem('pairingCode');
        localStorage.removeItem('pairingCodeExpiresAt');
        localStorage.removeItem('lastPairingCodeRequestTime');
        
        // No need to store credentials in localStorage again as they're already stored by the API client
        
        // Clear polling timer
        if (pollingTimer) {
          clearTimeout(pollingTimer);
          setPollingTimer(null);
        }
        
        setIsPairing(false);
        setIsPolling(false);
        
        console.log('[AuthContext] Pairing completed successfully, App should now redirect');
        return true;
      } else {
        console.error('[AuthContext] Missing API key or screen ID after successful pairing');
        setPairingError('Authentication failed: Missing credentials');
        setIsPairing(false);
        setIsPolling(false);
        return false;
      }
    } catch (error: any) {
      console.error('[AuthContext] Error checking pairing status:', error);
      
      // Check if the error is due to an invalid or expired pairing code
      if (error.response && error.response.status === 404) {
        console.log('[AuthContext] Received 404 error during pairing status check');
        
        // Don't automatically invalidate the code or trigger a new request
        // This was causing a loop of new code requests
        setPairingError('Error checking pairing status. Please try again later.');
        
        // Don't clear the pairing code or set it as expired
        // Let the user manually refresh if needed
      } else {
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
      }
      
      setIsPairing(false);
      setIsPolling(false);
      return false;
    }
  };

  const logout = () => {
    masjidDisplayClient.clearCredentials();
    setIsAuthenticated(false);
    setIsPaired(false);
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
        isPaired,
        setIsPaired,
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