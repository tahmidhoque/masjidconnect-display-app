# Testing the Release Process

## Step-by-Step Guide to Test Pre-Release

### Prerequisites Check

1. ✅ Git repository is clean (or changes committed)
2. ✅ GitHub token available (for publishing)
3. ✅ Node.js 18+ installed
4. ✅ All dependencies installed (`npm install`)

### Step 1: Create Pre-Release Version

Create a pre-release version (e.g., `0.0.2-beta.1`):

```bash
# Option A: Use the release script (recommended)
npm run release:create 0.0.2-beta.1 --skip-tests

# Option B: Manual version update
# Edit package.json: "version": "0.0.2-beta.1"
# Then commit and tag manually
```

**Note**: Using `--skip-tests` for faster testing, but normally you'd want tests to run.

### Step 2: Build the Pre-Release

Build for both architectures:

```bash
# Build locally (no publish)
npm run rpi:build

# Or build specific architecture for testing
npm run rpi:build:arm64  # For Raspberry Pi 4/5
```

**Verify artifacts**:
```bash
ls -lh dist/*.deb
# Should see:
# - masjidconnect-display-0.0.2-beta.1-armv7l.deb
# - masjidconnect-display-0.0.2-beta.1-arm64.deb
```

### Step 3: Validate Release

```bash
npm run release:validate
```

This checks:
- ✅ Version format
- ✅ Artifacts exist
- ✅ Checksums valid
- ✅ electron-updater config

### Step 4: Create Git Tag and Push

```bash
# Create tag
git tag -a v0.0.2-beta.1 -m "Pre-release test: 0.0.2-beta.1"

# Push changes and tag
git push
git push origin v0.0.2-beta.1
```

### Step 5: GitHub Actions Build

GitHub Actions will automatically:
1. Detect the tag push
2. Build for both architectures
3. Create a GitHub release (marked as pre-release)
4. Attach .deb files

**Monitor the build**:
- Go to: https://github.com/masjidSolutions/masjidconnect-display-app/actions
- Watch the "Build and Release" workflow

### Step 6: Verify GitHub Release

Check the release was created:
- URL: https://github.com/masjidSolutions/masjidconnect-display-app/releases
- Should see: "Release v0.0.2-beta.1" (marked as Pre-release)
- Should have .deb files for both architectures

### Step 7: Test Update Detection

On a Raspberry Pi with the app installed:

**Option A: Manual Update Check**
```bash
# The app checks automatically every hour
# Or trigger manually via admin portal FORCE_UPDATE command
```

**Option B: Test Update Detection Code**
```javascript
// In browser console or test script
const updateService = require('./src/services/updateService');
updateService.checkForUpdates();
```

**Check logs**:
```bash
# On Raspberry Pi
cat ~/.config/masjidconnect-display/logs/main.log | grep -i update
```

### Step 8: Verify Admin Portal Detection

The admin portal should:
1. See the new version in heartbeat data (`appVersion` field)
2. Show update available if device is on older version
3. Allow triggering FORCE_UPDATE command
4. Display update progress in heartbeat

**Check heartbeat data**:
- Look for `appVersion: "0.0.2-beta.1"` in heartbeat
- Look for `updateProgress` object when update is in progress

### Step 9: Test Update Flow

1. **Device on 0.0.1, release 0.0.2-beta.1 available**:
   - App should detect update (hourly check or FORCE_UPDATE)
   - Update progress should appear in heartbeat
   - Admin portal should show update status

2. **Trigger FORCE_UPDATE from admin portal**:
   - Should trigger update check immediately
   - Progress reported via heartbeat
   - Status: checking → available → downloading → downloaded

3. **Monitor heartbeat**:
   - Check `updateProgress.status`
   - Check `updateProgress.version`
   - Check `updateProgress.progress` (0-100)

### Step 10: Verify Pre-Release Handling

**Important**: electron-updater is configured with `allowPrerelease: false`

This means:
- ✅ Pre-releases are created on GitHub
- ❌ Devices won't auto-update to pre-releases
- ✅ Can test update detection manually
- ✅ Admin portal can see version info

**To test pre-release updates** (if needed):
- Temporarily set `allowPrerelease: true` in `electron/main.js`
- Or manually install pre-release .deb file

## Expected Results

### GitHub Release
- ✅ Release created with tag `v0.0.2-beta.1`
- ✅ Marked as "Pre-release"
- ✅ Contains .deb files for armv7l and arm64
- ✅ Has release notes
- ✅ Has checksums

### Update Detection
- ✅ electron-updater can see the release
- ✅ Version comparison works correctly
- ✅ Update progress tracked
- ✅ Heartbeat includes version and update status

### Admin Portal
- ✅ Shows device version in dashboard
- ✅ Can trigger FORCE_UPDATE
- ✅ Receives update progress via heartbeat
- ✅ Displays update status

## Troubleshooting

### Release Not Created
- Check GitHub Actions logs
- Verify tag was pushed: `git ls-remote --tags origin`
- Check workflow permissions

### Update Not Detected
- Verify release is published (not draft)
- Check electron-updater logs
- Verify `allowPrerelease` setting matches your needs
- Check network connectivity

### Admin Portal Not Showing Version
- Verify heartbeat includes `appVersion` field
- Check analytics service is initialized
- Verify version is being read correctly

### Build Fails
- Check build logs in GitHub Actions
- Verify all dependencies installed
- Check Node.js version (18+)
- Review `scripts/build-rpi.sh` output

## Cleanup After Testing

```bash
# Delete the pre-release tag (if needed)
git tag -d v0.0.2-beta.1
git push origin :refs/tags/v0.0.2-beta.1

# Or keep it for reference
```

## Next Steps After Successful Test

1. Create a real release (remove `-beta.1` suffix)
2. Test on actual Raspberry Pi hardware
3. Monitor update adoption
4. Verify version reporting in admin portal

