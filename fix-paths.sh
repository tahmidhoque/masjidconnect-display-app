#!/bin/bash

# fix-paths.sh
# Fixes asset paths in the production build for Electron

echo "Fixing static asset paths in build..."

BUILD_DIR="./build"
INDEX_FILE="$BUILD_DIR/index.html"

if [ ! -f "$INDEX_FILE" ]; then
  echo "Error: index.html not found in $BUILD_DIR"
  exit 1
fi

# Backup the original file
cp "$INDEX_FILE" "$INDEX_FILE.backup"

# Fix paths: Replace absolute paths with relative paths
# /static/ -> ./static/
sed -i.tmp 's|src="/static/|src="./static/|g' "$INDEX_FILE"
sed -i.tmp 's|href="/static/|href="./static/|g' "$INDEX_FILE"

# Add base tag if not present
if ! grep -q '<base href' "$INDEX_FILE"; then
  sed -i.tmp 's|</head>|  <base href="./" />\n  </head>|' "$INDEX_FILE"
  echo "Added <base href=\"./\" /> tag"
fi

# Clean up temporary files
rm -f "$INDEX_FILE.tmp"

echo "✅ Path fixes applied successfully!"
echo "Original file backed up to: $INDEX_FILE.backup"

