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
    nova_log ERROR firewall-protect \
      "An interface, slot address, and provider address are required."

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

  nova_log INFO firewall-protect \
    "Transmission egress is restricted to ${protected_interface} from ${protected_local_address} with SNAT ${protected_provider_address}."
}

main "$@"
