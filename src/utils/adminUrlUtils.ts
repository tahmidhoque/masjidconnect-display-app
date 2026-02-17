/**
 * Utility functions for generating admin portal URLs.
 *
 * Used by the pairing screen to build the QR code link and display the
 * admin base URL in instructions.
 */

const PRODUCTION_API_URL = 'https://portal.masjidconnect.co.uk';

/**
 * Resolves the API base URL from environment / build-time config.
 *
 * - Production builds always use the hardcoded production URL for reliability.
 * - Development builds honour the VITE_API_URL env var.
 */
export const getApiBaseUrl = (): string => {
  if (import.meta.env.PROD) {
    return PRODUCTION_API_URL;
  }

  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL as string;
  }

  return 'http://localhost:3000';
};

/**
 * Derives the admin dashboard URL from the API URL / current hostname.
 */
export const getAdminBaseUrl = (): string => {
  const apiUrl = getApiBaseUrl();

  const apiHostname = new URL(apiUrl).hostname;
  const apiPort = new URL(apiUrl).port ?? '';

  // Local development — use the API hostname directly
  if (window.location.hostname === 'localhost') {
    return `http://${apiHostname}${apiPort ? `:${apiPort}` : ''}`;
  }

  // Production — derive from the current hostname
  const currentHostname = window.location.hostname;
  const protocol = window.location.protocol;

  if (currentHostname.includes('display')) {
    return `${protocol}//${currentHostname.replace('display', 'dashboard')}`;
  }

  // Subdomain structure — swap first part for "dashboard"
  const domainParts = currentHostname.split('.');
  if (domainParts.length > 1) {
    domainParts[0] = 'dashboard';
    return `${protocol}//${domainParts.join('.')}`;
  }

  // Fallback
  return apiUrl.replace('/api', '');
};

/**
 * Build the full pairing URL that the QR code should encode.
 */
export const getPairingUrl = (pairingCode: string): string => {
  const baseUrl = getAdminBaseUrl();
  return `${baseUrl}/pair/${pairingCode}`;
};
