# Environment Variables Documentation

Complete reference for all environment variables used in the MasjidConnect Display App.

## Overview

Environment variables are baked into the build at compile time (not runtime). This means:
- Variables must be set **before** building
- Changing variables requires rebuilding the application
- React requires the `REACT_APP_` prefix for client-side variables

## Required for Production

### REACT_APP_API_URL

**Type**: String (URL)  
**Required**: Yes, for production builds  
**Default**: `https://portal.masjidconnect.co.uk/api`  
**Description**: The base URL for all API calls to the MasjidConnect backend.

**Used in:**
- `src/api/masjidDisplayClient.ts` - Main API client
- `src/services/analyticsService.ts` - Analytics service
- `src/store/middleware/emergencyMiddleware.ts` - Emergency alerts
- `src/store/middleware/orientationMiddleware.ts` - Orientation sync
- `src/utils/systemMetrics.ts` - System metrics reporting
- `src/utils/adminUrlUtils.ts` - Admin URL generation

**Example:**
```bash
REACT_APP_API_URL=https://portal.masjidconnect.co.uk/api
```

**Note**: The default fallback ensures builds work even if not explicitly set, but it's recommended to set this explicitly for production builds.

## Automatically Set (No Action Needed)

### REACT_APP_VERSION

**Type**: String (semantic version)  
**Set by**: Build scripts automatically from `package.json`  
**Description**: Application version number used for version tracking and analytics.

**How it's set:**
- Build scripts use `cross-env REACT_APP_VERSION=$npm_package_version`
- Automatically extracts version from `package.json`

**Used in:**
- `src/services/analyticsService.ts` - Version tracking
- `src/utils/versionManager.ts` - Version management

**Example value**: `0.0.2-beta.2`

### NODE_ENV

**Type**: String (`production` or `development`)  
**Set by**: `react-scripts` automatically  
**Description**: Environment mode used throughout the codebase for conditional logic.

**Used in:**
- Conditional feature flags
- Development vs production optimisations
- Debug logging control
- Performance settings

**Values:**
- `development` - Development mode with debugging enabled
- `production` - Production mode with optimisations enabled

## Optional - Development/Debugging

### REACT_APP_USE_CORS_PROXY

**Type**: String (`'true'` or `'false'`)  
**Default**: `false`  
**Required**: No  
**Description**: Enable CORS proxy in development mode only.

**Usage:**
- Only effective when `NODE_ENV=development`
- Set to `'true'` to enable CORS proxy
- Used when developing locally and encountering CORS issues

**Used in:**
- `src/api/masjidDisplayClient.ts` - CORS proxy application

**Example:**
```bash
REACT_APP_USE_CORS_PROXY=true
```

### REACT_APP_CORS_PROXY_URL

**Type**: String (URL)  
**Default**: `https://cors-anywhere.herokuapp.com/`  
**Required**: No  
**Description**: CORS proxy URL used when `REACT_APP_USE_CORS_PROXY=true`.

**Usage:**
- Only used when `REACT_APP_USE_CORS_PROXY=true` and `NODE_ENV=development`
- Override if using a different CORS proxy service

**Example:**
```bash
REACT_APP_CORS_PROXY_URL=https://cors-anywhere.herokuapp.com/
```

## Optional - Electron-Specific

### ELECTRON_DEBUG

**Type**: String (any value enables)  
**Default**: Not set (disabled)  
**Required**: No  
**Description**: Enable Electron debug mode with DevTools.

**Usage:**
- Set to any value (e.g., `true`, `1`) to enable
- Enables DevTools in Electron window
- Useful for debugging Electron-specific issues

**Used in:**
- `electron/main.js` - DevTools configuration

**Example:**
```bash
ELECTRON_DEBUG=true
```

### UPDATE_CHANNEL

**Type**: String (`'latest'`, `'beta'`, or `'alpha'`)  
**Default**: `'latest'`  
**Required**: No  
**Description**: Electron updater channel for update checks.

**Values:**
- `'latest'` - Stable releases (default)
- `'beta'` - Beta releases
- `'alpha'` - Alpha/pre-release versions

**Used in:**
- `electron/main.js` - Update channel configuration

**Example:**
```bash
UPDATE_CHANNEL=beta
```

### DISABLE_UPDATES

**Type**: String (any value disables)  
**Default**: Not set (updates enabled)  
**Required**: No  
**Description**: Disable automatic update checks.

**Usage:**
- Set to any value (e.g., `true`, `1`) to disable
- Useful for testing or when updates should be manually controlled

**Used in:**
- `electron/main.js` - Update check control

**Example:**
```bash
DISABLE_UPDATES=true
```

## CI/CD - GitHub Actions

### GH_TOKEN

**Type**: String (GitHub token)  
**Required**: Yes, for publishing releases  
**Description**: GitHub token for publishing releases to GitHub.

**Usage:**
- Automatically provided by GitHub Actions as `secrets.GITHUB_TOKEN`
- For local publishing, set manually or use GitHub CLI

**Used in:**
- `scripts/build-rpi.sh` - Publishing builds
- `.github/workflows/build-and-release.yml` - Release workflow

**Note**: This is automatically available in GitHub Actions workflows and doesn't need to be set manually.

## Setting Up Environment Variables

### Local Development

1. **Create `.env` file** in the project root:
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env`** with your values:
   ```bash
   REACT_APP_API_URL=https://portal.masjidconnect.co.uk/api
   ```

3. **Restart development server** for changes to take effect:
   ```bash
   npm start
   ```

### Production Builds

**Option 1: Using `.env` file**
```bash
# Create .env file
echo "REACT_APP_API_URL=https://portal.masjidconnect.co.uk/api" > .env

# Build
npm run build
```

**Option 2: Using environment variables**
```bash
export REACT_APP_API_URL=https://portal.masjidconnect.co.uk/api
npm run build
```

**Option 3: Inline with build command**
```bash
REACT_APP_API_URL=https://portal.masjidconnect.co.uk/api npm run build
```

### GitHub Actions CI/CD

See [GitHub Actions Environment Setup](GITHUB_ACTIONS_ENV_SETUP.md) for detailed instructions on configuring environment variables in GitHub Actions workflows.

## Environment File Locations

React supports multiple environment files with different priorities:

1. `.env.development.local` - Local overrides for development (gitignored)
2. `.env.local` - Local overrides for all environments (gitignored)
3. `.env.development` - Development defaults
4. `.env` - Default for all environments (gitignored)
5. `.env.production` - Production defaults

**Priority**: Files higher in the list override values from files lower in the list.

**Note**: `.env` files are gitignored and should not be committed. Use `.env.example` as a template.

## Troubleshooting

### Variables Not Working

1. **Check prefix**: React variables must start with `REACT_APP_`
2. **Restart server**: Development server must be restarted after changing `.env`
3. **Rebuild**: Production builds must be rebuilt after changing variables
4. **Check spelling**: Variable names are case-sensitive

### Default Values

If a variable is not set, the codebase includes fallback defaults:
- `REACT_APP_API_URL` → `https://portal.masjidconnect.co.uk/api`
- `REACT_APP_VERSION` → `0.0.1` (if package.json version unavailable)
- `UPDATE_CHANNEL` → `'latest'`

### Verification

To verify environment variables are set correctly:

1. **Development**: Check browser console for logged API URLs
2. **Build**: Check build output for environment variable usage
3. **Runtime**: Variables are available as `process.env.REACT_APP_*` in code

## Best Practices

1. **Never commit `.env` files** - They're gitignored for security
2. **Use `.env.example`** - Document all variables with examples
3. **Set defaults in code** - Provide fallbacks for production builds
4. **Use GitHub Secrets** - For sensitive values in CI/CD
5. **Document changes** - Update documentation when adding new variables

## Related Documentation

- [GitHub Actions Environment Setup](GITHUB_ACTIONS_ENV_SETUP.md) - CI/CD configuration
- [README.md](../README.md) - Quick start guide
- [API URL Fix](../docs/API_URL_FIX.md) - Historical context on API URL configuration

