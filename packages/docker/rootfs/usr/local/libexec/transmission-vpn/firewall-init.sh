#!/command/with-contenv bash
set -euo pipefail

readonly script_directory="/usr/local/libexec/transmission-vpn"

source "${script_directory}/firewall-common.sh"

cleanup_on_error() {
  set +e

  remove_protected_rules_by_pattern
  remove_firewall_rules
  rm -f \
    "${firewall_backend_path}" \
    "${firewall_interfaces_path}" \
    "${firewall_ipv6_path}" \
    "${firewall_ready_path}"
}

main() {
  acquire_firewall_lock
  detect_firewall_ipv6

  local selected_backend
  selected_backend="$(select_firewall_backend)"

  configure_firewall_backend "${selected_backend}"
  remove_protected_rules_by_pattern
  rm -f "${firewall_interfaces_path}"
  remove_firewall_rules

  trap cleanup_on_error ERR

  install_firewall_rules
  verify_firewall_rules

  write_runtime_state_atomic "${firewall_backend_path}" "${selected_backend}"$'\n'
  publish_firewall_ready "startup"

  trap - ERR

  printf 'firewall-init: Transmission egress is blocked through the %s backend.\n' \
    "${selected_backend}"
}

main "$@"
