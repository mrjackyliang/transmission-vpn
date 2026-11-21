#!/command/with-contenv bash
set -euo pipefail

source /usr/local/libexec/nova-docker/log

readonly runtime_directory="/run/transmission-vpn"
readonly state_directory="${NOVA_STATE_DIRECTORY}"

fail() {
  local message="${1}"

  nova_log ERROR config-init "${message}"

  return 1
}

run_as_service_identity() {
  /command/s6-applyuidgid \
    -u "${PUID}" \
    -g "${PGID}" \
    -G "${PGID}" \
    "$@"
}

prepare_directories() {
  install -d -m 0755 -o root -g root "${runtime_directory}"

  local runtime_path
  for runtime_path in \
    "${runtime_directory}/directories" \
    "${runtime_directory}/services" \
    "${runtime_directory}/transmission-config" \
    "${runtime_directory}/transmission-state" \
    "${runtime_directory}/vpn.status.d" \
    "${runtime_directory}/web-proxy" \
    "${runtime_directory}/web-proxy-state"; do
    install -d -m 0770 -o "${PUID}" -g "${PGID}" "${runtime_path}"
  done

  install -d -m 0750 -o "${PUID}" -g "${PGID}" \
    "${state_directory}/transmission" \
    "${state_directory}/vpn"

  if ! run_as_service_identity /bin/sh -c 'test -w "$1"' sh /data; then
    fail "/data is not writable by PUID ${PUID} and PGID ${PGID}."
  fi
}

migrate_legacy_state() {
  if ! run_as_service_identity \
    /usr/local/bin/transmission-vpn-api \
    --migrate-state-only; then
    fail "Legacy app state could not be migrated safely."
  fi
}

initialize_control_state() {
  if ! run_as_service_identity \
    /usr/local/bin/transmission-vpn-api \
    --initialize-only; then
    fail "The control-plane database or managed configuration could not be initialized."
  fi
}

main() {
  if [[ ! -c /dev/net/tun ]]; then
    fail "The TUN device is unavailable. Start the container with --device=/dev/net/tun."
  fi

  prepare_directories
  migrate_legacy_state
  initialize_control_state

  printf '{"puid":%s,"pgid":%s,"timezone":"%s"}\n' \
    "${PUID}" \
    "${PGID}" \
    "${TZ}" > "${runtime_directory}/config.ready"

  nova_log INFO config-init \
    "Runtime identity ${PUID}:${PGID} and app paths are ready."
}

main "$@"
