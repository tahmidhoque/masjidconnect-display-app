/**
 * Credential Service
 * 
 * Single source of truth for all credential operations.
 * Handles storage, retrieval, and validation of authentication credentials.
 * 
 * Storage Keys:
 * - masjid_api_key: The API key for authenticated requests
 * - masjid_screen_id: The unique screen identifier
 * - masjid_id: The masjid (mosque) identifier
 */

import logger from '../utils/logger';

// Storage keys - these are the ONLY keys used for credentials
const STORAGE_KEYS = {
  API_KEY: 'masjid_api_key',
  SCREEN_ID: 'masjid_screen_id',
  MASJID_ID: 'masjid_id',
  IS_PAIRED: 'masjid_is_paired',
} as const;

/**
 * Credentials interface
 */
export interface Credentials {
  apiKey: string;
  screenId: string;
  masjidId?: string;
}

/**
 * Credential validation result
 */
export interface CredentialValidation {
  isValid: boolean;
  hasApiKey: boolean;
  hasScreenId: boolean;
  hasMasjidId: boolean;
  error?: string;
}

/**
 * Event types for credential changes
 */
export type CredentialEventType = 'saved' | 'cleared' | 'loaded';

/**
 * Credential change listener
 */
export type CredentialListener = (event: CredentialEventType, credentials: Credentials | null) => void;

class CredentialService {
  private listeners: Set<CredentialListener> = new Set();
  private cachedCredentials: Credentials | null = null;
  private isInitialised: boolean = false;

  constructor() {
    // Load credentials on instantiation
    this.loadCredentials();
  }

  /**
   * Initialise the credential service
   * Call this early in app startup
   */
  public initialise(): void {
    if (this.isInitialised) {
      logger.debug('[CredentialService] Already initialised');
      return;
    }

    logger.info('[CredentialService] Initialising...');
    this.loadCredentials();
    this.isInitialised = true;
    logger.info('[CredentialService] Initialised', {
      hasCredentials: this.hasCredentials(),
    });
  }

  /**
   * Load credentials from localStorage
   * Checks multiple storage locations for backward compatibility with old client
   */
  private loadCredentials(): void {
    try {
      // Try primary storage keys first
      let apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
      let screenId = localStorage.getItem(STORAGE_KEYS.SCREEN_ID);
      let masjidId = localStorage.getItem(STORAGE_KEYS.MASJID_ID);

      // Fallback to legacy bare keys for apiKey and screenId
      if (!apiKey) {
        apiKey = localStorage.getItem('apiKey');
      }
      if (!screenId) {
        screenId = localStorage.getItem('screenId');
      }

      // Fallback to legacy masjidId keys (old clients stored it differently)
      if (!masjidId) {
        masjidId = localStorage.getItem('masjidId'); // Legacy key 1
      }
      if (!masjidId) {
        masjidId = localStorage.getItem('masjid_masjid_id'); // Legacy key 2
      }

      // Fallback to masjidconnect_credentials JSON
      const credentialsJson = localStorage.getItem('masjidconnect_credentials');
      if (credentialsJson) {
        try {
          const parsed = JSON.parse(credentialsJson);
          if (!apiKey && parsed.apiKey) apiKey = parsed.apiKey;
          if (!screenId && parsed.screenId) screenId = parsed.screenId;
          if (!masjidId && parsed.masjidId) masjidId = parsed.masjidId;
        } catch {
          logger.warn('[CredentialService] Failed to parse masjidconnect_credentials JSON');
        }
      }

      if (apiKey && screenId) {
        this.cachedCredentials = {
          apiKey,
          screenId,
          masjidId: masjidId || undefined,
        };

        logger.info('[CredentialService] Credentials loaded from storage', {
          screenId,
          hasMasjidId: !!masjidId,
          apiKeyLength: apiKey.length,
        });

        // Migrate to primary storage keys if loaded from legacy locations
        this.migrateToCurrentStorage(apiKey, screenId, masjidId);
      } else {
        this.cachedCredentials = null;
        logger.info('[CredentialService] No credentials found in storage');
      }
    } catch (error) {
      logger.error('[CredentialService] Error loading credentials', { error });
      this.cachedCredentials = null;
    }
  }

  /**
   * Migrate credentials from legacy storage to current storage keys
   */
  private migrateToCurrentStorage(apiKey: string, screenId: string, masjidId: string | null): void {
    const primaryApiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
    const primaryScreenId = localStorage.getItem(STORAGE_KEYS.SCREEN_ID);
    const primaryMasjidId = localStorage.getItem(STORAGE_KEYS.MASJID_ID);

    let migrated = false;

    if (!primaryApiKey && apiKey) {
      localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
      migrated = true;
    }
    if (!primaryScreenId && screenId) {
      localStorage.setItem(STORAGE_KEYS.SCREEN_ID, screenId);
      migrated = true;
    }
    if (!primaryMasjidId && masjidId) {
      localStorage.setItem(STORAGE_KEYS.MASJID_ID, masjidId);
      migrated = true;
    }

    if (migrated) {
      localStorage.setItem(STORAGE_KEYS.IS_PAIRED, 'true');
      logger.info('[CredentialService] Migrated credentials to primary storage keys');
    }
  }

  /**
   * Save credentials to localStorage
   */
  public saveCredentials(credentials: Credentials): void {
    try {
      // Validate before saving
      if (!credentials.apiKey || !credentials.screenId) {
        throw new Error('Invalid credentials: apiKey and screenId are required');
      }

      // Save to primary localStorage keys
      localStorage.setItem(STORAGE_KEYS.API_KEY, credentials.apiKey);
      localStorage.setItem(STORAGE_KEYS.SCREEN_ID, credentials.screenId);
      localStorage.setItem(STORAGE_KEYS.IS_PAIRED, 'true');

      if (credentials.masjidId) {
        localStorage.setItem(STORAGE_KEYS.MASJID_ID, credentials.masjidId);
      }

      // Also save to legacy format for backward compatibility
      localStorage.setItem('isPaired', 'true');
      localStorage.setItem('apiKey', credentials.apiKey);
      localStorage.setItem('screenId', credentials.screenId);
      
      // Save full credentials object (including masjidId if present)
      const credentialsJson: Record<string, string> = {
        apiKey: credentials.apiKey,
        screenId: credentials.screenId,
      };
      if (credentials.masjidId) {
        credentialsJson.masjidId = credentials.masjidId;
      }
      localStorage.setItem('masjidconnect_credentials', JSON.stringify(credentialsJson));

      // Update cache
      this.cachedCredentials = { ...credentials };

      logger.info('[CredentialService] Credentials saved', {
        screenId: credentials.screenId,
        hasMasjidId: !!credentials.masjidId,
        apiKeyLength: credentials.apiKey.length,
      });

      // Notify listeners
      this.notifyListeners('saved', this.cachedCredentials);

      // Verify storage
      this.verifyStorage(credentials);
    } catch (error) {
      logger.error('[CredentialService] Error saving credentials', { error });
      throw error;
    }
  }

  /**
   * Verify credentials were stored correctly
   */
  private verifyStorage(expected: Credentials): void {
    const storedApiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
    const storedScreenId = localStorage.getItem(STORAGE_KEYS.SCREEN_ID);

    if (storedApiKey !== expected.apiKey || storedScreenId !== expected.screenId) {
      logger.error('[CredentialService] CRITICAL: Credential storage verification failed!', {
        expectedScreenId: expected.screenId,
        storedScreenId,
        apiKeyMatch: storedApiKey === expected.apiKey,
      });
    } else {
      logger.debug('[CredentialService] Credential storage verified successfully');
    }
  }

  /**
   * Get current credentials
   */
  public getCredentials(): Credentials | null {
    // Try loading from storage if not cached
    if (!this.cachedCredentials) {
      this.loadCredentials();
    }

    // Return cached version if available
    const creds = this.cachedCredentials;
    if (creds) {
      return {
        apiKey: creds.apiKey,
        screenId: creds.screenId,
        masjidId: creds.masjidId,
      };
    }

    return null;
  }

  /**
   * Get API key
   */
  public getApiKey(): string | null {
    return this.cachedCredentials?.apiKey || null;
  }

  /**
   * Get screen ID
   */
  public getScreenId(): string | null {
    return this.cachedCredentials?.screenId || null;
  }

  /**
   * Get masjid ID
   */
  public getMasjidId(): string | null {
    return this.cachedCredentials?.masjidId || null;
  }

  /**
   * Check if credentials exist and are valid
   */
  public hasCredentials(): boolean {
    return !!(this.cachedCredentials?.apiKey && this.cachedCredentials?.screenId);
  }

  /**
   * Check if fully authenticated (has all required credentials including masjidId)
   */
  public isFullyAuthenticated(): boolean {
    return !!(
      this.cachedCredentials?.apiKey &&
      this.cachedCredentials?.screenId &&
      this.cachedCredentials?.masjidId
    );
  }

  /**
   * Validate current credentials
   */
  public validateCredentials(): CredentialValidation {
    const creds = this.cachedCredentials;

    if (!creds) {
      return {
        isValid: false,
        hasApiKey: false,
        hasScreenId: false,
        hasMasjidId: false,
        error: 'No credentials found',
      };
    }

    const hasApiKey = !!(creds.apiKey && creds.apiKey.length > 0);
    const hasScreenId = !!(creds.screenId && creds.screenId.length > 0);
    const hasMasjidId = !!(creds.masjidId && creds.masjidId.length > 0);
    const isValid = hasApiKey && hasScreenId;

    return {
      isValid,
      hasApiKey,
      hasScreenId,
      hasMasjidId,
      error: isValid ? undefined : 'Missing required credentials',
    };
  }

  /**
   * Clear all credentials
   */
  public clearCredentials(): void {
    try {
      // Clear from localStorage
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
      localStorage.removeItem(STORAGE_KEYS.SCREEN_ID);
      localStorage.removeItem(STORAGE_KEYS.MASJID_ID);
      localStorage.removeItem(STORAGE_KEYS.IS_PAIRED);

      // Clear cache
      this.cachedCredentials = null;

      logger.info('[CredentialService] Credentials cleared');

      // Notify listeners
      this.notifyListeners('cleared', null);
    } catch (error) {
      logger.error('[CredentialService] Error clearing credentials', { error });
    }
  }

  /**
   * Update masjid ID (can be set separately after pairing)
   */
  public updateMasjidId(masjidId: string): void {
    if (!this.cachedCredentials) {
      logger.warn('[CredentialService] Cannot update masjidId: no credentials loaded');
      return;
    }

    localStorage.setItem(STORAGE_KEYS.MASJID_ID, masjidId);
    this.cachedCredentials.masjidId = masjidId;

    logger.info('[CredentialService] MasjidId updated', { masjidId });
    this.notifyListeners('saved', this.cachedCredentials);
  }

  /**
   * Add a listener for credential changes
   */
  public addListener(listener: CredentialListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of a credential change
   */
  private notifyListeners(event: CredentialEventType, credentials: Credentials | null): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event, credentials);
      } catch (error) {
        logger.error('[CredentialService] Error in listener', { error });
      }
    });
  }

  /**
   * Get auth header value for API requests
   */
  public getAuthHeader(): string | null {
    const apiKey = this.getApiKey();
    return apiKey ? `Bearer ${apiKey}` : null;
  }

  /**
   * Check if paired (based on stored flag)
   */
  public isPaired(): boolean {
    // Check primary key and legacy key for backward compatibility
    const isPairedFlag = 
      localStorage.getItem(STORAGE_KEYS.IS_PAIRED) === 'true' ||
      localStorage.getItem('isPaired') === 'true'; // Legacy key
    return isPairedFlag && this.hasCredentials();
  }

  /**
   * Debug: Log current credential state
   */
  public debugLogState(): void {
    const validation = this.validateCredentials();
    logger.info('[CredentialService] Current state:', {
      hasCredentials: this.hasCredentials(),
      isPaired: this.isPaired(),
      isFullyAuthenticated: this.isFullyAuthenticated(),
      validation,
      cachedScreenId: this.cachedCredentials?.screenId,
      cachedMasjidId: this.cachedCredentials?.masjidId,
      cachedApiKeyLength: this.cachedCredentials?.apiKey?.length,
    });
  }
}

// Export singleton instance
const credentialService = new CredentialService();
export default credentialService;

// Also export the storage keys for migration purposes
export { STORAGE_KEYS };

