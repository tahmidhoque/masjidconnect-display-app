# MasjidConnect Display App

A digital signage application for mosques to display prayer times, announcements, events, and emergency alerts on Raspberry Pi devices running Chromium in kiosk mode.

## Overview

The MasjidConnect Display App is designed to run on screens throughout a mosque to provide real-time information to worshippers. It features:

- Prayer times display with countdown to next prayer
- Announcements and events
- Islamic content (verses, hadiths, etc.)
- Support for both landscape and portrait orientations
- Offline-first functionality
- Emergency alerts (full-screen overlay)

## Key Features

- **Display-only**: No user input required; designed for digital signage. Pairing is done once via QR code.
- **Responsive design**: Adapts to different screen sizes and orientations.
- **Offline support**: Continues to function using cached data when connectivity is lost.
- **Real-time updates**: Syncs with the MasjidConnect management system over WebSocket when online.

## Technical Stack

- **Runtime**: Vite SPA served by a Node.js static server, displayed in Chromium kiosk mode (no Electron).
- **Stack**: React 18, TypeScript 5, Vite 7, Tailwind CSS v4, Redux Toolkit, PWA (Workbox).
- **Target**: Raspberry Pi 4/5 — performance-critical, offline-first, 24/7 operation.

## Getting Started

### Prerequisites

- Node.js 20 LTS
- npm 10.x or higher

### Development

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set `VITE_API_URL` if needed (defaults to production API).

3. Start the development server:

   ```bash
   npm run dev
   ```

   The app runs at http://localhost:3001.

### Building for Production

```bash
npm run build
```

This runs TypeScript check and Vite build; output is in `dist/`.

### Packaging for Deployment

To create a release archive for Raspberry Pi:

```bash
npm run package
```

This builds the app, writes `dist/version.json`, and creates `masjidconnect-display-<version>.tar.gz` containing `dist/`, `deploy/`, helper scripts, and `package.json`. The archive is architecture-independent (HTML/CSS/JS + Node.js server).

To package without rebuilding (requires existing `dist/`):

```bash
npm run package:only
```

## Environment Variables

Configuration is baked in at build time via Vite. Use `VITE_`-prefixed variables.

| Variable           | Required | Default                               | Purpose                    |
|--------------------|----------|----------------------------------------|----------------------------|
| `VITE_API_URL`     | Production | `https://portal.masjidconnect.co.uk` | API base URL               |
| `VITE_REALTIME_URL` | No      | `https://masjidconnect-realtime.fly.dev` | WebSocket server URL   |
| `PORT`             | Deploy     | `3001`                              | Static server port         |

Copy `.env.example` to `.env` and set values as needed. For CI, set `VITE_API_URL` (and optionally `VITE_REALTIME_URL`) as GitHub Secrets.

## Deployment

The app is deployed as a **tar.gz archive** on Raspberry Pi: no .deb, no Electron. Flow:

1. **CI/CD**: On push/tag, GitHub Actions runs `npm run package`, uploads the `.tar.gz`, and creates a GitHub Release with SHA256 checksums.
2. **RPi**: Download the release, extract to `/opt/masjidconnect`, run `deploy/install.sh` to install Chromium (if needed), systemd services, and start the display.

---

## Raspberry Pi Deployment

### Architecture

- **Node.js server** (`deploy/server.mjs`) serves `dist/` on http://localhost:3001.
- **Chromium** runs in kiosk mode and points at that URL.
- Both are managed by systemd; the kiosk service starts after the display server is ready.

### Prerequisites

- Raspberry Pi 4 or 5 running **Raspberry Pi OS (Bookworm)** with desktop (for Chromium).
- Node.js 20 LTS installed.
- Internet connection for initial setup.

### Installation Steps

**1. Install Node.js 20** (if not already installed):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**2. Download the latest release** (replace `1.0.0` with the actual version):

```bash
VERSION="1.0.0"
wget https://github.com/masjidSolutions/masjidconnect-display-app/releases/download/v${VERSION}/masjidconnect-display-${VERSION}.tar.gz
```

**3. Extract**:

```bash
sudo mkdir -p /opt/masjidconnect
sudo tar -xzf masjidconnect-display-${VERSION}.tar.gz -C /opt/masjidconnect --strip-components=1
```

**4. Run the installer**:

```bash
sudo /opt/masjidconnect/deploy/install.sh
```

This installs Chromium and `unclutter` if missing, copies files, sets up systemd services, and starts the display server and kiosk.

**5. Optimise the Pi** (optional but recommended):

```bash
sudo bash /opt/masjidconnect/scripts/optimize-raspberry-pi.sh
sudo reboot
```

**6. Verify**:

```bash
systemctl status masjidconnect-display
systemctl status masjidconnect-kiosk
curl http://localhost:3001/health
```

### Updating an Existing Installation

```bash
VERSION="1.1.0"   # Replace with new version
wget https://github.com/masjidSolutions/masjidconnect-display-app/releases/download/v${VERSION}/masjidconnect-display-${VERSION}.tar.gz
sudo systemctl stop masjidconnect-kiosk masjidconnect-display
sudo tar -xzf masjidconnect-display-${VERSION}.tar.gz -C /opt/masjidconnect --strip-components=1
sudo systemctl start masjidconnect-display masjidconnect-kiosk
```

### Managing Services

```bash
systemctl status masjidconnect-display
systemctl status masjidconnect-kiosk
journalctl -u masjidconnect-display -f
```

### RPi Optimisation Script

`scripts/optimize-raspberry-pi.sh` configures:

- CPU governor: `performance`
- `vm.swappiness`: 10
- GPU memory: 128 MB
- VC4 KMS V3D graphics driver
- HDMI: 1080p 60 Hz

Run with `sudo`; a reboot is recommended after running.

---

## Offline Capabilities

- **Service worker (Workbox)**: Caches static assets, API responses, and critical resources; NetworkFirst for API, CacheFirst for images/fonts.
- **LocalForage**: API data cached in IndexedDB with localStorage fallback.
- **Prayer timing**: Local calculation when offline; device clock used for countdown.
- **Redux Persist**: Auth, content, and emergency state survive restarts.

---

## License

This project is proprietary software owned by MasjidConnect.

## Contact

For support or inquiries, contact support@masjidconnect.co.uk
