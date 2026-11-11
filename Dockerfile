# syntax=docker/dockerfile:1

############################
#### Debian Base Rootfs ####
############################
FROM debian:trixie-20261005-slim@sha256:a29215f6a35e51e22adffa17f89e9d2ef06214e64a2bad10d765c46aea49f11f AS debian-base

ARG DEBIAN_FRONTEND="noninteractive"

############################
#### s6-overlay Rootfs ####
############################
FROM debian-base AS s6-overlay

ARG TARGETARCH
ARG S6_OVERLAY_VERSION="3.2.3.2"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
  case "${TARGETARCH}" in \
    "amd64") s6_architecture="x86_64" ;; \
    "arm64") s6_architecture="aarch64" ;; \
    *) echo "Unsupported target architecture: ${TARGETARCH}" >&2; exit 1 ;; \
  esac; \
  mkdir -p /s6-rootfs; \
  for archive_name in "s6-overlay-noarch.tar.xz" "s6-overlay-${s6_architecture}.tar.xz"; do \
    release_url="https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}"; \
    curl --fail --location --silent --show-error \
      --output "/tmp/${archive_name}" \
      "${release_url}/${archive_name}"; \
    curl --fail --location --silent --show-error \
      --output "/tmp/${archive_name}.sha256" \
      "${release_url}/${archive_name}.sha256"; \
    cd /tmp; \
    sha256sum -c "${archive_name}.sha256"; \
    tar -C /s6-rootfs -Jxpf "/tmp/${archive_name}"; \
    rm -f "/tmp/${archive_name}" "/tmp/${archive_name}.sha256"; \
  done

##############################
#### Transmission Release ####
##############################
FROM debian-base AS transmission-release

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    jq \
  && rm -rf /var/lib/apt/lists/*

ARG TRANSMISSION_SERIES="4.1"

WORKDIR /release

COPY packages/docker/transmission-release.jq ./transmission-release.jq

# The feed changes with every Transmission release, so the next step runs again only then.
ADD https://github.com/transmission/transmission/releases.atom ./releases.atom

RUN curl --fail --location --silent --show-error \
    --header "Accept: application/vnd.github+json" \
    --output releases.json \
    "https://api.github.com/repos/transmission/transmission/releases?per_page=100" \
  && jq --exit-status --raw-output --arg series "${TRANSMISSION_SERIES}" \
    --from-file transmission-release.jq releases.json > transmission.env

###################################
#### Transmission Source Build ####
###################################
FROM debian-base AS transmission-build

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    cmake \
    curl \
    libb64-dev \
    libcurl4-openssl-dev \
    libdeflate-dev \
    libevent-dev \
    libminiupnpc-dev \
    libnatpmp-dev \
    libssl-dev \
    ninja-build \
    pkg-config \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

ARG TRANSMISSION_BUILD_JOBS="1"

WORKDIR /build

COPY --from=transmission-release /release/transmission.env ./transmission.env

RUN . ./transmission.env \
  && curl --fail --location --silent --show-error \
    --output transmission.tar.xz \
    "https://github.com/transmission/transmission/releases/download/${TRANSMISSION_VERSION}/transmission-${TRANSMISSION_VERSION}.tar.xz" \
  && printf '%s  %s\n' "${TRANSMISSION_SHA256}" "transmission.tar.xz" \
    | sha256sum -c - \
  && mkdir source \
  && tar -xJf transmission.tar.xz --strip-components=1 -C source

RUN cmake -S source -B output -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr/local \
    -DENABLE_CLI=OFF \
    -DENABLE_DAEMON=ON \
    -DENABLE_GTK=OFF \
    -DENABLE_MAC=OFF \
    -DENABLE_NLS=OFF \
    -DENABLE_QT=OFF \
    -DENABLE_TESTS=OFF \
    -DENABLE_UTILS=OFF \
    -DINSTALL_DOC=OFF \
    -DINSTALL_LIB=OFF \
    -DINSTALL_WEB=OFF \
    -DREBUILD_WEB=OFF \
    -DRUN_CLANG_TIDY=OFF \
    -DWITH_CRYPTO=openssl \
    -DWITH_SYSTEMD=OFF \
  && cmake --build output --target transmission-daemon \
    --parallel "${TRANSMISSION_BUILD_JOBS}" \
  && DESTDIR=/build/install cmake --install output --strip

RUN . ./transmission.env \
  && /build/install/usr/local/bin/transmission-daemon --version 2>&1 \
    | grep -F "${TRANSMISSION_VERSION}"

#############################
#### Web Interface Build ####
#############################
FROM node:24.22.0-trixie-slim@sha256:a6155384446670e9719bdc4fd0ebe4d4b29fb32a8d6aa523da3547a6cfbcf22c AS web-interface-build

WORKDIR /workspace

COPY packages/docker/build-package.json ./package.json
COPY ["apps/transmission/package.json", "apps/transmission/package.json"]

RUN npm install --ignore-scripts

COPY ["apps/transmission/index.html", "apps/transmission/index.html"]
COPY ["apps/transmission/tsconfig.web.json", "apps/transmission/tsconfig.web.json"]
COPY ["apps/transmission/vite.config.mts", "apps/transmission/vite.config.mts"]
COPY ["apps/transmission/mock-api.mts", "apps/transmission/mock-api.mts"]
COPY ["apps/transmission/src", "apps/transmission/src"]

RUN npm run build:web --workspace='transmission-vpn-app-transmission'

##################################
#### Control API Dependencies ####
##################################
FROM --platform=$BUILDPLATFORM golang:1.27.3-trixie@sha256:fbb7ae40b62ff8afe31662df570d39b4f5052ac32b90dae8e60d7657a20a74f4 AS control-api-dependencies

WORKDIR /source

COPY apps/transmission/control-api/go.mod apps/transmission/control-api/go.sum ./

RUN go mod download \
  && go mod verify

##########################
#### Control API Test ####
##########################
FROM control-api-dependencies AS control-api-test

COPY apps/transmission/control-api/ ./

RUN go test ./...

###########################
#### Control API Build ####
###########################
FROM control-api-test AS control-api-build

ARG TARGETARCH
ARG TARGETOS

# The release step bumps this manifest, so the API reports the version it shipped in.
COPY ["apps/transmission/package.json", "/version/package.json"]

RUN version="$(sed -n 's/^  "version": "\([^"]*\)",$/\1/p' /version/package.json)" \
  && test -n "${version}" \
  && CGO_ENABLED=0 GOARCH="${TARGETARCH}" GOOS="${TARGETOS}" \
  go build \
    -buildvcs=false \
    -ldflags="-s -w -X main.version=${version}" \
    -o /out/transmission-vpn-api \
    -trimpath \
    ./cmd/transmission-vpn-api \
  && CGO_ENABLED=0 GOARCH="${TARGETARCH}" GOOS="${TARGETOS}" \
    go build \
      -buildvcs=false \
      -ldflags="-s -w" \
      -o /out/transmission-vpn-directory-controller \
      -trimpath \
      ./cmd/directory-controller \
  && CGO_ENABLED=0 GOARCH="${TARGETARCH}" GOOS="${TARGETOS}" \
    go build \
      -buildvcs=false \
      -ldflags="-s -w" \
      -o /out/transmission-vpn-web-proxy \
      -trimpath \
      ./cmd/web-proxy \
  && CGO_ENABLED=0 GOARCH="${TARGETARCH}" GOOS="${TARGETOS}" \
  go build \
    -buildvcs=false \
    -ldflags="-s -w" \
    -o /out/transmission-vpn-vpn-controller \
    -trimpath \
    ./cmd/vpn-controller \
  && CGO_ENABLED=0 GOARCH="${TARGETARCH}" GOOS="${TARGETOS}" \
  go build \
    -buildvcs=false \
    -ldflags="-s -w" \
    -o /out/transmission-vpn-transmission-runner \
    -trimpath \
    ./cmd/transmission-runner

#######################
#### Runtime Image ####
#######################
FROM debian-base AS runtime

# The publish workflow adds org.opencontainers.image.version from the release tag.
LABEL org.opencontainers.image.title="Transmission VPN" \
  org.opencontainers.image.description="Fail-closed Transmission appliance with OpenVPN and WireGuard"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    iproute2 \
    iptables \
    libb64-0d \
    libcurl4t64 \
    libdeflate0 \
    libevent-2.1-7t64 \
    libminiupnpc18 \
    libnatpmp1t64 \
    libstdc++6 \
    netcat-openbsd \
    openvpn \
    passwd \
    sysvinit-utils \
    tzdata \
    util-linux \
    wget \
    wireguard-go \
    wireguard-tools \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1000 transmission \
  && useradd \
    --gid transmission \
    --home-dir /nonexistent \
    --no-create-home \
    --shell /usr/sbin/nologin \
    --uid 1000 \
    transmission \
  && groupadd --gid 65531 webproxy \
  && useradd \
    --gid webproxy \
    --home-dir /nonexistent \
    --no-create-home \
    --shell /usr/sbin/nologin \
    --uid 65531 \
    webproxy \
  && groupadd --gid 65532 control \
  && useradd \
    --gid control \
    --home-dir /nonexistent \
    --no-create-home \
    --shell /usr/sbin/nologin \
    --uid 65532 \
    control

COPY --from=s6-overlay /s6-rootfs/ /
COPY --from=transmission-build /build/install/usr/local/bin/transmission-daemon /usr/local/bin/transmission-daemon
COPY --from=control-api-build /out/transmission-vpn-api /usr/local/bin/transmission-vpn-api
COPY --from=control-api-build /out/transmission-vpn-directory-controller /usr/local/bin/transmission-vpn-directory-controller
COPY --from=control-api-build /out/transmission-vpn-transmission-runner /usr/local/bin/transmission-vpn-transmission-runner
COPY --from=control-api-build /out/transmission-vpn-vpn-controller /usr/local/bin/transmission-vpn-vpn-controller
COPY --from=control-api-build /out/transmission-vpn-web-proxy /usr/local/bin/transmission-vpn-web-proxy
COPY --from=web-interface-build /workspace/apps/transmission/build /usr/local/share/transmission-vpn/web
COPY packages/docker/rootfs/ /

RUN chmod 0755 \
  /etc/s6-overlay/s6-rc.d/control-api/finish \
  /etc/s6-overlay/s6-rc.d/control-api/run \
  /etc/s6-overlay/s6-rc.d/directory-controller/finish \
  /etc/s6-overlay/s6-rc.d/directory-controller/run \
  /etc/s6-overlay/s6-rc.d/transmission/finish \
  /etc/s6-overlay/s6-rc.d/transmission/run \
  /etc/s6-overlay/s6-rc.d/vpn-controller/finish \
  /etc/s6-overlay/s6-rc.d/vpn-controller/run \
  /etc/s6-overlay/s6-rc.d/web-proxy/finish \
  /etc/s6-overlay/s6-rc.d/web-proxy/run \
  /usr/local/libexec/transmission-vpn/*.sh

ENV PGID="1000" \
  PATH="/command:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
  PUID="1000" \
  S6_BEHAVIOUR_IF_STAGE2_FAILS="2" \
  S6_CMD_WAIT_FOR_SERVICES_MAXTIME="0" \
  S6_VERBOSITY="1" \
  TZ="UTC"

VOLUME ["/config", "/data"]

EXPOSE 9091
EXPOSE 22602
EXPOSE 22605

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/usr/local/libexec/transmission-vpn/healthcheck.sh"]

STOPSIGNAL SIGTERM

# s6-overlay must start as root so its oneshots can configure identities and networking.
ENTRYPOINT ["/init"]
