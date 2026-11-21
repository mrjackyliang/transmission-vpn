#!/command/with-contenv bash
set -euo pipefail

readonly script_directory="/usr/local/libexec/transmission-vpn"
readonly requested_block_reason="${1:-vpn-unavailable}"
readonly protected_interface="${2:-}"

source "${script_directory}/firewall-common.sh"

main() {
  if [[ ! "${requested_block_reason}" =~ ^[A-Za-z0-9._:-]+$ ]]; then
    nova_log ERROR firewall-block "The block reason contains unsupported characters."

    return 1
  fi

  acquire_firewall_lock
  load_firewall_backend
  remove_protected_interface_rules "${protected_interface}"
  verify_firewall_rules
  publish_firewall_ready "${requested_block_reason}"

  if [[ -n "${protected_interface}" ]]; then
    nova_log INFO firewall-block \
      "Transmission egress through ${protected_interface} is blocked (${requested_block_reason})."
  else
    nova_log INFO firewall-block \
      "All Transmission VPN egress is blocked (${requested_block_reason})."
  fi
}

main "$@"
