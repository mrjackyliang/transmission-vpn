##################################
#### Control API Dependencies ####
##################################
FROM --platform=$BUILDPLATFORM golang:1.27.3-trixie@sha256:fbb7ae40b62ff8afe31662df570d39b4f5052ac32b90dae8e60d7657a20a74f4 AS control-api-dependencies

WORKDIR /source

COPY apps/transmission/control-api/go.mod apps/transmission/control-api/go.sum ./

RUN go mod download \
  && go mod verify
