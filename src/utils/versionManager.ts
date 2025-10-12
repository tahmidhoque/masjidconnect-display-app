/**
 * Version Management Utilities
 * 
 * Provides utilities for semantic versioning operations including:
 * - Version parsing and validation
 * - Version comparison
 * - Version increment operations
 */

import logger from './logger';

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

/**
 * Parse a semantic version string into its components
 * Supports formats: "1.2.3", "v1.2.3", "1.2.3-beta.1", "1.2.3+build.123"
 */
export function parseVersion(versionString: string): SemanticVersion | null {
  try {
    // Remove 'v' prefix if present
    const cleanVersion = versionString.replace(/^v/, '');
    
    // Regex for semantic versioning
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    
    const match = cleanVersion.match(semverRegex);
    
    if (!match) {
      logger.warn('Invalid version format', { versionString });
      return null;
    }
    
    const [, major, minor, patch, prerelease, build] = match;
    
    return {
      major: parseInt(major, 10),
      minor: parseInt(minor, 10),
      patch: parseInt(patch, 10),
      prerelease: prerelease || undefined,
      build: build || undefined,
    };
  } catch (error) {
    logger.error('Error parsing version', { versionString, error });
    return null;
  }
}

/**
 * Convert a SemanticVersion object back to a string
 */
export function versionToString(version: SemanticVersion): string {
  let versionString = `${version.major}.${version.minor}.${version.patch}`;
  
  if (version.prerelease) {
    versionString += `-${version.prerelease}`;
  }
  
  if (version.build) {
    versionString += `+${version.build}`;
  }
  
  return versionString;
}

/**
 * Compare two versions
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const version1 = parseVersion(v1);
  const version2 = parseVersion(v2);
  
  if (!version1 || !version2) {
    logger.error('Cannot compare invalid versions', { v1, v2 });
    return 0;
  }
  
  // Compare major version
  if (version1.major !== version2.major) {
    return version1.major > version2.major ? 1 : -1;
  }
  
  // Compare minor version
  if (version1.minor !== version2.minor) {
    return version1.minor > version2.minor ? 1 : -1;
  }
  
  // Compare patch version
  if (version1.patch !== version2.patch) {
    return version1.patch > version2.patch ? 1 : -1;
  }
  
  // If both have no prerelease, they're equal
  if (!version1.prerelease && !version2.prerelease) {
    return 0;
  }
  
  // Version without prerelease is greater than version with prerelease
  if (!version1.prerelease) return 1;
  if (!version2.prerelease) return -1;
  
  // Compare prerelease versions lexicographically
  if (version1.prerelease < version2.prerelease) return -1;
  if (version1.prerelease > version2.prerelease) return 1;
  
  return 0;
}

/**
 * Check if version1 is greater than version2
 */
export function isNewerVersion(v1: string, v2: string): boolean {
  return compareVersions(v1, v2) > 0;
}

/**
 * Check if version1 is less than version2
 */
export function isOlderVersion(v1: string, v2: string): boolean {
  return compareVersions(v1, v2) < 0;
}

/**
 * Check if two versions are equal
 */
export function areVersionsEqual(v1: string, v2: string): boolean {
  return compareVersions(v1, v2) === 0;
}

/**
 * Validate a version string
 */
export function isValidVersion(versionString: string): boolean {
  return parseVersion(versionString) !== null;
}

/**
 * Increment version by type
 */
export function incrementVersion(
  currentVersion: string,
  type: 'major' | 'minor' | 'patch'
): string | null {
  const version = parseVersion(currentVersion);
  
  if (!version) {
    logger.error('Cannot increment invalid version', { currentVersion });
    return null;
  }
  
  // Remove prerelease and build metadata when incrementing
  const newVersion: SemanticVersion = {
    major: version.major,
    minor: version.minor,
    patch: version.patch,
  };
  
  switch (type) {
    case 'major':
      newVersion.major += 1;
      newVersion.minor = 0;
      newVersion.patch = 0;
      break;
    case 'minor':
      newVersion.minor += 1;
      newVersion.patch = 0;
      break;
    case 'patch':
      newVersion.patch += 1;
      break;
  }
  
  return versionToString(newVersion);
}

/**
 * Get the current application version from package.json
 */
export function getCurrentVersion(): string {
  // In production builds, the version might be embedded differently
  // For now, we'll use a constant that will be replaced during build
  return process.env.REACT_APP_VERSION || '0.0.1';
}

/**
 * Format version for display with optional prefix
 */
export function formatVersionDisplay(version: string, includePrefix: boolean = true): string {
  const prefix = includePrefix ? 'v' : '';
  return `${prefix}${version}`;
}

/**
 * Check if a version is a prerelease
 */
export function isPrerelease(versionString: string): boolean {
  const version = parseVersion(versionString);
  return version ? !!version.prerelease : false;
}

/**
 * Get release type between two versions
 */
export function getReleaseType(oldVersion: string, newVersion: string): string {
  const v1 = parseVersion(oldVersion);
  const v2 = parseVersion(newVersion);
  
  if (!v1 || !v2) {
    return 'unknown';
  }
  
  if (v2.major > v1.major) {
    return 'major';
  }
  
  if (v2.minor > v1.minor) {
    return 'minor';
  }
  
  if (v2.patch > v1.patch) {
    return 'patch';
  }
  
  if (v2.prerelease && !v1.prerelease) {
    return 'prerelease';
  }
  
  return 'none';
}

