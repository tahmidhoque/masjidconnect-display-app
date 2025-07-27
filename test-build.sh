#!/bin/bash

# Test script to verify the build configuration for Raspberry Pi
# This script only checks setup and configuration without actually building

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== MasjidConnect Display App - Build Configuration Test ===${NC}"

# Check environment
echo -e "${YELLOW}Checking environment...${NC}"
echo "Node.js: $(node -v)"
echo "NPM: $(npm -v)"
if command -v npx &> /dev/null; then
    echo "NPX: Found"
else
    echo -e "${RED}NPX not found - this will cause build failures${NC}"
fi

# Check for electron-builder
echo -e "${YELLOW}Checking for electron-builder...${NC}"
if npx electron-builder --version &> /dev/null; then
    echo "electron-builder: $(npx electron-builder --version)"
else
    echo -e "${RED}electron-builder not found or not working${NC}"
    echo "Try running: npm install -g electron-builder"
fi

# Check for after-install.sh
echo -e "${YELLOW}Checking for installation scripts...${NC}"
if [ -f "after-install.sh" ]; then
    echo "after-install.sh: Found in root directory (CORRECT)"
    if [ -x "after-install.sh" ]; then
        echo "after-install.sh: Is executable (CORRECT)"
    else
        echo -e "${RED}after-install.sh: Not executable - this will cause issues${NC}"
        echo "Run: chmod +x after-install.sh"
    fi
else
    echo -e "${RED}after-install.sh: Not found in root directory${NC}"
    if [ -f "build/after-install.sh" ]; then
        echo "after-install.sh: Found in build/ directory"
        echo -e "${RED}This is not where electron-builder looks for it${NC}"
        echo "Fix by copying: cp build/after-install.sh ./"
    else
        echo -e "${RED}after-install.sh: Not found anywhere${NC}"
    fi
fi

# Check package.json configuration
echo -e "${YELLOW}Checking package.json configuration...${NC}"
if grep -q '"afterInstall": "after-install.sh"' package.json; then
    echo "package.json: afterInstall path is correct"
else
    echo -e "${RED}package.json: afterInstall path is incorrect${NC}"
    echo "Edit package.json and set: \"afterInstall\": \"after-install.sh\""
fi

# Check icon file
echo -e "${YELLOW}Checking for icon files...${NC}"
if [ -f "assets/icon.png" ] && [ -s "assets/icon.png" ]; then
    echo "assets/icon.png: Found and not empty"
else
    echo -e "${RED}assets/icon.png: Missing or empty${NC}"
fi

echo -e "\n${GREEN}Test completed${NC}"
echo -e "If all tests passed, you can build with: ${YELLOW}./build-rpi-package.sh${NC}"
echo -e "If any test failed, fix the issues before attempting to build." 