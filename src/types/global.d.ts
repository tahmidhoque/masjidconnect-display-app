/**
 * Global type declarations
 *
 * Companion service API types.
 * The companion service runs locally on RPi and exposes a REST API.
 */

interface CompanionServiceAPI {
  /** Base URL of the companion service (e.g. http://localhost:3100) */
  baseUrl: string;
}

interface Window {
  /** Reference to companion service configuration, if available */
  companionService?: CompanionServiceAPI;
}
