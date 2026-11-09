#!/command/with-contenv bash
set -euo pipefail

readonly script_directory="/usr/local/libexec/transmission-vpn"
readonly protected_interface="${1:-}"
readonly protected_local_address="${2:-}"
readonly protected_provider_address="${3:-}"

source "${script_directory}/firewall-common.sh"

main() {
  if [[ -z "${protected_interface}" || -z "${protected_local_address}" || \
    -z "${protected_provider_address}" ]]; then
    printf 'firewall-protect: an interface, slot address, and provider address are required.\n' >&2

    return 1
  fi

  acquire_firewall_lock
  load_firewall_backend
  replace_protected_interface_rule \
    "${protected_interface}" \
    "${protected_local_address}" \
    "${protected_provider_address}"
  verify_firewall_rules
  publish_firewall_ready

  printf 'firewall-protect: Transmission egress is restricted to %s from %s with SNAT %s.\n' \
    "${protected_interface}" \
    "${protected_local_address}" \
    "${protected_provider_address}"
}

main "$@"
