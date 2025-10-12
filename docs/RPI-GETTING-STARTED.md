# MasjidConnect Display App - Raspberry Pi Quick Start

This guide provides quick setup instructions for running the MasjidConnect Display App on a Raspberry Pi.

## Hardware Requirements

- Raspberry Pi 3 or newer (Raspberry Pi 4 with 2GB+ RAM recommended)
- Power supply (official 5V/3A USB-C for Pi 4, or 5V/2.5A micro USB for Pi 3)
- MicroSD card (16GB+, Class 10 recommended)
- HDMI display or TV
- Internet connection (Wi-Fi or Ethernet)

## Software Setup

### Option 1: Install from pre-built package (Recommended)

1. Download the latest `.deb` package for your Pi model from [GitHub Releases](https://github.com/masjidSolutions/masjidconnect-display-app/releases)
   - Use `armv7l` package for 32-bit Raspberry Pi OS (Pi 3, Pi Zero 2)
   - Use `arm64` package for 64-bit Raspberry Pi OS (Pi 4, newer models)

2. Install the package:
   ```bash
   sudo apt update
   sudo apt install -y ./masjidconnect-display-0.1.0-arm64.deb
   ```

3. The app will automatically start at boot. To start it manually:
   ```bash
   /opt/masjidconnect-display/masjidconnect-display
   ```

### Option 2: Build from source

If you need to build from source, follow these steps on your development machine:

1. Follow the build instructions in [README-RASPBERRY-PI.md](README-RASPBERRY-PI.md)
2. Copy the resulting `.deb` package to your Raspberry Pi
3. Install as shown in Option 1

## Kiosk Mode Setup

For the best experience, set up your Raspberry Pi in kiosk mode:

1. Install Raspberry Pi OS Lite (64-bit recommended for Pi 4)
2. Configure auto-login:
   ```bash
   sudo raspi-config
   ```
   Navigate to System Options > Boot / Auto Login > Desktop Autologin

3. Disable screen blanking:
   ```bash
   sudo nano /etc/xdg/lxsession/LXDE-pi/autostart
   ```
   Add these lines:
   ```
   @xset s off
   @xset -dpms
   @xset s noblank
   ```

4. Hide cursor when inactive:
   ```bash
   sudo apt install -y unclutter
   echo "@unclutter -idle 0.5" | sudo tee -a /etc/xdg/lxsession/LXDE-pi/autostart
   ```

## Pairing Your Display

When first started, the app will show a pairing screen:

1. Create an account on [MasjidConnect](https://masjidconnect.com) if you don't have one
2. Log in and navigate to Display Management
3. Click "Add New Display" and note the pairing code
4. Enter the pairing code in the app when prompted

## Auto-Updates

The app will automatically check for updates every hour when connected to the internet. Updates will be downloaded in the background and installed on the next restart.

## Troubleshooting

If you encounter issues:

- Check installation logs: `cat /var/log/masjidconnect-install.log`
- Check application logs: `cat ~/.config/masjidconnect-display/logs/main.log`
- For display issues, ensure GPU memory is at least 128MB in `/boot/config.txt`
- If the app doesn't start automatically, check `/etc/xdg/autostart/` for the desktop file

Need more help? Visit [MasjidConnect Support](https://masjidconnect.com/support) 