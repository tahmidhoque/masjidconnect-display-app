#!/bin/bash
# MasjidConnect Display App - Build and Install on Raspberry Pi
# This script builds and installs the app directly on the Raspberry Pi

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Check if running as root for installation
INSTALL_SYSTEM=false
if [ "$(id -u)" -eq 0 ]; then
    INSTALL_SYSTEM=true
    print_warning "Running as root - will install system-wide"
else
    print_status "Running as user - will install locally"
fi

print_header "MasjidConnect Display App - RPi Builder"

# Check if we're on a Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null; then
    print_warning "This doesn't appear to be a Raspberry Pi"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check available memory
TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
if [ "$TOTAL_MEM" -lt 1000 ]; then
    print_warning "Low memory detected ($TOTAL_MEM MB). Build may be slow or fail."
    print_status "Consider enabling swap or building on a more powerful Pi."
fi

# Check Node.js version
print_status "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Installing Node.js..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y nodejs npm
    else
        print_error "Please install Node.js 16+ manually"
        exit 1
    fi
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_error "Node.js 16+ required (found: $(node -v))"
    print_status "Install newer Node.js: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    exit 1
fi

print_status "Node.js $(node -v) found ✓"

# Install build dependencies
print_status "Installing build dependencies..."
if [ "$INSTALL_SYSTEM" = true ]; then
    apt-get update
    apt-get install -y \
        build-essential \
        python3 \
        libnss3-dev \
        libatk-bridge2.0-dev \
        libdrm2 \
        libxkbcommon0 \
        libgtk-3-0 \
        libgbm1 \
        libasound2-dev \
        git
fi

# Set memory-optimized npm settings
print_status "Configuring npm for Raspberry Pi..."
npm config set registry https://registry.npmjs.org/
npm config set maxsockets 3
npm config set fund false
npm config set audit false

# Increase Node.js memory limit for build
export NODE_OPTIONS="--max_old_space_size=1024"

# Install dependencies with optimizations
print_status "Installing project dependencies (this may take a while)..."
if [ -f "package-lock.json" ]; then
    npm ci --production=false --silent --no-progress
else
    npm install --silent --no-progress
fi

# Create optimized build
print_status "Building React application (optimized for RPi)..."

# Disable ESLint during build to speed things up
export GENERATE_SOURCEMAP=false
export SKIP_PREFLIGHT_CHECK=true

# Create .env.local to disable problematic features during build
cat > .env.local << EOF
GENERATE_SOURCEMAP=false
ESLINT_NO_DEV_ERRORS=true
TSC_COMPILE_ON_ERROR=true
FAST_REFRESH=false
EOF

# Build with memory constraints
npm run build 2>/dev/null || {
    print_warning "Build failed, trying with less memory..."
    export NODE_OPTIONS="--max_old_space_size=512"
    npm run build
}

# Clean up
rm -f .env.local

print_status "Fixing paths for Electron..."
chmod +x fix-paths.sh
./fix-paths.sh

# Prepare installation directories
INSTALL_DIR="/opt/masjidconnect-display"
USER_INSTALL_DIR="$HOME/.local/share/masjidconnect-display"

if [ "$INSTALL_SYSTEM" = true ]; then
    TARGET_DIR="$INSTALL_DIR"
    print_status "Installing system-wide to $INSTALL_DIR"
    
    # Create installation directory
    mkdir -p "$INSTALL_DIR"
    
    # Copy application files maintaining structure
    cp -r build/* "$INSTALL_DIR/"
    cp -r electron "$INSTALL_DIR/"
    cp -r node_modules "$INSTALL_DIR/"
    cp package.json "$INSTALL_DIR/"
    
    # Copy fonts
    if [ -d "src/assets/fonts" ]; then
        mkdir -p "$INSTALL_DIR/fonts"
        cp -r src/assets/fonts/* "$INSTALL_DIR/fonts/"
    fi
    
    # Create optimized startup script
    cat > "$INSTALL_DIR/masjidconnect-display" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"

# Set environment for Raspberry Pi
export ELECTRON_ENABLE_LOGGING=false
export ELECTRON_DISABLE_SANDBOX=1

# Launch with optimal flags for RPi
exec node_modules/.bin/electron . \
    --no-sandbox \
    --disable-gpu-compositing \
    --disable-software-rasterizer \
    --disable-dev-shm-usage \
    --disable-extensions \
    --disable-plugins \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    --max-old-space-size=256 \
    "$@"
EOF
    
    chmod +x "$INSTALL_DIR/masjidconnect-display"
    
    # Create desktop entry
    cat > /usr/share/applications/masjidconnect-display.desktop << EOF
[Desktop Entry]
Type=Application
Name=MasjidConnect Display
Exec=$INSTALL_DIR/masjidconnect-display
Comment=Digital signage for mosques
Categories=Utility;Education;
StartupNotify=false
Terminal=false
EOF
    
    # Set up autostart
    mkdir -p /etc/xdg/autostart/
    cp /usr/share/applications/masjidconnect-display.desktop /etc/xdg/autostart/
    
    # Create systemd service
    cat > /etc/systemd/system/masjidconnect-display.service << EOF
[Unit]
Description=MasjidConnect Display App
After=graphical-session.target network-online.target
Wants=graphical-session.target network-online.target

[Service]
Type=simple
User=pi
Environment=DISPLAY=:0
Environment=XDG_RUNTIME_DIR=/run/user/1000
ExecStart=$INSTALL_DIR/masjidconnect-display
Restart=always
RestartSec=10

[Install]
WantedBy=graphical-session.target
EOF
    
    systemctl daemon-reload
    systemctl enable masjidconnect-display.service
    
else
    TARGET_DIR="$USER_INSTALL_DIR"
    print_status "Installing locally to $USER_INSTALL_DIR"
    
    # Create user installation directory
    mkdir -p "$USER_INSTALL_DIR"
    
    # Copy application files maintaining structure  
    cp -r build/* "$USER_INSTALL_DIR/"
    cp -r electron "$USER_INSTALL_DIR/"
    cp -r node_modules "$USER_INSTALL_DIR/"
    cp package.json "$USER_INSTALL_DIR/"
    
    # Create startup script
    cat > "$USER_INSTALL_DIR/masjidconnect-display" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
export ELECTRON_DISABLE_SANDBOX=1
exec node_modules/.bin/electron . --no-sandbox "$@"
EOF
    
    chmod +x "$USER_INSTALL_DIR/masjidconnect-display"
    
    # Create user desktop entry
    mkdir -p "$HOME/.local/share/applications"
    cat > "$HOME/.local/share/applications/masjidconnect-display.desktop" << EOF
[Desktop Entry]
Type=Application
Name=MasjidConnect Display
Exec=$USER_INSTALL_DIR/masjidconnect-display
Comment=Digital signage for mosques
Categories=Utility;Education;
StartupNotify=false
Terminal=false
EOF
    
    # Create user autostart
    mkdir -p "$HOME/.config/autostart"
    cp "$HOME/.local/share/applications/masjidconnect-display.desktop" "$HOME/.config/autostart/"
fi

print_header "Installation Complete!"

echo
print_status "✅ MasjidConnect Display App installed successfully!"
echo
print_status "📍 Installation location: $TARGET_DIR"
print_status "🚀 Auto-start configured: Yes"
echo

if [ "$INSTALL_SYSTEM" = true ]; then
    print_status "System-wide installation commands:"
    echo "  Start manually: $INSTALL_DIR/masjidconnect-display"
    echo "  Start service:  sudo systemctl start masjidconnect-display"
    echo "  Stop service:   sudo systemctl stop masjidconnect-display"
    echo "  View logs:      journalctl -u masjidconnect-display -f"
else
    print_status "User installation commands:"
    echo "  Start manually: $USER_INSTALL_DIR/masjidconnect-display"
    echo "  Background:     $USER_INSTALL_DIR/masjidconnect-display &"
fi

echo
print_status "🔄 The app will start automatically on next boot"
print_status "📱 Follow on-screen instructions to pair with your MasjidConnect account"
echo

# Clean up build artifacts to save space
print_status "Cleaning up build artifacts to save space..."
rm -rf node_modules/.cache build

print_status "🎉 Build and installation complete!"
print_status "Reboot recommended to start the display app automatically." 