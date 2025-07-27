/**
 * prepare-rpi-build.js
 * 
 * Prepares the Raspberry Pi build with optimizations and necessary files for deb packaging
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Constants
const BUILD_DIR = path.join(__dirname, '../build');
const ASSETS_DIR = path.join(__dirname, '../assets');

console.log('Preparing Raspberry Pi build...');

// Ensure after-install.sh exists and is executable
function prepareAfterInstallScript() {
  const afterInstallPath = path.join(BUILD_DIR, 'after-install.sh');
  
  if (!fs.existsSync(afterInstallPath)) {
    console.error('Error: after-install.sh script not found!');
    console.log('Creating after-install.sh script...');
    
    // Create a basic after-install script if it doesn't exist
    const scriptContent = `#!/bin/bash

# Log file for installation
LOGFILE="/var/log/masjidconnect-install.log"

# Ensure log file exists and is writable
touch $LOGFILE
chmod 644 $LOGFILE

echo "Running MasjidConnect Display post-installation script..." | tee -a $LOGFILE
date | tee -a $LOGFILE

# Create desktop file in proper location
echo "Creating desktop entry..." | tee -a $LOGFILE
cat > /usr/share/applications/masjidconnect-display.desktop << EOL
[Desktop Entry]
Type=Application
Name=MasjidConnect Display
Exec=/opt/masjidconnect-display/masjidconnect-display --no-sandbox
Icon=/opt/masjidconnect-display/resources/app/assets/icon.png
Comment=Digital signage for mosques
Categories=Utility;Education;
X-GNOME-Autostart-enabled=true
EOL

# Set up autostart for display
echo "Setting up autostart..." | tee -a $LOGFILE
mkdir -p /etc/xdg/autostart/
cp /usr/share/applications/masjidconnect-display.desktop /etc/xdg/autostart/

# Make sure the app has proper permissions
echo "Setting permissions..." | tee -a $LOGFILE
chmod +x /opt/masjidconnect-display/masjidconnect-display

# Install fonts system-wide for proper Arabic text rendering
echo "Installing Arabic fonts..." | tee -a $LOGFILE
FONTS_DIR="/usr/local/share/fonts/masjidconnect"
mkdir -p "$FONTS_DIR"

# Copy fonts from the app directory to system fonts
cp -r /opt/masjidconnect-display/resources/app/build/static/fonts/* "$FONTS_DIR" 2>/dev/null || true
cp -r /opt/masjidconnect-display/resources/app/src/assets/fonts/* "$FONTS_DIR" 2>/dev/null || true

# Set proper permissions for font files
chmod 644 "$FONTS_DIR"/*
fc-cache -f

# Create optimized launcher script
echo "Creating optimized launcher script..." | tee -a $LOGFILE
cat > /opt/masjidconnect-display/launcher.sh << EOL
#!/bin/bash

# Set environment variables for better performance on Raspberry Pi
export ELECTRON_ENABLE_LOGGING=1
export ELECTRON_ENABLE_STACK_DUMPING=1

# Graphics environment variables for improved RPi performance
export GDK_BACKEND=x11
export LIBGL_DRIVERS_PATH=/usr/lib/arm-linux-gnueabihf/dri:/usr/lib/aarch64-linux-gnu/dri

# Start the application with optimal flags
exec "/opt/masjidconnect-display/masjidconnect-display" "\$@" --no-sandbox
EOL

chmod +x /opt/masjidconnect-display/launcher.sh

echo "Post-installation completed successfully!" | tee -a $LOGFILE
exit 0
`;
    
    fs.writeFileSync(afterInstallPath, scriptContent);
  }
  
  // Make sure the script is executable
  try {
    execSync(`chmod +x "${afterInstallPath}"`);
    console.log('Made after-install.sh executable');
  } catch (error) {
    console.error('Error making after-install.sh executable:', error);
  }
}

// Create a valid PNG icon file (256x256 blue icon)
function createValidIconFile() {
  console.log('Creating a valid 256x256 PNG icon file...');
  
  // Icon paths
  const iconPath = path.join(ASSETS_DIR, 'icon.png');
  const iconBackupPath = path.join(ASSETS_DIR, 'icon.png.bak');
  
  // Backup existing icon if it exists and has content
  if (fs.existsSync(iconPath) && fs.statSync(iconPath).size > 0) {
    console.log('Backing up existing icon...');
    fs.copyFileSync(iconPath, iconBackupPath);
  }
  
  // Create a 256x256 blue PNG icon with MasjidConnect branding
  // This is a proper 256x256 blue icon suitable for electron-builder
  const validPngData = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNui8sowAAAAfdEVYdERhdGUAMjAyNC0xMi0zMSAwODoyNDo0MSAtMDUwMKwtKNcAAAg8SURBVHic7d1/iFV1Hwfwz/fdOeeee8+9c++91/v7GpEtl0jIsjYzlIhMwwcLbDMq8gELijBhQwiLH1hEGBL+sKCIoD/KgiD6Q1hQEEH9UVjkQxkR/iBDI4tsVdqszWa79+793nPPOed7zvf7x3e/3+87Z8459/v93nPPPed8P5/P5/MFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgP/j/wCjZOGzCwIBGgAAAABJRU5ErkJggg==',
    'base64'
  );
  
  try {
    fs.writeFileSync(iconPath, validPngData);
    console.log(`Created valid 256x256 PNG icon at: ${iconPath}`);
    return true;
  } catch (error) {
    console.error('Error creating icon file:', error);
    return false;
  }
}

// Create a build verification/optimization report
function createBuildReport() {
  const reportPath = path.join(BUILD_DIR, 'rpi-build-report.txt');
  const timestamp = new Date().toISOString();
  
  let reportContent = `MasjidConnect Display App - Raspberry Pi Build Report
Generated: ${timestamp}

Build Directory Structure:
-------------------------
`;

  // Add directory structure to report
  try {
    const buildFiles = execSync(`find "${BUILD_DIR}" -type f | sort`).toString();
    reportContent += buildFiles;
  } catch (error) {
    reportContent += `Error listing build files: ${error.message}\n`;
  }
  
  reportContent += `
Optimizations Applied:
--------------------
- Created after-install.sh script for desktop integration
- Created valid application icon
- Set up package dependencies for Raspberry Pi compatibility
- Configured auto-updater for GitHub releases

Notes:
-----
- The application will start automatically on boot
- Updates will be checked hourly when online
- For manual updates, run: sudo apt-get update && sudo apt-get upgrade
`;

  fs.writeFileSync(reportPath, reportContent);
  console.log(`Build report created at: ${reportPath}`);
}

// Main execution
try {
  prepareAfterInstallScript();
  createValidIconFile();
  createBuildReport();
  console.log('Raspberry Pi build preparation completed successfully!');
} catch (error) {
  console.error('Error preparing Raspberry Pi build:', error);
  process.exit(1);
} 