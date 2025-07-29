#!/bin/bash

echo "🚀 Starting MasjidConnect Display App - PRODUCTION Mode (No Debug)"
echo "================================================================="

# Stop any existing processes
echo "🧹 Cleaning up any existing processes..."
pkill -f "electron.*masjidconnect" 2>/dev/null || true
pkill -f "node.*electron" 2>/dev/null || true
pkill -f "react-scripts start" 2>/dev/null || true
sleep 3

# Check if build exists
if [ ! -d "build" ]; then
    echo "❌ No build directory found!"
    echo "Building the production app first..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Build failed!"
        exit 1
    fi
fi

echo "✅ Production build found"

# Set production environment variables
export NODE_ENV=production
export ELECTRON_DEBUG=false
export ELECTRON_ENABLE_LOGGING=false
export ELECTRON_DISABLE_SECURITY_WARNINGS=true

# Disable Node.js inspector completely
export NODE_OPTIONS="--no-warnings"

echo "🖥️  Starting production Electron app (no debug, no inspector)..."
echo "📝 Environment: NODE_ENV=$NODE_ENV"
echo "📊 Use ./test-memory-fixes.sh to monitor memory usage"
echo "🛑 Use Ctrl+C to stop the app"
echo ""

# Start Electron with production settings - no inspector, no debug
NODE_ENV=production ELECTRON_DEBUG=false ./node_modules/.bin/electron . --no-sandbox --disable-dev-shm-usage 