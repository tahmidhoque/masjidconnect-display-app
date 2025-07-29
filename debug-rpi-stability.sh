#!/bin/bash

# RPi Stability Debug Monitor
# Comprehensive logging to identify restart causes

echo "🔍 MasjidConnect RPi Stability Monitor"
echo "====================================="

# Configuration
MONITOR_DURATION=${1:-3600}  # Default 1 hour
LOG_DIR="./rpi_debug_logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MAIN_LOG="$LOG_DIR/stability_debug_$TIMESTAMP.log"
ERROR_LOG="$LOG_DIR/errors_$TIMESTAMP.log"
SYSTEM_LOG="$LOG_DIR/system_$TIMESTAMP.log"
NETWORK_LOG="$LOG_DIR/network_$TIMESTAMP.log"

# Create logs directory
mkdir -p "$LOG_DIR"

# Function to log with timestamp
log_event() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$MAIN_LOG"
}

# Function to monitor system resources
monitor_system() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Memory info
    local mem_total=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local mem_free=$(grep MemFree /proc/meminfo | awk '{print $2}')
    local mem_available=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    
    # CPU temperature (RPi specific)
    local cpu_temp="N/A"
    if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
        cpu_temp=$(($(cat /sys/class/thermal/thermal_zone0/temp) / 1000))
    fi
    
    # CPU usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}' 2>/dev/null || echo "N/A")
    
    # Disk usage
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    # GPU memory (RPi specific)
    local gpu_mem="N/A"
    if command -v vcgencmd >/dev/null 2>&1; then
        gpu_mem=$(vcgencmd get_mem gpu 2>/dev/null | cut -d= -f2 || echo "N/A")
    fi
    
    echo "$timestamp,mem_total:${mem_total}KB,mem_free:${mem_free}KB,mem_available:${mem_available}KB,cpu_temp:${cpu_temp}°C,cpu_usage:${cpu_usage}%,disk_usage:${disk_usage}%,gpu_mem:$gpu_mem" >> "$SYSTEM_LOG"
}

# Function to monitor network connectivity
monitor_network() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Check internet connectivity
    local internet_status="DOWN"
    if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        internet_status="UP"
    fi
    
    # Check local network
    local local_network_status="DOWN"
    if ping -c 1 192.168.1.1 >/dev/null 2>&1 || ping -c 1 10.0.0.1 >/dev/null 2>&1; then
        local_network_status="UP"
    fi
    
    # Check API endpoint if configured
    local api_status="UNKNOWN"
    if [ -n "$MASJIDCONNECT_API_BASE_URL" ]; then
        if curl -s --connect-timeout 5 "$MASJIDCONNECT_API_BASE_URL/health" >/dev/null 2>&1; then
            api_status="UP"
        else
            api_status="DOWN"
        fi
    fi
    
    echo "$timestamp,internet:$internet_status,local_network:$local_network_status,api:$api_status" >> "$NETWORK_LOG"
}

# Function to monitor app processes
monitor_app_process() {
    local pids=($(pgrep -f "masjidconnect-display-app.*Electron" 2>/dev/null))
    
    if [ ${#pids[@]} -eq 0 ]; then
        # Try alternative patterns
        pids=($(pgrep -f "electron.*masjid" 2>/dev/null))
    fi
    
    if [ ${#pids[@]} -eq 0 ]; then
        log_event "ERROR" "🚨 APP NOT RUNNING! Process disappeared."
        return 1
    fi
    
    local main_pid=${pids[0]}
    local memory=$(ps -p "$main_pid" -o rss= 2>/dev/null | tr -d ' ')
    
    if [ -n "$memory" ]; then
        local memory_mb=$((memory / 1024))
        log_event "INFO" "App running: PID=$main_pid, Memory=${memory_mb}MB"
        return 0
    else
        log_event "ERROR" "🚨 APP PROCESS UNRESPONSIVE! PID=$main_pid"
        return 1
    fi
}

# Function to capture system logs related to crashes
capture_system_logs() {
    log_event "INFO" "Capturing system logs for crash analysis..."
    
    # Journalctl logs for electron/node crashes
    if command -v journalctl >/dev/null 2>&1; then
        journalctl --since "5 minutes ago" | grep -E "(electron|node|segfault|killed|crashed)" >> "$ERROR_LOG" 2>/dev/null
    fi
    
    # Dmesg for kernel-level issues
    if command -v dmesg >/dev/null 2>&1; then
        dmesg | tail -50 | grep -E "(killed|oom|thermal|gpu|drm)" >> "$ERROR_LOG" 2>/dev/null
    fi
    
    # Check for core dumps
    if [ -d /var/crash ]; then
        ls -la /var/crash/ >> "$ERROR_LOG" 2>/dev/null
    fi
}

# Function to monitor electron console errors
monitor_electron_logs() {
    # If electron is running with console output, try to capture it
    local log_file="$HOME/.config/masjidconnect-display-app/logs/main.log"
    if [ -f "$log_file" ]; then
        tail -n 20 "$log_file" | grep -E "(error|crash|fatal|exception)" >> "$ERROR_LOG" 2>/dev/null
    fi
}

# Trap function to handle cleanup
cleanup() {
    log_event "INFO" "🛑 Monitoring stopped. Generating summary report..."
    
    echo "
🔍 STABILITY MONITORING SUMMARY
==============================
Duration: $MONITOR_DURATION seconds
Logs Location: $LOG_DIR

📊 Key Files:
- Main Log: $MAIN_LOG
- Error Log: $ERROR_LOG  
- System Log: $SYSTEM_LOG
- Network Log: $NETWORK_LOG

🔧 Analysis Commands:
- View errors: cat $ERROR_LOG
- System trends: tail -20 $SYSTEM_LOG
- Network issues: grep DOWN $NETWORK_LOG
- App restarts: grep 'NOT RUNNING' $MAIN_LOG

📋 Next Steps:
1. Review error log for crash details
2. Check system log for thermal/memory issues
3. Examine network log for connectivity problems
4. Look for patterns in restart timing
"
    exit 0
}

# Set up signal handling
trap cleanup SIGINT SIGTERM

# Main monitoring loop
main() {
    log_event "INFO" "🚀 Starting comprehensive RPi stability monitoring"
    log_event "INFO" "Duration: ${MONITOR_DURATION}s | Logs: $LOG_DIR"
    
    # Create log headers
    echo "timestamp,mem_total,mem_free,mem_available,cpu_temp,cpu_usage,disk_usage,gpu_mem" > "$SYSTEM_LOG"
    echo "timestamp,internet,local_network,api" > "$NETWORK_LOG"
    echo "=== ERROR LOG START $(date) ===" > "$ERROR_LOG"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + MONITOR_DURATION))
    local restart_count=0
    local last_app_status=1  # 0=running, 1=not running
    
    while [ $(date +%s) -lt $end_time ]; do
        # Monitor app process
        if monitor_app_process; then
            if [ $last_app_status -eq 1 ]; then
                restart_count=$((restart_count + 1))
                log_event "WARNING" "🔄 APP RESTART DETECTED! Count: $restart_count"
                capture_system_logs
                monitor_electron_logs
            fi
            last_app_status=0
        else
            last_app_status=1
        fi
        
        # Monitor system resources every 30 seconds
        monitor_system
        
        # Monitor network every 60 seconds
        if [ $(($(date +%s) % 60)) -eq 0 ]; then
            monitor_network
        fi
        
        # Sleep between checks
        sleep 30
    done
    
    log_event "INFO" "✅ Monitoring completed. Total restarts detected: $restart_count"
    cleanup
}

# Check if app is running before starting
if ! pgrep -f "electron.*masjid\|masjidconnect.*electron" >/dev/null 2>&1; then
    echo "❌ MasjidConnect app is not running!"
    echo "Start the app first with: ./start-production-clean.sh"
    exit 1
fi

# Start monitoring
main 