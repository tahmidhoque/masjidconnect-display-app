# Version Management & Release Strategy

This document describes the versioning system, release process, and OTA update mechanism for the MasjidConnect Display App.

## Table of Contents

- [Semantic Versioning](#semantic-versioning)
- [Version Increment Scripts](#version-increment-scripts)
- [Release Process](#release-process)
- [OTA Updates](#ota-updates)
- [Testing Updates](#testing-updates)

---

## Semantic Versioning

The app follows **Semantic Versioning 2.0.0** (https://semver.org/):

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
```

### Version Components

- **MAJOR**: Incompatible API changes or major feature overhauls

  - Example: `1.0.0` → `2.0.0`
  - When: Breaking changes, complete redesign

- **MINOR**: New features, backward-compatible

  - Example: `1.0.0` → `1.1.0`
  - When: New remote control commands, UI enhancements

- **PATCH**: Bug fixes, backward-compatible

  - Example: `1.0.0` → `1.0.1`
  - When: Bug fixes, security patches, minor improvements

- **PRERELEASE** (optional): Pre-release versions

  - Example: `1.1.0-beta.1`, `1.1.0-rc.1`
  - When: Testing before stable release

- **BUILD** (optional): Build metadata
  - Example: `1.0.0+20240115.abc123`
  - When: Including build timestamps or git hashes

### Current Version

The current version is defined in `package.json`:

```json
{
  "version": "0.0.1"
}
```

---

## Version Increment Scripts

### Automated Version Bumping

Use npm scripts to increment versions:

```bash
# Bump patch version (0.0.1 → 0.0.2)
npm run version:bump:patch

# Bump minor version (0.0.1 → 0.1.0)
npm run version:bump:minor

# Bump major version (0.0.1 → 1.0.0)
npm run version:bump:major
```

These scripts:

1. Update `package.json`
2. Do NOT create git tags (use `--no-git-tag-version`)
3. Allow manual commit and tagging

### Manual Version Update

You can also manually edit `package.json`:

```json
{
  "version": "1.2.3"
}
```

Then commit:

```bash
git add package.json
git commit -m "Bump version to 1.2.3"
git tag v1.2.3
git push && git push --tags
```

---

## Release Process

### Pre-Release Checklist

Before creating a release:

1. ✅ **Run Tests**: Ensure all tests pass

   ```bash
   npm test -- --watchAll=false
   ```

2. ✅ **Update Version**: Bump version using scripts

   ```bash
   npm run version:bump:minor
   ```

3. ✅ **Build Locally**: Test build process

   ```bash
   npm run release:prepare
   ```

4. ✅ **Update CHANGELOG**: Document changes (if maintained)

5. ✅ **Commit Changes**:

   ```bash
   git add package.json
   git commit -m "Release v1.2.0"
   ```

6. ✅ **Create Tag**:

   ```bash
   git tag v1.2.0
   ```

7. ✅ **Push to GitHub**:
   ```bash
   git push origin main
   git push origin v1.2.0
   ```

### Automated Build & Release

Once a version tag is pushed, GitHub Actions automatically:

1. **Builds** React app
2. **Packages** Electron app for:
   - Raspberry Pi 4+ (ARM64)
   - Raspberry Pi 3 (ARMv7l)
3. **Generates** release notes from git commits
4. **Uploads** `.deb` and `.tar.gz` packages
5. **Creates** SHA256 checksums
6. **Publishes** GitHub Release

### Manual Workflow Trigger

You can also trigger builds manually:

1. Go to **Actions** tab on GitHub
2. Select **Build and Release** workflow
3. Click **Run workflow**
4. Enter version (or leave blank to use `package.json` version)
5. Click **Run workflow**

---

## OTA Updates

### How OTA Updates Work

The display app uses `electron-updater` with GitHub Releases as the update server:

```
┌─────────────────┐
│  Display App    │
│  (Raspberry Pi) │
└────────┬────────┘
         │
         │ 1. Check for updates
         ├─────────────────────────────────┐
         │                                 │
         │ 2. Download if available        │
         ├─────────────────────────────────┤
         │                                 │
         │ 3. Notify user                  │
         ├─────────────────────────────────┤
         │                                 │
         │ 4. Install on restart           │
         └─────────────────────────────────┘
```

### Update Check Frequency

- **On App Start**: Checks immediately
- **Hourly**: Checks every hour (configurable in `electron/main.js`)
- **Manual**: Via admin portal remote command

### Update Configuration

In `electron/main.js`:

```javascript
// Configure auto updater
autoUpdater.autoDownload = true; // Download automatically
autoUpdater.allowDowngrade = false; // Prevent downgrades
autoUpdater.allowPrerelease = false; // Ignore pre-releases
autoUpdater.autoInstallOnAppQuit = false; // Manual install

// Check interval
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
```

### Update Flow

1. **Check Phase**:

   - App checks GitHub Releases API
   - Compares current version with latest release
   - Shows notification if update available

2. **Download Phase**:

   - Downloads update in background
   - Shows progress bar to user
   - Does not interrupt app usage

3. **Ready Phase**:

   - Download complete
   - Persistent notification shown
   - User can install now or later

4. **Install Phase**:
   - User clicks "Install Now" button
   - App closes and updates
   - App restarts automatically

### Manual Update Trigger

Admin portal can force update check via SSE:

```json
{
  "type": "FORCE_UPDATE",
  "commandId": "uuid-v4",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

This triggers immediate update check and download.

---

## Testing Updates

### Testing Pre-Release Versions

#### Step 1: Create Pre-Release

```bash
# Set pre-release version
npm run version:bump:minor  # e.g., 1.1.0
npm version prerelease --preid=beta  # 1.1.0-beta.0

git commit -am "Release v1.1.0-beta.0"
git tag v1.1.0-beta.0
git push && git push --tags
```

#### Step 2: Mark as Pre-Release

GitHub Actions will automatically mark versions with `-` as pre-releases.

#### Step 3: Enable Pre-Releases in App

In `electron/main.js`:

```javascript
autoUpdater.allowPrerelease = true; // Enable pre-releases
```

Rebuild and test.

### Testing Update Flow Locally

#### Simulate Update Available

1. Lower version in `package.json` (e.g., `0.0.1`)
2. Build and run app
3. Create a newer release on GitHub
4. Trigger update check
5. Verify notification appears

#### Test Without Publishing

Use `electron-updater` dev server:

```bash
# In separate terminal
npx http-server ./dist -p 8080

# Configure app to use local server
# (Requires code changes to electron/main.js)
```

### Monitoring Updates in Production

Check logs on Raspberry Pi:

```bash
# View main process logs
cat ~/.config/masjidconnect-display-app/logs/main.log

# Watch live logs
tail -f ~/.config/masjidconnect-display-app/logs/main.log | grep -i update
```

Log entries to look for:

- `Checking for update...`
- `Update available: v1.2.0`
- `Download speed: ...`
- `Update downloaded. Will install on restart.`

---

## Version Display

### In Application

Current version is displayed in:

- Footer of main screen
- Error screens
- About/Settings section (if implemented)

Implementation:

```typescript
import { getCurrentVersion, formatVersionDisplay } from './utils/versionManager';

const version = getCurrentVersion();
const display = formatVersionDisplay(version); // "v1.2.0"
```

### In Build Artifacts

Version is embedded in:

- `package.json`
- `build/version.json` (generated during build)
- Electron app metadata
- `.deb` package filename

Example `version.json`:

```json
{
  "version": "1.2.0",
  "buildTimestamp": "2024-01-15T10:30:00Z",
  "gitHash": "abc123",
  "gitBranch": "main",
  "nodeVersion": "v18.17.0",
  "platform": "linux",
  "architectures": ["armv7l", "arm64"]
}
```

---

## Rollback Strategy

### If Update Causes Issues

#### Option 1: Downgrade via Manual Installation

```bash
# Download previous version
wget https://github.com/masjidSolutions/masjidconnect-display-app/releases/download/v1.1.0/masjidconnect-display-1.1.0-arm64.deb

# Install previous version
sudo dpkg -i masjidconnect-display-1.1.0-arm64.deb
```

#### Option 2: Yank Bad Release

1. Go to GitHub Releases
2. Edit the problematic release
3. Mark as "Pre-release" (hides from auto-updater)
4. Users won't update to this version

#### Option 3: Push Hotfix

1. Fix the issue
2. Bump patch version
3. Release immediately
4. Users update to fixed version

### Prevention Measures

- Test updates on development devices first
- Use pre-release versions for beta testing
- Implement staged rollouts (future enhancement)
- Monitor error reports after releases

---

## Best Practices

### Versioning Guidelines

- **Major (X.0.0)**: Once per year or for major milestones
- **Minor (1.X.0)**: Monthly or when adding significant features
- **Patch (1.0.X)**: Weekly or as needed for bug fixes
- **Never** skip versions (e.g., don't jump 1.0.0 → 1.2.0)

### Release Timing

- **Avoid Friday Releases**: Give time to monitor before weekend
- **Avoid Prayer Times**: Don't disrupt displays during Salah
- **Use Staging Period**: Test on a few devices before wide release
- **Document Changes**: Clear release notes help troubleshooting

### Communication

- Announce upcoming updates in admin portal
- Provide rollback instructions
- Monitor support channels after releases
- Keep release notes detailed but concise

---

## Troubleshooting

### Updates Not Detected

**Check**:

1. Version in `package.json` is correct
2. GitHub release is published (not draft)
3. Release tag format is correct (`v1.2.0`, not `1.2.0`)
4. Device has internet connectivity
5. `electron-updater` logs for errors

**Fix**:

```bash
# Manually trigger update check
# (Via admin portal remote command)
```

### Download Failures

**Common Causes**:

- Network connectivity issues
- GitHub rate limiting
- Insufficient disk space
- Corrupted download

**Fix**:

- Check network connection
- Verify disk space: `df -h`
- Retry download
- Manual installation as fallback

### Installation Failures

**Common Causes**:

- Incorrect permissions
- App running with elevated privileges
- Antivirus blocking installation

**Fix**:

- Ensure app runs as normal user
- Check system logs
- Manual installation via `.deb` package

---

## Support

For version management questions:

- **Documentation**: `/docs`
- **GitHub Actions**: `.github/workflows/build-and-release.yml`
- **Update Service**: `src/services/updateService.ts`
- **Version Utils**: `src/utils/versionManager.ts`

---

**Last Updated**: 2024-01-15
**Document Version**: 1.0.0
