import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrientation } from '../../contexts/OrientationContext';
import { useSnackbar } from 'notistack';
import logoNoTextBlue from '../../assets/logos/logo-notext-blue.svg';
import { getAdminBaseUrl, getPairingUrl } from '../../utils/adminUrlUtils';

// Import the modular components
import PairingInstructions from './pairing/PairingInstructions';
import PairingCode from './pairing/PairingCode';
import QRCodeDisplay from './pairing/QRCodeDisplay';
import PairingScreenLayout from './pairing/PairingScreenLayout';

/**
 * The Pairing Screen component
 * 
 * This screen is shown when the display is not yet paired with a masjid.
 * It shows pairing instructions and a QR code that administrators need to scan
 * to pair this display with their masjid account.
 * 
 * Note: This is a non-interactive display, so the pairing is done through another device.
 */
const PairingScreen: React.FC = () => {
  const { 
    requestPairingCode, 
    checkPairingStatus, 
    isPairing, 
    pairingError, 
    pairingCode, 
    pairingCodeExpiresAt,
    isPairingCodeExpired,
    setIsPaired
  } = useAuth();
  const { orientation } = useOrientation();
  const [fadeIn, setFadeIn] = useState<boolean>(false);
  const [pairingAttempts, setPairingAttempts] = useState<number>(0);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const requestInProgress = useRef<boolean>(false);
  const pollingRef = useRef<boolean>(false);
  const { enqueueSnackbar } = useSnackbar();
  
  // Track if component is mounted
  const isMounted = useRef<boolean>(true);
  
  // Add separate state for QR code loading
  const [isQrLoading, setIsQrLoading] = useState<boolean>(false);
  
  // Start polling for pairing status
  const startPolling = useCallback(async (code: string) => {
    if (pollingRef.current || !code) return;
    
    pollingRef.current = true;
    setIsPolling(true);
    console.log('[PairingScreen] Starting to poll for pairing status...');
    
    try {
      const isPaired = await checkPairingStatus(code);
      
      if (!isMounted.current) return;
      
      if (isPaired) {
        console.log('[PairingScreen] Device paired successfully!');
        pollingRef.current = false;
        setIsPolling(false);
        
        // Force a re-render of the App component by updating the isPaired state in AuthContext
        setIsPaired(true);
      } else {
        console.log('[PairingScreen] Device not yet paired, continuing to poll...');
        // Polling continues in the AuthContext through interval-based checks
      }
    } catch (error) {
      console.error('[PairingScreen] Error checking pairing status:', error);
      pollingRef.current = false;
      setIsPolling(false);
    }
  }, [checkPairingStatus, setIsPaired]);
  
  // Handle refresh button click
  const handleRefresh = useCallback(async () => {
    console.log('Refresh button clicked');
    
    // Increment pairing attempts
    setPairingAttempts(prev => prev + 1);
    
    // Reset polling state
    pollingRef.current = false;
    setIsPolling(false);
    
    // Don't request a new code if already requesting one
    if (isPairing) {
      console.log('Already requesting a pairing code, skipping duplicate request');
      return;
    }
    
    try {
      // Set loading state
      setIsQrLoading(true);
      
      // Request a new pairing code
      await requestPairingCode(orientation);
      
      // Clear loading state
      setIsQrLoading(false);
    } catch (error) {
      console.error('Error requesting pairing code:', error);
      
      // Clear loading state on error
      setIsQrLoading(false);
      
      enqueueSnackbar('Failed to request pairing code. Please try again.', { 
        variant: 'error',
        autoHideDuration: 5000
      });
    }
  }, [isPairing, requestPairingCode, orientation, enqueueSnackbar]);
  
  // Request a new code if the current one expires
  useEffect(() => {
    if (isPairingCodeExpired && !isPairing && !pollingRef.current && !requestInProgress.current) {
      console.log('[PairingScreen] Detected expired code, requesting a new one');
      handleRefresh();
    }
  }, [isPairingCodeExpired, isPairing, handleRefresh]);
  
  // Initial pairing code request on mount
  useEffect(() => {
    console.log('[PairingScreen] Initial mount useEffect');
    let isMounted = true;
    
    // Check if we already have a valid pairing code before doing anything
    if (pairingCode && !isPairingCodeExpired) {
      console.log('[PairingScreen] Already have a valid pairing code, skipping request');
      // Start polling with existing code
      if (pairingCode && !pollingRef.current) {
        console.log('[PairingScreen] Starting polling with existing code');
        setTimeout(() => {
          if (isMounted) {
            startPolling(pairingCode);
          }
        }, 2000);
      }
      // Just animate and return
      setTimeout(() => {
        if (isMounted) {
          setFadeIn(true);
        }
      }, 300);
      return () => {
        isMounted = false;
      };
    }
    
    const initiatePairing = async () => {
      if (!isMounted) return;
      
      // Prevent multiple simultaneous requests
      if (requestInProgress.current) {
        console.log('[PairingScreen] Request already in progress, skipping');
        return;
      }
      
      // Only request a new pairing code if we need one
      if ((!pairingCode || isPairingCodeExpired) && !isPairing && !pollingRef.current) {
        console.log('[PairingScreen] Will initiate pairing process after delay...');
        
        // Add a delay before requesting a pairing code to prevent rapid requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!isMounted) return;
        
        console.log('[PairingScreen] Initiating pairing process...');
        setPairingAttempts(prev => prev + 1);
        
        try {
          requestInProgress.current = true;
          setIsQrLoading(true); // Set QR loading state to true when requesting code
          console.log('[PairingScreen] Requesting pairing code with orientation:', orientation);
          const code = await requestPairingCode(orientation);
          requestInProgress.current = false;
          setIsQrLoading(false); // Clear QR loading state after code is received
          
          if (code && isMounted) {
            console.log('[PairingScreen] Pairing code received:', code);
          } else {
            console.warn('[PairingScreen] Failed to get a valid pairing code');
          }
        } catch (error) {
          console.error('[PairingScreen] Error in pairing process:', error);
          requestInProgress.current = false;
          setIsQrLoading(false); // Clear QR loading state on error
        }
      }
    };
    
    // Start the pairing process with a delay
    console.log('[PairingScreen] Will start pairing process after delay...');
    const startupTimer = setTimeout(() => {
      if (isMounted) {
        console.log('[PairingScreen] Starting pairing process after delay...');
        initiatePairing();
      }
    }, 1000);
    
    // Animate elements
    setTimeout(() => {
      if (isMounted) {
        setFadeIn(true);
      }
    }, 300);
    
    return () => {
      isMounted = false;
      clearTimeout(startupTimer);
      // Clean up polling on unmount
      pollingRef.current = false;
    };
  }, [pairingCode, isPairingCodeExpired, isPairing, orientation, requestPairingCode, startPolling]);
  
  // Start polling when we have a valid code but aren't polling
  useEffect(() => {
    // Add a debounce to prevent rapid polling starts
    let pollingTimer: NodeJS.Timeout | null = null;
    
    if (pairingCode && !pollingRef.current && !isPairing && !requestInProgress.current) {
      console.log('[PairingScreen] We have a valid code but not polling, will start polling after delay...');
      
      // Add a delay before starting polling to prevent rapid requests
      pollingTimer = setTimeout(() => {
        if (pairingCode && !pollingRef.current && !isPairing && !requestInProgress.current) {
          console.log('[PairingScreen] Starting polling after delay');
          startPolling(pairingCode);
        }
      }, 2000); // 2 second delay
    }
    
    // Clean up timer on unmount or when dependencies change
    return () => {
      if (pollingTimer) {
        clearTimeout(pollingTimer);
      }
    };
  }, [pairingCode, isPairing, startPolling]);
  
  // Handle pairing errors
  useEffect(() => {
    if (pairingError) {
      // Show error notification
      enqueueSnackbar(pairingError, { 
        variant: 'error',
        autoHideDuration: 5000
      });
      
      // Only request a new code if the error is about an expired code
      if (pairingError.includes('expired') && !isPairing && !requestInProgress.current) {
        console.log('[PairingScreen] Error indicates expired code, requesting new one');
        // Wait a moment before requesting a new code
        setTimeout(() => {
          if (isMounted.current && !requestInProgress.current && !isPairing) {
            handleRefresh();
          }
        }, 3000); // Longer delay to prevent rapid requests
      }
    }
  }, [pairingError, enqueueSnackbar, handleRefresh, isPairing]);
  
  // Generate the QR code URL for pairing
  const qrCodeUrl = pairingCode ? getPairingUrl(pairingCode) : '';
  
  // Get the admin base URL for instructions
  const adminBaseUrl = getAdminBaseUrl();
  
  // Left section (instructions)
  const leftSection = (
    <PairingInstructions adminBaseUrl={adminBaseUrl} />
  );
  
  // Right section (pairing code and QR code)
  const rightSection = (
    <>
      <PairingCode
        pairingCode={pairingCode}
        expiresAt={pairingCodeExpiresAt}
        isExpired={isPairingCodeExpired}
        onRefresh={handleRefresh}
        isLoading={isPairing}
      />
      
      <QRCodeDisplay
        qrCodeUrl={qrCodeUrl}
        pairingCode={pairingCode}
        isPairing={isQrLoading} // Use specific QR loading state 
        logoSrc={logoNoTextBlue}
        adminBaseUrl={adminBaseUrl}
      />
    </>
  );
  
  // Force authentication if credentials already exist in localStorage
  useEffect(() => {
    const alreadyChecked = localStorage.getItem('credentials_check_done');
    if (alreadyChecked === 'true') {
      return; // Skip if we've already done this check in this session
    }
    
    console.log('[PairingScreen] Checking if credentials already exist in localStorage');
    
    // Check for credentials in any format
    const apiKey = localStorage.getItem('masjid_api_key') || 
                  localStorage.getItem('apiKey');
    const screenId = localStorage.getItem('masjid_screen_id') || 
                    localStorage.getItem('screenId');
    
    if (apiKey && screenId) {
      console.log('[PairingScreen] Found existing credentials, forcing authentication');
      
      // Force immediate authentication by calling setIsPaired(true)
      setIsPaired(true);
      
      // Mark that we've done this check to avoid loops
      localStorage.setItem('credentials_check_done', 'true');
    } else {
      console.log('[PairingScreen] No existing credentials found');
      localStorage.setItem('credentials_check_done', 'true');
    }
  }, [setIsPaired]);
  
  return (
    <PairingScreenLayout
      orientation={orientation}
      fadeIn={fadeIn}
      leftSection={leftSection}
      rightSection={rightSection}
    />
  );
};

export default PairingScreen; 