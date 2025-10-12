# Installation Verification Guide

## Package Details

**Package Name:** `masjidconnect-display-0.0.1-arm64.deb`  
**Size:** ~94 MB  
**Architecture:** ARM64 (Raspberry Pi 4+)  
**Version:** 0.0.1

## Fixed Issues

### 1. ✅ **Product Name Configuration**

- **Problem:** `productName` had a space ("MasjidConnect Display") causing electron-builder to install to an inconsistent location
- **Solution:** Changed to `productName: "masjidconnect-display"` (no space)
- **Result:** Consistent installation to `/opt/masjidconnect-display/`

### 2. ✅ **After-Install Script Error Handling**

- **Problem:** Script was failing on permission errors and missing files
- **Solution:**
  - Added `set +e` to continue on non-critical errors
  - Added existence checks before operations
  - Made all chmod/mkdir operations non-fatal
  - Fallback log location: `/tmp/masjidconnect-install.log` if `/var/log` not writable
- **Result:** Installation completes successfully even with permission restrictions

### 3. ✅ **Arabic Font Installation**

- **Problem:** Font installation was failing when directories didn't exist
- **Solution:**
  - Check if directories exist before copying
  - Try multiple possible font locations
  - Set permissions only on existing files
  - Make font cache update optional
- **Result:** Graceful handling of font installation with fallback

## Installation Path Verification

The `.deb` package will install to:

```
/opt/masjidconnect-display/
├── masjidconnect-display       # Main executable
├── chrome-sandbox
├── chrome_100_percent.pak
├── chrome_200_percent.pak
├── chrome_crashpad_handler
├── icudtl.dat
├── libEGL.so
├── libGLESv2.so
├── libffmpeg.so
├── libvk_swiftshader.so
├── libvulkan.so.1
├── locales/
│   └── [language files]
└── resources/
    ├── app/
    │   ├── build/              # React app build
    │   ├── electron/           # Electron main process
    │   ├── node_modules/       # Dependencies
    │   ├── assets/
    │   │   └── icon.png        # App icon
    │   └── package.json
    └── app.asar               # Packaged app (if ASAR enabled)
```

## Desktop Integration

### Desktop Entry

Location: `/usr/share/applications/masjidconnect-display.desktop`

```desktop
[Desktop Entry]
Type=Application
Name=MasjidConnect Display
Exec=/opt/masjidconnect-display/masjidconnect-display --no-sandbox
Icon=/opt/masjidconnect-display/resources/app/assets/icon.png
Comment=Digital signage for mosques
Categories=Utility;Education;
StartupWMClass=masjidconnect-display
```

### Auto-start

Location: `/etc/xdg/autostart/masjidconnect-display.desktop`

The app will start automatically on boot for all users.

## Font Installation

### System Fonts Directory

Location: `/usr/local/share/fonts/masjidconnect/`

The installer will attempt to copy Arabic/Islamic fonts to this location for system-wide rendering.

**Font Locations Checked** (in order):

1. `/opt/masjidconnect-display/resources/app/build/static/media/*.woff2`
2. `/opt/masjidconnect-display/resources/app/src/assets/fonts/*.woff2`

**Note:** If font installation fails, the app still works as fonts are embedded in the web bundle.

## Installation Commands

### 1. Transfer Package to Raspberry Pi

```bash
# From your Mac
scp dist/masjidconnect-display-0.0.1-arm64.deb pi@your-pi-ip:/home/pi/
```

### 2. Install Package

```bash
# On Raspberry Pi
ssh pi@your-pi-ip
sudo dpkg -i masjidconnect-display-0.0.1-arm64.deb
```

### 3. Check Installation Log

```bash
# Check for any warnings
cat /var/log/masjidconnect-install.log

# Or if it fell back to tmp:
cat /tmp/masjidconnect-install.log
```

### 4. Verify Installation

```bash
# Check if package is installed
dpkg -l | grep masjidconnect

# Expected output:
# ii  masjidconnect-display  0.0.1  arm64  MasjidConnect Display App for showing prayer times and announcements

# Check if files exist
ls -la /opt/masjidconnect-display/
ls -la /usr/share/applications/masjidconnect-display.desktop
```

### 5. Launch Application

```bash
# Manual launch for testing
/opt/masjidconnect-display/masjidconnect-display --no-sandbox

# Or from desktop menu:
# Applications > Utility > MasjidConnect Display

# Or reboot to test auto-start:
sudo reboot
```

## Post-Installation Verification

### Check Application Status

```bash
# Check if app is running
ps aux | grep masjidconnect-display

# Check display server connection
echo $DISPLAY

# Check for any errors
journalctl -xe | grep masjidconnect
```

### Verify Font Rendering

1. Launch the app
2. Check if Arabic text renders correctly
3. If fonts look incorrect, try:

```bash
# Rebuild font cache
sudo fc-cache -f -v

# Check if fonts are registered
fc-list | grep -i arabic
fc-list | grep -i noto
```

## Troubleshooting

### Installation Fails

```bash
# Check dependencies
sudo apt-get install -f

# Manually install missing dependencies
sudo apt-get install libasound2 libatk-bridge2.0-0 libatk1.0-0 \
  libatspi2.0-0 libcups2 libdrm2 libgbm1 libgtk-3-0 libnotify4 \
  libnss3 libx11-xcb1 libxcb-dri3-0 libxcomposite1 libxdamage1 \
  libxfixes3 libxkbcommon0 libxrandr2 libxss1 libxtst6 libuuid1 xdg-utils
```

### App Won't Start

```bash
# Check if sandbox is the issue (common on RPi)
/opt/masjidconnect-display/masjidconnect-display --no-sandbox --disable-gpu

# Check permissions
sudo chmod +x /opt/masjidconnect-display/masjidconnect-display

# Check for missing libraries
ldd /opt/masjidconnect-display/masjidconnect-display
```

### Fonts Not Rendering

```bash
# Install Noto fonts (best for Arabic)
sudo apt-get install fonts-noto fonts-noto-ui-core fonts-noto-mono

# Or install Google Fonts
sudo apt-get install fonts-noto-cjk fonts-noto-cjk-extra

# Rebuild font cache
sudo fc-cache -f -v
```

### Auto-start Not Working

```bash
# Check if desktop entry exists
cat /etc/xdg/autostart/masjidconnect-display.desktop

# Check if it's executable
sudo chmod +x /etc/xdg/autostart/masjidconnect-display.desktop

# Check desktop session logs
cat ~/.xsession-errors
```

## Uninstallation

### Complete Removal

```bash
# Remove package and config files
sudo apt remove --purge masjidconnect-display

# Remove system fonts (optional)
sudo rm -rf /usr/local/share/fonts/masjidconnect

# Rebuild font cache
sudo fc-cache -f
```

### Remove Just the Package

```bash
# Keep config files
sudo apt remove masjidconnect-display
```

## Expected Behavior

### ✅ Normal Operation

1. **Installation:** Completes without errors
2. **First Launch:** Shows pairing screen
3. **After Pairing:** Displays prayer times and content
4. **Auto-start:** Launches on boot automatically
5. **Arabic Text:** Renders correctly with proper font
6. **Updates:** Can be updated via admin portal

### ⚠️ Expected Warnings (Non-Critical)

- Font cache update warnings (if `fc-cache` not installed)
- Permission warnings on `/var/log` (falls back to `/tmp`)
- Minor GPU warnings on Raspberry Pi (expected with `--no-sandbox`)

### ❌ Critical Issues (Should Not Occur)

- Package installation fails completely
- App won't launch at all
- Missing `/opt/masjidconnect-display` directory
- Desktop entry not created

## Testing Checklist

- [ ] Package installs without errors
- [ ] `/opt/masjidconnect-display/` directory exists
- [ ] Executable file has correct permissions
- [ ] Desktop entry created
- [ ] Auto-start configured
- [ ] App launches manually
- [ ] App launches on boot
- [ ] Arabic fonts render correctly
- [ ] App can be updated
- [ ] App can be uninstalled cleanly

## Success Criteria

✅ All files install to `/opt/masjidconnect-display/`  
✅ After-install script completes successfully  
✅ Desktop integration works  
✅ Auto-start configured  
✅ App launches without permission errors  
✅ Arabic fonts render correctly

---

**Build Date:** 2025-10-12  
**Version:** 0.0.1  
**Package:** masjidconnect-display-0.0.1-arm64.deb  
**Size:** 94 MB  
**Architecture:** ARM64 / aarch64
