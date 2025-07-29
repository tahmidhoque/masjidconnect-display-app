#!/bin/bash

# Script to start MasjidConnect Display App in PRODUCTION mode
# Use this for memory testing and stability validation

echo "🚀 Starting MasjidConnect Display App - Production Mode"
echo "====================================================="

# Check if build directory exists
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

# Kill any existing development servers
echo "🧹 Stopping any development servers..."
pkill -f "react-scripts start" 2>/dev/null || true
pkill -f "webpack-dev-server" 2>/dev/null || true

# Wait a moment for processes to stop
sleep 2

# Start the production Electron app
echo "🖥️  Starting production Electron app..."
echo "📝 Use Ctrl+C to stop the app"
echo "📊 Use ./test-memory-fixes.sh to monitor memory usage"
echo ""

npm run electron 