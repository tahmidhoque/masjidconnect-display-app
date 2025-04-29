#!/bin/bash

# MasjidConnect Display App - Raspberry Pi Build Script
# This script helps with creating optimized Raspberry Pi packages

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Parse arguments
BUILD_ARCH="armv7l"  # Default architecture
PUBLISH_MODE="never" # Default publish mode

# Get script directory for absolute paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BUILD_DIR="$SCRIPT_DIR/build"
ASSETS_DIR="$SCRIPT_DIR/assets"

# Parse command line arguments
while [ "$#" -gt 0 ]; do
  case "$1" in
    --arm64)
      BUILD_ARCH="arm64"
      shift 1
      ;;
    --armv7l)
      BUILD_ARCH="armv7l"
      shift 1
      ;;
    --all)
      BUILD_ARCH="all"
      shift 1
      ;;
    --publish)
      PUBLISH_MODE="always"
      shift 1
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--arm64 | --armv7l | --all] [--publish]"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}=== MasjidConnect Display App - Raspberry Pi Build ===${NC}"
echo "This script will build the application for Raspberry Pi devices."
echo -e "Building for architecture: ${YELLOW}${BUILD_ARCH}${NC}"
echo -e "Publish mode: ${YELLOW}${PUBLISH_MODE}${NC}"
echo -e "Working directory: ${YELLOW}${SCRIPT_DIR}${NC}"

# Create build directory if it doesn't exist
mkdir -p "$BUILD_DIR"

# Check Node.js version
echo -e "${YELLOW}Checking Node.js version...${NC}"
NODE_VERSION=$(node -v)
echo "Node.js version: $NODE_VERSION"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm install
fi

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
rm -rf "$SCRIPT_DIR/dist/"
rm -rf "$BUILD_DIR/electron/"

# Prepare after-install script (place directly in project root for electron-builder)
echo -e "${YELLOW}Creating after-install script...${NC}"
cat > "$SCRIPT_DIR/after-install.sh" << EOL
#!/bin/bash

# Log file for installation
LOGFILE="/var/log/masjidconnect-install.log"

# Ensure log file exists and is writable
touch \$LOGFILE
chmod 644 \$LOGFILE

echo "Running MasjidConnect Display post-installation script..." | tee -a \$LOGFILE
date | tee -a \$LOGFILE

# Create desktop file in proper location
echo "Creating desktop entry..." | tee -a \$LOGFILE
cat > /usr/share/applications/masjidconnect-display.desktop << EOD
[Desktop Entry]
Type=Application
Name=MasjidConnect Display
Exec=/opt/masjidconnect-display/masjidconnect-display --no-sandbox
Icon=/opt/masjidconnect-display/resources/assets/icon.png
Comment=Digital signage for mosques
Categories=Utility;Education;
X-GNOME-Autostart-enabled=true
EOD

# Set up autostart for display
echo "Setting up autostart..." | tee -a \$LOGFILE
mkdir -p /etc/xdg/autostart/
cp /usr/share/applications/masjidconnect-display.desktop /etc/xdg/autostart/

# Make sure the app has proper permissions
echo "Setting permissions..." | tee -a \$LOGFILE
chmod +x /opt/masjidconnect-display/masjidconnect-display

echo "Post-installation completed successfully!" | tee -a \$LOGFILE
exit 0
EOL

# Make the after-install script executable
chmod +x "$SCRIPT_DIR/after-install.sh"

# Also put a copy in the build directory for completeness
cp "$SCRIPT_DIR/after-install.sh" "$BUILD_DIR/after-install.sh"
chmod +x "$BUILD_DIR/after-install.sh"

# Perform the build
echo -e "${GREEN}Building React app...${NC}"
npm run build

# Verify path to after-install.sh before building
echo -e "${YELLOW}Verifying after-install.sh location...${NC}"
if [ ! -f "$SCRIPT_DIR/after-install.sh" ]; then
  echo -e "${RED}ERROR: after-install.sh missing from project root!${NC}"
  exit 1
fi

ls -la "$SCRIPT_DIR/after-install.sh"
echo "Script exists and is executable. Proceeding with build..."

# Build for the specified architecture with icon disabled
if [ "$BUILD_ARCH" == "all" ]; then
  echo -e "${GREEN}Building Electron app for all Raspberry Pi architectures...${NC}"
  npx electron-builder build --linux deb tar.gz --armv7l --arm64 --config.linux.icon=false --publish ${PUBLISH_MODE}
elif [ "$BUILD_ARCH" == "arm64" ]; then
  echo -e "${GREEN}Building Electron app for Raspberry Pi (arm64)...${NC}"
  npx electron-builder build --linux deb tar.gz --arm64 --config.linux.icon=false --publish ${PUBLISH_MODE}
else
  echo -e "${GREEN}Building Electron app for Raspberry Pi (armv7l)...${NC}"
  npx electron-builder build --linux deb tar.gz --armv7l --config.linux.icon=false --publish ${PUBLISH_MODE}
fi

echo -e "${GREEN}Build process completed${NC}"
echo "The following packages have been created:"
ls -la dist/*.deb dist/*.tar.gz 2>/dev/null || echo "No packages were created. Check errors above."

echo -e "\n${YELLOW}Usage Instructions:${NC}"
echo "1. Copy the .deb file to your Raspberry Pi"
echo "2. Install it using:"
echo "   sudo apt update"
echo "   sudo apt install -y ./masjidconnect-display-*.deb"
echo "3. If installation fails with '_apt' user errors, run:"
echo "   sudo sh -c 'echo \"APT::Sandbox::User \\\"_apt\\\";\" > /etc/apt/apt.conf.d/99temp-allow-sandbox'"
echo "   Then try installing again"
echo "4. If the app fails to start with missing libraries:"
echo "   sudo apt install -y libgbm1 libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6"
echo "5. The application will start automatically on boot"
echo "6. For updates, install the new .deb file or use the auto-updater"

# Print help for next steps if publishing
if [ "$PUBLISH_MODE" == "always" ]; then
  echo -e "\n${YELLOW}Release Information:${NC}"
  echo "The release has been published to GitHub."
  echo "To check the release status, visit: https://github.com/masjidSolutions/masjidconnect-display-app/releases"
fi 