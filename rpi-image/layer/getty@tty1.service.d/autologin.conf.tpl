[Service]
ExecStart=
# --noclear    keep the retained Plymouth splash frame instead of blanking the VT
# --noissue    do not print /etc/issue (OS banner) above the (skipped) login prompt
# --nohostname belt-and-braces: never print the hostname
ExecStart=-/sbin/agetty --autologin AUTOLOGIN_USER --noclear --noissue --nohostname %I 38400 linux
