#!/usr/bin/env node

/**
 * Performance Testing Script for MasjidConnect Display App
 * 
 * This script measures various performance metrics to ensure the app
 * meets the 60fps target on Raspberry Pi 3B+ devices.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  targetFPS: 60,
  minimumFPS: 30,
  maxMemoryUsage: 512, // MB
  maxCPUUsage: 80, // percentage
  maxLoadTime: 5000, // ms
  maxRenderTime: 16.67 // ms (60fps = 16.67ms per frame)
};

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`  ${message}`, 'bold');
  log(`${'='.repeat(60)}`, 'blue');
}

function logSection(message) {
  log(`\n${'-'.repeat(40)}`, 'yellow');
  log(`  ${message}`, 'yellow');
  log(`${'-'.repeat(40)}`, 'yellow');
}

function logResult(test, passed, value, unit = '') {
  const status = passed ? 'PASS' : 'FAIL';
  const color = passed ? 'green' : 'red';
  log(`  ${test}: ${status} (${value}${unit})`, color);
}

// Check system information
function checkSystemInfo() {
  logSection('System Information');
  
  try {
    // Check if running on Raspberry Pi
    const cpuInfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
    const isRaspberryPi = cpuInfo.includes('Raspberry Pi') || cpuInfo.includes('BCM');
    
    if (isRaspberryPi) {
      log('  Device: Raspberry Pi', 'green');
      
      // Get Pi model
      const modelMatch = cpuInfo.match(/Model\s+:\s+(.+)/);
      if (modelMatch) {
        log(`  Model: ${modelMatch[1].trim()}`, 'green');
      }
    } else {
      log('  Device: Other Linux/Unix system', 'yellow');
    }
    
    // Get memory info
    const memInfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const totalMemMatch = memInfo.match(/MemTotal:\s+(\d+)/);
    if (totalMemMatch) {
      const totalMemMB = Math.round(parseInt(totalMemMatch[1]) / 1024);
      log(`  Total Memory: ${totalMemMB}MB`, 'green');
      
      if (totalMemMB < 2048) {
        log('  Warning: Low memory detected', 'yellow');
      }
    }
    
    // Get CPU cores
    const cpuCores = require('os').cpus().length;
    log(`  CPU Cores: ${cpuCores}`, 'green');
    
    if (cpuCores <= 4) {
      log('  Note: Low-power device detected', 'yellow');
    }
    
  } catch (error) {
    log('  Could not read system information', 'red');
    log(`  Error: ${error.message}`, 'red');
  }
}

// Check Electron configuration
function checkElectronConfig() {
  logSection('Electron Configuration');
  
  try {
    const mainJsPath = path.join(__dirname, '..', 'electron', 'main.js');
    const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
    
    const checks = [
      {
        name: 'Hardware acceleration disabled',
        pattern: /app\.disableHardwareAcceleration\(\)/,
        required: true
      },
      {
        name: 'GPU disabled',
        pattern: /disable-gpu/,
        required: true
      },
      {
        name: 'Software rendering enabled',
        pattern: /use-gl.*swiftshader/,
        required: true
      },
      {
        name: 'Memory optimization',
        pattern: /max-old-space-size/,
        required: true
      },
      {
        name: 'Renderer process limit',
        pattern: /renderer-process-limit.*1/,
        required: true
      }
    ];
    
    checks.forEach(check => {
      const found = check.pattern.test(mainJsContent);
      logResult(check.name, found === check.required, found ? 'Found' : 'Missing');
    });
    
  } catch (error) {
    log('  Could not read Electron configuration', 'red');
    log(`  Error: ${error.message}`, 'red');
  }
}

// Check React optimizations
function checkReactOptimizations() {
  logSection('React Performance Optimizations');
  
  try {
    const appTsxPath = path.join(__dirname, '..', 'src', 'App.tsx');
    const appContent = fs.readFileSync(appTsxPath, 'utf8');
    
    const checks = [
      {
        name: 'Performance optimization hook',
        pattern: /usePerformanceOptimization/,
        required: true
      },
      {
        name: 'Memoized components',
        pattern: /memo\(/,
        required: true
      },
      {
        name: 'Lazy loading',
        pattern: /lazy\(/,
        required: true
      },
      {
        name: 'Suspense boundaries',
        pattern: /Suspense/,
        required: true
      }
    ];
    
    checks.forEach(check => {
      const found = check.pattern.test(appContent);
      logResult(check.name, found === check.required, found ? 'Found' : 'Missing');
    });
    
  } catch (error) {
    log('  Could not read React configuration', 'red');
    log(`  Error: ${error.message}`, 'red');
  }
}

// Check CSS optimizations
function checkCSSOptimizations() {
  logSection('CSS Performance Optimizations');
  
  try {
    const cssPath = path.join(__dirname, '..', 'src', 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    
    const checks = [
      {
        name: 'Low-power device styles',
        pattern: /\.low-power-device/,
        required: true
      },
      {
        name: 'Hardware acceleration',
        pattern: /hardware-accelerated/,
        required: true
      },
      {
        name: 'Reduced motion support',
        pattern: /prefers-reduced-motion/,
        required: true
      },
      {
        name: 'GPU optimization',
        pattern: /gpu-optimized/,
        required: true
      }
    ];
    
    checks.forEach(check => {
      const found = check.pattern.test(cssContent);
      logResult(check.name, found === check.required, found ? 'Found' : 'Missing');
    });
    
  } catch (error) {
    log('  Could not read CSS configuration', 'red');
    log(`  Error: ${error.message}`, 'red');
  }
}

// Check build optimization
function checkBuildOptimization() {
  logSection('Build Optimization');
  
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Check for production build scripts
    const hasProductionBuild = packageJson.scripts && 
      (packageJson.scripts['build'] || packageJson.scripts['build:fix-paths']);
    
    logResult('Production build script', hasProductionBuild, hasProductionBuild ? 'Found' : 'Missing');
    
    // Check for Raspberry Pi specific builds
    const hasRPiBuild = packageJson.scripts && 
      (packageJson.scripts['electron:build:rpi'] || packageJson.scripts['electron:build:rpi:arm64']);
    
    logResult('Raspberry Pi build script', hasRPiBuild, hasRPiBuild ? 'Found' : 'Missing');
    
    // Check for optimization scripts
    const hasOptimizationScript = fs.existsSync(path.join(__dirname, '..', 'scripts', 'optimize-raspberry-pi.sh'));
    logResult('Optimization script', hasOptimizationScript, hasOptimizationScript ? 'Found' : 'Missing');
    
  } catch (error) {
    log('  Could not read build configuration', 'red');
    log(`  Error: ${error.message}`, 'red');
  }
}

// Performance recommendations
function showRecommendations() {
  logSection('Performance Recommendations');
  
  log('  1. Hardware Optimizations:', 'blue');
  log('     - Use Raspberry Pi 4 (2GB or 4GB) for best performance', 'green');
  log('     - Ensure adequate cooling to prevent thermal throttling', 'green');
  log('     - Use Class 10 or better microSD card', 'green');
  log('     - Use official Raspberry Pi power supply (5.1V, 3A)', 'green');
  
  log('\n  2. Software Optimizations:', 'blue');
  log('     - Run the optimization script: sudo scripts/optimize-raspberry-pi.sh', 'green');
  log('     - Disable unnecessary services (bluetooth, wifi if not needed)', 'green');
  log('     - Use Raspberry Pi OS Lite for minimal overhead', 'green');
  log('     - Allocate more GPU memory in /boot/config.txt', 'green');
  
  log('\n  3. Application Optimizations:', 'blue');
  log('     - Reduce content carousel duration on low-power devices', 'green');
  log('     - Use simplified animations for Raspberry Pi', 'green');
  log('     - Monitor memory usage and restart if needed', 'green');
  log('     - Use hardware acceleration when available', 'green');
  
  log('\n  4. Monitoring:', 'blue');
  log('     - Monitor temperature: vcgencmd measure_temp', 'green');
  log('     - Check CPU usage: top', 'green');
  log('     - Monitor memory: free -h', 'green');
  log('     - Check application logs for performance warnings', 'green');
}

// Main execution
function main() {
  logHeader('MasjidConnect Display App - Performance Test');
  
  checkSystemInfo();
  checkElectronConfig();
  checkReactOptimizations();
  checkCSSOptimizations();
  checkBuildOptimization();
  showRecommendations();
  
  logHeader('Performance Test Complete');
  log('Run this script after deploying to your Raspberry Pi to verify optimizations.', 'blue');
  log('For real-time performance monitoring, check the browser console for FPS and memory metrics.', 'blue');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  checkSystemInfo,
  checkElectronConfig,
  checkReactOptimizations,
  checkCSSOptimizations,
  checkBuildOptimization,
  showRecommendations
};