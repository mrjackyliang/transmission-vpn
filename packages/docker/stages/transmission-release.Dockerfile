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

# An optional github_token build secret lifts GitHub's unauthenticated rate limit; it never enters a layer.
RUN --mount=type=secret,id=github_token,required=false \
  set --; \
  if [ -s /run/secrets/github_token ]; then \
    set -- --header "Authorization: Bearer $(cat /run/secrets/github_token)"; \
  fi; \
  curl --fail --location --silent --show-error \
    --header "Accept: application/vnd.github+json" \
    "$@" \
    --output releases.json \
    "https://api.github.com/repos/transmission/transmission/releases?per_page=100" \
  && jq --exit-status --raw-output --arg series "${TRANSMISSION_SERIES}" \
    --from-file transmission-release.jq releases.json > transmission.env
