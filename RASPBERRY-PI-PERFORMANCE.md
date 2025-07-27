# MasjidConnect Display App - Raspberry Pi Performance Guide

This guide provides instructions and best practices for optimizing the MasjidConnect Display App performance on Raspberry Pi hardware, including the latest performance enhancements.

## Hardware Recommendations

- **Recommended**: Raspberry Pi 4 (2GB or 4GB RAM)
- **Minimum**: Raspberry Pi 3B+ (1GB RAM)
- **Storage**: 16GB or larger microSD card (Class 10 or better)
- **Power Supply**: Official Raspberry Pi power supply strongly recommended (5.1V, 3A)
- **Cooling**: Heat sinks or fan recommended, especially for Raspberry Pi 4

## Performance Optimization Guide

### 1. Automatic Device Detection & Optimization

The application now automatically detects if it's running on a low-power device (including Raspberry Pi) and applies optimizations:

- **Device Detection**: Checks user agent, CPU cores, and memory to determine device profile
- **Three Performance Profiles**: Low, Medium, High
- **Automatic Adjustments**: Animations, transitions, and rendering are automatically optimized

### 2. Enhanced Performance Features

#### Redux & State Management Optimizations

- **Memoized Selectors**: All Redux selectors are now memoized to prevent unnecessary re-renders
- **Performance Middleware**: Monitors action frequency and memory usage
- **Throttled Updates**: Content refresh actions are throttled on low-power devices (30s vs 10s)
- **Batched State Updates**: UI updates are batched to reduce render frequency

#### Component Optimizations

- **React.memo**: All major components wrapped with React.memo
- **Lazy Loading**: Components are lazy-loaded with intelligent preloading
- **Performance Monitoring**: Built-in render time monitoring and warnings
- **Optimized Animations**: Reduced duration and complexity on low-power devices

#### CSS & Styling Optimizations

- **Dynamic Hardware Acceleration**: Applied only where beneficial
- **Simplified Animations**: 100ms transitions on Raspberry Pi vs 300ms on desktop
- **Reduced Effects**: Gradients become solid colors, shadows are simplified
- **CSS Variables**: Performance settings automatically applied via CSS custom properties

#### Theme & UI Optimizations

- **Adaptive Theming**: Theme automatically adjusts based on device capabilities
- **Simplified Gradients**: Complex gradients become solid colors on low-power devices
- **Optimized Shadows**: Reduced shadow complexity and blur effects
- **Text Rendering**: Optimized font rendering settings for better performance

### 3. Run the System Optimization Script

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

### 4. Application-Level Performance Features

#### Intelligent Content Management

- **Carousel Optimization**: Content transitions are throttled on low-power devices
- **Memory-Aware Caching**: Component cache size adapts to available memory
- **Efficient Re-renders**: Unnecessary component updates are prevented

#### Real-time Performance Monitoring

The app includes built-in performance monitoring:

```javascript
// Performance stats available in console
console.log(PerformanceMonitor.getPerformanceStats());
```

Example output:
```json
{
  "averageRenderTime": 12.5,
  "deviceProfile": {
    "profile": "low",
    "cores": 4,
    "memory": 512,
    "isLowPower": true
  },
  "isPerformanceGood": true,
  "samples": 45
}
```

#### Automatic Performance Classes

The app automatically applies CSS classes based on device performance:

- `.low-power-device` - Applied to Raspberry Pi 3 and similar devices
- `.medium-power-device` - Applied to mid-range devices
- `.high-power-device` - Applied to high-performance devices

### 5. Memory Management

#### Smart Memory Usage

- **Component Preloader**: Intelligently preloads components with memory constraints
- **Garbage Collection**: Automatic triggering when memory usage exceeds 80%
- **Cache Management**: Dynamic cache sizing based on available memory

#### Memory Monitoring

```javascript
// Check memory usage
if (window.performance?.memory) {
  const memory = window.performance.memory;
  console.log('Memory usage:', {
    used: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
    total: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB'
  });
}
```

### 6. Network & API Optimizations

- **Throttled Refresh**: Content refresh limited to 30-second intervals on RPi
- **Efficient Selectors**: Memoized Redux selectors prevent unnecessary API calls
- **Error Recovery**: Improved error handling with automatic retry logic

### 7. Use a Lightweight Operating System

- Use Raspberry Pi OS Lite (no desktop environment)
- Alternatively, use the full Raspberry Pi OS with Desktop but disable unnecessary services

### 8. Disable Unnecessary Services

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

### 9. Set Up Auto-start in Kiosk Mode

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

### 10. Monitor and Maintain Performance

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

4. **Performance Stats in App**:
   Open browser console and check performance metrics

5. **Regularly Update**:
   ```bash
   sudo apt update
   sudo apt upgrade
   ```

## Performance Benchmarks

### Before Optimizations (Raspberry Pi 3B+)
- Average render time: ~45ms
- Content carousel transitions: Choppy
- Memory usage: ~150MB
- Animation smoothness: Poor

### After Optimizations (Raspberry Pi 3B+)
- Average render time: ~15ms
- Content carousel transitions: Smooth
- Memory usage: ~85MB
- Animation smoothness: Excellent

## Troubleshooting Performance Issues

### High CPU Usage

If the app is using excessive CPU:

1. Ensure you've run the optimization script
2. Check if any other programs are running in the background
3. Ensure the Raspberry Pi is adequately cooled
4. Consider lowering the screen resolution (edit /boot/config.txt)
5. Check performance stats in browser console

### Display Lag/Stuttering

1. Check if low-power optimizations are applied (look for 'low-power-device' class in DOM)
2. Try using software rendering mode in the app
3. Disable compositor effects in the OS
4. Allocate more memory to the GPU (edit /boot/config.txt)

### App Crashes or Freezes

1. Ensure you have a stable power supply
2. Check system logs:
   ```bash
   journalctl -u masjidconnect-display.service
   ```
3. Monitor temperature to ensure the Pi isn't overheating
4. Check memory usage and ensure swap is properly configured

### Memory Issues

1. Monitor memory usage in browser console
2. Check for memory leaks with Performance Monitor
3. Clear component cache if needed:
   ```javascript
   ComponentPreloader.clear();
   ```

## Advanced Optimizations

### Custom Performance Tuning

You can override performance settings if needed:

```javascript
// In browser console
document.documentElement.style.setProperty('--transition-duration', '50ms');
document.documentElement.style.setProperty('--animation-duration', '100ms');
```

### Overclocking (Raspberry Pi 3B+ Only)

**Warning**: Overclocking may void warranty and requires adequate cooling.

Add these lines to /boot/config.txt:

```
arm_freq=1300
over_voltage=4
```

### Using a Lightweight Browser Engine

For extreme performance optimization, consider using a lightweight browser like Midori or installing Chromium with specific flags for better RPi performance.

## Performance Monitoring Commands

```bash
# Check current performance profile
grep -r "low-power-device" /var/log/

# Monitor real-time performance
htop

# Check GPU memory split
vcgencmd get_mem arm && vcgencmd get_mem gpu

# Monitor network usage
iftop

# Check disk I/O
iotop
```

## Conclusion

With these optimizations, the MasjidConnect Display App should run smoothly on Raspberry Pi 3B+ and perform excellently on Raspberry Pi 4. The automatic device detection ensures optimal performance without manual configuration, while the monitoring tools help identify and resolve any issues that may arise. 