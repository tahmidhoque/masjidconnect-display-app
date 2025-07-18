#!/bin/bash
# MasjidConnect Display App - Raspberry Pi Optimizer
# This script optimizes the Raspberry Pi for better performance with the MasjidConnect Display App

echo "MasjidConnect Display App - Raspberry Pi Optimizer"
echo "=================================================="
echo

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
   echo "This script must be run as root" 
   echo "Try: sudo $0"
   exit 1
fi

echo "Checking system..."
PI_MODEL=$(grep "Model" /proc/cpuinfo | sed 's/Model\s*: //g')
echo "Detected: $PI_MODEL"

# Set CPU governor to performance
echo "Setting CPU governor to performance mode..."
if [ -d /sys/devices/system/cpu/cpu0/cpufreq ]; then
  for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
    echo "performance" > $cpu
    echo " - Set $(dirname $cpu) to performance mode"
  done
  echo " - CPU governor set to performance"
else
  echo " - CPU governor control not available"
fi

# Reduce swappiness to minimize disk I/O
echo "Reducing swappiness to minimize disk I/O..."
sysctl -w vm.swappiness=10
echo " - Set swappiness to 10"

# Configure Raspberry Pi specific optimizations
if [ -f /boot/config.txt ] || [ -f /boot/firmware/config.txt ]; then
  echo "Configuring Raspberry Pi specific optimizations..."
  
  CONFIG_FILE="/boot/config.txt"
  if [ -f /boot/firmware/config.txt ]; then
    CONFIG_FILE="/boot/firmware/config.txt"
  fi
  
  # Make backup of config file
  cp $CONFIG_FILE "${CONFIG_FILE}.bak"
  echo " - Backup created at ${CONFIG_FILE}.bak"
  
  # Check if GPU memory is already set
  if ! grep -q "^gpu_mem=" $CONFIG_FILE; then
    echo "gpu_mem=128" >> $CONFIG_FILE
    echo " - Set GPU memory to 128MB"
  else
    echo " - GPU memory allocation already configured"
  fi
  
  # Enable OpenGL driver with less memory usage
  if ! grep -q "^dtoverlay=vc4-kms-v3d" $CONFIG_FILE; then
    echo "dtoverlay=vc4-kms-v3d" >> $CONFIG_FILE
    echo " - Enabled VC4 KMS V3D graphics driver"
  else
    echo " - VC4 KMS V3D graphics driver already enabled"
  fi
  
  # Enable CPU boost if available
  if ! grep -q "^force_turbo=1" $CONFIG_FILE; then
    echo "force_turbo=1" >> $CONFIG_FILE
    echo " - Enabled CPU turbo mode"
  else
    echo " - CPU turbo mode already enabled"
  fi
  
  # Disable Bluetooth to save resources if available
  if ! grep -q "^dtoverlay=disable-bt" $CONFIG_FILE; then
    echo "dtoverlay=disable-bt" >> $CONFIG_FILE
    echo " - Disabled Bluetooth to save resources"
  else
    echo " - Bluetooth already disabled"
  fi
  
  # Configure HDMI timings for better display performance
  if ! grep -q "^hdmi_group=" $CONFIG_FILE; then
    echo "hdmi_group=2" >> $CONFIG_FILE
    echo "hdmi_mode=82" >> $CONFIG_FILE
    echo " - Configured HDMI for 1080p 60Hz"
  else
    echo " - HDMI already configured"
  fi
  
  echo " - Raspberry Pi specific optimizations applied"
else
  echo " - No Raspberry Pi config file found, skipping specific optimizations"
fi

# Create a service to restore performance governor on boot
if [ ! -f /etc/systemd/system/cpu-performance.service ]; then
  echo "Creating service to set CPU governor on boot..."
  cat > /etc/systemd/system/cpu-performance.service << EOF
[Unit]
Description=CPU Performance Governor
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do echo performance > \$cpu; done'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

  systemctl enable cpu-performance.service
  echo " - Created and enabled cpu-performance service"
else
  echo " - CPU performance service already exists"
fi

# Set up X11 configurations for better performance
if [ -d /etc/X11 ]; then
  echo "Setting up X11 configurations for better performance..."
  
  # Create an X11 configuration with acceleration disabled
  if [ ! -f /etc/X11/xorg.conf.d/20-modesetting.conf ]; then
    mkdir -p /etc/X11/xorg.conf.d/
    cat > /etc/X11/xorg.conf.d/20-modesetting.conf << EOF
Section "Device"
    Identifier  "Raspberry Pi"
    Driver      "modesetting"
    Option      "AccelMethod"    "none"
    Option      "SWcursor"       "true"
EndSection
EOF
    echo " - Created X11 configuration with software rendering"
  else
    echo " - X11 configuration already exists"
  fi
fi

echo
echo "Optimization complete! Please reboot your Raspberry Pi for changes to take effect."
echo "Run the following command to reboot:"
echo "sudo reboot" 