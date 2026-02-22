[Unit]
Description=MasjidConnect Kiosk (Cage + Chromium)
# Replace getty on tty1 so Cage owns the console and the display shows the app, not a login prompt.
Conflicts=getty@tty1.service
After=getty@tty1.service systemd-user-sessions.service plymouth-quit-wait.service masjidconnect-kiosk-setup.service masjidconnect-display.service
After=dbus.socket systemd-logind.service
Wants=dbus.socket systemd-logind.service
Requires=masjidconnect-display.service
ConditionPathExists=/dev/tty0

[Service]
Type=simple
# Run as UID 1000 so Pi Imager custom user (e.g. mcadmin) works; setup service adds this user to render/video.
User=1000
Group=1000
# Allow Cage to start when there are no keyboard/mouse (e.g. kiosk with no input devices).
Environment=WLR_LIBINPUT_NO_DEVICES=1
# Wait for DRM device (vc4 KMS) before starting Cage
ExecStartPre=/bin/bash -c 'for i in $(seq 1 30); do [ -e /dev/dri/card0 ] && break; sleep 1; done; [ -e /dev/dri/card0 ] || { echo "No DRM device found"; exit 1; }'
# Wait for display server before starting Chromium
ExecStartPre=/bin/bash -c 'for i in $(seq 1 60); do curl -sf http://localhost:3001/health >/dev/null && break; sleep 1; done'
ExecStart=/usr/bin/cage -- /usr/bin/chromium-browser --kiosk --noerrdialogs --disable-infobars --check-for-update-interval=31536000 --disable-features=TranslateUI --disable-pinch --overscroll-history-navigation=0 --enable-gpu-rasterization --enable-oop-rasterization --disable-dev-shm-usage --force-device-scale-factor=1 --autoplay-policy=no-user-gesture-required --disable-session-crashed-bubble --disable-component-update --password-store=basic --renderer-process-limit=1 --disable-background-networking --disable-backgrounding-occluded-windows http://localhost:3001
ExecStartPost=+/bin/sh -c 'chvt 1'
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
# Own tty1 so Cage displays on the physical screen instead of leaving getty visible.
TTYPath=/dev/tty1
TTYReset=yes
TTYVHangup=yes
TTYVTDisallocate=yes
StandardInput=tty-fail
UtmpIdentifier=tty1
UtmpMode=user
# Required by Cage/wlroots for logind session.
PAMName=cage

[Install]
WantedBy=default.target
