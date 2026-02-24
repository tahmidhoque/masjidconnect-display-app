# MasjidConnect Display — rpi-image-gen

Build a **bootable Raspberry Pi image** with the MasjidConnect Display App pre-installed. Flash the image to an SD card and boot — no manual install steps on the Pi.

The image targets **Raspberry Pi 5** (and Pi 4). Boot is configured for: **no RPI branding or splash** (early GPU splash disabled, black Plymouth splash by default), **silent boot** (no console text on the display; kernel/init output is on a different VT), and **direct launch into full-screen kiosk** (X11 + Chromium; no desktop GUI).

Uses [rpi-image-gen](https://github.com/raspberrypi/rpi-image-gen) (official Raspberry Pi image builder). The image runs the app under **X11** (Xorg + xinit) + Chromium in kiosk mode; no full desktop or Wayland.

## Requirements

- **Build host**: Raspberry Pi (4 or 5) running **64-bit Raspberry Pi OS** (Bookworm or Trixie), or a Debian Bookworm/Trixie arm64 machine with [rpi-image-gen dependencies](https://github.com/raspberrypi/rpi-image-gen#dependencies) installed.
- **Network** on the build host (for NodeSource and packages).
- **rpi-image-gen** cloned and its `install_deps.sh` run (see below).

## CI-built image

On every push and on release tags, GitHub Actions builds the app and then builds an RPi image. You can:

- **From a workflow run**: Actions → select the run → Artifacts → download `masjidconnect-display-image` (contains `masjidconnect-display.img` and its SHA256).
- **From a release**: When you create a release (tag `v*` or workflow_dispatch), the release includes `masjidconnect-display.img` and `masjidconnect-display.img.sha256`. Flash the `.img` with Etcher or Raspberry Pi Imager ("Use custom"). The image has built-in default SSH credentials (user **pi**, password **masjidconnect**) because Pi Imager cannot apply OS customisation to custom images.

No need to build the image yourself unless you want to customise the layer, build for **Raspberry Pi 3**, use a **custom splash/background**, or avoid uploading the image via GitHub (e.g. artifact size limits on free tier).

---

## Building with Docker (recommended if not using GH artifacts)

If the GitHub Actions–built image is too large to download (e.g. free tier limits), build the image locally with Docker. This works on amd64 (with QEMU) or arm64.

**Prerequisites**: Docker installed, enough disk for the build (several GB).

From the **repo root**:

```bash
chmod +x rpi-image/build-image.sh
./rpi-image/build-image.sh          # Pi 3 image (default)
./rpi-image/build-image.sh pi4       # Pi 4/5 image
./rpi-image/build-image.sh pi3 --skip-package   # Pi 3, reuse existing app archive
```

The script builds the app archive if needed, builds the Docker image (rpi-image-gen + deps), then runs the image build. Output: **`rpi-image/out/masjidconnect-display.img`**. Flash with Etcher or Raspberry Pi Imager ("Use custom").

---

## Building for Raspberry Pi 3

Use the Pi 3 config so the image targets Pi 3 (arm64) instead of Pi 5.

**Local (rpi-image-gen on host):**  
`./rpi-image-gen build -S /path/to/masjidconnect-display-app/rpi-image -c config/masjidconnect-pi3.yaml`

**Docker:**  
`./rpi-image/build-image.sh pi3`

---

## Custom boot splash and background image

- **Boot splash**: A **black splash** is included by default (`rpi-image/assets/splash.png`) so the image has no RPI branding on boot. Replace it with your own **`rpi-image/assets/splash.png`** to use a custom Plymouth boot image; it is installed into the Plymouth pix theme.
- **Background image** (optional): Place **`rpi-image/assets/background.png`** to copy it to `/opt/masjidconnect/background.png` in the image (e.g. for in-app use). Use PNG; recommended size matches your display (e.g. 1920×1080).

---

## Quick start (local build)

### 1. Build the app and create the archive

From the **masjidconnect-display-app** repo root:

```bash
npm run package
```

This produces `masjidconnect-display-<version>.tar.gz` in the project root.

### 2. Place the archive for the image build

Copy the archive into the rpi-image app directory (create it if needed):

```bash
mkdir -p rpi-image/app
cp masjidconnect-display-*.tar.gz rpi-image/app/masjidconnect-display.tar.gz
```

So the image build expects: `rpi-image/app/masjidconnect-display.tar.gz`.

### 3. Clone and prepare rpi-image-gen

On your build host (e.g. a Raspberry Pi):

```bash
git clone https://github.com/raspberrypi/rpi-image-gen.git
cd rpi-image-gen
sudo ./install_deps.sh
```

### 4. Build the image

Point rpi-image-gen at this repo’s **rpi-image** directory and use the MasjidConnect config:

```bash
# From the rpi-image-gen clone
./rpi-image-gen build -S /path/to/masjidconnect-display-app/rpi-image -c config/masjidconnect.yaml
```

Example if both repos are under the same parent:

```bash
./rpi-image-gen build -S ../masjidconnect-display-app/rpi-image -c config/masjidconnect.yaml
```

The image will be under `./work/` (exact path depends on image name; look for a `.img` file).

### 5. Flash the SD card

Use [Raspberry Pi Imager](https://www.raspberrypi.com/software/):

- **“Use custom”** and select the generated `.img` file.
- **Note:** When flashing a **custom image** (our `.img`), Pi Imager does **not** offer OS customisation (gear icon); that only applies to official Raspberry Pi OS images. The MasjidConnect image is built with **default SSH credentials** so you can always log in: username is the first user (usually **`pi`**), password **`masjidconnect`**. Change the password after first login: `ssh pi@<rpi-ip>`, then run `passwd`.
- If you flash an **official** Raspberry Pi OS image and then install the app manually, you can use OS customisation to set a user and password before writing.
- Alternatively, flash from the command line:

```bash
sudo rpi-imager --cli /path/to/work/.../masjidconnect-display.img /dev/mmcblk0
```

Replace `/dev/mmcblk0` with your SD block device (e.g. on Mac, the device might be `disk2` — use the correct path for your OS).

### 6. Boot the Pi

Insert the SD card, power on, and connect to the same network (e.g. Ethernet). The app should start automatically: Node server on port 3001, then X11 (xinit) + Chromium in kiosk mode. Pair the screen via the MasjidConnect portal as usual.

---

## What the image contains

- **Base**: Minimal Raspberry Pi OS (Bookworm) from rpi-image-gen’s `bookworm-minbase`.
- **Layer `masjidconnect-display`**:
  - Node.js 20 (from NodeSource)
  - Chromium, X11 (xserver-xorg, xinit, x11-xserver-utils), unclutter, curl
  - App at `/opt/masjidconnect` (from your `masjidconnect-display-*.tar.gz`), including `deploy/xinitrc-kiosk` for the X11 kiosk client
  - Boot config: `disable_splash=1` in `config.txt`; `quiet`, `loglevel=0`, `logo.nologo`, `console=tty2` in `cmdline.txt` (silent boot, no text on display); default black Plymouth splash (no RPI branding).
  - systemd units:
    - `masjidconnect-display.service` — Node server (`deploy/server.mjs`) on port 3001
    - `masjidconnect-kiosk.service` — installed but **not enabled**; kiosk starts via **console autologin** instead (see below).
  - **Kiosk startup**: getty on tty1 uses an autologin drop-in for the first user (UID 1000). That user’s `~/.profile` runs the X11 kiosk script only when the TTY is `/dev/tty1`, so the session owns the VT and Xorg can open it. SSH logins do not start the kiosk.
  - Default SSH login: first user (usually **pi**), password **masjidconnect** (set at build time so custom images work without Pi Imager OS customisation).

No full desktop; kiosk runs under minimal X11 (Xorg + xinit + Chromium).

---

## Overriding the app archive path

If the tar.gz is not at `rpi-image/app/masjidconnect-display.tar.gz`, pass the path when building:

```bash
./rpi-image-gen build -S /path/to/masjidconnect-display-app/rpi-image -c config/masjidconnect.yaml -- IGconf_masjidconnect_app_archive=/abs/path/to/masjidconnect-display-1.0.0.tar.gz
```

---

## Troubleshooting

- **Default SSH credentials (custom image)**  
  When you flash the **MasjidConnect custom .img** with Pi Imager, OS customisation is not available (it only applies to official RPi OS images). The image is built with a known default so you can always SSH in: username **`pi`** (the first user from the base), password **`masjidconnect`**. Run `ssh pi@<rpi-ip>` and change the password after first login with `passwd`.

- **“App archive not found”**  
  Ensure the tar.gz exists at `rpi-image/app/masjidconnect-display.tar.gz` or set `IGconf_masjidconnect_app_archive` (see above).

- **Node.js not installed in image**  
  The layer installs Node 20 from NodeSource in a hook; the build host must have network. If it fails, the hook is non-fatal (`|| true`); check the build log and ensure `curl` and network work from the chroot.

- **No display / black screen**  
  Confirm the Pi has a display connected and that the X11 kiosk and Chromium start:  
  `journalctl -u masjidconnect-kiosk -f` and `journalctl -u masjidconnect-display -f`.  
  Older images used Cage (Wayland), which fails on RPi with a fleeting “Failed to query DRI3 DRM FD” error and a black screen; the image now uses X11 (xinit + Chromium) instead. To capture boot errors (e.g. if something fails before the kiosk starts), you can enable a serial console or temporarily remove `quiet` and `loglevel=0` from `cmdline.txt` on the flashed SD (first partition)   so kernel and service messages stay visible.

- **`xf86OpenConsole: Cannot open virtual console 1 (Operation not permitted)`**  
  On an **already-flashed Pi** (old image), use the scripts in `rpi-image/scripts/` to enable autologin and run the kiosk from .profile without reflashing (see **Apply autologin on an already-flashed Pi** below).

- **tty1 asks for a password / "No such file or directory" for start-kiosk-x11.sh**  
  If the image was built from an older archive or SRCROOT was not set during build, getty may not have autologin and the kiosk script may be missing. Use the **SSH fix** (see **Fix kiosk via SSH (no reflash)** below) to copy the deploy scripts and apply autologin without rebuilding the image.

- **Xorg "Cannot run in framebuffer mode. Please specify busIDs for all framebuffer devices"**  
  On Raspberry Pi 4/5 with vc4 KMS, Xorg can fail to start without an explicit OutputClass for the display. Apply the **Xorg vc4 fix** (see **Fix kiosk via SSH** or **Xorg framebuffer fix** below) or rebuild the image (the layer now installs `/etc/X11/xorg.conf.d/99-vc4.conf`).

- **Display shows boot log (e.g. "Starting plymouth-quit...") instead of kiosk**  
  The image sets `console=tty2` so kernel output goes to tty2; on RPi the display can stay on that console so you see the boot log. **Fix:** remove `console=tty2` from the kernel command line so the display shows tty1 (getty and kiosk). Run the apply script again (it now does this in step 7), or on the Pi run:  
  `sudo sed -i 's/ console=tty2//g' /boot/firmware/cmdline.txt` (or `/boot/cmdline.txt` if that is what exists), then `sudo reboot`.

- **`openvt: Couldn't get a file descriptor referring to the console`**  
  The kiosk no longer runs as a systemd service by default; it runs from console autologin. If you enabled `masjidconnect-kiosk.service` and see this, disable it (`sudo systemctl disable --now masjidconnect-kiosk`) and rely on autologin + .profile instead.

- **Custom username in Pi Imager (e.g. mcadmin)**
  The display and kiosk services run as **UID 1000** (the first user). If you set a custom username in Pi Imager’s OS customisation, that user gets UID 1000 and the app runs as them; a setup step at boot adds that user to the `render`, `video`, and `tty` groups for GPU and console access. No extra config needed.

- **Base layer / user “pi”**  
  The layer declares a dependency on `rpi-user-credentials`; the included base config should provide it. If your base does not create user `pi`, adjust the layer or config (e.g. set `IGconf_device_user1` to your user).

---

## Fix kiosk via SSH (no reflash)

If you see **tty1 asking for a password** or **missing `/opt/masjidconnect/deploy/start-kiosk-x11.sh`** (e.g. "No such file or directory") after flashing, you can fix the running Pi over SSH without rebuilding the image.

**From your dev machine** (with this repo cloned):

```bash
cd rpi-image/scripts
chmod +x fix-kiosk-via-ssh.sh
./fix-kiosk-via-ssh.sh pi@<rpi-ip>
```

This script: (1) copies `start-kiosk-x11.sh`, `start-kiosk-now.sh`, and `xinitrc-kiosk` into `/opt/masjidconnect/deploy/` on the Pi; (2) applies getty autologin and the kiosk line in `~/.profile` (same as `apply-kiosk-autologin.sh`); (3) offers to reboot. Use the Pi's IP (e.g. `pi@192.168.1.10`). Default SSH: user **pi**, password **masjidconnect**.

**Manual alternative:** copy the three deploy scripts to `/opt/masjidconnect/deploy/` on the Pi with `chmod +x`, then run `apply-kiosk-autologin.sh` on the Pi and reboot.

**Xorg framebuffer fix only (Pi 4/5):** If X starts but fails with "Cannot run in framebuffer mode", create the vc4 config on the Pi:

```bash
sudo mkdir -p /etc/X11/xorg.conf.d
sudo tee /etc/X11/xorg.conf.d/99-vc4.conf << 'EOF'
Section "OutputClass"
  Identifier "vc4"
  MatchDriver "vc4"
  Driver "modesetting"
  Option "PrimaryGPU" "true"
EndSection
EOF
sudo reboot
```

Or from your dev machine (repo cloned): run `./fix-kiosk-via-ssh.sh pi@<rpi-ip>` — it now also installs this Xorg config.

---

## Apply autologin on an already-flashed Pi

If you flashed an image **before** the autologin + .profile kiosk change, you can fix the **`xf86OpenConsole: Cannot open virtual console 1 (Operation not permitted)`** error without reflashing.

**If `/opt/masjidconnect/deploy/start-kiosk-x11.sh` is missing**, use **Fix kiosk via SSH (no reflash)** above instead.

**Option A — from your dev machine (SSH):**

```bash
cd rpi-image/scripts
./apply-kiosk-autologin-remote.sh pi@<rpi-ip>
```

Prompts to reboot the Pi when done.

**Option B — on the Pi:**

Copy `rpi-image/scripts/apply-kiosk-autologin.sh` to the Pi, then:

```bash
chmod +x apply-kiosk-autologin.sh
sudo ./apply-kiosk-autologin.sh
sudo reboot
```

The script: enables getty autologin on tty1 for UID 1000, appends the kiosk start to that user's `~/.profile` (only when TTY is tty1), disables `masjidconnect-kiosk.service`, and runs `daemon-reload`.

---

## Quick fix: show the kiosk from SSH (no reboot)

If the display is stuck on the boot log or blank and you want to see the kiosk **right now** without debugging autologin/console:

**Option 1 — Physical console (most reliable)**  
At the Pi (keyboard + monitor): press **Ctrl+Alt+F1** to get to tty1. Log in as your user (e.g. `pi` / `masjidconnect`). Then run **as root** (Xorg needs root to open the VT on this setup):

```bash
sudo /opt/masjidconnect/deploy/start-kiosk-x11.sh
```

The display is already on tty1; Chromium will run as your user. If you run it without `sudo`, you may see “Cannot open virtual console 1 (Permission denied)” in the X log.

**Option 2 — From SSH**  
SSH in and run:

```bash
sudo systemctl start masjidconnect-display.service
sleep 2
sudo chvt 1
U=$(getent passwd 1000 | cut -d: -f1)
H=$(getent passwd 1000 | cut -d: -f6)
sudo openvt -c 1 -s -- sudo -u "$U" env HOME="$H" /opt/masjidconnect/deploy/start-kiosk-x11.sh
```

If `openvt` errors with "Couldn't get a file descriptor referring to the console", use **Option 1** (physical console, with `sudo`) instead.  
If you get **"Cannot open virtual console 1 (Permission denied)"** in the X log, run the script **as root** (e.g. from console: `sudo /opt/masjidconnect/deploy/start-kiosk-x11.sh`).

(After the next app deploy, you can run `sudo /opt/masjidconnect/deploy/start-kiosk-now.sh` from SSH to do the same as Option 2.)

---

## Files in this directory

| Path | Purpose |
|------|--------|
| `config/masjidconnect.yaml` | rpi-image-gen config: Pi 4/5, base image + MasjidConnect layer. |
| `config/masjidconnect-pi3.yaml` | Same as above but for **Raspberry Pi 3** (`device.layer: rpi3`). |
| `layer/masjidconnect-display.yaml` | Layer: packages (Chromium, X11, Plymouth), NodeSource hook, extract app, custom splash/background, systemd units. |
| `layer/kiosk-x11.service.tpl` | X11 kiosk systemd unit (installed but not enabled; kiosk runs via autologin). |
| `layer/getty@tty1.service.d/autologin.conf.tpl` | Template for getty autologin on tty1 (username substituted at build). |
| `layer/xorg.conf.d/99-vc4.conf` | Xorg OutputClass for vc4 (fixes "Cannot run in framebuffer mode" on Pi 4/5). |
| `layer/masjidconnect-kiosk-setup.service` | Oneshot: adds UID 1000 user to render/video/tty at boot for GPU and console access. |
| `layer/masjidconnect-console-vt1.service` | Oneshot: runs `chvt 1` after Plymouth so the display shows tty1 (kiosk) not kernel log (tty2). |
| `assets/splash.png` | Default black boot splash (Plymouth); replace for custom splash. |
| `assets/background.png` | Optional background image (copied to `/opt/masjidconnect/background.png`). |
| `app/` | Put `masjidconnect-display.tar.gz` here (or set `IGconf_masjidconnect_app_archive`). |
| `Dockerfile` | Docker image with rpi-image-gen + deps for local image builds. |
| `build-image.sh` | Script to build the RPi image via Docker (Pi 3 or Pi 4/5). |
| `scripts/apply-kiosk-autologin.sh` | On-Pi script: enable getty autologin on tty1, append kiosk to ~/.profile, disable kiosk service. Run with sudo. |
| `scripts/apply-kiosk-autologin-remote.sh` | From dev machine: copy and run apply-kiosk-autologin.sh on a Pi via SSH. |
| `scripts/fix-kiosk-via-ssh.sh` | From dev machine: copy deploy scripts to Pi and apply autologin (use when script is missing or tty1 asks for password). |
| `entrypoint.sh` | Docker entrypoint: runs rpi-image-gen and copies `.img` to output dir. |
| `out/` | Docker build output directory (generated; contains `masjidconnect-display.img`). |
