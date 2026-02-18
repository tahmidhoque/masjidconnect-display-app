# MasjidConnect Display — rpi-image-gen

Build a **bootable Raspberry Pi image** with the MasjidConnect Display App pre-installed. Flash the image to an SD card and boot — no manual install steps on the Pi.

Uses [rpi-image-gen](https://github.com/raspberrypi/rpi-image-gen) (official Raspberry Pi image builder). The image runs the app under **Cage** (Wayland kiosk) + Chromium; no full desktop or X11 required.

## Requirements

- **Build host**: Raspberry Pi (4 or 5) running **64-bit Raspberry Pi OS** (Bookworm or Trixie), or a Debian Bookworm/Trixie arm64 machine with [rpi-image-gen dependencies](https://github.com/raspberrypi/rpi-image-gen#dependencies) installed.
- **Network** on the build host (for NodeSource and packages).
- **rpi-image-gen** cloned and its `install_deps.sh` run (see below).

## CI-built image

On every push and on release tags, GitHub Actions builds the app and then builds an RPi image. You can:

- **From a workflow run**: Actions → select the run → Artifacts → download `masjidconnect-display-image` (contains `masjidconnect-display.img` and its SHA256).
- **From a release**: When you create a release (tag `v*` or workflow_dispatch), the release includes `masjidconnect-display.img` and `masjidconnect-display.img.sha256`. Flash the `.img` with Etcher or Raspberry Pi Imager ("Use custom").

No need to build the image yourself unless you want to customise the layer or build locally.

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

- **“Use custom”** and select the generated `.img` file,  
  or from the command line:

```bash
sudo rpi-imager --cli /path/to/work/.../masjidconnect-display.img /dev/mmcblk0
```

Replace `/dev/mmcblk0` with your SD block device (e.g. on Mac, the device might be `disk2` — use the correct path for your OS).

### 6. Boot the Pi

Insert the SD card, power on, and connect to the same network (e.g. Ethernet). The app should start automatically: Node server on port 3001, then Cage + Chromium in kiosk mode. Pair the screen via the MasjidConnect portal as usual.

---

## What the image contains

- **Base**: Minimal Raspberry Pi OS (Bookworm) from rpi-image-gen’s `bookworm-minbase`.
- **Layer `masjidconnect-display`**:
  - Node.js 20 (from NodeSource)
  - Chromium, Cage, curl
  - App at `/opt/masjidconnect` (from your `masjidconnect-display-*.tar.gz`)
  - systemd units:
    - `masjidconnect-display.service` — Node server (`deploy/server.mjs`) on port 3001
    - `masjidconnect-kiosk.service` — Cage + Chromium in kiosk mode on `http://localhost:3001`

No X11 or full desktop; kiosk runs under Wayland (Cage).

---

## Overriding the app archive path

If the tar.gz is not at `rpi-image/app/masjidconnect-display.tar.gz`, pass the path when building:

```bash
./rpi-image-gen build -S /path/to/masjidconnect-display-app/rpi-image -c config/masjidconnect.yaml -- IGconf_masjidconnect_app_archive=/abs/path/to/masjidconnect-display-1.0.0.tar.gz
```

---

## Troubleshooting

- **“App archive not found”**  
  Ensure the tar.gz exists at `rpi-image/app/masjidconnect-display.tar.gz` or set `IGconf_masjidconnect_app_archive` (see above).

- **Node.js not installed in image**  
  The layer installs Node 20 from NodeSource in a hook; the build host must have network. If it fails, the hook is non-fatal (`|| true`); check the build log and ensure `curl` and network work from the chroot.

- **No display / black screen**  
  Confirm the Pi has a display connected and that Cage/Chromium start:  
  `journalctl -u masjidconnect-kiosk -f` and `journalctl -u masjidconnect-display -f`.

- **Base layer / user “pi”**  
  The layer declares a dependency on `rpi-user-credentials`; the included base config should provide it. If your base does not create user `pi`, adjust the layer or config (e.g. set `IGconf_device_user1` to your user).

---

## Files in this directory

| Path | Purpose |
|------|--------|
| `config/masjidconnect.yaml` | rpi-image-gen config: base image + MasjidConnect layer, image name, app archive path. |
| `layer/masjidconnect-display.yaml` | Layer: packages (Chromium, Cage, curl), NodeSource hook, extract app, install and enable systemd units. |
| `layer/kiosk-cage.service.tpl` | Template for the Cage-based kiosk systemd unit (substitutes `KIOSK_USER`). |
| `app/` | Put `masjidconnect-display.tar.gz` here (or set `IGconf_masjidconnect_app_archive`). |
