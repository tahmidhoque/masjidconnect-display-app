#!/bin/bash

# Script to create a 256x256 icon for the MasjidConnect Display App

echo "Creating 256x256 icon.png for MasjidConnect Display App..."

# Create the assets directory if it doesn't exist
mkdir -p assets

# Try using ImageMagick if available
if command -v convert &> /dev/null; then
    echo "Using ImageMagick to create icon..."
    convert -size 256x256 xc:black -fill white -gravity center -font Arial -pointsize 24 -annotate 0 "MasjidConnect" assets/icon.png
    echo "Icon created successfully at assets/icon.png"
    exit 0
fi

# If ImageMagick is not available, create a simple black square
echo "ImageMagick not found, creating simple PNG..."

# Create a minimal valid PNG (1x1 black pixel then resize)
echo -n -e \\x89PNG\\r\\n\\x1a\\n\\x00\\x00\\x00\\rIHDR\\x00\\x00\\x01\\x00\\x00\\x00\\x01\\x00\\x08\\x00\\x00\\x00\\x00\\x3a\\x7e\\x9b\\x55\\x00\\x00\\x00\\x0eIDATx\\x9cc\\xf8\\xff\\xff\\x3f\\x06\\x06\\x00\\x05\\x87\\x01\\x02\\x7f\\xcf\\x1c\\xea\\x00\\x00\\x00\\x00IEND\\xaeB\\x60\\x82 > assets/icon.png

if [ -s "assets/icon.png" ]; then
    echo "Simple icon created successfully at assets/icon.png"
    exit 0
else
    echo "ERROR: Failed to create icon"
    exit 1
fi 