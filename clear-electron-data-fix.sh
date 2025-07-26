#!/bin/bash
# MasjidConnect Display App - Fixed Electron Data Clearer
# Uses actual app configuration to find correct data directories

set -e

print_status() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARN]\033[0m $1"
}

print_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

print_header() {
    echo -e "\033[0;34m========================================\033[0m"
    echo -e "\033[0;34m$1\033[0m"
    echo -e "\033[0;34m========================================\033[0m"
}

print_header "MasjidConnect Display - Fixed Data Cleaner"

# Get actual app names from package.json if available
if [ -f "package.json" ]; then
    PACKAGE_NAME=$(node -p "require('./package.json').name" 2>/dev/null || echo "")
    PRODUCT_NAME=$(node -p "require('./package.json').build?.productName || ''" 2>/dev/null || echo "")
    print_status "Found package name: $PACKAGE_NAME"
    print_status "Found product name: $PRODUCT_NAME"
fi

# All possible app names and variations
APP_NAMES=(
    "masjidconnect-display-app"
    "MasjidConnect Display"
    "masjidconnect-display"
    "Masjidconnect Display App" 
    "com.masjidconnect.display"
)

if [ -n "$PACKAGE_NAME" ]; then
    APP_NAMES+=("$PACKAGE_NAME")
fi
if [ -n "$PRODUCT_NAME" ]; then
    APP_NAMES+=("$PRODUCT_NAME")
fi

# Stop the application completely
print_status "Stopping MasjidConnect Display App..."

# Stop systemd service
sudo systemctl stop masjidconnect-display 2>/dev/null || true

# Kill all related processes
pkill -f masjidconnect 2>/dev/null || true
pkill -f "electron.*display" 2>/dev/null || true
pkill -f "MasjidConnect" 2>/dev/null || true

# Wait for processes to stop
sleep 3

# Force kill if still running
pkill -9 -f masjidconnect 2>/dev/null || true
pkill -9 -f "electron.*display" 2>/dev/null || true

print_status "✓ Application stopped"

# Determine OS and set base directories
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    BASE_DIRS=(
        "$HOME/.config"
        "$HOME/.local/share" 
        "$HOME/.cache"
    )
elif [[ "$OSTYPE" == "darwin"* ]]; then
    BASE_DIRS=(
        "$HOME/Library/Application Support"
        "$HOME/Library/Caches"
        "$HOME/Library/Preferences"
    )
else
    print_error "Unsupported OS: $OSTYPE"
    exit 1
fi

# Find and clear actual data directories
CLEARED_COUNT=0
TOTAL_SIZE=0

print_status "Searching and clearing Electron data directories..."

for base_dir in "${BASE_DIRS[@]}"; do
    if [ -d "$base_dir" ]; then
        for app_name in "${APP_NAMES[@]}"; do
            target_dir="$base_dir/$app_name"
            if [ -d "$target_dir" ]; then
                # Calculate size before removal
                if command -v du >/dev/null; then
                    SIZE=$(du -sk "$target_dir" 2>/dev/null | cut -f1 || echo "0")
                    TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
                fi
                
                print_status "🗑️  Clearing: $target_dir"
                rm -rf "$target_dir"
                CLEARED_COUNT=$((CLEARED_COUNT + 1))
            fi
        done
        
        # Also search for any directories containing masjid/display/electron
        find "$base_dir" -maxdepth 1 -type d \( -iname "*masjid*" -o -iname "*display*" \) 2>/dev/null | while read -r dir; do
            if [[ "$(basename "$dir")" != "masjidconnect-display" ]]; then  # Don't delete the installation directory
                # Check if it looks like electron data
                if [ -f "$dir/Preferences" ] || [ -f "$dir/Local Storage/leveldb/CURRENT" ] || [ -d "$dir/Cache" ]; then
                    print_status "🗑️  Clearing related: $dir"
                    rm -rf "$dir"
                fi
            fi
        done
    fi
done

# Clear specific Electron storage locations
ELECTRON_STORAGE_PATTERNS=(
    "$HOME/.config/*/Local Storage"
    "$HOME/.config/*/IndexedDB" 
    "$HOME/.config/*/databases"
    "$HOME/.config/*/Service Worker"
    "$HOME/.config/*/Cache"
    "$HOME/.config/*/Code Cache"
    "$HOME/.config/*/GPUCache"
    "$HOME/.config/*/CachedData"
)

print_status "Clearing Electron storage patterns..."

for pattern in "${ELECTRON_STORAGE_PATTERNS[@]}"; do
    for dir in $pattern; do
        if [ -d "$dir" ]; then
            parent_dir=$(dirname "$dir")
            parent_name=$(basename "$parent_dir")
            
            # Check if parent directory name matches our app
            for app_name in "${APP_NAMES[@]}"; do
                if [[ "$parent_name" == "$app_name" ]]; then
                    print_status "🗑️  Clearing storage: $dir"
                    rm -rf "$dir"
                    break
                fi
            done
        fi
    done
done

# Clear installation-specific config directories
INSTALL_CONFIGS=(
    "/opt/masjidconnect-display/config"
    "$HOME/.local/share/masjidconnect-display/config"
)

for config_dir in "${INSTALL_CONFIGS[@]}"; do
    if [ -d "$config_dir" ]; then
        print_status "🗑️  Clearing installation config: $config_dir"
        rm -rf "$config_dir"
        CLEARED_COUNT=$((CLEARED_COUNT + 1))
    fi
done

# Clear any remaining process-specific temp files
TEMP_PATTERNS=(
    "/tmp/*masjid*"
    "/tmp/*display*"
    "/tmp/electron*"
)

for pattern in "${TEMP_PATTERNS[@]}"; do
    for file in $pattern; do
        if [ -e "$file" ]; then
            print_status "🗑️  Clearing temp: $file"
            rm -rf "$file"
        fi
    done
done

# Clear any Chrome/Chromium data that might be app-related
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CHROME_DIRS=(
        "$HOME/.config/google-chrome/Default"
        "$HOME/.config/chromium/Default"
    )
    
    for chrome_dir in "${CHROME_DIRS[@]}"; do
        if [ -d "$chrome_dir" ]; then
            # Look for app-specific Local Storage
            LS_DIR="$chrome_dir/Local Storage/leveldb"
            if [ -d "$LS_DIR" ]; then
                # Clear any local storage that might be from our app
                find "$LS_DIR" -name "*masjid*" -o -name "*display*" | while read -r file; do
                    print_status "🗑️  Clearing browser storage: $file"
                    rm -f "$file"
                done
            fi
        fi
    done
fi

print_header "Cleanup Summary"

if [ $CLEARED_COUNT -gt 0 ]; then
    print_status "✅ Cleared $CLEARED_COUNT directories/files"
    if [ $TOTAL_SIZE -gt 0 ]; then
        print_status "📊 Freed approximately $((TOTAL_SIZE / 1024)) MB of data"
    fi
else
    print_warning "❓ No Electron data directories found to clear"
    print_status "This could mean:"
    echo "   • The app hasn't been run yet (no data created)"
    echo "   • Data is stored with a different app name"  
    echo "   • Data is in a location not checked by this script"
fi

echo
print_status "🔄 Next steps:"
echo "   1. Start the app: sudo systemctl start masjidconnect-display"
echo "   2. The app should show the pairing screen"
echo "   3. If data persists, run './find-electron-data.sh' to locate it"

echo
print_status "💡 Debugging tips:"
echo "   • Check app logs: journalctl -u masjidconnect-display -f"
echo "   • Monitor data creation: watch -n 1 'find ~/.config -name \"*masjid*\" -o -name \"*display*\"'"
echo "   • Verify fresh start: look for pairing screen instead of main display" 