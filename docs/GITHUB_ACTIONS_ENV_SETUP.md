# GitHub Actions Environment Variables Setup

Step-by-step guide for configuring environment variables in GitHub Actions workflows for CI/CD builds.

## Overview

The MasjidConnect Display App uses GitHub Actions for automated builds and releases. Environment variables are configured via GitHub Secrets to keep sensitive values secure.

## Current Workflow Configuration

The workflow file `.github/workflows/build-and-release.yml` sets environment variables in two key steps:

1. **Build React app** (line 64-73)
2. **Build Electron app** (line 78-96)

Both steps now include `REACT_APP_API_URL` with a fallback to the default URL.

## Required GitHub Secrets

### REACT_APP_API_URL

**Purpose**: API endpoint URL for production builds  
**Required**: Recommended (workflow has fallback to default)  
**Type**: Repository Secret

**Steps to configure:**

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `REACT_APP_API_URL`
5. Value: `https://portal.masjidconnect.co.uk/api` (or your API URL)
6. Click **Add secret**

**Note**: The workflow includes a fallback to the default URL if this secret is not set, but it's recommended to set it explicitly.

## Automatically Available Secrets

### GITHUB_TOKEN

**Purpose**: GitHub token for publishing releases  
**Required**: Yes, for publishing  
**Type**: Automatically provided by GitHub Actions

**No action needed** - This is automatically provided by GitHub Actions and doesn't need to be configured.

## Workflow Environment Variables

The workflow sets environment variables in the `env:` blocks:

```yaml
- name: Build React app
  run: npm run build:fix-paths
  env:
    REACT_APP_API_URL: ${{ secrets.REACT_APP_API_URL || 'https://portal.masjidconnect.co.uk/api' }}
    REACT_APP_VERSION: ${{ steps.package-version.outputs.VERSION }}
    CI: false
    DISABLE_ESLINT_PLUGIN: false
```

**Key points:**

- `${{ secrets.REACT_APP_API_URL }}` - Accesses the GitHub Secret
- `|| 'https://portal.masjidconnect.co.uk/api'` - Fallback if secret not set
- `REACT_APP_VERSION` - Automatically set from package.json

## Verifying Configuration

### Check Workflow Runs

1. Go to **Actions** tab in your repository
2. Select a workflow run
3. Expand the "Build React app" step
4. Check the logs for environment variable values

### Expected Log Output

When building, you should see:

```
Building version: 0.0.2-beta.2
Initializing MasjidDisplayClient with baseURL: https://portal.masjidconnect.co.uk/api
```

### Testing the Configuration

1. **Trigger a workflow run**:
   - Push to `main` branch, or
   - Create a tag starting with `v`, or
   - Use "Run workflow" button in Actions tab

2. **Check build logs**:
   - Verify API URL is set correctly
   - Check for any environment variable errors

3. **Test the build artifact**:
   - Download the `.deb` file from artifacts
   - Install on a test device
   - Verify API connectivity

## Troubleshooting

### Secret Not Found

**Error**: `REACT_APP_API_URL` is undefined or empty

**Solution**:

1. Verify the secret exists in repository settings
2. Check the secret name matches exactly (case-sensitive)
3. Ensure you're checking the correct repository
4. The workflow will use the fallback URL if secret is missing

### Build Failing

**Error**: Build fails with API connection errors

**Solution**:

1. Verify `REACT_APP_API_URL` secret is set correctly
2. Check the API URL is accessible from GitHub Actions runners
3. Verify the URL format (should include protocol: `https://`)
4. Check workflow logs for specific error messages

### Wrong API URL in Build

**Error**: Build uses wrong API URL

**Solution**:

1. Verify the secret value in repository settings
2. Check workflow file uses `${{ secrets.REACT_APP_API_URL }}`
3. Clear workflow cache if needed
4. Re-run the workflow

## Adding New Environment Variables

To add new environment variables to the workflow:

1. **Add to GitHub Secrets** (if sensitive):
   - Go to Settings → Secrets and variables → Actions
   - Add new repository secret

2. **Update workflow file**:

   ```yaml
   - name: Build React app
     run: npm run build:fix-paths
     env:
       REACT_APP_API_URL: ${{ secrets.REACT_APP_API_URL || 'https://portal.masjidconnect.co.uk/api' }}
       REACT_APP_NEW_VAR: ${{ secrets.REACT_APP_NEW_VAR || 'default-value' }}
       REACT_APP_VERSION: ${{ steps.package-version.outputs.VERSION }}
   ```

3. **Update documentation**:
   - Add to `.env.example`
   - Update `docs/ENVIRONMENT_VARIABLES.md`
   - Update this file if needed

## Security Best Practices

1. **Never commit secrets** - Use GitHub Secrets, not hardcoded values
2. **Use repository secrets** - For values specific to this repository
3. **Use environment secrets** - For values specific to environments (if using environments)
4. **Rotate secrets** - Update secrets periodically
5. **Limit access** - Only grant access to necessary workflows

## Workflow File Reference

The environment variables are configured in:

**File**: `.github/workflows/build-and-release.yml`

**Lines**:

- 66-73: Build React app environment variables
- 90-96: Build Electron app environment variables

## Related Documentation

- [Environment Variables Documentation](ENVIRONMENT_VARIABLES.md) - Complete variable reference
- [README.md](../README.md) - Project overview
- [GitHub Actions Documentation](https://docs.github.com/en/actions) - Official GitHub Actions docs

## Quick Reference

**Required Secret:**

- `REACT_APP_API_URL` - API endpoint URL (recommended)

**Automatically Available:**

- `GITHUB_TOKEN` - For publishing releases

**Workflow Syntax:**

```yaml
env:
  REACT_APP_API_URL: ${{ secrets.REACT_APP_API_URL || 'default-value' }}
```

**Where to configure:**

- Repository Settings → Secrets and variables → Actions → New repository secret
