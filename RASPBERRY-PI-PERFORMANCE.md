# MasjidConnect Display App - Raspberry Pi Performance Guide

This guide provides instructions and best practices for optimizing the MasjidConnect Display App performance on Raspberry Pi hardware.

## Hardware Recommendations

- **Recommended**: Raspberry Pi 4 (2GB or 4GB RAM)
- **Minimum**: Raspberry Pi 3B+ (1GB RAM)
- **Storage**: 16GB or larger microSD card (Class 10 or better)
- **Power Supply**: Official Raspberry Pi power supply strongly recommended (5.1V, 3A)
- **Cooling**: Heat sinks or fan recommended, especially for Raspberry Pi 4

## Performance Optimization Guide

### 1. Run the Optimization Script

We've included an optimization script that configures your Raspberry Pi for optimal performance:

```bash
# Make the script executable if needed
chmod +x scripts/optimize-raspberry-pi.sh

# Run the script as root
sudo scripts/optimize-raspberry-pi.sh

# Reboot after running the script
sudo reboot
```

This script performs the following optimizations:
- Sets CPU governor to performance mode
- Reduces swappiness to minimize disk I/O
- Configures GPU memory allocation
- Enables CPU turbo mode
- Disables Bluetooth to save resources
- Configures HDMI for optimal performance
- Sets up X11 with software rendering

### 2. Use a Lightweight Operating System

- Use Raspberry Pi OS Lite (no desktop environment)
- Alternatively, use the full Raspberry Pi OS with Desktop but disable unnecessary services

### 3. Disable Unnecessary Services

```bash
# Disable Bluetooth if not needed
sudo systemctl disable bluetooth
sudo systemctl stop bluetooth

# Disable Wi-Fi if using Ethernet
sudo rfkill block wifi

# Disable unnecessary services
sudo systemctl disable avahi-daemon
sudo systemctl disable triggerhappy
sudo systemctl disable cups
```

### 4. Application Configuration

The application has been updated to run better on Raspberry Pi with these optimizations:

1. **Hardware Acceleration Settings**:
   - The app now uses software rendering on Raspberry Pi instead of hardware acceleration
   - This provides a more consistent performance across various Pi models

2. **Reduced Animations**:
   - Simplified transitions and animations to reduce CPU/GPU load
   - Lower transparency effects and more efficient rendering

3. **Memory Optimizations**:
   - Component memoization to prevent unnecessary re-renders
   - Deferred loading of non-critical data

### 5. Set Up Auto-start in Kiosk Mode

Create a systemd service to auto-start the application on boot in kiosk mode:

```bash
sudo nano /etc/systemd/system/masjidconnect-display.service
```

Add the following content:

```
[Unit]
Description=MasjidConnect Display App
After=network.target

[Service]
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/bin/startx /usr/bin/masjidconnect-display -- -nocursor
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable the service:

```bash
sudo systemctl enable masjidconnect-display.service
sudo systemctl start masjidconnect-display.service
```

### 6. Monitor and Maintain Performance

1. **Monitor Temperature**:
   ```bash
   vcgencmd measure_temp
   ```

2. **Check CPU Usage**:
   ```bash
   top
   ```

3. **Memory Usage**:
   ```bash
   free -h
   ```

4. **Regularly Update**:
   ```bash
   sudo apt update
   sudo apt upgrade
   ```

## Troubleshooting Performance Issues

### High CPU Usage

If the app is using excessive CPU:

1. Ensure you've run the optimization script
2. Check if any other programs are running in the background
3. Ensure the Raspberry Pi is adequately cooled
4. Consider lowering the screen resolution (edit /boot/config.txt)

### Display Lag/Stuttering

1. Try using software rendering mode in the app
2. Disable compositor effects in the OS
3. Allocate more memory to the GPU (edit /boot/config.txt)

### App Crashes or Freezes

1. Ensure you have a stable power supply
2. Check system logs:
   ```bash
   journalctl -u masjidconnect-display.service
   ```
3. Monitor temperature to ensure the Pi isn't overheating

## Advanced Optimizations

### Overclocking (Raspberry Pi 3B+ Only)

**Warning**: Overclocking may void warranty and requires adequate cooling.

Add these lines to /boot/config.txt:

```
arm_freq=1300
over_voltage=4
```

### Using a Lightweight Browser Engine

The app is already optimized to use minimal resources, but if needed you can configure the Electron app to use even less memory by editing the main.js file. 