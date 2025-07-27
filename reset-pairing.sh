#!/bin/bash
# MasjidConnect Display App - Reset Pairing Only
# Clears only pairing and authentication data for re-pairing

print_status() {
    echo -e "\033[0;32m[INFO]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARN]\033[0m $1"
}

print_status "MasjidConnect Display - Reset Pairing Data"

# Stop the app
print_status "Stopping application..."
pkill -f masjidconnect-display 2>/dev/null || true
sudo systemctl stop masjidconnect-display 2>/dev/null || true

# Clear pairing-related data
APP_CONFIG_DIRS=(
    "$HOME/.config/masjidconnect-display"
    "/opt/masjidconnect-display/config"
    "$HOME/.local/share/masjidconnect-display/config"
)

for dir in "${APP_CONFIG_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        # Clear auth-related files
        rm -f "$dir/auth.json" 2>/dev/null || true
        rm -f "$dir/pairing.json" 2>/dev/null || true
        rm -f "$dir/credentials.json" 2>/dev/null || true
        rm -f "$dir/screen-config.json" 2>/dev/null || true
        
        print_status "✓ Cleared pairing data from $(basename "$dir")"
    fi
done

# Clear localStorage that might contain auth tokens
STORAGE_DIRS=(
    "$HOME/.config/masjidconnect-display/Local Storage"
    "$HOME/.config/masjidconnect-display/localStorage"
)

for dir in "${STORAGE_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        rm -rf "$dir"
        print_status "✓ Cleared auth storage"
    fi
done

print_status "✅ Pairing data cleared - device will show pairing screen on next start"
print_status "To start: sudo systemctl start masjidconnect-display" 