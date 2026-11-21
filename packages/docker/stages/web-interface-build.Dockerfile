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
