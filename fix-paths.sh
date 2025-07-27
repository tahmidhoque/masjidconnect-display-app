#!/bin/bash

# Exit on error
set -e

echo "Fixing paths in built files..."

# Fix paths in the index.html file directly
echo "Fixing path references in build/index.html..."
# Replace all absolute paths with relative paths in the generated index.html
sed -i.bak 's|src="/static/|src="./static/|g' build/index.html
sed -i.bak 's|href="/static/|href="./static/|g' build/index.html
rm -f build/index.html.bak

# Fix the asset-manifest.json file to use relative paths
echo "Fixing asset-manifest.json to use relative paths..."
if [ -f "build/asset-manifest.json" ]; then
  sed -i.bak 's|": "/static/|": "./static/|g' build/asset-manifest.json
  rm -f build/asset-manifest.json.bak
fi

# Create a patched main.html with fixed paths
echo "Creating patched main.html with fixed paths..."
cp build/index.html build/main.html
sed -i.bak 's|src="/static/|src="./static/|g' build/main.html
sed -i.bak 's|href="/static/|href="./static/|g' build/main.html
rm -f build/main.html.bak

# Make sure the static directory exists in electron
if [ ! -d "electron/static" ]; then
  echo "Creating electron/static directory..."
  mkdir -p electron/static/js
  mkdir -p electron/static/css
  mkdir -p electron/static/media
fi

# Copy fixed index.html to electron directory for fallback
echo "Copying fixed index.html to electron directory..."
cp build/main.html electron/index.html

# Copy static assets to electron/static for fallback access
echo "Copying static assets to electron/static..."
cp -r build/static/js/* electron/static/js/
cp -r build/static/css/* electron/static/css/
if [ -d "build/static/media" ]; then
  cp -r build/static/media/* electron/static/media/
fi

# Copy other important files
echo "Copying other important files..."
cp build/favicon.ico electron/favicon.ico
cp build/manifest.json electron/manifest.json
if [ -f "build/logo192.png" ]; then
  cp build/logo192.png electron/logo192.png
fi

echo "Path fixing completed!" 