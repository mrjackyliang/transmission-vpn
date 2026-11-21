############################
#### Debian Base Rootfs ####
############################
FROM debian:trixie-20261005-slim@sha256:a29215f6a35e51e22adffa17f89e9d2ef06214e64a2bad10d765c46aea49f11f AS debian-base

ARG DEBIAN_FRONTEND="noninteractive"
