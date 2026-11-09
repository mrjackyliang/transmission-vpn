#!/command/with-contenv bash
set -euo pipefail

readonly script_directory="/usr/local/libexec/transmission-vpn"
readonly requested_block_reason="${1:-vpn-unavailable}"
readonly protected_interface="${2:-}"

source "${script_directory}/firewall-common.sh"

main() {
  if [[ ! "${requested_block_reason}" =~ ^[A-Za-z0-9._:-]+$ ]]; then
    printf 'firewall-block: the block reason contains unsupported characters.\n' >&2

    return 1
  fi

  acquire_firewall_lock
  load_firewall_backend
  remove_protected_interface_rules "${protected_interface}"
  verify_firewall_rules
  publish_firewall_ready "${requested_block_reason}"

  if [[ -n "${protected_interface}" ]]; then
    printf 'firewall-block: Transmission egress through %s is blocked (%s).\n' \
      "${protected_interface}" \
      "${requested_block_reason}"
  else
    printf 'firewall-block: all Transmission VPN egress is blocked (%s).\n' \
      "${requested_block_reason}"
  fi
}

main "$@"
