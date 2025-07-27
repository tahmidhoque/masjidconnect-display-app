#!/bin/bash
# Fix script for broken MasjidConnect Display installations
# Fixes the electron directory structure issue

print_status() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

print_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

# Determine installation location
INSTALL_DIR="/opt/masjidconnect-display"
USER_INSTALL_DIR="$HOME/.local/share/masjidconnect-display"

if [ -d "$INSTALL_DIR" ] && [ "$(id -u)" -eq 0 ]; then
    TARGET_DIR="$INSTALL_DIR"
    INSTALL_TYPE="system"
elif [ -d "$USER_INSTALL_DIR" ]; then
    TARGET_DIR="$USER_INSTALL_DIR"
    INSTALL_TYPE="user"
else
    print_error "No MasjidConnect Display installation found"
    exit 1
fi

print_status "Found $INSTALL_TYPE installation at: $TARGET_DIR"

# Check if main.js exists in wrong location
if [ -f "$TARGET_DIR/main.js" ] && [ ! -d "$TARGET_DIR/electron" ]; then
    print_status "Fixing electron directory structure..."
    
    # Stop the app if running
    pkill -f masjidconnect-display 2>/dev/null || true
    
    # Create electron directory
    mkdir -p "$TARGET_DIR/electron"
    
    # Move electron files to proper location
    mv "$TARGET_DIR/main.js" "$TARGET_DIR/electron/"
    mv "$TARGET_DIR/preload.js" "$TARGET_DIR/electron/" 2>/dev/null || true
    mv "$TARGET_DIR/main.js.bak" "$TARGET_DIR/electron/" 2>/dev/null || true
    
    print_status "✅ Fixed electron directory structure"
    
    # Update the startup script to ensure it works from the right directory
    cat > "$TARGET_DIR/masjidconnect-display" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"

# Verify electron directory exists
if [ ! -f "electron/main.js" ]; then
    echo "Error: electron/main.js not found"
    echo "Expected structure: $(pwd)/electron/main.js"
    echo "Actual files:"
    find . -name "*.js" -type f | head -10
    exit 1
fi

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
    
    chmod +x "$TARGET_DIR/masjidconnect-display"
    print_status "✅ Updated startup script"
    
elif [ -d "$TARGET_DIR/electron" ] && [ -f "$TARGET_DIR/electron/main.js" ]; then
    print_status "✅ Installation structure is already correct"
else
    print_error "Could not determine the issue with the installation"
    print_status "Debug info:"
    echo "Target dir: $TARGET_DIR"
    echo "Files in target:"
    ls -la "$TARGET_DIR" | head -10
    exit 1
fi

# Test the installation
print_status "Testing the installation..."
if [ -f "$TARGET_DIR/electron/main.js" ]; then
    print_status "✅ electron/main.js found"
else
    print_error "❌ electron/main.js still missing"
    exit 1
fi

if [ -f "$TARGET_DIR/package.json" ]; then
    MAIN_ENTRY=$(node -p "require('$TARGET_DIR/package.json').main" 2>/dev/null || echo "unknown")
    print_status "package.json main entry: $MAIN_ENTRY"
    
    if [ -f "$TARGET_DIR/$MAIN_ENTRY" ]; then
        print_status "✅ Main entry file exists at correct location"
    else
        print_error "❌ Main entry file missing: $TARGET_DIR/$MAIN_ENTRY"
        exit 1
    fi
fi

print_status "🎉 Installation fix completed!"
print_status "You can now start the app with: $TARGET_DIR/masjidconnect-display" 