[Unit]
Description=MasjidConnect Kiosk (Cage + Chromium)
After=masjidconnect-display.service
Requires=masjidconnect-display.service

[Service]
Type=simple
User=$KIOSK_USER
# Wait for display server before starting Chromium
ExecStartPre=/bin/bash -c 'for i in $(seq 1 60); do curl -sf http://localhost:3001/health >/dev/null && break; sleep 1; done'
ExecStart=/usr/bin/cage -- /usr/bin/chromium-browser --kiosk --noerrdialogs --disable-infobars --check-for-update-interval=31536000 --disable-features=TranslateUI --disable-pinch --overscroll-history-navigation=0 --enable-gpu-rasterization --enable-oop-rasterization --disable-dev-shm-usage --force-device-scale-factor=1 --autoplay-policy=no-user-gesture-required --disable-session-crashed-bubble --disable-component-update --password-store=basic http://localhost:3001
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
