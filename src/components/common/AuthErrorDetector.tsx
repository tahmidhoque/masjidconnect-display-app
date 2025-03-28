import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import masjidDisplayClient from '../../api/masjidDisplayClient';
import logger from '../../utils/logger';
import { POLLING_INTERVALS } from '../../api/masjidDisplayClient';

/**
 * AuthErrorDetector - A component that monitors for authentication errors
 * and handles them by triggering re-authentication when needed.
 * 
 * This version respects the polling intervals from the integration guide
 * to avoid making too frequent API calls.
 */
const AuthErrorDetector: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const [lastCheckTime, setLastCheckTime] = useState<number>(Date.now());
  const [consecutiveErrors, setConsecutiveErrors] = useState<number>(0);
  const checkIntervalRef = useRef<number | null>(null);

  // Use heartbeat polling interval from the integration guide
  const checkInterval = POLLING_INTERVALS.HEARTBEAT;

  // Check authentication status on the heartbeat interval from the integration guide
  useEffect(() => {
    if (!isAuthenticated) return;

    logger.debug('AuthErrorDetector initialized with check interval', { 
      checkIntervalMs: checkInterval,
      checkIntervalMinutes: checkInterval / (60 * 1000)
    });

    // Only run the check if not already run within the interval time
    const timeSinceLastCheck = Date.now() - lastCheckTime;
    if (timeSinceLastCheck > checkInterval) {
      checkAuthStatus();
    }

    // Set up periodic check based on the heartbeat interval from the integration guide
    checkIntervalRef.current = window.setInterval(checkAuthStatus, checkInterval);
    
    return () => {
      if (checkIntervalRef.current !== null) {
        window.clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [isAuthenticated]);

  const checkAuthStatus = async () => {
    try {
      // Make a heartbeat request to test auth (this doubles as our required heartbeat)
      const response = await masjidDisplayClient.sendHeartbeat({
        status: 'ONLINE',
        metrics: {
          uptime: Math.floor((Date.now() - performance.now()) / 1000),
          memoryUsage: 0,
          lastError: ''
        }
      });

      if (response.success) {
        // Reset consecutive errors on success
        if (consecutiveErrors > 0) {
          logger.info('Authentication working again after previous errors');
          setConsecutiveErrors(0);
        }
      } else if (response?.status === 401) {
        // Authentication error
        logger.warn('Authentication error detected', { 
          status: response?.status, 
          error: response.error 
        });
        setConsecutiveErrors(prev => prev + 1);
        
        // If we've had 3 consecutive auth errors, force logout
        if (consecutiveErrors >= 2) {
          logger.error('Multiple authentication errors, logging out', { consecutiveErrors });
          logout();
        }
      }
    } catch (error) {
      logger.error('Error in authentication check', { error });
    } finally {
      setLastCheckTime(Date.now());
    }
  };

  // This component doesn't render anything
  return null;
};

export default AuthErrorDetector; 