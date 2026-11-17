#!/command/with-contenv bash
set -euo pipefail

readonly script_directory="/usr/local/libexec/transmission-vpn"

source "${script_directory}/firewall-common.sh"

main() {
  acquire_firewall_lock

  if [[ ! -f "${firewall_backend_path}" ]]; then
    nova_log INFO firewall-down "No active firewall state was found."

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

  nova_log INFO firewall-down \
    "Fail-closed rules were removed after protected services stopped."
}

main "$@"
