#!/bin/bash
# Robust Raspberry Pi Build Script
# Builds Electron app for Raspberry Pi with proper error handling and validation

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ARCH="${1:-all}"  # all, armv7l, or arm64
PUBLISH="${2:-never}"  # never or always

echo -e "${GREEN}🚀 MasjidConnect Display - Raspberry Pi Build${NC}"
echo "=========================================="
echo "Architecture: $ARCH"
echo "Publish: $PUBLISH"
echo ""

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js is not installed${NC}"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo -e "${RED}❌ npm is not installed${NC}"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
  echo -e "${RED}❌ Node.js version 16+ required (found: $(node -v))${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Clean previous builds
echo -e "${YELLOW}🧹 Cleaning previous builds...${NC}"
rm -rf "$PROJECT_ROOT/dist"
rm -rf "$PROJECT_ROOT/build"
echo -e "${GREEN}✅ Clean complete${NC}"
echo ""

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
  npm ci
else
  npm install
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Build React app
echo -e "${YELLOW}⚛️  Building React app...${NC}"
npm run build:fix-paths
if [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
  echo -e "${RED}❌ React build failed - build directory not found${NC}"
  exit 1
fi
echo -e "${GREEN}✅ React app built${NC}"
echo ""

# Prepare RPI build
echo -e "${YELLOW}🔧 Preparing RPI build files...${NC}"
node scripts/prepare-rpi-build.js
if [ ! -f "after-install.sh" ]; then
  echo -e "${RED}❌ after-install.sh not found${NC}"
  exit 1
fi
chmod +x after-install.sh
echo -e "${GREEN}✅ RPI build prepared${NC}"
echo ""

# Build function
build_arch() {
  local arch=$1
  echo -e "${YELLOW}🔨 Building for $arch...${NC}"
  
  # Set publish flag
  local publish_flag="--publish never"
  if [ "$PUBLISH" = "always" ]; then
    publish_flag="--publish always"
    if [ -z "$GH_TOKEN" ]; then
      echo -e "${RED}❌ GH_TOKEN environment variable required for publishing${NC}"
      exit 1
    fi
  fi
  
  # Build with electron-builder
  # Use npx to ensure we're using the local electron-builder
  if npx electron-builder --linux deb --$arch $publish_flag; then
    echo -e "${GREEN}✅ Build successful for $arch${NC}"
    
    # Verify artifact exists
    local deb_file=$(find dist -name "*${arch}.deb" -type f | head -1)
    if [ -z "$deb_file" ]; then
      echo -e "${RED}❌ .deb file not found for $arch${NC}"
      exit 1
    fi
    
    # Check file size
    local size=$(stat -f%z "$deb_file" 2>/dev/null || stat -c%s "$deb_file" 2>/dev/null)
    if [ "$size" -lt 1000000 ]; then
      echo -e "${RED}❌ .deb file too small ($size bytes) - build may have failed${NC}"
      exit 1
    fi
    
    echo -e "${GREEN}   Artifact: $(basename "$deb_file")${NC}"
    echo -e "${GREEN}   Size: $((size / 1024 / 1024)) MB${NC}"
  else
    echo -e "${RED}❌ Build failed for $arch${NC}"
    exit 1
  fi
  echo ""
}

# Build based on architecture
if [ "$ARCH" = "all" ]; then
  build_arch "armv7l"
  build_arch "arm64"
elif [ "$ARCH" = "armv7l" ] || [ "$ARCH" = "arm64" ]; then
  build_arch "$ARCH"
else
  echo -e "${RED}❌ Invalid architecture: $ARCH${NC}"
  echo "Usage: $0 [armv7l|arm64|all] [never|always]"
  exit 1
fi

# Summary
echo -e "${GREEN}=========================================="
echo "✅ Build Complete!"
echo "==========================================${NC}"
echo ""
echo "Artifacts in dist/:"
ls -lh dist/*.deb 2>/dev/null || echo "No .deb files found"
echo ""
echo "Next steps:"
echo "1. Transfer .deb files to Raspberry Pi"
echo "2. Install: sudo dpkg -i masjidconnect-display-*.deb"
echo "3. Fix dependencies if needed: sudo apt-get install -f"

