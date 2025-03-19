import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import masjidDisplayClient from '../api/masjidDisplayClient';
import { ApiCredentials, PairingRequest, ApiResponse, RequestPairingCodeResponse, CheckPairingStatusResponse } from '../api/models';
import { Orientation } from './OrientationContext';

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
    console.log('[AuthContext] 🚀 Initial load - checking for credentials...');
    
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
        console.error('[AuthContext] Error parsing JSON credentials', e);
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
        console.error('[AuthContext] Error parsing last API response', e);
      }
      
      // Find the first valid credential set
      for (const format of formats) {
        if (format.apiKey && format.screenId) {
          console.log('[AuthContext] ✅ FOUND VALID CREDENTIALS:', {
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
      
      console.log('[AuthContext] ❌ No valid credentials found in any format');
      return { apiKey: null, screenId: null, found: false };
    };
    
    // Execute the check
    const { apiKey, screenId, found } = checkAllCredentialFormats();
    
    if (found && apiKey && screenId) {
      console.log('[AuthContext] 🔐 Initializing with valid credentials');
      
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
      
      console.log('[AuthContext] 🎉 Successfully authenticated from stored credentials');
    } else {
      console.log('[AuthContext] No valid credentials found, will need to pair');
      
      // Check if we have a stored pairing code and expiration time
      const storedPairingCode = localStorage.getItem('pairingCode');
      const storedPairingCodeExpiresAt = localStorage.getItem('pairingCodeExpiresAt');
      
      if (storedPairingCode && storedPairingCodeExpiresAt) {
        const expiresAt = new Date(storedPairingCodeExpiresAt);
        const now = new Date();
        
        // Only restore the pairing code if it hasn't expired
        if (expiresAt > now) {
          console.log('[AuthContext] Restoring saved pairing code:', storedPairingCode);
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
          console.log('Pairing code has expired');
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
      
      console.log('[AuthContext] Checking paired status from localStorage:', { 
        isPairedFlag, 
        hasApiKey: !!apiKey, 
        hasScreenId: !!screenId 
      });
      
      if (isPairedFlag === 'true' && apiKey && screenId) {
        console.log('[AuthContext] Device is paired according to localStorage flags');
        
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
      console.log('[AuthContext] 📊 Checking pairing status for code:', pairingCode);
      
      // Call API client's checkPairingStatus method
      const isPaired = await masjidDisplayClient.checkPairingStatus(pairingCode);
      console.log('[AuthContext] 📊 API client returned isPaired:', isPaired);
      
      // IMPORTANT: At this point if isPaired=true, the API client already:
      // 1. Set credentials in localStorage
      // 2. Triggered a page reload
      // So this code might not even execute if pairing was successful
      
      // But in case it does continue, check if we have credentials now:
      if (isPaired) {
        console.log('[AuthContext] 🎉 Device has been paired successfully!');
        
        // Get the credentials from all possible storage locations
        const apiKey = localStorage.getItem('masjid_api_key') || 
                     localStorage.getItem('apiKey');
        const screenId = localStorage.getItem('masjid_screen_id') || 
                       localStorage.getItem('screenId');
        
        if (apiKey && screenId) {
          console.log('[AuthContext] 🔑 Found credentials, finalizing authentication...');
          
          // Set the in-memory state
          setIsPaired(true);  
          setIsAuthenticated(true);
          setScreenId(screenId);
          
          // Update state - do this synchronously to ensure it takes effect
          setIsPairing(false);
          setIsPolling(false);
          
          // Clear pairing state
          setPairingCode(null);
          setPairingCodeExpiresAt(null);
          
          // Clear localStorage pairing items
          localStorage.removeItem('pairingCode');
          localStorage.removeItem('pairingCodeExpiresAt');
          localStorage.removeItem('lastPairingCodeRequestTime');
          
          // Stop any polling timer
          if (pollingTimer) {
            clearTimeout(pollingTimer);
            setPollingTimer(null);
          }
          
          console.log('[AuthContext] 🏁 Pairing completed successfully!');
          return true;
        } else {
          console.error('[AuthContext] ❌ Missing credentials after pairing! Will force reload');
          // Force reload as a last resort - the credentials might be there after reload
          window.location.reload();
          return false;
        }
      }
      
      // If we get here, the device is not paired yet
      console.log('[AuthContext] Device not yet paired, continuing to poll...');
      
      // Check if the pairing code is still valid in localStorage
      const storedPairingCode = localStorage.getItem('pairingCode');
      if (!storedPairingCode || storedPairingCode !== pairingCode) {
        console.log('[AuthContext] Pairing code was invalidated, stopping poll');
        setPairingCode(null);
        setPairingCodeExpiresAt(null);
        setIsPairingCodeExpired(true);
        setPairingError('Pairing code is invalid or expired. Please request a new code.');
        setIsPairing(false);
        setIsPolling(false);
        return false;
      }
      
      // Schedule next poll
      if (pollingTimer) {
        clearTimeout(pollingTimer);
      }
      
      // Use polling interval from API client (defaults to 5 seconds)
      const pollingInterval = masjidDisplayClient.getPollingInterval();
      console.log(`[AuthContext] Will check again in ${pollingInterval / 1000} seconds`);
      
      const timer = setTimeout(() => {
        // Only check again if we still have the same pairing code and it's not expired
        if (pairingCode === getPairingCode() && !isPairingCodeExpired) {
          console.log('[AuthContext] Polling - checking pairing status again...');
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
    } catch (error: any) {
      console.error('[AuthContext] Error checking pairing status:', error);
      
      // Handle specific error cases
      if (error.response && error.response.status === 404) {
        console.log('[AuthContext] Received 404 error during pairing status check');
        setPairingError('Error checking pairing status. Please try again later.');
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

  // Update setIsPaired to handle explicit authentication
  const handleSetIsPaired = (newIsPaired: boolean) => {
    if (newIsPaired) {
      // Check if we have the credentials needed to authenticate
      const apiKey = localStorage.getItem('masjid_api_key') || 
                    localStorage.getItem('apiKey');
      const screenId = localStorage.getItem('masjid_screen_id') || 
                     localStorage.getItem('screenId');
      
      console.log('[AuthContext] setIsPaired(true) called, checking credentials:', {
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
        
        console.log('[AuthContext] Authentication forced by setIsPaired call');
      } else {
        console.error('[AuthContext] Cannot authenticate - missing credentials');
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
        console.log('[AuthContext] Received authentication event');
        const customEvent = event as CustomEvent<{apiKey: string, screenId: string}>;
        const { apiKey, screenId } = customEvent.detail;
        
        if (apiKey && screenId) {
          console.log('[AuthContext] Event contains valid credentials');
          
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
          
          console.log('[AuthContext] Authentication completed via direct event');
        }
      } catch (error) {
        console.error('[AuthContext] Error handling auth event:', error);
      }
    };
    
    // Add the event listener
    console.log('[AuthContext] Setting up auth event listener');
    window.addEventListener('masjidconnect:authenticated', handleAuthEvent);
    
    // Clean up
    return () => {
      console.log('[AuthContext] Removing auth event listener');
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