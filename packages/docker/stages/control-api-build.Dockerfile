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
