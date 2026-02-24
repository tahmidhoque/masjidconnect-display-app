[Unit]
Description=MasjidConnect Kiosk (X11 + Chromium)
# getty@tty1 is masked so vt1 is free. Xorg is given vt1 and opens it directly (no TTY allocation for the service).
Conflicts=getty@tty1.service
After=getty@tty1.service systemd-user-sessions.service plymouth-quit-wait.service masjidconnect-kiosk-setup.service masjidconnect-display.service
After=dbus.socket
Wants=dbus.socket
Requires=masjidconnect-display.service
ConditionPathExists=/dev/tty0

[Service]
Type=simple
# Run as root so Xorg can open vt1. Chromium is started as UID 1000 from xinitrc.
Environment=DISPLAY=:0
DeviceAllow=char-4:* rw
DeviceAllow=char-5:* rw
# No TTY allocation (avoids "Operation not permitted" on some systems). Xorg opens vt1 via xinit ... -- :0 vt1.
StandardOutput=journal
StandardError=journal
ExecStartPre=/bin/bash -c 'for i in $(seq 1 60); do curl -sf http://localhost:3001/health >/dev/null && break; sleep 1; done'
ExecStart=+/opt/masjidconnect/deploy/start-kiosk-x11.sh
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
