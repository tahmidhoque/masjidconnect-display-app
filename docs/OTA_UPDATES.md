# MasjidConnect Display App - OTA Update System

This document provides detailed information on how the Over-The-Air (OTA) update system works in the MasjidConnect Display App, and how to manage releases for automatic updates.

## How OTA Updates Work

The MasjidConnect Display App uses [electron-updater](https://www.electron.build/auto-update) to provide automatic updates. This system:

1. Checks for new versions on application start
2. Downloads updates in the background
3. Notifies users when updates are ready to install
4. Provides a seamless update experience with minimal downtime

## Architecture

The update system consists of several components:

1. **GitHub Release System**: The source of truth for new versions
2. **electron-updater**: The library that handles update detection and download
3. **UpdaterContext**: React context that exposes update functionality to the UI
4. **UpdateNotification**: UI component that shows update status and prompts for installation

## Release Workflow

### Prerequisites

- GitHub repository with releases enabled
- GitHub personal access token with `repo` scope
- electron-builder configured in package.json

### Step 1: Version Management

1. Update the version in package.json:

```json
{
  "name": "masjidconnect-display-app",
  "version": "0.1.1",  // Increment from previous version
  ...
}
```

Version follows semantic versioning (MAJOR.MINOR.PATCH):

- MAJOR: Breaking changes
- MINOR: New features, backward-compatible
- PATCH: Bug fixes, backward-compatible

### Step 2: Prepare the Release

1. Commit version changes:

```sh
git add package.json
git commit -m "Bump version to 0.1.1"
```

2. Tag the release:

```sh
git tag v0.1.1
```

3. Push changes and tags:

```sh
git push
git push --tags
```

### Step 3: Build and Publish

1. Set up GitHub authentication:

```sh
export GH_TOKEN=your_github_token
```

2. Build and publish:

```sh
npm run electron:build:publish
```

This command:

- Builds the React app
- Packages the Electron app for all configured platforms
- Uploads artifacts to GitHub Releases
- Creates a draft release on GitHub

### Step 4: Finalize Release

1. Go to your GitHub repository's Releases page
2. Find the draft release created by electron-builder
3. Edit the release to add release notes
4. Publish the release

## Versioning Strategy

### When to Release

- **Feature Updates**: When adding new functionality (increment MINOR)
- **Bug Fixes**: When fixing issues (increment PATCH)
- **Critical Updates**: For security or major bug fixes (expedite the release process)

### Testing Releases

Before publishing a production release:

1. Test with a pre-release version:

```json
{
  "version": "0.1.1-beta.1"
}
```

2. Build and publish the beta:

```sh
npm run electron:build:publish
```

3. Mark as a pre-release on GitHub
4. Test with real devices
5. If successful, repeat the process with the final version

## Update Channels

The app supports different update channels:

- **latest**: Default channel, stable releases
- **beta**: Pre-release versions for testing

To specify a channel in package.json:

```json
"build": {
  "publish": {
    "provider": "github",
    "owner": "masjidSolutions",
    "repo": "masjidconnect-display-app",
    "releaseType": "release",
    "channel": "latest"  // or "beta" for pre-releases
  }
}
```

## Update Configuration Options

Fine-tune the update behavior in `electron/main.js`:

```javascript
// Check for updates every hour (in milliseconds)
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

// Set up recurring update checks
setInterval(() => {
  autoUpdater.checkForUpdatesAndNotify();
}, UPDATE_CHECK_INTERVAL);

// Configure auto download behavior
autoUpdater.autoDownload = true; // Download updates automatically
autoUpdater.allowDowngrade = false; // Prevent downgrading to older versions
autoUpdater.allowPrerelease = false; // Ignore pre-release versions
autoUpdater.autoInstallOnAppQuit = true; // Install when app quits
```

## Troubleshooting Updates

### Common Issues

1. **Updates not being detected**:
   - Verify the version in package.json is higher than the installed version
   - Check that assets are correctly uploaded to GitHub
   - Ensure network connectivity

2. **Download failures**:
   - Check the app's log files for errors
   - Ensure the device has sufficient disk space
   - Verify network connectivity to GitHub

3. **Installation failures**:
   - Ensure the app has correct permissions
   - Check if antivirus or security software is blocking installation
   - Verify the application isn't running with elevated privileges

### Logs

Update logs are available in the app's log files:

- **macOS**: `~/Library/Logs/masjidconnect-display-app/main.log`
- **Linux/Raspberry Pi**: `~/.config/masjidconnect-display-app/logs/main.log`

The logs contain detailed information about the update process, including:

- Update check timestamps
- Available updates
- Download progress
- Installation status

### Manual Update

In case of persistent update issues, you can instruct users to manually update by:

1. Download the latest version from GitHub Releases
2. Uninstall the current version (optional)
3. Install the new version

## Security Considerations

The update system uses several security measures:

1. **Code Signing**: All releases should be code-signed to ensure authenticity
2. **HTTPS**: All communication with GitHub uses secure HTTPS
3. **Update Verification**: electron-updater verifies the integrity of downloads

## Future Improvements

Potential enhancements to the update system:

1. **Staged Rollouts**: Gradually release updates to detect issues early
2. **Update Analytics**: Track update success rates and failures
3. **Mandatory Updates**: Force updates for critical security fixes
4. **Custom Update Server**: Move from GitHub to a dedicated update server for higher control

## References

- [Electron Builder Documentation](https://www.electron.build/)
- [electron-updater API](https://www.electron.build/auto-update)
- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
