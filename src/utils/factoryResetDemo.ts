/**
 * Factory Reset Feature Demo
 * 
 * This utility demonstrates the factory reset functionality
 * Used for testing and showing the feature capabilities
 */

import { factoryResetService } from '../services/factoryResetService';
import logger from './logger';

/**
 * Demo function to show factory reset capabilities
 * This is safe to run as it only logs what would happen
 */
export const demoFactoryReset = (): void => {
  logger.info('🎬 Factory Reset Feature Demo Started');
  
  console.group('🔄 Factory Reset Feature');
  
  // Check if reset is possible
  const canReset = factoryResetService.canPerformReset();
  console.log('✅ Reset Available:', canReset);
  
  // Show confirmation message
  const confirmationMessage = factoryResetService.getConfirmationMessage();
  console.log('📝 Confirmation Message:');
  console.log(confirmationMessage);
  
  // Demo keyboard shortcut
  console.log('⌨️ Keyboard Shortcut: Ctrl+Shift+R (or Cmd+Shift+R on Mac)');
  
  // Demo what gets cleared
  console.log('🗑️ Data that gets cleared:');
  console.log('   • localStorage items:', Object.keys(localStorage).length);
  console.log('   • sessionStorage items:', Object.keys(sessionStorage).length);
  console.log('   • IndexedDB databases');
  console.log('   • Browser caches');
  console.log('   • Service caches');
  
  console.log('🎨 Modal Features:');
  console.log('   • Glassmorphic design with gold accents');
  console.log('   • Keyboard controls (Enter/Escape)');
  console.log('   • Loading states during reset');
  console.log('   • Warning indicators');
  
  console.log('🚨 Use Cases:');
  console.log('   • Display not responding properly');
  console.log('   • Moving to different location');
  console.log('   • Testing/development clean state');
  console.log('   • Troubleshooting connection issues');
  console.log('   • Before returning/selling device');
  
  console.groupEnd();
  
  logger.info('🎬 Factory Reset Feature Demo Complete');
  logger.info('💡 To test: Press Ctrl+Shift+R to open the confirmation modal');
};

/**
 * Show factory reset status in console
 */
export const showFactoryResetStatus = (): void => {
  const status = {
    available: factoryResetService.canPerformReset(),
    keyboardShortcut: 'Ctrl+Shift+R (or Cmd+Shift+R on Mac)',
    currentStorageItems: Object.keys(localStorage).length,
    features: [
      'Glassmorphic confirmation modal',
      'Keyboard-controlled interface',
      'Complete data clearing',
      'Automatic app reload',
      'Branded visual design'
    ]
  };
  
  console.table(status);
};

// ✅ DISABLED: Auto-run demo in development (was causing console spam)
// Uncomment the lines below if you need to test factory reset functionality
/*
if (process.env.NODE_ENV === 'development') {
  // Run demo after a short delay to avoid interfering with app startup
  setTimeout(() => {
    demoFactoryReset();
  }, 3000);
} 
*/ 