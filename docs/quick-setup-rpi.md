# MasjidConnect Display App - Quick Setup on Raspberry Pi

## Prerequisites

1. **Raspberry Pi 3 or newer** (Pi 4 with 2GB+ RAM recommended)
2. **Raspberry Pi OS** (64-bit Bullseye or newer recommended)
3. **Internet connection** for downloading dependencies
4. **8GB+ free space** for build process

## Quick Setup

### 1. Clone the Repository

```bash
git clone https://github.com/masjidSolutions/masjidconnect-display-app.git
cd masjidconnect-display-app
```

### 2. Build and Install

#### Option A: System-wide Installation (Recommended)

```bash
sudo ./build-and-install-rpi.sh
```

#### Option B: User Installation

```bash
./build-and-install-rpi.sh
```

### 3. Reboot

```bash
sudo reboot
```

The app will start automatically after reboot.

## What the Script Does

1. ✅ **Checks environment** - Verifies RPi and Node.js
2. ✅ **Installs dependencies** - Sets up build tools
3. ✅ **Optimizes for RPi** - Configures memory limits
4. ✅ **Builds React app** - Creates production build
5. ✅ **Sets up Electron** - Configures launcher scripts
6. ✅ **Installs app** - System-wide or user installation
7. ✅ **Configures autostart** - Starts on boot
8. ✅ **Creates services** - Systemd integration

## Build Options

### Memory Optimization

The script automatically:

- Sets Node.js memory limits based on available RAM
- Disables source maps and ESLint during build
- Uses optimized npm settings
- Cleans up after build to save space

### Installation Modes

**System-wide (sudo)**:

- Installs to `/opt/masjidconnect-display/`
- Creates systemd service
- Available to all users
- Starts automatically on boot

**User installation**:

- Installs to `~/.local/share/masjidconnect-display/`
- User autostart only
- No system-wide changes

## Manual Commands

### Start/Stop Application

**System-wide**:

```bash
# Start manually
sudo /opt/masjidconnect-display/masjidconnect-display

# Control service
sudo systemctl start masjidconnect-display
sudo systemctl stop masjidconnect-display
sudo systemctl restart masjidconnect-display

# View logs
journalctl -u masjidconnect-display -f
```

**User installation**:

```bash
# Start manually
~/.local/share/masjidconnect-display/masjidconnect-display

# Background
~/.local/share/masjidconnect-display/masjidconnect-display &
```

### Troubleshooting

**Check if app is running**:

```bash
ps aux | grep masjidconnect
```

**View display**:

```bash
export DISPLAY=:0
xrandr  # Check display status
```

**Free up memory** (if build fails):

```bash
sudo systemctl stop masjidconnect-display
free -h  # Check available memory
```

## Performance Tips

### For Raspberry Pi 3:

- Use 64-bit OS if possible
- Enable swap file: `sudo dphys-swapfile setup`
- Close unnecessary applications during build
- Consider building overnight (can take 1-2 hours)

### For Raspberry Pi 4:

- 2GB+ RAM recommended
- 4GB+ RAM for comfortable development
- Build typically takes 20-45 minutes

## Configuration

### Display Settings

Edit `/boot/config.txt`:

```bash
# GPU memory for display apps
gpu_mem=128

# HDMI settings
hdmi_group=2
hdmi_mode=82  # 1080p 60Hz
```

### Kiosk Mode

For full kiosk setup, also disable:

```bash
# Disable screen blanking
sudo nano /etc/xdg/lxsession/LXDE-pi/autostart
# Add:
@xset s off
@xset -dpms
@xset s noblank

# Hide cursor
sudo apt install unclutter
echo "@unclutter -idle 0.5" >> ~/.config/lxsession/LXDE-pi/autostart
```

## Support

If you encounter issues:

1. Check available memory: `free -h`
2. Verify Node.js version: `node -v` (needs 16+)
3. Check build logs for specific errors
4. Try building with swap enabled
5. Consider using a more powerful Pi model

For production deployments, consider using the pre-built packages instead of building on device.
