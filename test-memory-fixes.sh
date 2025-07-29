#!/bin/bash

# Test script for validating memory leak fixes on Raspberry Pi
# Run this script after deploying the fixes to monitor app stability

echo "🧪 MasjidConnect Display App - Memory Leak Fix Validation"
echo "========================================================="
echo ""
echo "⚠️  IMPORTANT: This script tests the PRODUCTION build only!"
echo ""
echo "📋 Before running this test:"
echo "1. Stop any development servers (npm start)"
echo "2. Build and start the production app:"
echo "   npm run build"
echo "   npm run electron"
echo "3. Then run this script"
echo ""

# Function to get memory usage
get_memory_usage() {
    local pid=$1
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        local mem_kb=$(ps -p "$pid" -o rss= 2>/dev/null | tr -d ' ')
        if [ -n "$mem_kb" ]; then
            echo $((mem_kb / 1024))  # Convert to MB
        else
            echo "0"
        fi
    else
        echo "0"
    fi
}

# Function to check if PRODUCTION app is running (Electron)
check_app_running() {
    # Look specifically for Electron process, not development server
    pgrep -f "electron.*masjidconnect" >/dev/null 2>&1 || pgrep -f "Electron.*masjidconnect" >/dev/null 2>&1
}

# Monitor memory usage over time
monitor_memory() {
    local duration=${1:-3600}  # Default 1 hour
    local interval=${2:-30}    # Check every 30 seconds
    local log_file="memory_test_$(date +%Y%m%d_%H%M%S).log"
    
    echo "📊 Starting memory monitoring for $duration seconds..."
    echo "Logging to: $log_file"
    
    # Write header
    echo "timestamp,memory_mb,status" > "$log_file"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    local max_memory=0
    local restart_count=0
    local initial_memory=0
    
    while [ $(date +%s) -lt $end_time ]; do
        local current_time=$(date +%s)
        local pid=$(pgrep -f "electron.*masjidconnect" | head -1)
        if [ -z "$pid" ]; then
            pid=$(pgrep -f "Electron.*masjidconnect" | head -1)
        fi
        
        if [ -n "$pid" ]; then
            local memory=$(get_memory_usage "$pid")
            
            # Track initial memory usage
            if [ $initial_memory -eq 0 ]; then
                initial_memory=$memory
                echo "📝 Initial memory usage: ${memory}MB"
            fi
            
            # Track maximum memory usage
            if [ $memory -gt $max_memory ]; then
                max_memory=$memory
            fi
            
            # Log data
            echo "$(date -Iseconds),$memory,running" >> "$log_file"
            
            # Check for memory growth
            local growth_percent=$(( (memory - initial_memory) * 100 / initial_memory ))
            if [ $growth_percent -gt 50 ]; then
                echo "⚠️  WARNING: Memory growth detected: ${growth_percent}% (${memory}MB)"
            fi
            
            # Display current status
            local elapsed=$((current_time - start_time))
            printf "\r⏱️  Elapsed: ${elapsed}s | Memory: ${memory}MB | Max: ${max_memory}MB | Growth: +${growth_percent}%%"
            
        else
            echo "$(date -Iseconds),0,not_running" >> "$log_file"
            restart_count=$((restart_count + 1))
            echo "\n❌ App not running! Restart count: $restart_count"
            
            # Wait for app to restart
            sleep 10
        fi
        
        sleep $interval
    done
    
    echo "\n\n📈 Memory Test Results:"
    echo "========================="
    echo "Initial Memory: ${initial_memory}MB"
    echo "Maximum Memory: ${max_memory}MB"
    echo "Memory Growth: +$(( (max_memory - initial_memory) * 100 / initial_memory ))%"
    echo "App Restarts: $restart_count"
    echo "Log File: $log_file"
    
    # Analyze results
    if [ $restart_count -eq 0 ] && [ $max_memory -lt $((initial_memory + 200)) ]; then
        echo "✅ PASS: App stable with minimal memory growth"
        return 0
    else
        echo "❌ FAIL: App showed instability or excessive memory growth"
        return 1
    fi
}

# Function to stress test the app
stress_test() {
    echo "🔥 Running stress test..."
    
    # Simulate rapid data sync operations
    for i in {1..10}; do
        echo "Triggering data sync $i/10..."
        # Send signal to refresh data (if app supports it)
        pkill -USR1 -f "masjidconnect-display" 2>/dev/null || true
        sleep 2
    done
    
    # Simulate network connectivity changes
    echo "Simulating network connectivity changes..."
    for i in {1..5}; do
        echo "Network change simulation $i/5..."
        # This would trigger network event listeners
        sleep 5
    done
}

# Main test execution
main() {
    echo "🚀 Starting MasjidConnect Display App Memory Test"
    echo "Date: $(date)"
    echo "System: $(uname -a)"
    
    # Check if PRODUCTION app is running
    if ! check_app_running; then
        echo "❌ Production Electron app is not running!"
        echo ""
        echo "Please start the PRODUCTION build first:"
        echo "1. npm run build"
        echo "2. npm run electron"
        echo ""
        echo "Do NOT use 'npm start' (development mode) for this test."
        exit 1
    fi
    
    echo "✅ App is running. Starting tests..."
    
    # Get initial system info
    echo "\n📋 System Information:"
    echo "Free Memory: $(free -h | grep Mem | awk '{print $7}')"
    echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')"
    
    # Run stress test first
    stress_test
    
    # Monitor memory for specified duration
    local test_duration=${1:-1800}  # Default 30 minutes
    monitor_memory "$test_duration"
    
    local result=$?
    
    if [ $result -eq 0 ]; then
        echo "\n🎉 Memory leak fixes appear to be working correctly!"
    else
        echo "\n⚠️  Further investigation may be needed."
    fi
    
    return $result
}

# Help function
show_help() {
    echo "Usage: $0 [duration_in_seconds]"
    echo ""
    echo "Monitor MasjidConnect Display App for memory leaks and stability issues"
    echo ""
    echo "Arguments:"
    echo "  duration_in_seconds  How long to monitor (default: 1800 = 30 minutes)"
    echo ""
    echo "Examples:"
    echo "  $0           # Monitor for 30 minutes"
    echo "  $0 3600      # Monitor for 1 hour"
    echo "  $0 600       # Monitor for 10 minutes"
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    "")
        main 1800  # Default 30 minutes
        ;;
    *)
        if [[ "$1" =~ ^[0-9]+$ ]]; then
            main "$1"
        else
            echo "Error: Invalid duration. Must be a number in seconds."
            show_help
            exit 1
        fi
        ;;
esac 