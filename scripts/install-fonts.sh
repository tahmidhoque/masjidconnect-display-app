#!/bin/bash

# Script to install required fonts on Raspberry Pi
# This ensures the Arabic text displays properly on all platforms

echo "Installing custom fonts for MasjidConnect Display App..."

# Create directory for fonts if it doesn't exist
FONT_DIR="$HOME/.local/share/fonts"
mkdir -p "$FONT_DIR"

# Copy fonts from the application assets
FONT_SOURCE="./src/assets/fonts"
cp -r "$FONT_SOURCE"/* "$FONT_DIR"

# Update font cache
fc-cache -f -v

echo "Fonts installed successfully!" 