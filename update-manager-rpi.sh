#!/bin/bash
# MasjidConnect Display App - Update Manager for Raspberry Pi
# Handles updates for source-built installations

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

# Configuration
REPO_URL="https://github.com/masjidSolutions/masjidconnect-display-app.git"
UPDATE_CHECK_URL="https://api.github.com/repos/masjidSolutions/masjidconnect-display-app/releases/latest"
INSTALL_DIR="/opt/masjidconnect-display"
USER_INSTALL_DIR="$HOME/.local/share/masjidconnect-display"
UPDATE_LOG="/var/log/masjidconnect-update.log"
LOCK_FILE="/tmp/masjidconnect-update.lock"

# Determine installation type
if [ -d "$INSTALL_DIR" ] && [ "$(id -u)" -eq 0 ]; then
    TARGET_DIR="$INSTALL_DIR"
    INSTALL_TYPE="system"
    SERVICE_NAME="masjidconnect-display"
elif [ -d "$USER_INSTALL_DIR" ]; then
    TARGET_DIR="$USER_INSTALL_DIR"
    INSTALL_TYPE="user"
    SERVICE_NAME=""
else
    print_error "No MasjidConnect Display installation found"
    exit 1
fi

# Lock mechanism to prevent concurrent updates
if [ -f "$LOCK_FILE" ]; then
    print_warning "Update already in progress (lock file exists)"
    exit 1
fi

trap 'rm -f "$LOCK_FILE"' EXIT
touch "$LOCK_FILE"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$UPDATE_LOG" 2>/dev/null || echo "$1"
}

print_header "MasjidConnect Display App - Update Manager"

# Function to stop the application
stop_app() {
    print_status "Stopping MasjidConnect Display App..."
    
    if [ "$INSTALL_TYPE" = "system" ] && command -v systemctl >/dev/null; then
        systemctl stop "$SERVICE_NAME" 2>/dev/null || true
        log_message "Stopped systemd service"
    fi
    
    # Kill any running instances
    pkill -f masjidconnect-display 2>/dev/null || true
    sleep 2
    
    # Force kill if still running
    pkill -9 -f masjidconnect-display 2>/dev/null || true
    log_message "Application stopped"
}

# Function to start the application
start_app() {
    print_status "Starting MasjidConnect Display App..."
    
    if [ "$INSTALL_TYPE" = "system" ] && command -v systemctl >/dev/null; then
        systemctl start "$SERVICE_NAME"
        log_message "Started systemd service"
    else
        # Start in background for user installation
        cd "$TARGET_DIR"
        nohup ./masjidconnect-display >/dev/null 2>&1 &
        log_message "Started application in background"
    fi
}

# Function to check for updates
check_for_updates() {
    print_status "Checking for updates..."
    
    # Get current version
    CURRENT_VERSION=""
    if [ -f "$TARGET_DIR/package.json" ]; then
        CURRENT_VERSION=$(node -p "require('$TARGET_DIR/package.json').version" 2>/dev/null || echo "unknown")
    fi
    
    print_status "Current version: $CURRENT_VERSION"
    
    # Check GitHub for latest release
    if command -v curl >/dev/null; then
        LATEST_INFO=$(curl -s "$UPDATE_CHECK_URL" 2>/dev/null || echo "")
        if [ -n "$LATEST_INFO" ]; then
            LATEST_VERSION=$(echo "$LATEST_INFO" | grep '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/' | sed 's/^v//')
            UPDATE_AVAILABLE=$(echo "$LATEST_INFO" | grep '"prerelease"' | grep -q 'false' && echo "true" || echo "false")
        else
            print_warning "Could not check for updates (no internet or API limit)"
            return 1
        fi
    else
        print_warning "curl not available, cannot check for updates"
        return 1
    fi
    
    print_status "Latest version: $LATEST_VERSION"
    
    # Compare versions
    if [ "$CURRENT_VERSION" != "$LATEST_VERSION" ] && [ "$UPDATE_AVAILABLE" = "true" ]; then
        print_status "Update available: $CURRENT_VERSION → $LATEST_VERSION"
        return 0
    else
        print_status "No updates available"
        return 1
    fi
}

# Function to backup current installation
backup_installation() {
    print_status "Creating backup..."
    
    BACKUP_DIR="$TARGET_DIR.backup.$(date +%s)"
    cp -r "$TARGET_DIR" "$BACKUP_DIR"
    
    echo "$BACKUP_DIR" > /tmp/masjidconnect-backup-path
    log_message "Backup created at $BACKUP_DIR"
}

# Function to restore from backup
restore_backup() {
    BACKUP_PATH=$(cat /tmp/masjidconnect-backup-path 2>/dev/null || echo "")
    
    if [ -n "$BACKUP_PATH" ] && [ -d "$BACKUP_PATH" ]; then
        print_status "Restoring from backup..."
        rm -rf "$TARGET_DIR"
        mv "$BACKUP_PATH" "$TARGET_DIR"
        log_message "Restored from backup"
        return 0
    else
        print_error "No backup found to restore"
        return 1
    fi
}

# Function to clean up old backups
cleanup_backups() {
    print_status "Cleaning up old backups..."
    
    # Keep only the 3 most recent backups
    BACKUP_BASE=$(dirname "$TARGET_DIR")/$(basename "$TARGET_DIR").backup.*
    ls -dt $BACKUP_BASE 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
    
    rm -f /tmp/masjidconnect-backup-path
}

# Function to update from source
update_from_source() {
    print_status "Updating from source..."
    
    # Create temporary directory for update
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    # Clone latest source
    git clone --depth 1 "$REPO_URL" source
    cd source
    
    # Set up build environment
    export NODE_OPTIONS="--max_old_space_size=512"
    export GENERATE_SOURCEMAP=false
    export SKIP_PREFLIGHT_CHECK=true
    
    # Install dependencies and build
    npm ci --production=false --silent --no-progress
    npm run build 2>/dev/null || {
        print_error "Build failed during update"
        cd /
        rm -rf "$TEMP_DIR"
        return 1
    }
    
    # Fix paths
    chmod +x fix-paths.sh
    ./fix-paths.sh
    
    # Update installation
    print_status "Installing updated files..."
    
    # Stop app first
    stop_app
    
    # Update files (preserve node_modules if possible)
    if [ -d "$TARGET_DIR/node_modules" ]; then
        # Preserve existing node_modules for faster updates
        mv "$TARGET_DIR/node_modules" /tmp/masjidconnect-node_modules.bak
    fi
    
    # Remove old files except config
    find "$TARGET_DIR" -mindepth 1 -maxdepth 1 ! -name "config" -exec rm -rf {} +
    
    # Copy new files
    cp -r build/* "$TARGET_DIR/"
    cp -r electron/* "$TARGET_DIR/"
    cp package.json "$TARGET_DIR/"
    
    # Restore or update node_modules
    if [ -d "/tmp/masjidconnect-node_modules.bak" ]; then
        # Check if package.json changed significantly
        if diff -q package.json "$TARGET_DIR/package.json" >/dev/null 2>&1; then
            mv /tmp/masjidconnect-node_modules.bak "$TARGET_DIR/node_modules"
        else
            rm -rf /tmp/masjidconnect-node_modules.bak
            cp -r node_modules "$TARGET_DIR/"
        fi
    else
        cp -r node_modules "$TARGET_DIR/"
    fi
    
    # Copy fonts if available
    if [ -d "src/assets/fonts" ]; then
        mkdir -p "$TARGET_DIR/fonts"
        cp -r src/assets/fonts/* "$TARGET_DIR/fonts/"
    fi
    
    # Update startup script with latest optimizations
    cat > "$TARGET_DIR/masjidconnect-display" << 'EOF'
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
    
    chmod +x "$TARGET_DIR/masjidconnect-display"
    
    # Clean up
    cd /
    rm -rf "$TEMP_DIR"
    
    log_message "Update completed successfully"
    return 0
}

# Main update process
main() {
    log_message "Starting update check"
    
    if ! check_for_updates; then
        log_message "No updates needed"
        exit 0
    fi
    
    print_status "Starting update process..."
    
    # Create backup
    backup_installation
    
    # Attempt update
    if update_from_source; then
        print_status "✅ Update completed successfully!"
        
        # Start app
        start_app
        
        # Clean up old backups
        cleanup_backups
        
        log_message "Update process completed successfully"
        
        # Show new version
        NEW_VERSION=$(node -p "require('$TARGET_DIR/package.json').version" 2>/dev/null || echo "unknown")
        print_status "Updated to version: $NEW_VERSION"
        
    else
        print_error "❌ Update failed, restoring backup..."
        
        if restore_backup; then
            start_app
            print_status "Backup restored successfully"
        else
            print_error "Could not restore backup - manual intervention required"
        fi
        
        log_message "Update failed, backup restored"
        exit 1
    fi
}

# Command line options
case "${1:-}" in
    "check")
        check_for_updates && echo "Update available" || echo "No updates"
        ;;
    "update")
        main
        ;;
    "force-update")
        print_warning "Forcing update without version check..."
        backup_installation
        if update_from_source; then
            start_app
            cleanup_backups
            print_status "Force update completed"
        else
            restore_backup
            start_app
            print_error "Force update failed"
        fi
        ;;
    "restore")
        stop_app
        if restore_backup; then
            start_app
            print_status "Restored from backup"
        else
            print_error "No backup to restore"
        fi
        ;;
    *)
        echo "Usage: $0 {check|update|force-update|restore}"
        echo ""
        echo "Commands:"
        echo "  check        - Check if updates are available"
        echo "  update       - Update if new version available"
        echo "  force-update - Update regardless of version"
        echo "  restore      - Restore from latest backup"
        exit 1
        ;;
esac 