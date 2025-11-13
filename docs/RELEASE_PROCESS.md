# Release Process Documentation

This document describes the complete build and release process for the MasjidConnect Display App on Raspberry Pi, including OTA updates via electron-updater.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Version Management](#version-management)
- [Creating a Release](#creating-a-release)
- [Build Process](#build-process)
- [Release Validation](#release-validation)
- [Testing Releases](#testing-releases)
- [Rollback Process](#rollback-process)
- [Troubleshooting](#troubleshooting)

---

## Overview

The MasjidConnect Display App uses a robust build and release pipeline that:

- Builds for both Raspberry Pi architectures (armv7l and arm64)
- Creates GitHub releases automatically
- Enables OTA updates via electron-updater
- Validates releases before publishing
- Supports rollback procedures

### Architecture Support

- **armv7l**: Raspberry Pi 3 Model B/B+
- **arm64**: Raspberry Pi 4/5

---

## Prerequisites

### Required Tools

- Node.js 18+ and npm
- Git
- GitHub access token with `repo` scope (for publishing)
- Access to the repository

### GitHub Configuration

1. Ensure GitHub Actions are enabled for the repository
2. Verify `GITHUB_TOKEN` secret is available (automatically provided by GitHub Actions)
3. Confirm repository has releases enabled

### Local Setup

```bash
# Clone repository
git clone https://github.com/masjidSolutions/masjidconnect-display-app.git
cd masjidconnect-display-app

# Install dependencies
npm install
```

---

## Version Management

### Semantic Versioning

The app follows [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
```

- **MAJOR**: Breaking changes (e.g., 1.0.0 → 2.0.0)
- **MINOR**: New features, backward-compatible (e.g., 1.0.0 → 1.1.0)
- **PATCH**: Bug fixes (e.g., 1.0.0 → 1.0.1)
- **PRERELEASE**: Pre-release versions (e.g., 1.1.0-beta.1)
- **BUILD**: Build metadata (optional)

### Version Bumping

Use npm scripts to bump versions:

```bash
# Patch version (1.0.0 → 1.0.1)
npm run version:bump:patch

# Minor version (1.0.0 → 1.1.0)
npm run version:bump:minor

# Major version (1.0.0 → 2.0.0)
npm run version:bump:major
```

**Note**: These scripts update `package.json` but do NOT create git tags. Use the release creation script for complete releases.

---

## Creating a Release

### Automated Release Process

The recommended way to create a release:

```bash
# Create release (runs tests, updates version, creates tag)
npm run release:create <version>

# Example: Create release 1.0.1
npm run release:create 1.0.1
```

This script:
1. Validates version format
2. Checks git working directory is clean
3. Runs tests (unless `--skip-tests` flag is used)
4. Updates version in `package.json`
5. Updates `CHANGELOG.md` (unless `--skip-changelog` flag is used)
6. Creates git commit
7. Creates git tag

### Manual Release Process

If you prefer manual control:

```bash
# 1. Update version in package.json
# Edit package.json: "version": "1.0.1"

# 2. Update CHANGELOG.md (optional but recommended)
# Add entry for the new version

# 3. Commit changes
git add package.json CHANGELOG.md
git commit -m "Bump version to 1.0.1"

# 4. Create git tag
git tag -a v1.0.1 -m "Release 1.0.1"

# 5. Push changes and tag
git push
git push origin v1.0.1
```

### Release Script Options

```bash
# Skip tests (not recommended)
npm run release:create 1.0.1 --skip-tests

# Skip changelog update
npm run release:create 1.0.1 --skip-changelog

# Dry run (validate without making changes)
npm run release:create 1.0.1 --dry-run
```

---

## Build Process

### Automatic Builds (GitHub Actions)

When you push a version tag (e.g., `v1.0.1`), GitHub Actions automatically:

1. **Builds** the React app
2. **Prepares** RPI build files
3. **Builds** Electron app for both architectures (armv7l and arm64)
4. **Validates** build artifacts
5. **Generates** checksums
6. **Creates** GitHub release with artifacts

### Manual Builds

For local testing or manual builds:

```bash
# Build for both architectures (no publish)
npm run rpi:build

# Build for specific architecture
npm run rpi:build:armv7l   # Raspberry Pi 3
npm run rpi:build:arm64    # Raspberry Pi 4/5

# Build and publish to GitHub releases
export GH_TOKEN=your_github_token
npm run rpi:publish
```

**Important Notes**:
- The build script builds architectures **separately** (not together) for reliability
- Each architecture build is validated before proceeding
- Build artifacts are verified for size and integrity
- Publishing requires `GH_TOKEN` environment variable with `repo` scope

### Build Artifacts

After building, artifacts are in the `dist/` directory:

- `masjidconnect-display-<version>-armv7l.deb` - Raspberry Pi 3 package
- `masjidconnect-display-<version>-arm64.deb` - Raspberry Pi 4/5 package
- `masjidconnect-display-<version>-armv7l.tar.gz` - Fallback archive
- `masjidconnect-display-<version>-arm64.tar.gz` - Fallback archive

---

## Release Validation

### Pre-Release Validation

Before creating a release, validate:

```bash
# Validate release artifacts
npm run release:validate
```

This checks:
- ✅ Version format (semantic versioning)
- ✅ Required artifacts exist (.deb files for both architectures)
- ✅ Artifact integrity (file size, format)
- ✅ Checksums are valid
- ✅ Git tag exists
- ✅ Release notes present (CHANGELOG.md)
- ✅ electron-updater configuration

### Post-Build Validation

GitHub Actions automatically validates:
- Version format
- Build artifacts exist and are valid
- Checksums are generated
- Both architectures built successfully

---

## Testing Releases

### Automated Testing

The `test-release.yml` workflow automatically tests releases:

1. Downloads release artifacts
2. Validates .deb file integrity
3. Checks package metadata
4. Verifies checksums
5. Tests electron-updater detection

### Manual Testing on Raspberry Pi

1. **Download the release**:
   ```bash
   # For Raspberry Pi 4/5 (arm64)
   wget https://github.com/masjidSolutions/masjidconnect-display-app/releases/download/v1.0.1/masjidconnect-display-1.0.1-arm64.deb
   
   # For Raspberry Pi 3 (armv7l)
   wget https://github.com/masjidSolutions/masjidconnect-display-app/releases/download/v1.0.1/masjidconnect-display-1.0.1-armv7l.deb
   ```

2. **Verify checksum**:
   ```bash
   # Download checksum file
   wget https://github.com/masjidSolutions/masjidconnect-display-app/releases/download/v1.0.1/masjidconnect-display-1.0.1-arm64.deb.sha256
   
   # Verify
   sha256sum -c masjidconnect-display-1.0.1-arm64.deb.sha256
   ```

3. **Install**:
   ```bash
   sudo dpkg -i masjidconnect-display-1.0.1-arm64.deb
   ```

4. **Test**:
   - Verify app starts correctly
   - Check version is reported correctly
   - Test update detection (should detect newer versions)
   - Monitor heartbeat for version reporting

---

## Rollback Process

### Deprecating a Release

If a release has issues, deprecate it:

```bash
# Mark release as deprecated (manual GitHub steps)
npm run release:rollback <version> --reason="Issue description"

# Example
npm run release:rollback 1.0.1 --reason="Memory leak in update service"
```

This provides instructions to:
1. Mark release as pre-release on GitHub (hides from auto-updater)
2. Add deprecation notice to release notes

### Creating a Patch Release

To replace a problematic release:

```bash
# Create patch release to replace problematic version
npm run release:rollback <problematic-version> --create-patch --reason="Issue description"

# Example: Creates 1.0.2 to replace 1.0.1
npm run release:rollback 1.0.1 --create-patch --reason="Fixes memory leak"
```

This will:
1. Increment patch version (e.g., 1.0.1 → 1.0.2)
2. Update package.json
3. Update CHANGELOG.md with rollback notice
4. Provide instructions to commit and tag

### Emergency Rollback

For immediate rollback:

1. **Mark release as pre-release** on GitHub (prevents new updates)
2. **Create hotfix** release:
   ```bash
   npm run release:create <new-patch-version>
   git push && git push origin v<new-patch-version>
   ```
3. **Monitor** devices updating to new version
4. **Document** the issue in CHANGELOG.md

---

## Troubleshooting

### Build Failures

**Issue**: Build fails on GitHub Actions

**Solutions**:
- Check GitHub Actions logs for specific errors
- Verify Node.js version compatibility (18+)
- Ensure all dependencies are in package.json
- Check for missing build scripts
- Verify `after-install.sh` and `after-remove.sh` are executable

**Issue**: Cross-compilation fails

**Solutions**:
- Use GitHub Actions (recommended - runs on Linux)
- Build directly on Raspberry Pi
- Use Docker for cross-compilation
- **Never build both architectures in one command** - build separately

**Issue**: .deb package doesn't install on RPI

**Solutions**:
- Verify architecture matches your RPI (armv7l for Pi 3, arm64 for Pi 4/5)
- Check installation log: `cat /var/log/masjidconnect-install.log`
- Fix dependencies: `sudo apt-get install -f`
- Verify package integrity: `dpkg-deb -I package.deb`
- Run verification script: `bash scripts/verify-installation.sh`

### Release Issues

**Issue**: Release not detected by electron-updater

**Solutions**:
- Verify release is not marked as "pre-release"
- Check package.json `build.publish` configuration
- Ensure GitHub token has correct permissions
- Verify release artifacts are attached

**Issue**: Wrong version reported

**Solutions**:
- Verify `REACT_APP_VERSION` environment variable is set during build
- Check `package.json` version matches release tag
- Ensure version is properly embedded in build

### Update Issues

**Issue**: Updates not downloading

**Solutions**:
- Check network connectivity on device
- Verify GitHub releases API is accessible
- Check electron-updater logs
- Ensure update channel is correct

**Issue**: Update fails to install

**Solutions**:
- Verify .deb file integrity (checksum)
- Check disk space on device
- Review installation logs
- Test manual installation first

---

## Best Practices

### Release Timing

- ✅ **Avoid Friday releases** - Monitor issues before weekend
- ✅ **Avoid prayer times** - Don't disrupt displays during Salah
- ✅ **Use staging period** - Test on few devices before wide release
- ✅ **Document changes** - Clear release notes help troubleshooting

### Version Management

- ✅ **Follow semantic versioning** strictly
- ✅ **Never skip versions** (e.g., don't jump 1.0.0 → 1.2.0)
- ✅ **Use pre-releases** for beta testing
- ✅ **Tag releases** immediately after version bump

### Testing

- ✅ **Test on actual hardware** before release
- ✅ **Verify both architectures** work correctly
- ✅ **Test update flow** from previous version
- ✅ **Monitor version reporting** in heartbeat

### Communication

- ✅ **Announce updates** in admin portal
- ✅ **Provide rollback instructions** if needed
- ✅ **Monitor support channels** after releases
- ✅ **Document known issues** in release notes

---

## Quick Reference

### Common Commands

```bash
# Create release
npm run release:create <version>

# Validate release
npm run release:validate

# Rollback release
npm run release:rollback <version> --create-patch

# Build locally
npm run rpi:build

# Build and publish
npm run rpi:publish
```

### Release Checklist

- [ ] Update version in package.json
- [ ] Update CHANGELOG.md
- [ ] Run tests (`npm test`)
- [ ] Create release (`npm run release:create`)
- [ ] Push changes and tag
- [ ] Verify GitHub Actions build succeeds
- [ ] Validate release artifacts
- [ ] Test on Raspberry Pi hardware
- [ ] Monitor version reporting
- [ ] Document any issues

---

## Support

For issues or questions:
- Check GitHub Issues: https://github.com/masjidSolutions/masjidconnect-display-app/issues
- Contact: support@masjidconnect.co.uk

