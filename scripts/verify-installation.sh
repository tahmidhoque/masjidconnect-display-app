#!/bin/bash
# Verification script to test .deb package installation
# Run this on Raspberry Pi after installing the .deb package

set -e

echo "🔍 Verifying MasjidConnect Display Installation"
echo "=========================================="
echo ""

# Check if app is installed
if [ ! -f "/opt/masjidconnect-display/masjidconnect-display" ]; then
  echo "❌ Main executable not found at /opt/masjidconnect-display/masjidconnect-display"
  exit 1
fi

echo "✅ Main executable found"

# Check executable permissions
if [ ! -x "/opt/masjidconnect-display/masjidconnect-display" ]; then
  echo "⚠️  Main executable is not executable, fixing..."
  sudo chmod +x /opt/masjidconnect-display/masjidconnect-display
fi

echo "✅ Executable permissions correct"

# Check required files exist
REQUIRED_FILES=(
  "/opt/masjidconnect-display/masjidconnect-display"
  "/opt/masjidconnect-display/resources/app.asar"
  "/opt/masjidconnect-display/resources/app/electron/main.js"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ] || [ -d "$file" ]; then
    echo "✅ Found: $file"
  else
    echo "❌ Missing: $file"
    exit 1
  fi
done

# Check desktop entry
if [ -f "/usr/share/applications/masjidconnect-display.desktop" ]; then
  echo "✅ Desktop entry found"
else
  echo "⚠️  Desktop entry not found (may need to run after-install.sh)"
fi

# Check autostart
if [ -f "/etc/xdg/autostart/masjidconnect-display.desktop" ]; then
  echo "✅ Autostart entry found"
else
  echo "⚠️  Autostart entry not found"
fi

# Test app version
echo ""
echo "📦 Package Information:"
dpkg -l | grep masjidconnect-display || echo "⚠️  Package not found in dpkg database"

echo ""
echo "✅ Installation verification complete!"
echo ""
echo "To test the app:"
echo "  /opt/masjidconnect-display/masjidconnect-display --no-sandbox"

