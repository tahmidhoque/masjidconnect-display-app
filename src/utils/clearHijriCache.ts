/**
 * Clear all cached Hijri date data to force fresh calculation
 * This should be called once after the Hijri algorithm update
 */
export const clearHijriCache = (): void => {
  try {
    // Clear localStorage Hijri cache
    localStorage.removeItem('hijriDate');
    localStorage.removeItem('hijriDateTimestamp');
    localStorage.removeItem('hijriDateApiLastAttempt');
    
    // Clear any other potential Hijri-related cache
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.toLowerCase().includes('hijri') || key.toLowerCase().includes('islamic')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('✅ Cleared all cached Hijri date data');
  } catch (error) {
    console.error('❌ Error clearing Hijri cache:', error);
  }
};

// Auto-clear cache on import to ensure fresh calculation
clearHijriCache(); 