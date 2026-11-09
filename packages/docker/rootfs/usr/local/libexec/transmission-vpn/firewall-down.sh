#!/command/with-contenv bash
set -euo pipefail

readonly script_directory="/usr/local/libexec/transmission-vpn"

source "${script_directory}/firewall-common.sh"

main() {
  acquire_firewall_lock

  if [[ ! -f "${firewall_backend_path}" ]]; then
    printf 'firewall-down: no active firewall state was found.\n'

    return 0
  fi

  load_firewall_backend
  remove_protected_interface_rules
  remove_firewall_rules
  rm -f \
    "${firewall_backend_path}" \
    "${firewall_interfaces_path}" \
    "${firewall_ipv6_path}" \
    "${firewall_ready_path}"

  printf 'firewall-down: fail-closed rules were removed after protected services stopped.\n'
}

main "$@"
