import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { EmergencyAlert } from '../api/models';
import emergencyAlertService from '../services/emergencyAlertService';
import { useAuth } from './AuthContext';
import logger from '../utils/logger';

interface EmergencyAlertContextType {
  currentAlert: EmergencyAlert | null;
  hasActiveAlert: boolean;
  clearAlert: () => void;
}

const EmergencyAlertContext = createContext<EmergencyAlertContextType | undefined>(undefined);

interface EmergencyAlertProviderProps {
  children: ReactNode;
}

export const EmergencyAlertProvider: React.FC<EmergencyAlertProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [currentAlert, setCurrentAlert] = useState<EmergencyAlert | null>(null);

  // Log when the component renders
  console.log('🚨 EmergencyAlertProvider rendering, isAuthenticated:', isAuthenticated);

  useEffect(() => {
    console.log('🚨 EmergencyAlertContext: useEffect triggered, isAuthenticated:', isAuthenticated);
    
    if (isAuthenticated) {
      logger.info('EmergencyAlertContext: Initializing emergency alert service');
      console.log('🚨 EmergencyAlertContext: Initializing emergency alert service');
      
      // Use localhost:3000 for development (matching the working test setup)
      const baseURL = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : (process.env.REACT_APP_API_URL || 'https://api.masjid.app');
      
      console.log('🚨 EmergencyAlertContext: Using baseURL:', baseURL);
      
      // Initialize the emergency alert service with the correct base URL
      emergencyAlertService.initialize(baseURL);

      // Set up listener for alert changes
      const unsubscribe = emergencyAlertService.addListener((alert) => {
        logger.info('EmergencyAlertContext: Alert state changed', { 
          hasAlert: !!alert,
          alertId: alert?.id
        });
        console.log('🚨 EmergencyAlertContext: Alert state changed from service:', alert);
        setCurrentAlert(alert);
      });

      // Clean up on unmount
      return () => {
        console.log('🚨 EmergencyAlertContext: Cleaning up emergency alert service');
        unsubscribe();
        emergencyAlertService.cleanup();
      };
    }
  }, [isAuthenticated]);

  // Clear the current alert manually
  const clearAlert = () => {
    if (currentAlert) {
      logger.info('EmergencyAlertContext: Manually clearing alert', { id: currentAlert.id });
      console.log('🚨 EmergencyAlertContext: Manually clearing alert:', currentAlert.id);
      setCurrentAlert(null);
    }
  };

  const value = {
    currentAlert,
    hasActiveAlert: !!currentAlert,
    clearAlert
  };

  // Log when the alert state changes
  useEffect(() => {
    console.log('🚨 EmergencyAlertContext: Current alert state:', currentAlert);
  }, [currentAlert]);

  return (
    <EmergencyAlertContext.Provider value={value}>
      {children}
    </EmergencyAlertContext.Provider>
  );
};

export const useEmergencyAlert = (): EmergencyAlertContextType => {
  const context = useContext(EmergencyAlertContext);
  if (context === undefined) {
    throw new Error('useEmergencyAlert must be used within an EmergencyAlertProvider');
  }
  return context;
}; 