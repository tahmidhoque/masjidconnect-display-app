# 🔍 RPi Restart Debugging Guide

Since memory usage is stable (42MB), the app restarts are caused by **other factors**. This guide provides comprehensive tools to identify the root cause.

## 🛠️ Available Debugging Tools

### 1. **Comprehensive RPi Monitor** (`debug-rpi-stability.sh`)

Monitors system resources, network, and detects restarts in real-time.

### 2. **JavaScript Crash Logger** (Built into app)

Captures unhandled errors, promise rejections, and performance issues.

### 3. **Browser Console Debugger** (`window.MasjidConnectDebug`)

Interactive debugging tools accessible via browser console.

---

## 🚀 **Step-by-Step Debugging Process**

### **Step 1: Deploy Fixed Version**

```bash
# Deploy all the new monitoring tools
./build-and-install-rpi.sh
```

### **Step 2: Start Comprehensive Monitoring**

```bash
# Start the app in production mode
./start-production-clean.sh

# In a separate SSH session, start monitoring (30 minutes)
./debug-rpi-stability.sh 1800
```

### **Step 3: Monitor Browser Console** (if accessible)

If you can access the browser console on the RPi:

```javascript
// Show help for all debug commands
window.MasjidConnectDebug.help();

// Check for JavaScript crashes
window.MasjidConnectDebug.showCrashes();

// Monitor performance in real-time
window.MasjidConnectDebug.monitorPerformance(300000); // 5 minutes
```

---

## 📊 **What Each Tool Monitors**

### **System Monitor** (`debug-rpi-stability.sh`)

- ✅ **App Process Status** - Detects when app stops/restarts
- ✅ **System Resources** - CPU temp, memory, disk usage
- ✅ **Network Connectivity** - Internet, local network, API status
- ✅ **System Logs** - Kernel messages, crashes, thermal issues
- ✅ **GPU Memory** - RPi-specific graphics memory usage

### **JavaScript Crash Logger** (Automatic)

- ✅ **Unhandled Errors** - JavaScript exceptions that crash the app
- ✅ **Promise Rejections** - Async errors that cause instability
- ✅ **Component Crashes** - React component errors
- ✅ **Network Failures** - API timeouts/failures that trigger restarts
- ✅ **Performance Issues** - Long tasks, high memory usage

### **Browser Console Tools** (Interactive)

- ✅ **Real-time Memory** - Monitor JavaScript heap usage
- ✅ **Crash History** - View stored crash reports
- ✅ **System Information** - Browser, platform, timing details

---

## 🔍 **Common Restart Causes & Detection**

### **1. Thermal Throttling**

**Detection:** `debug-rpi-stability.sh` logs CPU temperature

```bash
# Check system log for high temperatures
grep "cpu_temp" rpi_debug_logs/system_*.log
```

**Solution:** Improve cooling, reduce GPU memory split

### **2. Network Timeouts**

**Detection:** Network log shows API failures

```bash
# Check for network issues
grep "DOWN" rpi_debug_logs/network_*.log
```

**Solution:** Increase API timeouts, add better retry logic

### **3. GPU/Driver Issues**

**Detection:** System logs show DRM/GPU errors

```bash
# Check error log for GPU problems
grep -i "gpu\|drm" rpi_debug_logs/errors_*.log
```

**Solution:** Reduce GPU acceleration, update drivers

### **4. JavaScript Memory Issues**

**Detection:** Browser console shows high memory usage

```javascript
window.MasjidConnectDebug.showSystemInfo();
```

**Solution:** Enable memory manager, reduce component complexity

### **5. Unhandled Errors**

**Detection:** Crash logger captures exceptions

```javascript
window.MasjidConnectDebug.showCrashes();
```

**Solution:** Fix specific JavaScript errors

### **6. System Resource Exhaustion**

**Detection:** System log shows resource limits

```bash
# Check for disk/memory issues
tail -20 rpi_debug_logs/system_*.log
```

**Solution:** Free disk space, add swap memory

---

## 📝 **Analysis Workflow**

### **After Running Monitoring:**

1. **Check Main Log for Restart Events**

   ```bash
   grep "RESTART DETECTED" rpi_debug_logs/stability_debug_*.log
   ```

2. **Review Error Log for Crash Details**

   ```bash
   cat rpi_debug_logs/errors_*.log
   ```

3. **Analyze System Trends**

   ```bash
   tail -20 rpi_debug_logs/system_*.log
   ```

4. **Check Network Stability**

   ```bash
   grep "DOWN" rpi_debug_logs/network_*.log
   ```

5. **Browser Console Analysis** (if accessible)
   ```javascript
   // Download complete crash report
   window.MasjidConnectDebug.downloadCrashReport();
   ```

---

## 🎯 **Expected Patterns**

### **If Temperature Related:**

- System log shows temps > 80°C
- Restarts correlate with high CPU usage
- More frequent during peak usage

### **If Network Related:**

- Network log shows frequent API failures
- Errors contain timeout/connection messages
- Restarts happen during sync operations

### **If JavaScript Related:**

- Crash logger shows specific error patterns
- Browser console shows memory growth
- Errors in component stack traces

### **If System Related:**

- Kernel logs show OOM kills or hardware errors
- System resources show exhaustion patterns
- Multiple processes affected, not just app

---

## 🔧 **Quick Commands Reference**

```bash
# Start monitoring
./debug-rpi-stability.sh 1800

# Check if app is running
ps aux | grep electron

# View last system errors
sudo dmesg | tail -20

# Check system temperature
cat /sys/class/thermal/thermal_zone0/temp

# View system memory
free -h

# Check disk space
df -h
```

```javascript
// Browser console commands
window.MasjidConnectDebug.help();
window.MasjidConnectDebug.showCrashes();
window.MasjidConnectDebug.showSystemInfo();
window.MasjidConnectDebug.monitorPerformance(60000);
```

---

## 📊 **Reporting Results**

When you find the issue, please provide:

1. **Main monitoring log** with restart timestamps
2. **Error log** showing crash details
3. **System log** with resource trends
4. **Browser crash report** (if accessible)
5. **Description** of when restarts happen (time, pattern, triggers)

This comprehensive monitoring will definitively identify what's causing the restarts beyond memory issues! 🎯
