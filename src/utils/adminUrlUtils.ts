/**
 * Utility functions for generating admin URLs
 */

/**
 * Gets the admin base URL from the current hostname and the API URL
 */
export const getAdminBaseUrl = (): string => {
  // Get the API URL from environment variables
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
  
  // Extract the hostname from the API URL
  const apiHostname = new URL(apiUrl).hostname;
  const apiPort = new URL(apiUrl).port ?? "";
  
  // If we're on localhost, use the API hostname
  if (window.location.hostname === 'localhost') {
    return `http://${apiHostname}:${apiPort}`;
  }
  
  // For production, use the appropriate admin URL
  // Check if the current hostname has "display" in it, and replace with "admin" or "dashboard"
  const currentHostname = window.location.hostname;
  
  // Use same protocol as current page
  const protocol = window.location.protocol;
  
  if (currentHostname.includes('display')) {
    // Replace "display" with "admin" or "dashboard"
    return `${protocol}//${currentHostname.replace('display', 'dashboard')}`;
  }
  
  // If no display in hostname, assume it's a subdomain structure
  // and use dashboard as the subdomain
  const domainParts = currentHostname.split('.');
  if (domainParts.length > 1) {
    // Replace the first part (subdomain) with "dashboard"
    domainParts[0] = 'dashboard';
    return `${protocol}//${domainParts.join('.')}`;
  }
  
  // Fallback to the API URL
  return apiUrl.replace('/api', '');
};

/**
 * Gets the pairing URL based on the admin base URL and pairing code
 */
export const getPairingUrl = (pairingCode: string): string => {
  const baseUrl = getAdminBaseUrl();
  return `${baseUrl}/pair/${pairingCode}`;
}; 