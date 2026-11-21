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
