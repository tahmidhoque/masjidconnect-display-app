#!/bin/bash
# MasjidConnect Display App - Update Trigger Script
# For developers to signal that updates should be deployed

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

# Configuration
REPO_URL="https://github.com/masjidSolutions/masjidconnect-display-app"
WEBHOOK_URL="${MASJIDCONNECT_WEBHOOK_URL:-}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK_URL:-}"

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")

print_status "MasjidConnect Display Update Trigger"
print_status "Current version: $CURRENT_VERSION"

# Validate we're in the right repository
if [ ! -f "package.json" ] || ! grep -q "masjidconnect-display-app" package.json; then
    print_error "This script must be run from the masjidconnect-display-app repository root"
    exit 1
fi

# Check if we have uncommitted changes
if [ -d ".git" ]; then
    if ! git diff-index --quiet HEAD --; then
        print_warning "You have uncommitted changes!"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Get git info
    BRANCH=$(git branch --show-current)
    COMMIT=$(git rev-parse --short HEAD)
    print_status "Branch: $BRANCH"
    print_status "Commit: $COMMIT"
fi

# Menu for update type
echo
echo "Update Options:"
echo "1) Create GitHub Release (triggers auto-updates)"
echo "2) Send webhook notification to installed devices"
echo "3) Create pre-release for testing"
echo "4) Force update signal (emergency)"
echo "5) Send Discord notification"
echo "6) Exit"
echo

read -p "Choose option (1-6): " choice

case $choice in
    1)
        print_status "Creating GitHub Release..."
        
        # Check if gh CLI is installed
        if ! command -v gh >/dev/null; then
            print_error "GitHub CLI (gh) not installed"
            print_status "Install: brew install gh (macOS) or sudo apt install gh (Ubuntu)"
            exit 1
        fi
        
        # Get release notes
        echo "Enter release notes (press Ctrl+D when done):"
        RELEASE_NOTES=$(cat)
        
        # Create release
        gh release create "v$CURRENT_VERSION" \
            --title "MasjidConnect Display v$CURRENT_VERSION" \
            --notes "$RELEASE_NOTES" \
            --latest
        
        print_status "✅ GitHub release created!"
        print_status "🔄 Auto-update systems will detect this release within 6 hours"
        print_status "🌐 Release URL: $REPO_URL/releases/tag/v$CURRENT_VERSION"
        ;;
        
    2)
        print_status "Sending webhook notification..."
        
        if [ -z "$WEBHOOK_URL" ]; then
            read -p "Enter webhook URL: " WEBHOOK_URL
        fi
        
        if [ -n "$WEBHOOK_URL" ]; then
            curl -X POST "$WEBHOOK_URL" \
                -H "Content-Type: application/json" \
                -d "{
                    \"version\": \"$CURRENT_VERSION\",
                    \"action\": \"update_available\",
                    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
                    \"source\": \"developer_trigger\"
                }"
            print_status "✅ Webhook notification sent"
        else
            print_error "No webhook URL provided"
        fi
        ;;
        
    3)
        print_status "Creating pre-release..."
        
        if ! command -v gh >/dev/null; then
            print_error "GitHub CLI (gh) not installed"
            exit 1
        fi
        
        echo "Enter testing notes:"
        RELEASE_NOTES=$(cat)
        
        gh release create "v$CURRENT_VERSION-beta" \
            --title "MasjidConnect Display v$CURRENT_VERSION (Beta)" \
            --notes "$RELEASE_NOTES" \
            --prerelease
        
        print_status "✅ Pre-release created for testing"
        ;;
        
    4)
        print_status "Sending force update signal..."
        
        # Create update signal file
        cat > update-signal.json << EOF
{
    "version": "$CURRENT_VERSION",
    "force_update": true,
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "reason": "emergency_update",
    "rollback_version": "$(git describe --abbrev=0 --tags HEAD^)"
}
EOF
        
        if [ -n "$WEBHOOK_URL" ]; then
            curl -X POST "$WEBHOOK_URL/force-update" \
                -H "Content-Type: application/json" \
                -d @update-signal.json
            print_status "✅ Force update signal sent"
        else
            print_status "📄 Update signal created: update-signal.json"
            print_status "Deploy this file to your update server"
        fi
        
        rm -f update-signal.json
        ;;
        
    5)
        print_status "Sending Discord notification..."
        
        if [ -z "$DISCORD_WEBHOOK" ]; then
            read -p "Enter Discord webhook URL: " DISCORD_WEBHOOK
        fi
        
        if [ -n "$DISCORD_WEBHOOK" ]; then
            curl -X POST "$DISCORD_WEBHOOK" \
                -H "Content-Type: application/json" \
                -d "{
                    \"embeds\": [{
                        \"title\": \"🚀 MasjidConnect Display Update\",
                        \"description\": \"Version **$CURRENT_VERSION** is now available\",
                        \"color\": 3447003,
                        \"fields\": [
                            {\"name\": \"Version\", \"value\": \"$CURRENT_VERSION\", \"inline\": true},
                            {\"name\": \"Release\", \"value\": \"[$REPO_URL/releases]($REPO_URL/releases)\", \"inline\": true}
                        ],
                        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
                    }]
                }"
            print_status "✅ Discord notification sent"
        else
            print_error "No Discord webhook URL provided"
        fi
        ;;
        
    6)
        print_status "Exiting..."
        exit 0
        ;;
        
    *)
        print_error "Invalid option"
        exit 1
        ;;
esac

echo
print_status "🎉 Update trigger completed!"

# Show next steps
echo
print_status "📋 Next Steps:"
echo "  • Monitor update logs on deployed devices"
echo "  • Check GitHub Actions for any build issues"
echo "  • Verify devices are updating within 6 hours"
echo "  • Test the new version on a development device first"

# Show monitoring commands
echo
print_status "🔍 Monitoring Commands (for RPi devices):"
echo "  sudo journalctl -u masjidconnect-update.timer -f"
echo "  sudo systemctl status masjidconnect-display"
echo "  tail -f /var/log/masjidconnect-update.log" 