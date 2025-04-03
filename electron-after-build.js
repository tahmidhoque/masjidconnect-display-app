/**
 * electron-after-build.js
 * 
 * This script runs after the electron build to optimize the application
 * for running on Raspberry Pi devices. It:
 * 
 * 1. Creates proper desktop entries
 * 2. Sets up autostart
 * 3. Configures appropriate system optimizations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths to modify
const DIST_PATH = path.join(__dirname, 'dist');
const ARM_PATHS = [
  path.join(DIST_PATH, 'linux-armv7l-unpacked'),
  path.join(DIST_PATH, 'linux-arm64-unpacked')
];

/**
 * Creates a desktop file for the application
 */
function createDesktopFile(appDir) {
  console.log(`Creating desktop file in ${appDir}`);
  const desktopContent = `[Desktop Entry]
Type=Application
Name=MasjidConnect Display
Exec=/opt/masjidconnect-display/masjidconnect-display --no-sandbox
Icon=/opt/masjidconnect-display/resources/app/build/icon.png
Comment=Digital signage for mosques
Categories=Utility;Education;
X-GNOME-Autostart-enabled=true
`;

  const desktopPath = path.join(appDir, 'masjidconnect-display.desktop');
  fs.writeFileSync(desktopPath, desktopContent);
  console.log(`Created desktop file at: ${desktopPath}`);
}

/**
 * Creates an optimized launcher script
 */
function createLauncherScript(appDir) {
  console.log(`Creating launcher script in ${appDir}`);
  const launcherContent = `#!/bin/bash

# Set environment variables for better performance on Raspberry Pi
export ELECTRON_ENABLE_LOGGING=1
export ELECTRON_ENABLE_STACK_DUMPING=1

# Graphics environment variables for improved RPi performance
export GDK_BACKEND=x11
export LIBGL_DRIVERS_PATH=/usr/lib/arm-linux-gnueabihf/dri:/usr/lib/aarch64-linux-gnu/dri

# Start the application with optimal flags
exec "/opt/masjidconnect-display/masjidconnect-display" "$@" --no-sandbox
`;

  const scriptPath = path.join(appDir, 'launcher.sh');
  fs.writeFileSync(scriptPath, launcherContent);
  fs.chmodSync(scriptPath, 0o755);
  console.log(`Created launcher script at: ${scriptPath}`);
}

/**
 * Set up RPi optimizations
 */
function optimizeForRaspberryPi() {
  console.log('Setting up Raspberry Pi optimizations...');
  
  // Process each ARM build directory
  for (const armPath of ARM_PATHS) {
    if (fs.existsSync(armPath)) {
      console.log(`Processing ${armPath}`);
      createDesktopFile(armPath);
      createLauncherScript(armPath);
    } else {
      console.log(`Skipping ${armPath} - directory doesn't exist`);
    }
  }
}

// Run the optimizations
try {
  optimizeForRaspberryPi();
  console.log('Raspberry Pi optimizations completed successfully!');
} catch (error) {
  console.error('Error during optimization:', error);
  process.exit(1);
} 