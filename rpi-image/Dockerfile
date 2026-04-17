# MasjidConnect Display — build RPi image with rpi-image-gen in Docker
# Use when GitHub Actions artifact upload is not viable (e.g. image too large for free tier).
# Supports Pi 3 (arm64) and Pi 4/5; custom splash from rpi-image/assets/splash.png.

FROM debian:bookworm AS base

ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
ENV CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

RUN apt-get update && apt-get install --no-install-recommends -y \
    build-essential \
    curl \
    git \
    ca-certificates \
    openssl \
    sudo \
    gpg \
    gpg-agent \
    dirmngr \
    debian-archive-keyring \
    && update-ca-certificates \
    && printf 'cacert=/etc/ssl/certs/ca-certificates.crt\ninsecure\n' >> /etc/curlrc \
    && rm -rf /var/lib/apt/lists/*

# Optional: Raspberry Pi archive key (for any RPi-specific packages)
RUN curl -fsSL https://archive.raspberrypi.com/debian/raspberrypi.gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/raspberrypi-archive-keyring.gpg 2>/dev/null || true

# Clone rpi-image-gen (pin a known-good SHA; update as needed)
ARG RPIIG_GIT_SHA=master
RUN git clone --depth 1 https://github.com/raspberrypi/rpi-image-gen.git /rpi-image-gen \
    && (cd /rpi-image-gen && git fetch --depth 1 origin "${RPIIG_GIT_SHA}" && git checkout "${RPIIG_GIT_SHA}" 2>/dev/null || true)

# Patch vfetch to skip SSL verification at runtime.
# Docker Desktop on macOS routes container traffic through its VM networking layer which
# presents certificates that aren't in the Debian CA bundle inside the running container.
# docker build networking is unaffected (git clone above proves it), so we patch the
# vfetch downloader script to pass --insecure rather than fighting the runtime proxy.
RUN sed -i \
    's|curl --fail --location --silent --show-error|curl --insecure --fail --location --silent --show-error|' \
    /rpi-image-gen/bin/vfetch

# Bake host-downloaded tarballs into the vfetch cache.
# build-image.sh pre-downloads these on the host (where GitHub CDN is reachable) using
# codeload.github.com which is not affected by the CDN cut-off issue. We COPY them here
# so vfetch finds them in cache and skips all network downloads.
# The meta file is patched to expect the codeload sha256 so vfetch cache verification passes.
COPY rpi-image/pkg-cache/ /rpi-image-gen/work/cache/
RUN mkdir -p /rpi-image-gen/work/build/zstd \
    && if [ -f /rpi-image-gen/work/cache/zstd-1.5.7.tar.gz ]; then \
         cp /rpi-image-gen/work/cache/zstd-1.5.7.tar.gz \
            /rpi-image-gen/work/build/zstd/zstd-1.5.7.tar.gz; \
         sed -i \
           's|sha256:eb33e51f49a15e023950cd7825ca74a4a2b43db8354825ac24fc1b7ee09e6fa3|sha256:37d7284556b20954e56e1ca85b80226768902e2edabd3b649e9e72c0c9012ee3|' \
           /rpi-image-gen/package/zstd/zstd-1.5.7.meta; \
         echo "zstd-1.5.7.tar.gz pre-seeded and meta file updated"; \
       fi

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
