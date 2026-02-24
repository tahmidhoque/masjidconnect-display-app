# Release process and RPi self-update testing

This guide covers: (1) the release process when you create a new tag, (2) getting the app on an RPi, and (3) testing the self-update (FORCE_UPDATE) flow with a test release.

---

## 1. Release process (when you create a new tag)

Releases are created by GitHub Actions when you push a **version tag** (`v*`). The workflow builds the app, packages the tarball, and creates a GitHub Release with the tarball attached so devices can self-update from it.

### Steps to cut a release

1. **Bump the version in `package.json`** (must match the tag you will create):

   ```bash
   npm run version:bump:patch   # 1.0.0 → 1.0.1
   # or
   npm run version:bump:minor   # 1.0.0 → 1.1.0
   # or
   npm run version:bump:major   # 1.0.0 → 2.0.0
   ```

2. **Commit the version bump:**

   ```bash
   git add package.json
   git commit -m "chore: release v1.0.1"
   ```

3. **Create and push the tag** (tag must match `package.json` version exactly):

   ```bash
   git tag v1.0.1
   git push origin main
   git push origin v1.0.1
   ```

4. **Let GitHub Actions run:**
   - **Build** job: `npm run package` → produces `masjidconnect-display-<version>.tar.gz`.
   - **Release** job (runs only on tag push or workflow_dispatch): creates the GitHub Release and uploads the tarball (and image/checksums) as assets.

5. **Verify the release:**
   - On the repo: **Releases** → you should see **v1.0.1** with asset `masjidconnect-display-1.0.1.tar.gz`.
   - The self-update script on the Pi uses the **latest** release and this tarball asset.

### Important

- **Tag and `package.json` must match.** The release job checks this; if they differ, the workflow fails so you don’t publish a mismatched release.
- The update script on the Pi compares versions and only updates if the **latest release version is greater** than the installed version (from `dist/version.json` or `package.json`).

---

## 2. Getting the app on an RPi first

You need a Pi already running the display app (any version) before you can test the self-update. Two options:

### Option A: Flash the pre-built image (easiest)

1. From a **GitHub Release** (or Actions artifacts), download **masjidconnect-display.img** (and optionally **masjidconnect-display.img.sha256**).
2. Flash the image to an SD card with [Raspberry Pi Imager](https://www.raspberrypi.com/software/) (“Use custom” → select the `.img`) or [Etcher](https://etcher.balena.io/).
3. Insert the SD card, boot the Pi, connect to the same network (Ethernet or WiFi if preconfigured).
4. Default SSH: user **pi**, password **masjidconnect** (change after first login).
5. The kiosk and display server start automatically. Pair the screen from the MasjidConnect admin portal.

If there is no release yet, use **Option B** to install from a local tarball.

### Building the RPi image locally (no release image)

If you build with `./rpi-image/build-image.sh pi3` (or `pi4`): the script always runs `npm run package` and overwrites the tarball, so the image gets the latest code. Set **`VITE_REALTIME_URL`** and **`VITE_API_URL`** in a `.env` file in the repo root (copy from `.env.example`) before building so the correct WebSocket and API URLs are baked in.

### Option B: Manual install from tarball

Use this when you don’t have a release image yet (e.g. before the first release or for a quick test).

1. **On your dev machine**, build and package:

   ```bash
   npm run package
   ```

   This produces `masjidconnect-display-<version>.tar.gz` in the project root.

2. **Copy to the Pi** (replace `<rpi-ip>` with the Pi’s IP):

   ```bash
   scp masjidconnect-display-*.tar.gz pi@<rpi-ip>:~/
   ```

3. **On the Pi (SSH):**

   ```bash
   ssh pi@<rpi-ip>
   sudo mkdir -p /opt/masjidconnect
   sudo tar -xzf masjidconnect-display-*.tar.gz -C /opt/masjidconnect
   sudo /opt/masjidconnect/deploy/install.sh
   ```

4. Reboot or start the kiosk as needed. Pair the screen from the admin portal.

After this, the Pi is running the app and the self-update script (and sudoers) are in place.

---

## 3. Testing the self-update (FORCE_UPDATE) with a test release

Goal: have the Pi pull a **newer** release and restart so you see the Footer go through: Checking → Downloading → Installing → Restarting in Ns → reload.

### 3.1 Install an “old” version on the Pi

- Either flash an image or install a tarball for version **1.0.0** (or whatever is current). Ensure the Pi is paired and showing the display.

### 3.2 Create a test release (newer version)

1. Bump version, e.g. to **1.0.1**:

   ```bash
   npm run version:bump:patch
   git add package.json
   git commit -m "chore: release v1.0.1 (test update)"
   git tag v1.0.1
   git push origin main
   git push origin v1.0.1
   ```

2. Wait for GitHub Actions to finish and for the **v1.0.1** release to appear with **masjidconnect-display-1.0.1.tar.gz** attached.

### 3.3 Trigger the update on the Pi

1. Open the **MasjidConnect admin portal** and go to the screen that is paired to this Pi.
2. Send the **Force update** (FORCE_UPDATE) command to that screen.
3. **On the Pi display (Footer, bottom-left):**
   - You should see in order: **“Checking for update…”** → **“Downloading update…”** → **“Installing…”** → **“Restarting in 30s”** (or similar) with countdown, then the page reloads and the app runs the new version.

### 3.4 If something goes wrong

- **“Up to date” immediately:**  
  - The **latest** GitHub release may still be the same version as on the Pi (e.g. no v1.0.1 yet, or release not marked latest).  
  - Or the release has no asset named `masjidconnect-display-<version>.tar.gz`. Check the release assets.

- **No status messages:**  
  - The app might not be receiving the FORCE_UPDATE command (check WebSocket/heartbeat and that you’re sending to the correct screen).  
  - Or the Node server / update script isn’t running (e.g. wrong install path). Check:  
    `systemctl status masjidconnect-display`

- **Update script fails:**  
  - SSH in and run the script by hand to see errors:  
    `sudo /opt/masjidconnect/deploy/update-from-github.sh`  
  - Check: `curl -s https://api.github.com/repos/masjidSolutions/masjidconnect-display-app/releases/latest` and confirm there is an asset whose name matches `masjidconnect-display-*.tar.gz`.

- **Permission denied (sudo):**  
  - Sudoers must allow the app user to run the update script without a password. Image and `deploy/install.sh` add this; if you installed manually without running `install.sh`, run it so the sudoers file is created.

### 3.5 Quick checklist

| Step | What to do |
|------|------------|
| 1 | Pi running app (image or tarball install), paired in portal |
| 2 | Bump version in `package.json`, commit, tag `vX.Y.Z`, push tag |
| 3 | Wait for Actions to create release and attach tarball |
| 4 | In admin portal, send **Force update** to the screen |
| 5 | On Pi display: Footer shows Checking → Downloading → Installing → Restarting in Ns → reload |
| 6 | After reload, confirm new version (e.g. in `dist/version.json` or app UI if you expose it) |

---

## Summary

- **Release:** Bump version in `package.json` → commit → tag `v<version>` → push; workflow builds and publishes the tarball on the GitHub Release.
- **Get app on RPi:** Use a pre-built image (from a release) or manual install from `masjidconnect-display-<version>.tar.gz` + `deploy/install.sh`.
- **Test self-update:** Install an older version on the Pi, create a newer release (tag + push), then trigger **Force update** from the admin portal and watch the Footer for the update and countdown.
