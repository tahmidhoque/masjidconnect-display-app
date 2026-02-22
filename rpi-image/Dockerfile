# MasjidConnect Display — build RPi image with rpi-image-gen in Docker
# Use when GitHub Actions artifact upload is not viable (e.g. image too large for free tier).
# Supports Pi 3 (arm64) and Pi 4/5; custom splash from rpi-image/assets/splash.png.

FROM debian:bookworm AS base

RUN apt-get update && apt-get install --no-install-recommends -y \
    build-essential \
    curl \
    git \
    ca-certificates \
    sudo \
    gpg \
    gpg-agent \
    dirmngr \
    debian-archive-keyring \
    && rm -rf /var/lib/apt/lists/*

# Optional: Raspberry Pi archive key (for any RPi-specific packages)
RUN curl -fsSL https://archive.raspberrypi.com/debian/raspberrypi.gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/raspberrypi-archive-keyring.gpg 2>/dev/null || true

# Clone rpi-image-gen (pin a known-good SHA; update as needed)
ARG RPIIG_GIT_SHA=master
RUN git clone --depth 1 https://github.com/raspberrypi/rpi-image-gen.git /rpi-image-gen \
    && (cd /rpi-image-gen && git fetch --depth 1 origin "${RPIIG_GIT_SHA}" && git checkout "${RPIIG_GIT_SHA}" 2>/dev/null || true)

# Install rpi-image-gen deps. On amd64, binfmt_misc is required for arm64 chroot.
RUN apt-get update \
    && if [ "$(uname -m)" = "x86_64" ]; then \
        apt-get install -y --no-install-recommends qemu-user-static binfmt-support \
        libarchive-tools parted zerofree libcap2-bin xxd file kmod bc pigz \
        quilt slirp4netns debootstrap \
        && update-binfmts --enable qemu-aarch64 2>/dev/null || true; \
    fi \
    && /rpi-image-gen/install_deps.sh 2>/dev/null || { \
        apt-get install -y --no-install-recommends qemu-user-static dirmngr slirp4netns \
        quilt parted debootstrap zerofree libcap2-bin libarchive-tools xxd file kmod bc pigz; \
        /rpi-image-gen/install_deps.sh; \
    }

# Pre-populate Debian keyring for arm64 chroot (mmdebstrap verification)
RUN mkdir -p /rpi-image-gen/work/keys \
    && cp /usr/share/keyrings/debian-archive-keyring.gpg /rpi-image-gen/work/keys/ 2>/dev/null || true

COPY rpi-image/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /rpi-image-gen
ENTRYPOINT ["/entrypoint.sh"]
