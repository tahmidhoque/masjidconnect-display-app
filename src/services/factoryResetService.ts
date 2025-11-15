import logger from "../utils/logger";
import { requestDeduplicator } from "../utils/requestDeduplication";

/**
 * Factory Reset Service
 *
 * Handles complete reset of the display to factory settings
 * Clears all stored data and returns app to initial pairing state
 */
class FactoryResetService {
  /**
   * Perform complete factory reset
   */
  async performFactoryReset(): Promise<void> {
    try {
      logger.info("🔄 Starting factory reset...");

      // Step 1: Clear all localStorage
      await this.clearLocalStorage();

      // Step 2: Clear all caches
      await this.clearCaches();

      // Step 3: Clear IndexedDB (LocalForage)
      await this.clearIndexedDB();

      // Step 4: Clear session storage
      this.clearSessionStorage();

      // Step 5: Clear service caches
      this.clearServiceCaches();

      logger.info("✅ Factory reset completed successfully");

      // Step 6: Reload the page to restart the app
      this.reloadApplication();
    } catch (error) {
      logger.error("❌ Error during factory reset", { error });
      throw new Error("Factory reset failed");
    }
  }

  /**
   * Clear all localStorage data
   */
  private async clearLocalStorage(): Promise<void> {
    try {
      logger.info("Clearing localStorage...");

      // Get all keys before clearing
      const keys = Object.keys(localStorage);
      logger.info(`Found ${keys.length} localStorage items to clear`);

      // Clear everything
      localStorage.clear();

      logger.info("✅ localStorage cleared");
    } catch (error) {
      logger.error("Error clearing localStorage", { error });
    }
  }

  /**
   * Clear all browser caches
   */
  private async clearCaches(): Promise<void> {
    try {
      logger.info("Clearing browser caches...");

      // Clear service worker caches if available
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName)),
        );
        logger.info(`✅ Cleared ${cacheNames.length} cache(s)`);
      }
    } catch (error) {
      logger.error("Error clearing caches", { error });
    }
  }

  /**
   * Clear IndexedDB databases (used by LocalForage)
   */
  private async clearIndexedDB(): Promise<void> {
    try {
      logger.info("Clearing IndexedDB...");

      // Import localforage dynamically to clear it
      const localforage = await import("localforage");

      // Clear the main database
      await localforage.clear();

      // Clear any other localforage instances
      const instances = [
        "localforage",
        "masjidconnect-storage",
        "offline-storage",
      ];

      for (const instanceName of instances) {
        try {
          const instance = localforage.createInstance({ name: instanceName });
          await instance.clear();
        } catch (instanceError) {
          // Instance might not exist, which is fine
        }
      }

      logger.info("✅ IndexedDB cleared");
    } catch (error) {
      logger.error("Error clearing IndexedDB", { error });
    }
  }

  /**
   * Clear session storage
   */
  private clearSessionStorage(): void {
    try {
      logger.info("Clearing sessionStorage...");
      sessionStorage.clear();
      logger.info("✅ sessionStorage cleared");
    } catch (error) {
      logger.error("Error clearing sessionStorage", { error });
    }
  }

  /**
   * Clear service-level caches
   */
  private clearServiceCaches(): void {
    try {
      logger.info("Clearing service caches...");

      // Clear request deduplication cache
      requestDeduplicator.clearCache();

      // Clear any global variables/caches
      if (window) {
        // Clear any window-level cache objects
        delete (window as any).masjidConnectCache;
        delete (window as any).prayerTimesCache;
        delete (window as any).contentCache;
      }

      logger.info("✅ Service caches cleared");
    } catch (error) {
      logger.error("Error clearing service caches", { error });
    }
  }

  /**
   * Reload the application
   */
  private reloadApplication(): void {
    logger.info("🔄 Reloading application...");

    // Add a small delay to ensure all cleanup is complete
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }

  /**
   * Get confirmation message for factory reset
   */
  getConfirmationMessage(): string {
    return `This will permanently delete all display data and settings. 
    
The display will return to the pairing screen and must be reconnected to your MasjidConnect account.
    
Are you sure you want to continue?`;
  }

  /**
   * Check if factory reset is possible
   */
  canPerformReset(): boolean {
    // Always allow factory reset - this is a safety mechanism
    return true;
  }
}

// Export singleton instance
export const factoryResetService = new FactoryResetService();
export default factoryResetService;
