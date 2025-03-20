import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import masjidDisplayClient from '../api/masjidDisplayClient';
import { ApiCredentials, PairingRequest, ApiResponse, RequestPairingCodeResponse, CheckPairingStatusResponse } from '../api/models';
import { Orientation } from './OrientationContext';
import logger from '../utils/logger';

export interface AuthContextType {
  isAuthenticated: boolean;
  isPaired: boolean;
  setIsPaired: (isPaired: boolean) => void;
  isPairing: boolean;
  pairingError: string | null;
  screenId: string | null;
  requestPairingCode: (orientation: Orientation) => Promise<string | null>;
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

  // Load credentials and authenticate on initial load
  useEffect(() => {
    logger.debug('[AuthContext] 🚀 Initial load - checking for credentials...');
    
    // Check for credentials in ALL possible formats - be very thorough
    const checkAllCredentialFormats = () => {
      // 1. Direct API key and screenId checks in different formats
      const formats = [
        { apiKey: localStorage.getItem('masjid_api_key'), screenId: localStorage.getItem('masjid_screen_id') },
        { apiKey: localStorage.getItem('apiKey'), screenId: localStorage.getItem('screenId') }
      ];
      
      // 2. JSON format
      try {
        const jsonStr = localStorage.getItem('masjidconnect_credentials');
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          if (parsed && parsed.apiKey && parsed.screenId) {
            formats.push(parsed);
          }
        }
      } catch (e) {
        logger.error('[AuthContext] Error parsing JSON credentials', { error: e });
      }
      
      // 3. Last API response (emergency fallback)
      try {
        const lastResponseStr = localStorage.getItem('lastApiResponse');
        if (lastResponseStr) {
          const lastResponse = JSON.parse(lastResponseStr);
          if (lastResponse && lastResponse.apiKey && lastResponse.screenId) {
            formats.push(lastResponse);
          }
        }
      } catch (e) {
        logger.error('[AuthContext] Error parsing last API response', { error: e });
      }
      
      // Find the first valid credential set
      for (const format of formats) {
        if (format.apiKey && format.screenId) {
          logger.debug('[AuthContext] ✅ FOUND VALID CREDENTIALS', {
            source: format === formats[0] ? 'masjid_api_key format' : 
                    format === formats[1] ? 'apiKey format' : 'JSON or lastResponse format',
            apiKeyPrefix: format.apiKey.substring(0, 5) + '...',
            screenId: format.screenId
          });
          
          return {
            apiKey: format.apiKey,
            screenId: format.screenId,
            found: true
          };
        }
      }
      
      logger.debug('[AuthContext] ❌ No valid credentials found in any format');
      return { apiKey: null, screenId: null, found: false };
    };
    
    // Execute the check
    const { apiKey, screenId, found } = checkAllCredentialFormats();
    
    if (found && apiKey && screenId) {
      logger.debug('[AuthContext] 🔐 Initializing with valid credentials');
      
      // Ensure consistent localStorage state
      localStorage.setItem('masjid_api_key', apiKey);
      localStorage.setItem('masjid_screen_id', screenId);
      localStorage.setItem('apiKey', apiKey);
      localStorage.setItem('screenId', screenId);
      localStorage.setItem('masjidconnect_credentials', JSON.stringify({
        apiKey, screenId
      }));
      
      // Set state values for immediate effect
      setScreenId(screenId);
      setIsAuthenticated(true);
      setIsPaired(true);
      
      // Initialize the API client
      masjidDisplayClient.setCredentials({ apiKey, screenId });
      
      // Clear any pairing state
      setPairingCode(null);
      setPairingCodeExpiresAt(null);
      setIsPairingCodeExpired(false);
      setIsPairing(false);
      setIsPolling(false);
      
      // Clean up localStorage pairing items
      localStorage.removeItem('pairingCode');
      localStorage.removeItem('pairingCodeExpiresAt');
      localStorage.removeItem('lastPairingCodeRequestTime');
      
      logger.debug('[AuthContext] 🎉 Successfully authenticated from stored credentials');
    } else {
      logger.debug('[AuthContext] No valid credentials found, will need to pair');
      
      // Check if we have a stored pairing code and expiration time
      const storedPairingCode = localStorage.getItem('pairingCode');
      const storedPairingCodeExpiresAt = localStorage.getItem('pairingCodeExpiresAt');
      
      if (storedPairingCode && storedPairingCodeExpiresAt) {
        const expiresAt = new Date(storedPairingCodeExpiresAt);
        const now = new Date();
        
        // Only restore the pairing code if it hasn't expired
        if (expiresAt > now) {
          logger.debug('[AuthContext] Restoring saved pairing code', { code: storedPairingCode });
          setPairingCode(storedPairingCode);
          setPairingCodeExpiresAt(storedPairingCodeExpiresAt);
        } else {
          // Clear expired pairing code
          localStorage.removeItem('pairingCode');
          localStorage.removeItem('pairingCodeExpiresAt');
        }
      }
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
          logger.debug('Pairing code has expired');
          // Clear stored pairing code if expired
          localStorage.removeItem('pairingCode');
          localStorage.removeItem('pairingCodeExpiresAt');
        }
      };
      
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

  // Check for changes in isPaired flag in localStorage
  useEffect(() => {
    // Create a function to check for the isPaired flag
    const checkPairedStatus = () => {
      const isPairedFlag = localStorage.getItem('isPaired');
      const apiKey = localStorage.getItem('masjid_api_key');
      const screenId = localStorage.getItem('masjid_screen_id');
      
      logger.debug('[AuthContext] Checking paired status from localStorage', { 
        isPairedFlag, 
        hasApiKey: !!apiKey, 
        hasScreenId: !!screenId 
      });
      
      if (isPairedFlag === 'true' && apiKey && screenId) {
        logger.debug('[AuthContext] Device is paired according to localStorage flags');
        
        // Set the credentials in the client
        masjidDisplayClient.setCredentials({ apiKey, screenId });
        
        // Update state
        setIsPaired(true);
        setIsAuthenticated(true);
        setScreenId(screenId);
        
        // Clear pairing state
        setPairingCode(null);
        setPairingCodeExpiresAt(null);
        localStorage.removeItem('pairingCode');
        localStorage.removeItem('pairingCodeExpiresAt');
        
        // Clear the isPaired flag to avoid repeated processing
        localStorage.removeItem('isPaired');
        
        // Clear polling timer
        if (pollingTimer) {
          clearTimeout(pollingTimer);
          setPollingTimer(null);
        }
        
        setIsPairing(false);
        setIsPolling(false);
      }
    };
    
    // Check immediately
    checkPairedStatus();
    
    // Also set up an interval to check regularly
    const intervalId = setInterval(checkPairedStatus, 1000);
    
    // Clean up
    return () => {
      clearInterval(intervalId);
    };
  }, []);  // Empty dependency array means this runs once on mount

  /**
   * Step 1: Request a pairing code from the server
   */
  const requestPairingCode = async (orientation: Orientation): Promise<string | null> => {
    // If already pairing, don't start another pairing process
    if (isPairing) {
      logger.debug('[AuthContext] Already in pairing process, ignoring new request');
      return pairingCode;
    }
    
    // Check if we have a valid, non-expired code that we can reuse
    if (pairingCode && !isPairingCodeExpired) {
      logger.debug('[AuthContext] Reusing existing pairing code', { code: pairingCode });
      return pairingCode;
    }
    
    // Set isPairing to true to prevent duplicate requests
    setIsPairing(true);
    setPairingError(null);
    
    logger.debug('[AuthContext] Requesting pairing code');
    
    try {
      const deviceInfo = {
        deviceType: 'WEB',
        orientation,
      };
      
      logger.debug('[AuthContext] Requesting pairing code with device info', { deviceInfo });
      
      const response = await masjidDisplayClient.requestPairingCode(deviceInfo);
      logger.debug('[AuthContext] Received response from API client', { response: JSON.stringify(response, null, 2) });
      
      if (!response.success || !response.data) {
        const errorMessage = response.error || 'Failed to request pairing code';
        logger.error('[AuthContext] Pairing code request failed', { error: errorMessage, response });
        setPairingError(errorMessage);
        
        // Add a small delay before setting isPairing to false to prevent rapid re-attempts
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsPairing(false);
        return null;
      }
      
      logger.debug('[AuthContext] Response data', { data: response.data });
      
      const { pairingCode, expiresAt } = response.data;
      logger.debug('[AuthContext] Extracted values', { pairingCode, expiresAt });
      logger.debug('[AuthContext] Before setting state - current pairingCode state', { pairingCode });
      
      if (!pairingCode || !expiresAt) {
        logger.error('[AuthContext] Missing pairing code or expiration time in response:', response.data);
        setPairingError('Invalid server response: Missing pairing code or expiration time');
        setIsPairing(false);
        return null;
      }
      
      // Store the pairing code and expiration time
      logger.debug('[AuthContext] Setting pairing code state', { pairingCode });
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
      
      logger.debug('[AuthContext] Pairing code successfully stored, returning', { pairingCode });
      setIsPairing(false);
      
      return pairingCode;
    } catch (error: any) {
      logger.error('[AuthContext] Error requesting pairing code:', error);
      
      // Provide more detailed error messages based on the error type
      let errorMessage = 'Failed to connect to server';
      
      if (error.message) {
        if (error.message.includes('Network Error')) {
          errorMessage = 'Network error: Please check your internet connection';
        } else if (error.response) {
          logger.error('[AuthContext] Error response data:', error.response.data);
          errorMessage = `Server error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`;
        } else if (error.request) {
          logger.error('[AuthContext] No response received for request:', error.request);
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
      setPairingError('Invalid pairing code');
      return false;
    }
    
    // Start or continue polling for pairing status
    try {
      // Set polling state
      setIsPairing(true);
      
      // Check status directly
      logger.debug('Checking pairing status', { pairingCode });
      
      const isPaired = await masjidDisplayClient.checkPairingStatus(pairingCode);
      
      logger.debug('API client returned status', { isPaired });
      
      // If paired, complete the pairing process
      if (isPaired) {
        // Get the credentials from localStorage since API client already stores them there
        const apiKey = localStorage.getItem('masjid_api_key') || 
                     localStorage.getItem('apiKey');
        const screenId = localStorage.getItem('masjid_screen_id') || 
                       localStorage.getItem('screenId');
        
        if (apiKey && screenId) {
          logger.debug('[AuthContext] Found credentials, finalizing authentication');
          
          // Update the client with credentials
          masjidDisplayClient.setCredentials({ apiKey, screenId });
          
          // Update local component state
          setScreenId(screenId);
          
          // Store credentials in multiple formats for reliability
          localStorage.setItem('apiKey', apiKey);
          localStorage.setItem('screenId', screenId);
          localStorage.setItem('masjid_api_key', apiKey);
          localStorage.setItem('masjid_screen_id', screenId);
          
          // Set a flag to indicate that the device is paired
          localStorage.setItem('isPaired', 'true');
          
          // Update authentication state
          setIsPaired(true);
          setIsAuthenticated(true);
          
          // Clear pairing state
          setPairingCode(null);
          setPairingCodeExpiresAt(null);
          setIsPairing(false);
          localStorage.removeItem('pairingCode');
          localStorage.removeItem('pairingCodeExpiresAt');
          localStorage.removeItem('lastPairingCodeRequestTime');
          
          // Clear polling timer if it exists
          if (pollingTimer) {
            clearTimeout(pollingTimer);
            setPollingTimer(null);
          }
          
          setIsPolling(false);
          
          logger.debug('[AuthContext] Pairing completed successfully!');
          
          return true;
        }
      } else {
        // Not paired yet, set up polling if not already polling
        if (!isPolling) {
          logger.debug('[AuthContext] Device not yet paired, starting polling');
          
          // Start polling
          startPolling(pairingCode);
        }
      }
      
      return isPaired;
    } catch (error: any) {
      logger.error('[AuthContext] Error checking pairing status', { error });
      
      // Special handling for 404 error (pairing code invalid)
      if (error.status === 404) {
        logger.debug('[AuthContext] Received 404 error during pairing status check');
        setPairingError('Pairing code not found or is invalid');
        setIsPairing(false);
        
        // Clear polling
        if (pollingTimer) {
          clearTimeout(pollingTimer);
          setPollingTimer(null);
        }
        
        setIsPolling(false);
      } else {
        setPairingError('Error checking pairing status');
      }
      
      return false;
    }
  };

  // Helper function to start polling for pairing status
  const startPolling = (pairingCode: string): void => {
    if (isPolling) {
      return;
    }
    
    setIsPolling(true);
    
    // Check pairing status every 5 seconds (increased from 2s for performance)
    const pollingInterval = 5000; 
    
    const poll = () => {
      // Only continue polling if the component is still mounted
      if (!pairingCode) {
        setIsPolling(false);
        return;
      }
      
      // Schedule the next poll
      const timer = setTimeout(async () => {
        try {
          // First check if code is still valid
          const expiresAt = pairingCodeExpiresAt ? new Date(pairingCodeExpiresAt) : null;
          if (expiresAt && expiresAt < new Date()) {
            // Code has expired
            setIsPairingCodeExpired(true);
            setIsPolling(false);
            logger.debug('[AuthContext] Pairing code expired, stopping poll');
            return;
          }
          
          // Check if we have a different pairing code now
          if (pairingCode !== getPairingCode()) {
            setIsPolling(false);
            logger.debug('[AuthContext] Pairing code has changed, stopping polling');
            return;
          }
          
          // Check pairing status again
          const isPaired = await masjidDisplayClient.checkPairingStatus(pairingCode);
          
          if (isPaired) {
            // Pairing successful, handle it
            await checkPairingStatus(pairingCode);
          } else {
            // Continue polling
            poll();
          }
        } catch (error) {
          logger.error('[AuthContext] Error during polling', { error });
          // Continue polling anyway, unless there was a 404
          if (error && (error as any).status === 404) {
            setIsPolling(false);
          } else {
            poll();
          }
        }
      }, pollingInterval);
      
      setPollingTimer(timer);
    };
    
    // Start the polling
    poll();
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

  // Update setIsPaired to handle explicit authentication
  const handleSetIsPaired = (newIsPaired: boolean) => {
    if (newIsPaired) {
      // Check if we have the credentials needed to authenticate
      const apiKey = localStorage.getItem('masjid_api_key') || 
                    localStorage.getItem('apiKey');
      const screenId = localStorage.getItem('masjid_screen_id') || 
                     localStorage.getItem('screenId');
      
      logger.debug('[AuthContext] setIsPaired(true) called, checking credentials', {
        hasApiKey: !!apiKey,
        hasScreenId: !!screenId
      });
      
      if (apiKey && screenId) {
        // We have credentials, so fully authenticate
        setIsPaired(true);
        setIsAuthenticated(true);
        setScreenId(screenId);
        
        // Make sure the API client is authenticated
        masjidDisplayClient.setCredentials({ apiKey, screenId });
        
        logger.debug('[AuthContext] Authentication forced by setIsPaired call');
      } else {
        logger.error('[AuthContext] Cannot authenticate - missing credentials');
        setIsPaired(false);
      }
    } else {
      // Just set to false as normal
      setIsPaired(false);
    }
  };

  // Listen for direct auth events from the API client
  useEffect(() => {
    const handleAuthEvent = (event: Event) => {
      try {
        logger.debug('[AuthContext] Received authentication event');
        const customEvent = event as CustomEvent<{apiKey: string, screenId: string}>;
        const { apiKey, screenId } = customEvent.detail;
        
        if (apiKey && screenId) {
          logger.debug('[AuthContext] Event contains valid credentials');
          
          // Update auth state
          setScreenId(screenId);
          setIsAuthenticated(true);
          setIsPaired(true);
          
          // Clear pairing state
          setPairingCode(null);
          setPairingCodeExpiresAt(null);
          setIsPairingCodeExpired(false);
          setIsPairing(false);
          setIsPolling(false);
          
          // Clear polling timer
          if (pollingTimer) {
            clearTimeout(pollingTimer);
            setPollingTimer(null);
          }
          
          logger.debug('[AuthContext] Authentication completed via direct event');
        }
      } catch (error) {
        logger.error('[AuthContext] Error handling auth event', { error });
      }
    };
    
    // Add the event listener
    logger.debug('[AuthContext] Setting up auth event listener');
    window.addEventListener('masjidconnect:authenticated', handleAuthEvent);
    
    // Clean up
    return () => {
      logger.debug('[AuthContext] Removing auth event listener');
      window.removeEventListener('masjidconnect:authenticated', handleAuthEvent);
    };
  }, [pollingTimer]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isPaired,
        setIsPaired: handleSetIsPaired,
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