#!/bin/bash

# MasjidConnect Display App - Raspberry Pi Build Script
# This script builds optimized packages for Raspberry Pi deployment

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
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
    echo -e "${BLUE}=================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=================================${NC}"
}

# Default values
ARCH="both"
PUBLISH=false
CLEAN_BUILD=false
SKIP_DEPS=false

# Usage function
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Build MasjidConnect Display App for Raspberry Pi"
    echo ""
    echo "Options:"
    echo "  --arch <arch>     Architecture to build for: armv7l, arm64, or both (default: both)"
    echo "  --publish         Publish the build to GitHub releases"
    echo "  --clean           Clean build directories before building"
    echo "  --skip-deps       Skip dependency installation"
    echo "  --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                          # Build for both architectures"
    echo "  $0 --arch arm64             # Build only for ARM64"
    echo "  $0 --arch armv7l --clean    # Clean build for ARMv7l"
    echo "  $0 --publish                # Build and publish to GitHub"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --arch)
            ARCH="$2"
            shift 2
            ;;
        --publish)
            PUBLISH=true
            shift
            ;;
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        --skip-deps)
            SKIP_DEPS=true
            shift
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate architecture
if [[ "$ARCH" != "armv7l" && "$ARCH" != "arm64" && "$ARCH" != "both" ]]; then
    print_error "Invalid architecture: $ARCH"
    print_error "Valid options: armv7l, arm64, both"
    exit 1
fi

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
print_header "Building MasjidConnect Display App v$VERSION for Raspberry Pi"

# Validate environment
print_status "Validating build environment..."

# Check required tools
REQUIRED_TOOLS=("node" "npm" "git")
for tool in "${REQUIRED_TOOLS[@]}"; do
    if ! command -v "$tool" &> /dev/null; then
        print_error "$tool is required but not installed"
        exit 1
    fi
done

# Check Node.js version (require 16+)
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 16 ]]; then
    print_error "Node.js 16+ is required (found: $(node -v))"
    exit 1
fi

print_status "Environment validation passed"

# Clean build directories if requested
if [[ "$CLEAN_BUILD" == true ]]; then
    print_status "Cleaning build directories..."
    rm -rf build/ dist/ node_modules/.cache/
    print_status "Build directories cleaned"
fi

# Install dependencies
if [[ "$SKIP_DEPS" == false ]]; then
    print_status "Installing dependencies..."
    npm ci --quiet
    print_status "Dependencies installed"
else
    print_status "Skipping dependency installation"
fi

# Ensure required scripts are executable
print_status "Setting up build scripts..."
chmod +x scripts/*.sh 2>/dev/null || true
chmod +x *.sh 2>/dev/null || true

# Build the React application
print_status "Building React application..."
npm run build:fix-paths

# Skip font installation for faster builds (fonts are included in the app bundle)
print_status "Skipping font installation for faster build..."

# Prepare RPi build
print_status "Preparing Raspberry Pi build configuration..."
node scripts/prepare-rpi-build.js

# Determine build targets based on architecture
BUILD_TARGETS=""
case "$ARCH" in
    "armv7l")
        BUILD_TARGETS="rpi:build:armv7l"
        ;;
    "arm64")
        BUILD_TARGETS="rpi:build:arm64"
        ;;
    "both")
        if [[ "$PUBLISH" == true ]]; then
            BUILD_TARGETS="rpi:publish"
        else
            BUILD_TARGETS="rpi:build"
        fi
        ;;
esac

# Set up GitHub token for publishing if needed
if [[ "$PUBLISH" == true ]]; then
    if [[ -z "$GH_TOKEN" ]]; then
        print_warning "GH_TOKEN environment variable not set"
        print_warning "Publishing requires a GitHub personal access token"
        read -p "Enter GitHub token (or press Enter to skip publishing): " token
        if [[ -n "$token" ]]; then
            export GH_TOKEN="$token"
        else
            print_warning "Skipping publishing - building packages only"
            PUBLISH=false
            BUILD_TARGETS=${BUILD_TARGETS/rpi:publish/rpi:build}
        fi
    fi
fi

# Build the packages
print_status "Building Electron packages for architecture: $ARCH"
if [[ "$PUBLISH" == true ]]; then
    print_status "This build will be published to GitHub releases"
fi

# Run the build
npm run $BUILD_TARGETS

# Check build results
BUILD_SUCCESS=true
DIST_DIR="./dist"

if [[ ! -d "$DIST_DIR" ]]; then
    print_error "Build directory not found: $DIST_DIR"
    BUILD_SUCCESS=false
else
    # List built packages
    print_status "Build completed! Generated packages:"
    find "$DIST_DIR" -name "*.deb" -o -name "*.tar.gz" | while read -r file; do
        size=$(du -h "$file" | cut -f1)
        echo "  - $(basename "$file") ($size)"
    done
    
    # Verify that expected files exist
    if [[ "$ARCH" == "armv7l" || "$ARCH" == "both" ]]; then
        if ! find "$DIST_DIR" -name "*armv7l*.deb" | grep -q .; then
            print_warning "No ARMv7l .deb package found"
        fi
    fi
    
    if [[ "$ARCH" == "arm64" || "$ARCH" == "both" ]]; then
        if ! find "$DIST_DIR" -name "*arm64*.deb" | grep -q .; then
            print_warning "No ARM64 .deb package found"
        fi
    fi
fi

# Create installation package
print_status "Creating installation package..."
PACKAGE_DIR="masjidconnect-display-$VERSION-rpi"
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

# Copy packages and installation scripts
cp -r "$DIST_DIR"/* "$PACKAGE_DIR/" 2>/dev/null || true
cp rpi-install.sh "$PACKAGE_DIR/"
cp install-quick.sh "$PACKAGE_DIR/"
cp scripts/optimize-raspberry-pi.sh "$PACKAGE_DIR/"

# Create README for the package
cat > "$PACKAGE_DIR/README.md" << EOD
# MasjidConnect Display App v$VERSION - Raspberry Pi Package

This package contains the MasjidConnect Display App optimized for Raspberry Pi.

## Quick Installation

1. Extract this package to your Raspberry Pi
2. Run the installation script:
   \`\`\`bash
   sudo ./install-quick.sh
   \`\`\`
   
   Or use the full installer:
   \`\`\`bash
   sudo ./rpi-install.sh
   \`\`\`

## Package Contents

- \`*.deb\` - Debian packages for different architectures
- \`*.tar.gz\` - Alternative installation archives
- \`install-quick.sh\` - Quick installer (recommended) - handles _apt permission issues
- \`rpi-install.sh\` - Full installation script with advanced features
- \`optimize-raspberry-pi.sh\` - System optimization script

## System Requirements

- Raspberry Pi 3 or newer (Pi 4 with 2GB+ RAM recommended)
- Raspberry Pi OS Bullseye or newer
- 1GB+ free storage space
- Display connected via HDMI

## Architecture Selection

- Choose \`armv7l\` package for 32-bit Raspberry Pi OS
- Choose \`arm64\` package for 64-bit Raspberry Pi OS

## Support

For support and documentation, visit: https://masjidconnect.com/support
EOD

# Create tarball of the complete package
PACKAGE_TARBALL="$PACKAGE_DIR.tar.gz"
tar -czf "$PACKAGE_TARBALL" "$PACKAGE_DIR"
rm -rf "$PACKAGE_DIR"

print_header "Build Summary"
echo "Version: $VERSION"
echo "Architecture: $ARCH"
echo "Published: $PUBLISH"
echo ""

if [[ "$BUILD_SUCCESS" == true ]]; then
    print_status "✅ Build completed successfully!"
    echo ""
    print_status "📦 Individual packages in: $DIST_DIR"
    print_status "📦 Complete installation package: $PACKAGE_TARBALL"
    echo ""
    print_status "To install on Raspberry Pi:"
    echo "  1. Copy $PACKAGE_TARBALL to your Raspberry Pi"
    echo "  2. Extract: tar -xzf $PACKAGE_TARBALL"
    echo "  3. Install: cd $PACKAGE_DIR && sudo ./rpi-install.sh"
    echo ""
    
    if [[ "$PUBLISH" == true ]]; then
        print_status "🚀 Packages have been published to GitHub releases"
        echo "   Users can now update automatically or download from:"
        echo "   https://github.com/masjidSolutions/masjidconnect-display-app/releases"
    fi
else
    print_error "❌ Build failed! Check the output above for errors."
    exit 1
fi

print_status "Done! 🎉" 