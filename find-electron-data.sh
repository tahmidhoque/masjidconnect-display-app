#!/bin/bash
# Find actual Electron data directories for MasjidConnect Display App

print_status() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

print_header() {
    echo -e "\033[0;34m========================================\033[0m"
    echo -e "\033[0;34m$1\033[0m"
    echo -e "\033[0;34m========================================\033[0m"
}

print_header "Finding Electron Data Directories"

# Possible app names based on package.json
APP_NAMES=(
    "masjidconnect-display-app"
    "MasjidConnect Display"
    "masjidconnect-display"
    "Masjidconnect Display App"
)

# Common Electron data locations
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
fi

print_status "Searching for Electron data directories..."
echo

FOUND_DIRS=()

for base_dir in "${BASE_DIRS[@]}"; do
    if [ -d "$base_dir" ]; then
        for app_name in "${APP_NAMES[@]}"; do
            target_dir="$base_dir/$app_name"
            if [ -d "$target_dir" ]; then
                echo "✅ Found: $target_dir"
                FOUND_DIRS+=("$target_dir")
                
                # Show contents
                echo "   Contents:"
                ls -la "$target_dir" 2>/dev/null | head -10 | sed 's/^/     /'
                echo
            fi
        done
    fi
done

# Also search for any directory containing "masjid" or "display"
print_status "Searching for directories containing 'masjid' or 'display'..."
echo

for base_dir in "${BASE_DIRS[@]}"; do
    if [ -d "$base_dir" ]; then
        find "$base_dir" -maxdepth 1 -type d -iname "*masjid*" 2>/dev/null | while read -r dir; do
            echo "🔍 Found masjid-related: $dir"
            ls -la "$dir" 2>/dev/null | head -5 | sed 's/^/     /'
            echo
        done
        
        find "$base_dir" -maxdepth 1 -type d -iname "*display*" 2>/dev/null | while read -r dir; do
            echo "🔍 Found display-related: $dir"
            ls -la "$dir" 2>/dev/null | head -5 | sed 's/^/     /'
            echo
        done
    fi
done

# Check if app is running and show its process info
if pgrep -f "masjidconnect\|electron.*display" >/dev/null; then
    print_status "App is currently running:"
    ps aux | grep -E "(masjidconnect|electron.*display)" | grep -v grep
    echo
fi

# Show any chrome/chromium profile data (since Electron uses Chromium)
print_status "Checking for Chromium/Chrome profiles..."
CHROME_DIRS=(
    "$HOME/.config/google-chrome"
    "$HOME/.config/chromium" 
    "$HOME/.cache/google-chrome"
    "$HOME/.cache/chromium"
)

for chrome_dir in "${CHROME_DIRS[@]}"; do
    if [ -d "$chrome_dir" ]; then
        # Look for app-specific profiles
        find "$chrome_dir" -name "*masjid*" -o -name "*display*" 2>/dev/null | while read -r dir; do
            echo "🌐 Found Chrome/Chromium data: $dir"
        done
    fi
done

echo
print_status "Summary of directories to clear:"
if [ ${#FOUND_DIRS[@]} -eq 0 ]; then
    echo "❌ No Electron data directories found!"
    echo "   The app might be using a different naming scheme."
    echo "   Try running the app first, then run this script again."
else
    for dir in "${FOUND_DIRS[@]}"; do
        echo "  📁 $dir"
    done
fi

echo
print_status "Next steps:"
echo "  1. Stop the app completely"
echo "  2. Clear the directories listed above"
echo "  3. Restart the app for fresh state"

# Create a custom clear script based on found directories
if [ ${#FOUND_DIRS[@]} -gt 0 ]; then
    cat > clear-found-data.sh << 'EOF'
#!/bin/bash
# Auto-generated script to clear found Electron data

print_status() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

print_status "Stopping MasjidConnect Display App..."
pkill -f masjidconnect-display 2>/dev/null || true
sudo systemctl stop masjidconnect-display 2>/dev/null || true
sleep 2

print_status "Clearing found Electron data directories..."

EOF

    for dir in "${FOUND_DIRS[@]}"; do
        echo "if [ -d \"$dir\" ]; then" >> clear-found-data.sh
        echo "    rm -rf \"$dir\"" >> clear-found-data.sh
        echo "    print_status \"✓ Cleared $dir\"" >> clear-found-data.sh
        echo "fi" >> clear-found-data.sh
        echo "" >> clear-found-data.sh
    done

    cat >> clear-found-data.sh << 'EOF'

print_status "✅ Cleared all found Electron data"
print_status "Start the app to see fresh state"
EOF

    chmod +x clear-found-data.sh
    echo
    print_status "📝 Created custom clear script: ./clear-found-data.sh"
    echo "   Run this script to clear the actual data directories found."
fi 