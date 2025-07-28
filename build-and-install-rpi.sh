#!/bin/bash

# Exit on error
set -e

echo "========================================"
echo "MasjidConnect Display - RPi Build & Install"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're on a Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null; then
    print_warning "This script is optimized for Raspberry Pi. Continuing anyway..."
fi

# Check available memory and warn if low
AVAILABLE_MEM=$(free -m | awk 'NR==2{printf "%d", $7}')
if [ "$AVAILABLE_MEM" -lt 500 ]; then
    print_warning "Low available memory ($AVAILABLE_MEM MB). Build may be slow or fail."
    print_warning "Consider closing other applications or increasing swap space."
fi

# Clean up previous builds
print_status "Cleaning up previous builds..."
rm -rf build dist node_modules/.cache
npm cache clean --force 2>/dev/null || true

# Install dependencies with timeout for RPi
print_status "Installing dependencies (this may take a while on RPi)..."
timeout 1800 npm install || {
    print_error "Dependency installation failed or timed out"
    exit 1
}

# Create optimized build environment for RPi
print_status "Setting up RPi-optimized build environment..."

# Set Node.js memory limits for RPi
export NODE_OPTIONS="--max-old-space-size=1024"

# Create React build with optimizations
print_status "Building React application..."

# Use the rebuild script which has all the optimizations
if [ -f "rebuild.sh" ]; then
    print_status "Using optimized rebuild script..."
    chmod +x rebuild.sh
    ./rebuild.sh
else
    print_status "Using standard build process..."
    PUBLIC_URL="./" npm run build
fi

# Verify build was successful
if [ ! -d "build" ]; then
    print_error "React build failed - build directory not found"
    exit 1
fi

# Build Electron app for ARM (RPi)
print_status "Building Electron app for Raspberry Pi..."

# Determine RPi architecture
ARCH=$(uname -m)
case $ARCH in
    armv6l|armv7l)
        ELECTRON_TARGET="--armv7l"
        print_status "Building for ARMv7 (RPi 2/3/4)"
        ;;
    aarch64|arm64)
        ELECTRON_TARGET="--arm64"
        print_status "Building for ARM64 (RPi 4 64-bit)"
        ;;
    *)
        ELECTRON_TARGET="--armv7l"
        print_warning "Unknown architecture $ARCH, defaulting to ARMv7"
        ;;
esac

# Build with reduced memory usage
timeout 1800 npm run electron:build:rpi:noicon || {
    print_error "Electron build failed or timed out"
    exit 1
}

# Find the built package
DEB_FILE=$(find dist -name "*.deb" | head -1)
if [ -z "$DEB_FILE" ]; then
    print_error "No .deb package found in dist directory"
    exit 1
fi

print_status "Found package: $DEB_FILE"

# Install the package
print_status "Installing MasjidConnect Display..."
sudo dpkg -i "$DEB_FILE" || {
    print_warning "Package installation failed, attempting to fix dependencies..."
    sudo apt-get install -f -y
    sudo dpkg -i "$DEB_FILE"
}

# Create systemd service for auto-start (optional)
print_status "Setting up auto-start service..."
sudo tee /etc/systemd/system/masjidconnect-display.service > /dev/null << 'EOF'
[Unit]
Description=MasjidConnect Display
After=graphical-session.target

[Service]
Type=simple
User=pi
Environment=DISPLAY=:0
ExecStart=/opt/MasjidConnect Display/masjidconnect-display --no-sandbox --disable-dev-shm-usage
Restart=always
RestartSec=5

[Install]
WantedBy=graphical-session.target
EOF

# Enable the service
sudo systemctl daemon-reload
sudo systemctl enable masjidconnect-display.service

# Optimize system for kiosk mode
print_status "Applying RPi optimizations..."

# GPU memory split optimization
if [ -f /boot/config.txt ]; then
    sudo sed -i '/^gpu_mem=/d' /boot/config.txt
    echo "gpu_mem=128" | sudo tee -a /boot/config.txt
fi

# Disable unnecessary services for better performance
sudo systemctl disable bluetooth.service 2>/dev/null || true
sudo systemctl disable hciuart.service 2>/dev/null || true

# Create desktop shortcut
if [ -d "/home/pi/Desktop" ]; then
    cat > /home/pi/Desktop/MasjidConnect.desktop << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=MasjidConnect Display
Comment=Digital signage for mosques
Exec=/opt/MasjidConnect Display/masjidconnect-display --no-sandbox
Icon=/opt/MasjidConnect Display/resources/app/assets/icon.png
Terminal=false
Categories=Utility;
EOF
    chmod +x /home/pi/Desktop/MasjidConnect.desktop
fi

# Set up auto-hide mouse cursor for kiosk mode
if command -v unclutter &> /dev/null; then
    print_status "unclutter already installed"
else
    print_status "Installing unclutter to hide mouse cursor..."
    sudo apt-get update
    sudo apt-get install -y unclutter
fi

# Final status
print_status "========================================"
print_status "Installation completed successfully!"
print_status "========================================"
print_status ""
print_status "Next steps:"
print_status "1. Restart your Raspberry Pi: sudo reboot"
print_status "2. The app will start automatically after reboot"
print_status "3. Or start manually: /opt/MasjidConnect Display/masjidconnect-display"
print_status ""
print_status "For kiosk mode setup, see README-RASPBERRY-PI.md"
print_status ""

# Offer to reboot
read -p "Would you like to reboot now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Rebooting..."
    sudo reboot
fi