#!/bin/bash
# MasjidConnect Display App - Clear All Data Script
# Clears all cache, storage, configuration, and logs for a fresh start

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

print_header "MasjidConnect Display - Clear All Data"

# Configuration
APP_NAME="masjidconnect-display"
BACKUP_SUFFIX=".backup.$(date +%s)"

# Determine data directories based on OS and user
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux paths
    USER_CONFIG_DIR="$HOME/.config/$APP_NAME"
    USER_DATA_DIR="$HOME/.local/share/$APP_NAME"
    USER_CACHE_DIR="$HOME/.cache/$APP_NAME"
    USER_LOG_DIR="$HOME/.local/share/$APP_NAME/logs"
    
    # System paths (if running as root)
    SYSTEM_CONFIG_DIR="/etc/$APP_NAME"
    SYSTEM_DATA_DIR="/var/lib/$APP_NAME"
    SYSTEM_CACHE_DIR="/var/cache/$APP_NAME"
    SYSTEM_LOG_DIR="/var/log/$APP_NAME"
    
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS paths
    USER_CONFIG_DIR="$HOME/Library/Application Support/$APP_NAME"
    USER_DATA_DIR="$HOME/Library/Application Support/$APP_NAME"
    USER_CACHE_DIR="$HOME/Library/Caches/$APP_NAME"
    USER_LOG_DIR="$HOME/Library/Logs/$APP_NAME"
    
else
    print_warning "Unsupported OS type: $OSTYPE"
    print_status "Continuing with Linux paths..."
    USER_CONFIG_DIR="$HOME/.config/$APP_NAME"
    USER_DATA_DIR="$HOME/.local/share/$APP_NAME"
    USER_CACHE_DIR="$HOME/.cache/$APP_NAME"
    USER_LOG_DIR="$HOME/.local/share/$APP_NAME/logs"
fi

# App installation directories
INSTALL_DIR="/opt/masjidconnect-display"
USER_INSTALL_DIR="$HOME/.local/share/masjidconnect-display"

# Additional storage locations
BROWSER_CACHE_DIRS=(
    "$HOME/.cache/masjidconnect-display"
    "$HOME/.config/masjidconnect-display/Cache"
    "$HOME/.config/masjidconnect-display/CachedData"
    "$HOME/.config/masjidconnect-display/Code Cache"
    "$HOME/.config/masjidconnect-display/GPUCache"
    "$HOME/.config/masjidconnect-display/Service Worker"
)

# Service and log files
SERVICE_FILES=(
    "/etc/systemd/system/masjidconnect-display.service"
    "/etc/systemd/system/masjidconnect-update.timer"
    "/etc/systemd/system/masjidconnect-update.service"
    "/var/log/masjidconnect-update.log"
    "/var/log/masjidconnect-install.log"
)

# Desktop files
DESKTOP_FILES=(
    "/usr/share/applications/masjidconnect-display.desktop"
    "/etc/xdg/autostart/masjidconnect-display.desktop"
    "$HOME/.local/share/applications/masjidconnect-display.desktop"
    "$HOME/.config/autostart/masjidconnect-display.desktop"
    "/usr/share/applications/masjidconnect-update-checker.desktop"
)

# Function to stop the application
stop_app() {
    print_status "Stopping MasjidConnect Display App..."
    
    # Stop systemd service if exists
    if systemctl is-active --quiet masjidconnect-display 2>/dev/null; then
        sudo systemctl stop masjidconnect-display
        print_status "✓ Stopped systemd service"
    fi
    
    # Kill any running processes
    pkill -f masjidconnect-display 2>/dev/null || true
    pkill -f electron 2>/dev/null || true
    sleep 2
    
    # Force kill if still running
    pkill -9 -f masjidconnect-display 2>/dev/null || true
    
    print_status "✓ Application stopped"
}

# Function to backup data
backup_data() {
    print_status "Creating backup of existing data..."
    
    BACKUP_DIR="$HOME/masjidconnect-backup$BACKUP_SUFFIX"
    mkdir -p "$BACKUP_DIR"
    
    # Backup user data
    for dir in "$USER_CONFIG_DIR" "$USER_DATA_DIR" "$USER_CACHE_DIR"; do
        if [ -d "$dir" ]; then
            cp -r "$dir" "$BACKUP_DIR/$(basename "$dir")" 2>/dev/null || true
            print_status "✓ Backed up $(basename "$dir")"
        fi
    done
    
    # Backup logs if they exist
    if [ -d "$USER_LOG_DIR" ]; then
        cp -r "$USER_LOG_DIR" "$BACKUP_DIR/logs" 2>/dev/null || true
    fi
    
    # Backup system logs if accessible
    if [ -f "/var/log/masjidconnect-update.log" ]; then
        cp "/var/log/masjidconnect-update.log" "$BACKUP_DIR/" 2>/dev/null || true
    fi
    
    print_status "✓ Backup created at: $BACKUP_DIR"
    echo "$BACKUP_DIR" > /tmp/masjidconnect-backup-location
}

# Function to clear user data
clear_user_data() {
    print_status "Clearing user data directories..."
    
    # Clear main data directories
    for dir in "$USER_CONFIG_DIR" "$USER_DATA_DIR" "$USER_CACHE_DIR" "$USER_LOG_DIR"; do
        if [ -d "$dir" ]; then
            rm -rf "$dir"
            print_status "✓ Cleared $(basename "$dir")"
        fi
    done
    
    # Clear browser cache directories
    for dir in "${BROWSER_CACHE_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            rm -rf "$dir"
            print_status "✓ Cleared browser cache: $(basename "$dir")"
        fi
    done
    
    # Clear any LocalStorage/IndexedDB data
    ELECTRON_DATA_DIRS=(
        "$HOME/.config/$APP_NAME/Local Storage"
        "$HOME/.config/$APP_NAME/IndexedDB"
        "$HOME/.config/$APP_NAME/databases"
        "$HOME/.config/$APP_NAME/localStorage"
        "$HOME/.config/$APP_NAME/sessionStorage"
    )
    
    for dir in "${ELECTRON_DATA_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            rm -rf "$dir"
            print_status "✓ Cleared storage: $(basename "$dir")"
        fi
    done
}

# Function to clear system data (requires root)
clear_system_data() {
    if [ "$(id -u)" -eq 0 ]; then
        print_status "Clearing system data directories..."
        
        # Clear system data directories
        for dir in "$SYSTEM_CONFIG_DIR" "$SYSTEM_DATA_DIR" "$SYSTEM_CACHE_DIR" "$SYSTEM_LOG_DIR"; do
            if [ -d "$dir" ]; then
                rm -rf "$dir"
                print_status "✓ Cleared system $(basename "$dir")"
            fi
        done
        
        # Clear system log files
        for file in "${SERVICE_FILES[@]}"; do
            if [[ "$file" == *.log ]] && [ -f "$file" ]; then
                > "$file"  # Truncate log file instead of deleting
                print_status "✓ Cleared log: $(basename "$file")"
            fi
        done
        
    else
        print_warning "Not running as root - skipping system data cleanup"
        print_status "Run with sudo to clear system data and logs"
    fi
}

# Function to clear browser data using development tools
clear_browser_data() {
    print_status "Clearing browser/webview data..."
    
    # If app installation exists, we can clear its browser data
    if [ -d "$INSTALL_DIR" ] || [ -d "$USER_INSTALL_DIR" ]; then
        # Clear service worker cache
        SERVICE_WORKER_DIRS=(
            "$USER_CONFIG_DIR/Service Worker"
            "$HOME/.config/$APP_NAME/Service Worker"
        )
        
        for dir in "${SERVICE_WORKER_DIRS[@]}"; do
            if [ -d "$dir" ]; then
                rm -rf "$dir"
                print_status "✓ Cleared service worker cache"
            fi
        done
        
        # Clear webview data
        WEBVIEW_DIRS=(
            "$USER_CONFIG_DIR/WebView"
            "$HOME/.config/$APP_NAME/WebView"
            "$USER_CONFIG_DIR/Default"
            "$HOME/.config/$APP_NAME/Default"
        )
        
        for dir in "${WEBVIEW_DIRS[@]}"; do
            if [ -d "$dir" ]; then
                rm -rf "$dir"
                print_status "✓ Cleared webview data"
            fi
        done
    fi
}

# Function to reset configuration files
reset_config() {
    print_status "Resetting configuration files..."
    
    # If app has a config directory in installation, reset it
    if [ -d "$INSTALL_DIR/config" ]; then
        rm -rf "$INSTALL_DIR/config"
        print_status "✓ Cleared installation config"
    fi
    
    if [ -d "$USER_INSTALL_DIR/config" ]; then
        rm -rf "$USER_INSTALL_DIR/config"
        print_status "✓ Cleared user installation config"
    fi
    
    # Clear any preference files
    PREF_FILES=(
        "$HOME/.masjidconnect-display"
        "$HOME/.config/masjidconnect-display.conf"
        "$HOME/.masjidconnect-display.json"
    )
    
    for file in "${PREF_FILES[@]}"; do
        if [ -f "$file" ]; then
            rm -f "$file"
            print_status "✓ Cleared preference file: $(basename "$file")"
        fi
    done
}

# Main execution
main() {
    # Parse command line options
    BACKUP=true
    CLEAR_SYSTEM=false
    FORCE=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-backup)
                BACKUP=false
                shift
                ;;
            --system)
                CLEAR_SYSTEM=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --no-backup    Skip creating backup"
                echo "  --system       Clear system data (requires root)"
                echo "  --force        Skip confirmation prompts"
                echo "  --help         Show this help"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Warning and confirmation
    echo
    print_warning "⚠️  This will clear ALL MasjidConnect Display app data including:"
    echo "  • Configuration and settings"
    echo "  • Cache and temporary files"  
    echo "  • User data and preferences"
    echo "  • Logs and debug information"
    echo "  • Browser/webview storage (localStorage, IndexedDB)"
    echo "  • Service worker cache"
    
    if [ "$BACKUP" = true ]; then
        echo "  • A backup will be created first"
    else
        echo "  • NO backup will be created"
    fi
    
    echo
    
    if [ "$FORCE" = false ]; then
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Operation cancelled"
            exit 0
        fi
    fi
    
    # Stop the application
    stop_app
    
    # Create backup if requested
    if [ "$BACKUP" = true ]; then
        backup_data
    fi
    
    # Clear data
    clear_user_data
    clear_browser_data
    reset_config
    
    # Clear system data if requested and possible
    if [ "$CLEAR_SYSTEM" = true ]; then
        clear_system_data
    fi
    
    print_header "Cleanup Complete!"
    
    echo
    print_status "✅ All MasjidConnect Display app data has been cleared"
    
    if [ "$BACKUP" = true ] && [ -f "/tmp/masjidconnect-backup-location" ]; then
        BACKUP_LOCATION=$(cat /tmp/masjidconnect-backup-location)
        print_status "📦 Backup available at: $BACKUP_LOCATION"
        rm -f /tmp/masjidconnect-backup-location
    fi
    
    echo
    print_status "🔄 Next steps:"
    echo "  • The app will start fresh on next launch"
    echo "  • You'll need to pair the device again"
    echo "  • All settings will return to defaults"
    echo "  • Previous pairing and content cache is cleared"
    
    echo
    print_status "To start the app: sudo systemctl start masjidconnect-display"
}

# Run main function
main "$@" 