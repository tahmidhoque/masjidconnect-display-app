---
name: release-and-deployment
description: Full release lifecycle for the display app — version bumps, packaging, git tags, GitHub Actions, OTA self-update to devices, deploying to a Raspberry Pi over SSH, rollback and installation verification. Use when asked to "cut a release", "bump the version", "hotfix", "roll back", "deploy to a Pi", "force update a device", or when debugging why a device didn't update.
---

# Release & Deployment

## When to use this skill

- Cutting a release (patch/minor/major) from master.
- Hotfixing a broken live release, or rolling a device back to an older version.
- Deploying a work-in-progress build to a test Raspberry Pi over SSH.
- Debugging OTA updates (FORCE_UPDATE), the update status UI, or a fresh Pi install.
- Verifying what version/env a device is actually running.
- Do NOT use for writing tests → see `testing-and-validation`.
- Do NOT use for backend deploys (Vercel/Fly.io) → see `masjidconnect-ecosystem`.

## Mental model

The app is a **Vite SPA packaged as an architecture-independent tarball** (HTML/CSS/JS + a plain Node server). There is no Electron, no `.deb`, no electron-updater — any doc mentioning those is legacy (see Gotchas).

- **On the Pi:** `/opt/masjidconnect/` contains `dist/`, `deploy/` and `package.json`. systemd `masjidconnect-display.service` runs `deploy/server.mjs` (serves `dist/` on port 3001, plus localhost-only `/internal/*` endpoints); `masjidconnect-kiosk.service` runs Chromium `--kiosk` at `localhost:3001`.
- **Packaging:** `scripts/package-release.sh` (`npm run package`) builds, writes `dist/version.json` (version, gitHash, gitBranch, buildTime, nodeVersion, and `buildEnv` with the baked `VITE_API_URL`/`VITE_REALTIME_URL`), then tars `dist/`, `deploy/`, `scripts/optimize-raspberry-pi.sh`, `scripts/install-fonts.sh` and `package.json` into `masjidconnect-display-<version>.tar.gz`.
- **CI:** `.github/workflows/build-and-release.yml`. Pushing a `v*` tag triggers: build job (npm test → lint → `npm run package` → verify `dist/version.json` buildEnv → validate archive), an RPi image job (skipped on tag pushes — image >3 GB; build locally with `rpi-image/build-image.sh`), and a release job that **fails if the tag doesn't match `package.json` version**, generates SHA256 checksums, extracts notes from `CHANGELOG.md` if one exists (the repo currently has none, so the workflow generates fallback notes), and publishes the GitHub Release. `.github/workflows/pr-checks.yml` gates PRs with lint/test/build.
- **OTA:** admin portal sends a `FORCE_UPDATE` command (WebSocket or heartbeat). `src/services/remoteControlService.ts` (`handleCommand`) POSTs to `http://localhost:3001/internal/trigger-update`; `deploy/server.mjs` spawns `sudo bash deploy/update-from-github.sh`, which downloads the **highest-semver full (non-pre-release) GitHub release** with a `masjidconnect-display-*.tar.gz` asset from `tahmidhoque/masjidconnect-display-app`, extracts it, and restarts. Progress phases (`checking → downloading → installing → countdown → done | no_update`) are written to `.update-status.json` and polled by the app via `GET /internal/update-status`.
- **Version source of truth:** `package.json` — bump only via `npm run version:bump:patch|minor|major` (they use `--no-git-tag-version`).

## Step-by-step workflows

### 1. Cut a release start-to-finish (the standard procedure)

Authoritative source: `.cursor/rules/git-branching-and-releases.mdc`. Recent real example: commit `d39eceb chore: release 1.10.4` on `master`, branch `release/1.10.4`, tag `v1.10.4`.

1. Be on `master`, clean working tree, up to date: `git checkout master && git pull`.
2. Verify the tree is releasable: `npm run lint && npm test && npm run build`.
3. Decide bump size from what changed since the last release (`git log $(git describe --tags --abbrev=0)..HEAD --oneline`): breaking → major, features → minor, fixes only → patch.
4. Bump (never edit `package.json` by hand):
   ```bash
   npm run version:bump:patch   # or :minor / :major
   ```
5. Commit the bump on master: `git add package.json && git commit -m "chore: release <version>"`.
6. Create the release branch (no `v` prefix): `git checkout -b release/<version>`.
7. Tag (with `v` prefix) and push both:
   ```bash
   git tag v<version>
   git push origin master release/<version> v<version>
   ```
8. Watch GitHub Actions (`build-and-release.yml`). The release job publishes the GitHub Release with `masjidconnect-display-<version>.tar.gz` + `.sha256`.
9. Verify: the Releases page shows `v<version>` with the tarball asset. Devices pick it up on their next update check or on FORCE_UPDATE from the admin portal.

Optional alternative for steps 4–7: `node scripts/create-release.js <version> [--dry-run|--skip-tests|--skip-changelog]` validates semver, requires a clean tree, runs `npm test`, updates `package.json` + `CHANGELOG.md`, commits and tags — you still push manually. Note: there is **no** `npm run release:create` script despite what `docs/RELEASE_PROCESS.md` says; invoke it with `node`.

### 2. Hotfix a live release

1. Branch from master: `git checkout master && git pull && git checkout -b bugfix/<name>`.
2. Fix, test (`npm run lint && npm test && npm run build`), merge to master via PR (`pr-checks.yml` must pass).
3. Cut a **patch** release exactly as in workflow 1. Devices self-update to the highest semver, so publishing the new release is what "ships" the fix.
4. If the broken release must be hidden immediately (before the fix lands), do workflow 3 first.

### 3. Roll back a bad release

Two levels — fleet-wide and single device:

**Fleet-wide (stop devices updating to it):**
1. `node scripts/rollback-release.js <bad-version> --reason="what broke"` — prints the manual steps; the key one is marking the GitHub Release as a **pre-release**, because `deploy/update-from-github.sh` and `deploy/install-release.sh` only consider full releases with a tarball asset.
2. Do it: GitHub → Releases → the bad tag → Edit → tick "Set as a pre-release" → save.
3. Ship a replacement: `node scripts/rollback-release.js <bad-version> --create-patch --reason="..."` bumps the patch version and updates `CHANGELOG.md`; then commit, tag and push as in workflow 1 (or just run workflow 1 normally).

**Single device (install an older version now):** SSH to the Pi, then:
```bash
sudo /opt/masjidconnect/deploy/install-release.sh          # list available releases
sudo /opt/masjidconnect/deploy/install-release.sh 1.10.3   # install that version
sudo /opt/masjidconnect/deploy/install-release.sh latest   # highest semver
```
Note: a later FORCE_UPDATE will re-upgrade the device to the highest published release — depublish the bad release (above) or the rollback won't stick.

### 4. Deploy a local build to a test Pi (no release needed)

```bash
./scripts/deploy-via-ssh.sh pi@192.168.1.10                # build + push dist/
PI_HOST=pi@rpi.local ./scripts/deploy-via-ssh.sh --skip-build      # reuse existing dist/
./scripts/deploy-via-ssh.sh pi@rpi.local --deploy-scripts --restart-kiosk
```
Flags: `--skip-build` (use existing `dist/`), `--deploy-scripts` (also sync `deploy/` — needed when you changed `server.mjs`, `kiosk.sh`, update scripts or systemd units), `--restart-kiosk` (restart Chromium, not just the Node server). Requires the app already installed at `/opt/masjidconnect`. If the Pi was reimaged on the same IP: `ssh-keygen -R <host>` first.

For a **fresh install**: copy and extract the release tarball, then run the installer (it checks Node 18+, installs Chromium/unclutter if missing, installs and enables both systemd units):
```bash
scp masjidconnect-display-<version>.tar.gz pi@<ip>:~/
ssh pi@<ip>
sudo mkdir -p /opt/masjidconnect && sudo tar -xzf masjidconnect-display-<version>.tar.gz -C /opt/masjidconnect
sudo /opt/masjidconnect/deploy/install.sh
```
One-off Pi tuning (CPU governor, swappiness, GPU memory, KMS driver, HDMI): `sudo bash scripts/optimize-raspberry-pi.sh`. Full flashable images are built from `rpi-image/` (`rpi-image/build-image.sh`).

### 5. Verify an installation / debug an update

On the Pi (or over SSH):
```bash
curl -s http://localhost:3001/health            # { "status": "ok", "uptime": ... }
cat /opt/masjidconnect/dist/version.json        # version, gitHash, buildEnv.apiUrl/realtimeUrl
systemctl status masjidconnect-display masjidconnect-kiosk
journalctl -u masjidconnect-display -f          # server logs
curl -s http://localhost:3001/internal/update-status   # last update phase (204 if never run)
cat /tmp/masjidconnect-update-debug.log         # update script debug log
sudo bash /opt/masjidconnect/deploy/update-from-github.sh   # run an update by hand
```
Also check `curl -s http://localhost:3001/internal/debug` (localhost only) for server-side state. `dist/version.json.buildEnv` tells you which API/realtime URLs were baked in at build time — an empty `apiUrl` means the build ran without `VITE_API_URL` exported.

## Gotchas & failure modes

- **Stale docs — the biggest trap.** `docs/RELEASE_PROCESS.md`, `docs/VERSION_MANAGEMENT.md` (OTA sections), `docs/OTA_AND_REMOTE_CONTROL_IMPLEMENTATION_SUMMARY.md`, `docs/INSTALLATION_VERIFICATION.md`, `docs/README-RASPBERRY-PI.md`, `docs/RPI-GETTING-STARTED.md` and `docs/quick-setup-rpi.md` describe the **old Electron/.deb/electron-updater architecture** and scripts that no longer exist (`npm run release:create`, `npm run rpi:build`, `build-rpi-package.sh`). Current truth: this skill, `.cursor/rules/deployment-raspberry-pi.mdc`, and `docs/RPI_RELEASE_AND_UPDATE_TESTING.md` (which is up to date).
- **Symptom:** release job fails with "Tag version does not match package.json". **Cause:** tagged before committing the bump, or bumped after tagging. **Fix:** delete the tag (`git tag -d v<x>`; `git push origin :refs/tags/v<x>` if pushed), commit the bump, re-tag.
- **Symptom:** tag pushed but no GitHub Release. **Cause:** tag doesn't match `v*` (e.g. `1.2.3` without prefix), or the build job failed tests/lint first. **Fix:** check the Actions run; re-tag as `v<version>`.
- **Symptom:** device says "Up to date" after FORCE_UPDATE despite a newer release existing. **Causes:** the release has no `masjidconnect-display-*.tar.gz` asset (the update script filters on it); the release is marked pre-release; GitHub API unreachable from the Pi; or a private-repo token missing (`GITHUB_TOKEN` env or `/opt/masjidconnect/.github-token`). **Fix:** check the release assets, then `/tmp/masjidconnect-update-debug.log` on the device.
- **Symptom:** device updated but points at the wrong backend. **Cause:** `VITE_API_URL`/`VITE_REALTIME_URL` are baked at **build time** by Vite — a tarball built locally without env exported ships empty/localhost URLs. **Fix:** check `dist/version.json.buildEnv`; rely on CI builds (the workflow injects secrets with production defaults) for anything that ships to devices.
- **Symptom:** rolled a device back with `install-release.sh` but it upgraded itself again. **Cause:** update flow always installs the highest-semver published release. **Fix:** depublish/pre-release the bad version on GitHub first.
- **Symptom:** changed `deploy/server.mjs` or `deploy/update-from-github.sh` but the Pi behaves the same. **Cause:** `deploy-via-ssh.sh` only syncs `dist/` by default. **Fix:** re-run with `--deploy-scripts`.
- **Symptom:** update appears stuck at `checking`. **Cause:** `server.mjs` writes `{"phase":"checking"}` to `.update-status.json` before spawning the script; if `sudo` needs a password non-interactively the spawn dies silently. **Fix:** the Pi image grants passwordless sudo for the update script via `/etc/sudoers.d/99-masjidconnect-update` (written by `rpi-image/layer/masjidconnect-display.yaml`); on a hand-built Pi add an equivalent sudoers rule, or run the update script manually to see the error.
- **Ordering constraint:** cross-repo changes must ship **backend first, display second** — devices in the field update slowly. See `masjidconnect-ecosystem` before releasing anything that depends on a backend change.
- **Timing:** avoid releasing during prayer times (screens restart mid-update countdown) and avoid Friday releases (Jumu'ah + weekend).

## Validation

```bash
npm run lint && npm test && npm run build     # pre-release gate
npm run package                                # produces masjidconnect-display-<version>.tar.gz
tar -tzf masjidconnect-display-*.tar.gz | head # archive contains dist/, deploy/, package.json
node -e "console.log(require('./dist/version.json'))"   # after package: check version + buildEnv
node scripts/create-release.js <version> --dry-run       # sanity-check a version string
```
After tagging: GitHub Actions run green; Releases page has the tarball + `.sha256`. After deploying to a Pi: `curl http://<pi>:3001/health` from the LAN, and confirm the version shown in the app footer / `dist/version.json`.

## Related

- Sibling skills: `testing-and-validation` (release gate), `masjidconnect-ecosystem` (backend-first ordering), `debugging-runtime-issues` (device misbehaving after update).
- Current docs: `docs/RPI_RELEASE_AND_UPDATE_TESTING.md`, `.cursor/rules/deployment-raspberry-pi.mdc`, `.cursor/rules/git-branching-and-releases.mdc`, `rpi-image/README.md`.
- Key files: `scripts/package-release.sh`, `scripts/create-release.js`, `scripts/rollback-release.js`, `scripts/deploy-via-ssh.sh`, `scripts/optimize-raspberry-pi.sh`, `deploy/server.mjs`, `deploy/update-from-github.sh`, `deploy/install.sh`, `deploy/install-release.sh`, `deploy/wifi-setup-server.mjs` (WiFi onboarding UI, port 3002 local / port 80 AP mode; dev: `npm run wifi-setup:dev`), `.github/workflows/build-and-release.yml`, `.github/workflows/pr-checks.yml`.
