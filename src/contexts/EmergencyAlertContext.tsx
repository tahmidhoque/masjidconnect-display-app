import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { EmergencyAlert } from '../api/models';
import emergencyAlertService from '../services/emergencyAlertService';
import { useAuth } from './AuthContext';
import logger from '../utils/logger';

interface EmergencyAlertContextType {
  currentAlert: EmergencyAlert | null;
  hasActiveAlert: boolean;
  clearAlert: () => void;
  createTestAlert: () => void;
  testSSEConnection: () => void;
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

  // Create a test alert (for debugging or demo)
  const createTestAlert = () => {
    console.log('🚨 EmergencyAlertContext: Creating manual test alert');
    
    // Create a more persistent test alert (2 minutes duration)
    const testAlert: EmergencyAlert = {
      id: 'test-alert-' + Date.now(),
      title: 'Test Emergency Alert',
      message: 'This is a test of the emergency alert system. This alert was manually triggered for testing purposes. If you can see this message, the alert display system is working properly.',
      color: '#e74c3c', // Red
      expiresAt: new Date(Date.now() + 120000).toISOString(), // 2 minutes from now
      createdAt: new Date().toISOString(),
      masjidId: 'test-masjid-id'
    };
    
    console.log('🚨 EmergencyAlertContext: Setting test alert:', testAlert);
    setCurrentAlert(testAlert);
  };

  // Test SSE connection
  const testSSEConnection = () => {
    console.log('🚨 EmergencyAlertContext: Testing SSE connection');
    
    // Get the current connection status
    const status = emergencyAlertService.getConnectionStatus();
    console.log('🚨 EmergencyAlertContext: Current SSE connection status:', status);
    
    // If not connected, try to reconnect
    if (!status.connected) {
      const baseURL = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : (process.env.REACT_APP_API_URL || 'https://api.masjid.app');
        
      console.log('🚨 EmergencyAlertContext: Reconnecting with baseURL:', baseURL);
      emergencyAlertService.initialize(baseURL);
    }
    
    // Run a more detailed connection test
    emergencyAlertService.testConnection();
  };

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
    clearAlert,
    createTestAlert,
    testSSEConnection
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