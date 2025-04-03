# MasjidConnect Display App

A digital signage application for mosques to display prayer times, announcements, events, and other content.

## Overview

The MasjidConnect Display App is designed to be run on screens throughout a mosque/masjid to provide real-time information to worshippers. It features:

- Prayer times display with countdown to next prayer
- Announcements and events
- Islamic content (verses, hadiths, etc.)
- Support for both landscape and portrait orientations
- Offline functionality
- Automatic updates

## Key Features

- **No User Input Required**: This is a display-only application designed for digital signage. Users do not interact with the app directly.
- **Pairing System**: Screens are paired with the MasjidConnect management system using a simple code.
- **Responsive Design**: Adapts to different screen sizes and orientations.
- **Offline Support**: Continues to function even when internet connectivity is lost.
- **Real-time Updates**: Automatically syncs with the management system for up-to-date content.

## Technical Details

- Built with React and TypeScript
- Uses Material UI for components
- Implements a service worker for offline functionality
- Uses local storage and IndexedDB (via localforage) for data persistence

## Getting Started

### Prerequisites

- Node.js 14.x or higher
- npm 7.x or higher

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   REACT_APP_API_URL=https://api.masjidconnect.com
   ```
4. Start the development server:
   ```
   npm start
   ```

### Building for Production

```
npm run build
```

This will create a production-ready build in the `build` folder.

## Deployment

The app is designed to be deployed on any static hosting service or directly on devices like Raspberry Pi, Android tablets, or dedicated digital signage hardware.

### Recommended Deployment Options

1. **Web Hosting**: Deploy to services like Netlify, Vercel, or Firebase Hosting
2. **Dedicated Hardware**: Run on a Raspberry Pi in kiosk mode
3. **Tablets**: Use in full-screen mode on Android or iOS tablets

## Development Notes

- This is a "no user input" application - it's designed to be displayed on screens without user interaction
- The app automatically handles orientation changes
- Service workers are used for offline functionality and caching
- The app sends heartbeats to the server to indicate it's online and functioning

## Offline Capabilities

The MasjidConnect Display App includes robust offline support features:

### Implemented Features:

1. **Service Worker with Workbox**:
   - Strategic caching of static assets, API responses, and critical resources
   - Background sync when connection is restored
   - Automatic updates when new content is available

2. **Intelligent Data Caching**:
   - All API responses are cached locally using IndexedDB (via localforage)
   - Cached data is served when offline
   - Automatic synchronization when connection is restored

3. **Prayer Timing Logic**:
   - Locally calculates prayer times when offline
   - Uses device clock to maintain accurate timing even without connectivity

4. **User Experience**:
   - Visual indicator showing offline status
   - Duration of offline state
   - Automatic reconnection handling

5. **Multi-Layer Data Persistence**:
   - Browser cache for assets via service worker
   - IndexedDB for API data
   - LocalStorage for critical configuration

### How It Works:

- On first load, all critical data is cached
- The app checks connection status continuously
- When offline, it serves cached content
- When connection is restored, data is synchronized in background
- Display automatically updates when new data is available

### Development Testing:

You can test offline capabilities by:
1. Loading the app while online
2. Using browser dev tools to switch to offline mode (Network tab)
3. Refreshing the page to see offline behavior
4. The application should continue to function with the last cached data

## License

This project is proprietary software owned by MasjidConnect.

## Contact

For support or inquiries, contact support@masjidconnect.com

# Raspberry Pi Optimization

This application has been specifically optimized to run smoothly on Raspberry Pi devices.

## Hardware Acceleration

We've implemented several optimizations to improve performance on Raspberry Pi:

1. **Chromium/Electron Flags**: We've configured optimized Chromium flags that balance hardware acceleration with thermal management:
   - Enabled GPU rasterization with controlled thread counts
   - Used OpenGL desktop driver for better RPi compatibility
   - Limited raster threads and renderer processes to reduce thermal throttling

2. **Client-Side Rendering**: The React application detects low-power devices and:
   - Reduces animation complexity
   - Selectively applies hardware acceleration to critical UI elements
   - Scales down large images
   - Increases debounce/throttle times for events

3. **Kiosk Mode**: The application runs in fullscreen kiosk mode on Raspberry Pi.

## Building for Raspberry Pi

To build the application for Raspberry Pi:

```bash
# For Raspberry Pi 3 (armv7l)
npm run electron:build:armhf

# For Raspberry Pi 4 (arm64)
npm run electron:build:arm64

# For both architectures
npm run electron:build:pi

# Build and publish to GitHub releases
npm run electron:build:pi:publish
```

## System Optimizations

During installation, the application:

1. Creates autostart entry in `/home/pi/.config/autostart`
2. Sets proper file permissions
3. Configures GPU memory (minimum 128MB)
4. Enables the VC4 GL driver for hardware acceleration

## Troubleshooting

If you experience thermal throttling:
- Ensure your Raspberry Pi has adequate cooling (heatsink/fan)
- The app automatically limits GPU usage but may still require cooling
- For extreme cases, add a small 5V fan connected to the GPIO pins 

# Cross-Compiling for Raspberry Pi

When building for Raspberry Pi (armv7l/arm64) on macOS, there are known issues with electron-builder. Here are two workarounds:

## Method 1: Build on the Raspberry Pi directly

1. Clone the repository on the Raspberry Pi:
```bash
git clone https://github.com/masjidSolutions/masjidconnect-display-app.git
cd masjidconnect-display-app
npm install
```

2. Build the application:
```bash
npm run electron:build
```

## Method 2: Use a Docker container for building

Cross-compilation can be more reliable using Docker:

1. Create a Dockerfile for building:
```dockerfile
FROM electronuserland/builder:16

WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
RUN electron-builder --linux deb --armv7l
```

2. Build using Docker:
```bash
docker build -t masjidconnect-builder .
docker run --rm -v ${PWD}/dist:/app/dist masjidconnect-builder
```

## Method 3: Using the pre-built ZIP

If you're unable to build a proper .deb file, you can:

1. Build a ZIP package: 
```bash
npm run electron:build:armhf # This builds a ZIP file
```

2. Extract on the Raspberry Pi and run the installation script:
```bash
unzip masjidconnect-display-0.1.0-armv7l.zip -d /opt/masjidconnect-display
sudo chmod +x /opt/masjidconnect-display/masjidconnect-display
sudo bash build/after-install.sh
```

## Performance Optimizations

All the performance optimizations for Raspberry Pi are included in the codebase:

1. Hardware acceleration settings in `electron/main.js`
2. Thermal management with proper GPU flags
3. Reduced animations in `src/utils/performanceUtils.ts`

# Running on Raspberry Pi

For the best performance on Raspberry Pi devices, follow these recommendations:

## Hardware Requirements

- Raspberry Pi 3B+ or newer (Pi 4 recommended)
- MicroSD card with at least 16GB
- Display with HDMI input (portrait or landscape)
- Active cooling (small heatsink or fan) to prevent thermal throttling

## Software Setup

1. Install Raspberry Pi OS (32-bit or 64-bit)
2. Update your system:
```bash
sudo apt update && sudo apt upgrade -y
```

3. Install required dependencies:
```bash
sudo apt install -y libglib2.0-0 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgtk-3-0 libgbm1 libasound2
```

4. Install application:
   - Option 1: Get the latest release from GitHub
   - Option 2: Use the pre-built ZIP and follow the instructions above
   - Option 3: Build directly on the device

## Optimizing GPU Settings

To ensure optimal performance, modify your `/boot/config.txt`:

```bash
sudo nano /boot/config.txt
```

Add/modify these lines:
```
gpu_mem=128
dtoverlay=vc4-kms-v3d
```

## Autostart at Boot

The application will automatically create an autostart entry during installation. To verify it:

```bash
ls -la /home/pi/.config/autostart/masjidconnect-display.desktop
```

## Monitoring Performance

To monitor for thermal throttling:
```bash
vcgencmd measure_temp
vcgencmd get_throttled
```

If the temperature exceeds 80°C regularly or throttling occurs, improve cooling. 