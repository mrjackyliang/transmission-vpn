#!/command/with-contenv bash
set -euo pipefail

readonly script_directory="/usr/local/libexec/transmission-vpn"

source "${script_directory}/firewall-common.sh"

main() {
  local required_paths=(
    "/dev/net/tun"
    "/run/transmission-vpn/config.ready"
    "/run/transmission-vpn/firewall.backend"
    "/run/transmission-vpn/firewall.ipv6"
    "/run/transmission-vpn/firewall.ready"
    "/run/transmission-vpn/services/control-api.ready"
    "/run/transmission-vpn/services/directory-controller.ready"
    "/run/transmission-vpn/services/transmission.ready"
    "/run/transmission-vpn/services/vpn-controller.ready"
  )

  local required_path

  for required_path in "${required_paths[@]}"; do
    if [[ ! -e "${required_path}" ]]; then
      printf 'healthcheck: required runtime state is missing: %s\n' "${required_path}" >&2

      return 1
    fi
  done

  if [[ ! -c /dev/net/tun ]]; then
    printf 'healthcheck: /dev/net/tun is not a character device.\n' >&2

    return 1
  fi

  acquire_firewall_lock
  load_firewall_backend
  verify_firewall_rules
  flock -u 9

  if ! wget -q -O /dev/null http://127.0.0.1:22602/api/v1/health/live; then
    printf 'healthcheck: the control API liveness endpoint failed.\n' >&2

    return 1
  fi

  local transmission_marker="/run/transmission-vpn/services/transmission.ready"
  local transmission_phase
  transmission_phase="$(sed -n \
    's/.*"phase"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    "${transmission_marker}")"
  if [[ "${transmission_phase}" == "no-connections" ]]; then
    return 0
  fi
  if [[ "${transmission_phase}" != "daemon" ]]; then
    printf 'healthcheck: the Transmission readiness phase is invalid.\n' >&2

    return 1
  fi

  local default_connection_id
  default_connection_id="$(sed -n \
    's/.*"connectionId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    "${transmission_marker}")"
  if [[ ! "${default_connection_id}" =~ ^vpc-[0-9a-f]{16}$ ]]; then
    printf 'healthcheck: the default Transmission connection identifier is invalid.\n' >&2

    return 1
  fi

  local daemon_state_path="/run/transmission-vpn/transmission-state/${default_connection_id}.json"
  if [[ ! -f "${daemon_state_path}" ]]; then
    printf 'healthcheck: the default Transmission daemon state is missing.\n' >&2

    return 1
  fi

  local daemon_state
  daemon_state="$(sed -n \
    's/.*"state"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    "${daemon_state_path}")"
  local rpc_port
  rpc_port="$(sed -n \
    's/.*"rpcPort"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' \
    "${daemon_state_path}")"
  if [[ "${daemon_state}" != "ready" || ! "${rpc_port}" =~ ^[0-9]+$ \
    || "${rpc_port}" -lt 9092 || "${rpc_port}" -gt 9155 ]]; then
    printf 'healthcheck: the default Transmission daemon state is invalid.\n' >&2

    return 1
  fi

  if ! nc -z -w 2 127.0.0.1 "${rpc_port}"; then
    printf 'healthcheck: the default Transmission RPC listener failed.\n' >&2

    return 1
  fi
}

main "$@"
