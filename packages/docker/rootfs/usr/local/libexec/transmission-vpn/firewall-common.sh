#!/usr/bin/env bash
set -euo pipefail

readonly transmission_firewall_chain="TVPN_TRANSMISSION"
readonly web_proxy_firewall_chain="TVPN_WEB_PROXY"
readonly source_backstop_firewall_chain="TVPN_SOURCE_BACKSTOP"
readonly web_proxy_user_id="65531"
readonly web_proxy_port="22605"

# The console also runs as PUID, so it can own its files on hosts that ignore group
# permissions. Its own group keeps its sockets out of Transmission's chain. Neither
# unprivileged service can change its group, so Transmission can't leave the chain.
readonly control_group_id="65532"
readonly firewall_backend_path="/run/transmission-vpn/firewall.backend"
readonly firewall_interfaces_path="/run/transmission-vpn/firewall.interfaces"
readonly firewall_ipv6_path="/run/transmission-vpn/firewall.ipv6"
readonly firewall_lock_path="/run/transmission-vpn/firewall.lock"
readonly firewall_ready_path="/run/transmission-vpn/firewall.ready"
readonly slot_address_network="198.18.0.0/18"

# Kernel WireGuard sends each encrypted packet with the sender's socket still attached,
# so the owner match sees protected traffic again on eth0 after encryption. Only the
# controller's WireGuard link marks packets, and neither unprivileged service can set a
# mark, so marked UDP is already-encrypted tunnel traffic.
readonly wireguard_firewall_mark="0xca6c"

firewall_backend=""
firewall_ipv4_command=""
firewall_ipv6_command=""
firewall_ipv6_enabled=""

acquire_firewall_lock() {
  exec 9> "${firewall_lock_path}"
  flock -x 9
}

write_runtime_state_atomic() {
  local state_path="${1}"
  local state_content="${2}"
  local state_mode="${3:-0644}"

  local temporary_path
  temporary_path="$(mktemp "${state_path}.XXXXXX")"

  printf '%s' "${state_content}" > "${temporary_path}"
  chmod "${state_mode}" "${temporary_path}"
  mv -f "${temporary_path}" "${state_path}"
}

detect_firewall_ipv6() {
  if [[ -s /proc/net/if_inet6 ]]; then
    firewall_ipv6_enabled="1"
  else
    firewall_ipv6_enabled="0"
  fi

  write_runtime_state_atomic "${firewall_ipv6_path}" "${firewall_ipv6_enabled}"$'\n'
}

load_firewall_ipv6() {
  if [[ ! -f "${firewall_ipv6_path}" ]]; then
    printf 'firewall: IPv6 state is missing.\n' >&2

    return 1
  fi

  firewall_ipv6_enabled="$(< "${firewall_ipv6_path}")"
  if [[ "${firewall_ipv6_enabled}" != "0" && "${firewall_ipv6_enabled}" != "1" ]]; then
    printf 'firewall: IPv6 state is invalid.\n' >&2

    return 1
  fi
}

firewall_has_ipv6() {
  [[ "${firewall_ipv6_enabled}" == "1" ]]
}

configure_firewall_backend() {
  local requested_backend="${1}"

  case "${requested_backend}" in
    "legacy")
      firewall_backend="legacy"
      firewall_ipv4_command="iptables-legacy"
      firewall_ipv6_command="ip6tables-legacy"
      ;;

    "nft")
      firewall_backend="nft"
      firewall_ipv4_command="iptables"
      firewall_ipv6_command="ip6tables"
      ;;

    *)
      printf 'firewall: unsupported backend: %s\n' "${requested_backend}" >&2

      return 1
      ;;
  esac
}

firewall_backend_is_available() {
  local requested_backend="${1}"

  configure_firewall_backend "${requested_backend}"

  if ! command -v "${firewall_ipv4_command}" > /dev/null; then
    return 1
  fi

  if ! "${firewall_ipv4_command}" -w 5 -L OUTPUT > /dev/null 2>&1; then
    return 1
  fi

  if firewall_has_ipv6; then
    if ! command -v "${firewall_ipv6_command}" > /dev/null; then
      return 1
    fi

    if ! "${firewall_ipv6_command}" -w 5 -L OUTPUT > /dev/null 2>&1; then
      return 1
    fi
  fi
}

select_firewall_backend() {
  local candidate_backends=(
    "legacy"
    "nft"
  )

  local candidate_backend

  for candidate_backend in "${candidate_backends[@]}"; do
    if firewall_backend_is_available "${candidate_backend}"; then
      printf '%s\n' "${candidate_backend}"

      return 0
    fi
  done

  printf 'firewall: no supported iptables backend is available.\n' >&2

  return 1
}

load_firewall_backend() {
  if [[ ! -f "${firewall_backend_path}" ]]; then
    printf 'firewall: backend state is missing.\n' >&2

    return 1
  fi

  local selected_backend
  selected_backend="$(< "${firewall_backend_path}")"

  configure_firewall_backend "${selected_backend}"
  load_firewall_ipv6
}

remove_firewall_family_rules() {
  local firewall_command="${1}"
  local chain_name="${2}"
  shift 2

  local owner_match=("$@")

  if ! "${firewall_command}" -w 5 -L "${chain_name}" > /dev/null 2>&1; then
    return 0
  fi

  while "${firewall_command}" -w 5 -C OUTPUT \
    "${owner_match[@]}" \
    -j "${chain_name}" > /dev/null 2>&1; do
    "${firewall_command}" -w 5 -D OUTPUT \
      "${owner_match[@]}" \
      -j "${chain_name}"
  done

  "${firewall_command}" -w 5 -F "${chain_name}"
  "${firewall_command}" -w 5 -X "${chain_name}"
}

remove_source_backstop_rules() {
  if ! "${firewall_ipv4_command}" -w 5 -L "${source_backstop_firewall_chain}" > /dev/null 2>&1; then
    return 0
  fi

  while "${firewall_ipv4_command}" -w 5 -C OUTPUT \
    -j "${source_backstop_firewall_chain}" > /dev/null 2>&1; do
    "${firewall_ipv4_command}" -w 5 -D OUTPUT \
      -j "${source_backstop_firewall_chain}"
  done

  "${firewall_ipv4_command}" -w 5 -F "${source_backstop_firewall_chain}"
  "${firewall_ipv4_command}" -w 5 -X "${source_backstop_firewall_chain}"
}

remove_firewall_rules() {
  remove_source_backstop_rules
  remove_firewall_family_rules \
    "${firewall_ipv4_command}" \
    "${transmission_firewall_chain}" \
    -m owner --uid-owner "${PUID}" ! --gid-owner "${control_group_id}"
  remove_firewall_family_rules \
    "${firewall_ipv4_command}" \
    "${web_proxy_firewall_chain}" \
    -m owner --uid-owner "${web_proxy_user_id}"

  if firewall_has_ipv6; then
    remove_firewall_family_rules \
      "${firewall_ipv6_command}" \
      "${transmission_firewall_chain}" \
      -m owner --uid-owner "${PUID}" ! --gid-owner "${control_group_id}"
    remove_firewall_family_rules \
      "${firewall_ipv6_command}" \
      "${web_proxy_firewall_chain}" \
      -m owner --uid-owner "${web_proxy_user_id}"
  fi
}

install_transmission_firewall_family_rules() {
  local firewall_command="${1}"
  local canonical_loopback_address="${2}"
  local chain_name="${3}"
  local user_id="${4}"

  "${firewall_command}" -w 5 -N "${chain_name}"
  "${firewall_command}" -w 5 -A "${chain_name}" \
    -o lo -p udp --dport 53 -j DROP
  "${firewall_command}" -w 5 -A "${chain_name}" \
    -o lo -p tcp --dport 53 -j DROP
  "${firewall_command}" -w 5 -A "${chain_name}" \
    -o lo ! -d "${canonical_loopback_address}" -j DROP
  "${firewall_command}" -w 5 -A "${chain_name}" -o lo -j ACCEPT
  if [[ "${firewall_command}" == "${firewall_ipv4_command}" ]]; then
    "${firewall_command}" -w 5 -A "${chain_name}" \
      -p udp -m mark --mark "${wireguard_firewall_mark}" -j ACCEPT
  fi
  "${firewall_command}" -w 5 -A "${chain_name}" -j DROP
  "${firewall_command}" -w 5 -I OUTPUT 1 \
    -m owner --uid-owner "${user_id}" ! --gid-owner "${control_group_id}" \
    -j "${chain_name}"
}

install_web_proxy_firewall_family_rules() {
  local firewall_command="${1}"
  local chain_name="${2}"
  local user_id="${3}"

  local client_networks=()
  if [[ "${firewall_command}" == "${firewall_ipv4_command}" ]]; then
    client_networks=(
      "10.0.0.0/8"
      "172.16.0.0/12"
      "192.168.0.0/16"
    )
  else
    client_networks=(
      "fc00::/7"
      "fe80::/10"
    )
  fi

  "${firewall_command}" -w 5 -N "${chain_name}"
  "${firewall_command}" -w 5 -A "${chain_name}" -o lo -j DROP
  "${firewall_command}" -w 5 -A "${chain_name}" \
    -o tun+ -p tcp --sport "${web_proxy_port}" -j DROP
  "${firewall_command}" -w 5 -A "${chain_name}" \
    -o wg+ -p tcp --sport "${web_proxy_port}" -j DROP

  local client_network

  for client_network in "${client_networks[@]}"; do
    "${firewall_command}" -w 5 -A "${chain_name}" \
      -p tcp --sport "${web_proxy_port}" -d "${client_network}" -j ACCEPT
  done

  if [[ "${firewall_command}" == "${firewall_ipv4_command}" ]]; then
    "${firewall_command}" -w 5 -A "${chain_name}" \
      -p udp -m mark --mark "${wireguard_firewall_mark}" -j ACCEPT
  fi
  "${firewall_command}" -w 5 -A "${chain_name}" -j DROP
  "${firewall_command}" -w 5 -I OUTPUT 1 \
    -m owner --uid-owner "${user_id}" \
    -j "${chain_name}"
}

install_source_backstop_rules() {
  "${firewall_ipv4_command}" -w 5 -N "${source_backstop_firewall_chain}"
  "${firewall_ipv4_command}" -w 5 -A "${source_backstop_firewall_chain}" \
    -s "${slot_address_network}" ! -o lo -j DROP
  "${firewall_ipv4_command}" -w 5 -I OUTPUT 1 \
    -j "${source_backstop_firewall_chain}"
}

install_firewall_rules() {
  install_transmission_firewall_family_rules \
    "${firewall_ipv4_command}" \
    "127.0.0.1" \
    "${transmission_firewall_chain}" \
    "${PUID}"
  install_web_proxy_firewall_family_rules \
    "${firewall_ipv4_command}" \
    "${web_proxy_firewall_chain}" \
    "${web_proxy_user_id}"
  install_source_backstop_rules

  if firewall_has_ipv6; then
    install_transmission_firewall_family_rules \
      "${firewall_ipv6_command}" \
      "::1" \
      "${transmission_firewall_chain}" \
      "${PUID}"
    install_web_proxy_firewall_family_rules \
      "${firewall_ipv6_command}" \
      "${web_proxy_firewall_chain}" \
      "${web_proxy_user_id}"
  fi
}

verify_transmission_firewall_family_rules() {
  local firewall_command="${1}"
  local canonical_loopback_address="${2}"
  local chain_name="${3}"
  local user_id="${4}"

  "${firewall_command}" -w 5 -C OUTPUT \
    -m owner --uid-owner "${user_id}" ! --gid-owner "${control_group_id}" \
    -j "${chain_name}" > /dev/null
  "${firewall_command}" -w 5 -C "${chain_name}" -o lo -j ACCEPT > /dev/null
  "${firewall_command}" -w 5 -C "${chain_name}" \
    -o lo -p udp --dport 53 -j DROP > /dev/null
  "${firewall_command}" -w 5 -C "${chain_name}" \
    -o lo -p tcp --dport 53 -j DROP > /dev/null
  "${firewall_command}" -w 5 -C "${chain_name}" \
    -o lo ! -d "${canonical_loopback_address}" -j DROP > /dev/null
  if [[ "${firewall_command}" == "${firewall_ipv4_command}" ]]; then
    "${firewall_command}" -w 5 -C "${chain_name}" \
      -p udp -m mark --mark "${wireguard_firewall_mark}" -j ACCEPT > /dev/null
  fi
  "${firewall_command}" -w 5 -C "${chain_name}" -j DROP > /dev/null
}

verify_web_proxy_firewall_family_rules() {
  local firewall_command="${1}"
  local chain_name="${2}"
  local user_id="${3}"

  local client_networks=()
  if [[ "${firewall_command}" == "${firewall_ipv4_command}" ]]; then
    client_networks=(
      "10.0.0.0/8"
      "172.16.0.0/12"
      "192.168.0.0/16"
    )
  else
    client_networks=(
      "fc00::/7"
      "fe80::/10"
    )
  fi

  "${firewall_command}" -w 5 -C OUTPUT \
    -m owner --uid-owner "${user_id}" \
    -j "${chain_name}" > /dev/null
  "${firewall_command}" -w 5 -C "${chain_name}" -o lo -j DROP > /dev/null
  "${firewall_command}" -w 5 -C "${chain_name}" \
    -o tun+ -p tcp --sport "${web_proxy_port}" -j DROP > /dev/null
  "${firewall_command}" -w 5 -C "${chain_name}" \
    -o wg+ -p tcp --sport "${web_proxy_port}" -j DROP > /dev/null

  local client_network

  for client_network in "${client_networks[@]}"; do
    "${firewall_command}" -w 5 -C "${chain_name}" \
      -p tcp --sport "${web_proxy_port}" -d "${client_network}" -j ACCEPT > /dev/null
  done

  if [[ "${firewall_command}" == "${firewall_ipv4_command}" ]]; then
    "${firewall_command}" -w 5 -C "${chain_name}" \
      -p udp -m mark --mark "${wireguard_firewall_mark}" -j ACCEPT > /dev/null
  fi
  "${firewall_command}" -w 5 -C "${chain_name}" -j DROP > /dev/null
}

verify_source_backstop_rules() {
  "${firewall_ipv4_command}" -w 5 -C OUTPUT \
    -j "${source_backstop_firewall_chain}" > /dev/null
  "${firewall_ipv4_command}" -w 5 -C "${source_backstop_firewall_chain}" \
    -s "${slot_address_network}" ! -o lo -j DROP > /dev/null

  local output_rule
  local line_number=0
  local backstop_line=0
  local first_owner_line=0
  while IFS= read -r output_rule; do
    line_number=$((line_number + 1))
    if [[ "${output_rule}" == *"-j ${source_backstop_firewall_chain}"* \
      && "${backstop_line}" -eq 0 ]]; then
      backstop_line="${line_number}"
    fi
    if [[ "${output_rule}" == *'-m owner '* && "${first_owner_line}" -eq 0 ]]; then
      first_owner_line="${line_number}"
    fi
  done < <("${firewall_ipv4_command}" -w 5 -S OUTPUT)
  if [[ "${backstop_line}" -eq 0 || "${first_owner_line}" -eq 0 \
    || "${backstop_line}" -ge "${first_owner_line}" ]]; then
    printf 'firewall: the source backstop is not ahead of the owner chains.\n' >&2

    return 1
  fi
}

verify_firewall_rules() {
  verify_transmission_firewall_family_rules \
    "${firewall_ipv4_command}" \
    "127.0.0.1" \
    "${transmission_firewall_chain}" \
    "${PUID}"
  verify_web_proxy_firewall_family_rules \
    "${firewall_ipv4_command}" \
    "${web_proxy_firewall_chain}" \
    "${web_proxy_user_id}"
  verify_source_backstop_rules

  if firewall_has_ipv6; then
    verify_transmission_firewall_family_rules \
      "${firewall_ipv6_command}" \
      "::1" \
      "${transmission_firewall_chain}" \
      "${PUID}"
    verify_web_proxy_firewall_family_rules \
      "${firewall_ipv6_command}" \
      "${web_proxy_firewall_chain}" \
      "${web_proxy_user_id}"
  fi

  verify_protected_interface_rules
}

valid_protected_interface() {
  local interface_name="${1}"
  if [[ ! "${interface_name}" =~ ^(tun|wg)([0-9]{1,2})$ ]]; then
    return 1
  fi

  (( 10#${BASH_REMATCH[2]} <= 63 ))
}

protected_interface_slot() {
  local interface_name="${1}"

  if ! valid_protected_interface "${interface_name}"; then
    return 1
  fi

  local slot_text="${interface_name//[^0-9]/}"

  printf '%d\n' "$((10#${slot_text}))"
}

valid_protected_address() {
  local address="${1}"
  if [[ ! "${address}" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
    return 1
  fi

  local octets=()
  IFS='.' read -r -a octets <<< "${address}"
  local octet
  for octet in "${octets[@]}"; do
    if (( 10#${octet} > 255 )); then
      return 1
    fi
  done
}

validate_protected_triplet() {
  local interface_name="${1}"
  local local_address="${2}"
  local provider_address="${3}"

  if ! valid_protected_interface "${interface_name}"; then
    printf 'firewall: protected interface name is invalid: %s\n' "${interface_name}" >&2

    return 1
  fi
  if ! valid_protected_address "${local_address}"; then
    printf 'firewall: protected local IPv4 address is invalid: %s\n' "${local_address}" >&2

    return 1
  fi
  if ! valid_protected_address "${provider_address}"; then
    printf 'firewall: protected provider IPv4 address is invalid: %s\n' "${provider_address}" >&2

    return 1
  fi

  local slot
  slot="$(protected_interface_slot "${interface_name}")"
  if [[ "${local_address}" != "198.18.${slot}.1" ]]; then
    printf 'firewall: %s does not own local address %s.\n' \
      "${interface_name}" \
      "${local_address}" >&2

    return 1
  fi
}

remove_owner_accept_rule() {
  local chain_name="${1}"
  local interface_name="${2}"
  local local_address="${3}"

  while "${firewall_ipv4_command}" -w 5 -C "${chain_name}" \
    -s "${local_address}/32" -o "${interface_name}" -j ACCEPT > /dev/null 2>&1; do
    "${firewall_ipv4_command}" -w 5 -D "${chain_name}" \
      -s "${local_address}/32" -o "${interface_name}" -j ACCEPT || return 1
  done
}

remove_backstop_return_rule() {
  local interface_name="${1}"
  local local_address="${2}"

  while "${firewall_ipv4_command}" -w 5 -C "${source_backstop_firewall_chain}" \
    -s "${local_address}/32" -o "${interface_name}" -j RETURN > /dev/null 2>&1; do
    "${firewall_ipv4_command}" -w 5 -D "${source_backstop_firewall_chain}" \
      -s "${local_address}/32" -o "${interface_name}" -j RETURN || return 1
  done
}

remove_provider_drop_rule() {
  local interface_name="${1}"
  local provider_address="${2}"

  while "${firewall_ipv4_command}" -w 5 -C "${source_backstop_firewall_chain}" \
    -s "${provider_address}/32" ! -o "${interface_name}" -j DROP > /dev/null 2>&1; do
    "${firewall_ipv4_command}" -w 5 -D "${source_backstop_firewall_chain}" \
      -s "${provider_address}/32" ! -o "${interface_name}" -j DROP || return 1
  done
}

remove_snat_rule() {
  local interface_name="${1}"
  local local_address="${2}"
  local provider_address="${3}"

  while "${firewall_ipv4_command}" -w 5 -t nat -C POSTROUTING \
    -o "${interface_name}" -s "${local_address}/32" \
    -j SNAT --to-source "${provider_address}" > /dev/null 2>&1; do
    "${firewall_ipv4_command}" -w 5 -t nat -D POSTROUTING \
      -o "${interface_name}" -s "${local_address}/32" \
      -j SNAT --to-source "${provider_address}" || return 1
  done
}

remove_protected_triplet() {
  local interface_name="${1}"
  local local_address="${2}"
  local provider_address="${3}"

  remove_owner_accept_rule \
    "${transmission_firewall_chain}" \
    "${interface_name}" \
    "${local_address}" || return 1
  remove_owner_accept_rule \
    "${web_proxy_firewall_chain}" \
    "${interface_name}" \
    "${local_address}" || return 1
  remove_backstop_return_rule "${interface_name}" "${local_address}" || return 1
  remove_provider_drop_rule "${interface_name}" "${provider_address}" || return 1
  remove_snat_rule \
    "${interface_name}" \
    "${local_address}" \
    "${provider_address}" || return 1
}

install_owner_accept_rule() {
  local chain_name="${1}"
  local interface_name="${2}"
  local local_address="${3}"

  if "${firewall_ipv4_command}" -w 5 -C "${chain_name}" \
    -s "${local_address}/32" -o "${interface_name}" -j ACCEPT > /dev/null 2>&1; then
    return 0
  fi

  "${firewall_ipv4_command}" -w 5 -I "${chain_name}" 1 \
    -s "${local_address}/32" -o "${interface_name}" -j ACCEPT || return 1
  if ! "${firewall_ipv4_command}" -w 5 -C "${chain_name}" \
    -s "${local_address}/32" -o "${interface_name}" -j ACCEPT > /dev/null; then
    remove_owner_accept_rule "${chain_name}" "${interface_name}" "${local_address}"

    return 1
  fi
}

install_backstop_return_rule() {
  local interface_name="${1}"
  local local_address="${2}"

  if ! "${firewall_ipv4_command}" -w 5 -C "${source_backstop_firewall_chain}" \
    -s "${local_address}/32" -o "${interface_name}" -j RETURN > /dev/null 2>&1; then
    "${firewall_ipv4_command}" -w 5 -I "${source_backstop_firewall_chain}" 1 \
      -s "${local_address}/32" -o "${interface_name}" -j RETURN || return 1
  fi
}

install_provider_drop_rule() {
  local interface_name="${1}"
  local provider_address="${2}"

  if ! "${firewall_ipv4_command}" -w 5 -C "${source_backstop_firewall_chain}" \
    -s "${provider_address}/32" ! -o "${interface_name}" -j DROP > /dev/null 2>&1; then
    "${firewall_ipv4_command}" -w 5 -I "${source_backstop_firewall_chain}" 1 \
      -s "${provider_address}/32" ! -o "${interface_name}" -j DROP || return 1
  fi
}

install_snat_rule() {
  local interface_name="${1}"
  local local_address="${2}"
  local provider_address="${3}"

  if ! "${firewall_ipv4_command}" -w 5 -t nat -C POSTROUTING \
    -o "${interface_name}" -s "${local_address}/32" \
    -j SNAT --to-source "${provider_address}" > /dev/null 2>&1; then
    "${firewall_ipv4_command}" -w 5 -t nat -A POSTROUTING \
      -o "${interface_name}" -s "${local_address}/32" \
      -j SNAT --to-source "${provider_address}" || return 1
  fi
}

install_protected_triplet() {
  local interface_name="${1}"
  local local_address="${2}"
  local provider_address="${3}"

  if ! install_snat_rule \
    "${interface_name}" \
    "${local_address}" \
    "${provider_address}"; then
    return 1
  fi
  if ! install_provider_drop_rule "${interface_name}" "${provider_address}"; then
    remove_snat_rule "${interface_name}" "${local_address}" "${provider_address}"
    return 1
  fi
  if ! install_backstop_return_rule "${interface_name}" "${local_address}"; then
    remove_provider_drop_rule "${interface_name}" "${provider_address}"
    remove_snat_rule "${interface_name}" "${local_address}" "${provider_address}"

    return 1
  fi
  if ! install_owner_accept_rule \
    "${transmission_firewall_chain}" \
    "${interface_name}" \
    "${local_address}"; then
    remove_backstop_return_rule "${interface_name}" "${local_address}"
    remove_provider_drop_rule "${interface_name}" "${provider_address}"
    remove_snat_rule "${interface_name}" "${local_address}" "${provider_address}"

    return 1
  fi
  if ! install_owner_accept_rule \
    "${web_proxy_firewall_chain}" \
    "${interface_name}" \
    "${local_address}"; then
    remove_owner_accept_rule \
      "${transmission_firewall_chain}" \
      "${interface_name}" \
      "${local_address}"
    remove_backstop_return_rule "${interface_name}" "${local_address}"
    remove_provider_drop_rule "${interface_name}" "${provider_address}"
    remove_snat_rule "${interface_name}" "${local_address}" "${provider_address}"

    return 1
  fi

  if ! verify_protected_triplet \
    "${interface_name}" \
    "${local_address}" \
    "${provider_address}"; then
    remove_owner_accept_rule \
      "${transmission_firewall_chain}" \
      "${interface_name}" \
      "${local_address}"
    remove_owner_accept_rule \
      "${web_proxy_firewall_chain}" \
      "${interface_name}" \
      "${local_address}"
    remove_backstop_return_rule "${interface_name}" "${local_address}"
    remove_provider_drop_rule "${interface_name}" "${provider_address}"
    remove_snat_rule "${interface_name}" "${local_address}" "${provider_address}"

    return 1
  fi
}

verify_protected_triplet() {
  local interface_name="${1}"
  local local_address="${2}"
  local provider_address="${3}"

  "${firewall_ipv4_command}" -w 5 -C "${transmission_firewall_chain}" \
    -s "${local_address}/32" -o "${interface_name}" -j ACCEPT > /dev/null && \
    "${firewall_ipv4_command}" -w 5 -C "${web_proxy_firewall_chain}" \
      -s "${local_address}/32" -o "${interface_name}" -j ACCEPT > /dev/null && \
    "${firewall_ipv4_command}" -w 5 -C "${source_backstop_firewall_chain}" \
      -s "${local_address}/32" -o "${interface_name}" -j RETURN > /dev/null && \
    "${firewall_ipv4_command}" -w 5 -C "${source_backstop_firewall_chain}" \
      -s "${provider_address}/32" ! -o "${interface_name}" -j DROP > /dev/null && \
    "${firewall_ipv4_command}" -w 5 -t nat -C POSTROUTING \
      -o "${interface_name}" -s "${local_address}/32" \
      -j SNAT --to-source "${provider_address}" > /dev/null
}

replace_protected_interface_rule() {
  local requested_interface="${1}"
  local requested_local_address="${2}"
  local requested_provider_address="${3}"

  validate_protected_triplet \
    "${requested_interface}" \
    "${requested_local_address}" \
    "${requested_provider_address}"

  local temporary_path
  temporary_path="$(mktemp "${firewall_interfaces_path}.XXXXXX")"
  local stored_interface
  local stored_local_address
  local stored_provider_address
  local replaced_local_address=""
  local replaced_provider_address=""
  if [[ -f "${firewall_interfaces_path}" ]]; then
    while read -r stored_interface stored_local_address stored_provider_address; do
      [[ -z "${stored_interface}" ]] && continue
      validate_protected_triplet \
        "${stored_interface}" \
        "${stored_local_address}" \
        "${stored_provider_address}"
      if [[ "${stored_interface}" == "${requested_interface}" ]]; then
        replaced_local_address="${stored_local_address}"
        replaced_provider_address="${stored_provider_address}"
      else
        printf '%s %s %s\n' \
          "${stored_interface}" \
          "${stored_local_address}" \
          "${stored_provider_address}" >> "${temporary_path}"
      fi
    done < "${firewall_interfaces_path}"
  fi

  if [[ -n "${replaced_local_address}" ]] && ! remove_protected_triplet \
    "${requested_interface}" \
    "${replaced_local_address}" \
    "${replaced_provider_address}"; then
    rm -f "${temporary_path}"

    return 1
  fi

  if ! remove_protected_rules_by_pattern "${requested_interface}"; then
    if [[ -n "${replaced_local_address}" ]]; then
      install_protected_triplet \
        "${requested_interface}" \
        "${replaced_local_address}" \
        "${replaced_provider_address}"
    fi
    rm -f "${temporary_path}"

    return 1
  fi

  printf '%s %s %s\n' \
    "${requested_interface}" \
    "${requested_local_address}" \
    "${requested_provider_address}" >> "${temporary_path}"
  chmod 0644 "${temporary_path}"
  if ! install_protected_triplet \
    "${requested_interface}" \
    "${requested_local_address}" \
    "${requested_provider_address}"; then
    if [[ -n "${replaced_local_address}" ]]; then
      install_protected_triplet \
        "${requested_interface}" \
        "${replaced_local_address}" \
        "${replaced_provider_address}"
    fi
    rm -f "${temporary_path}"

    return 1
  fi
  if ! mv -f "${temporary_path}" "${firewall_interfaces_path}"; then
    remove_protected_triplet \
      "${requested_interface}" \
      "${requested_local_address}" \
      "${requested_provider_address}"
    if [[ -n "${replaced_local_address}" ]]; then
      install_protected_triplet \
        "${requested_interface}" \
        "${replaced_local_address}" \
        "${replaced_provider_address}"
    fi
    rm -f "${temporary_path}"

    return 1
  fi
}

remove_chain_rules_by_pattern() {
  local firewall_command="${1}"
  local chain_name="${2}"
  local requested_interface="${3:-}"

  if ! "${firewall_command}" -w 5 -L "${chain_name}" > /dev/null 2>&1; then
    return 0
  fi

  local rule
  local interface_name
  local rule_fields=()
  while IFS= read -r rule; do
    if [[ ! "${rule}" =~ [[:space:]]-o[[:space:]]((tun|wg)[0-9]{1,2})([[:space:]]|$) ]]; then
      continue
    fi
    interface_name="${BASH_REMATCH[1]}"
    if ! valid_protected_interface "${interface_name}"; then
      continue
    fi
    if [[ -n "${requested_interface}" && "${requested_interface}" != "${interface_name}" ]]; then
      continue
    fi
    if [[ "${chain_name}" != "${source_backstop_firewall_chain}" ]] && \
      [[ ! "${rule}" =~ [[:space:]]-j[[:space:]]ACCEPT([[:space:]]|$) ]]; then
      continue
    fi

    read -r -a rule_fields <<< "${rule}"
    rule_fields[0]="-D"
    "${firewall_command}" -w 5 "${rule_fields[@]}"
  done < <("${firewall_command}" -w 5 -S "${chain_name}")
}

remove_snat_rules_by_pattern() {
  local requested_interface="${1:-}"
  local rule
  local interface_name
  local rule_fields=()
  while IFS= read -r rule; do
    if [[ ! "${rule}" =~ [[:space:]]-o[[:space:]]((tun|wg)[0-9]{1,2})([[:space:]]|$) ]]; then
      continue
    fi
    interface_name="${BASH_REMATCH[1]}"
    if ! valid_protected_interface "${interface_name}"; then
      continue
    fi
    if [[ -n "${requested_interface}" && "${requested_interface}" != "${interface_name}" ]]; then
      continue
    fi
    if [[ ! "${rule}" =~ [[:space:]]-s[[:space:]]198\.18\.[0-9]{1,2}\.1/32([[:space:]]|$) ]] || \
      [[ ! "${rule}" =~ [[:space:]]-j[[:space:]]SNAT([[:space:]]|$) ]]; then
      continue
    fi

    read -r -a rule_fields <<< "${rule}"
    rule_fields[0]="-D"
    "${firewall_ipv4_command}" -w 5 -t nat "${rule_fields[@]}"
  done < <("${firewall_ipv4_command}" -w 5 -t nat -S POSTROUTING)
}

remove_protected_rules_by_pattern() {
  local requested_interface="${1:-}"

  remove_chain_rules_by_pattern \
    "${firewall_ipv4_command}" \
    "${transmission_firewall_chain}" \
    "${requested_interface}"
  remove_chain_rules_by_pattern \
    "${firewall_ipv4_command}" \
    "${web_proxy_firewall_chain}" \
    "${requested_interface}"
  remove_chain_rules_by_pattern \
    "${firewall_ipv4_command}" \
    "${source_backstop_firewall_chain}" \
    "${requested_interface}"
  remove_snat_rules_by_pattern "${requested_interface}"
}

remove_protected_interface_rules() {
  local requested_interface="${1:-}"

  if [[ -n "${requested_interface}" ]] && ! valid_protected_interface "${requested_interface}"; then
    printf 'firewall: protected interface name is invalid: %s\n' "${requested_interface}" >&2

    return 1
  fi
  local temporary_path
  temporary_path="$(mktemp "${firewall_interfaces_path}.XXXXXX")"
  local stored_interface
  local stored_local_address
  local stored_provider_address
  if [[ -f "${firewall_interfaces_path}" ]]; then
    while read -r stored_interface stored_local_address stored_provider_address; do
      [[ -z "${stored_interface}" ]] && continue
      if [[ -z "${requested_interface}" || "${stored_interface}" == "${requested_interface}" ]]; then
        if validate_protected_triplet \
          "${stored_interface}" \
          "${stored_local_address}" \
          "${stored_provider_address}"; then
          if ! remove_protected_triplet \
            "${stored_interface}" \
            "${stored_local_address}" \
            "${stored_provider_address}"; then
            install_protected_triplet \
              "${stored_interface}" \
              "${stored_local_address}" \
              "${stored_provider_address}"
            rm -f "${temporary_path}"

            return 1
          fi
        fi
      else
        printf '%s %s %s\n' \
          "${stored_interface}" \
          "${stored_local_address}" \
          "${stored_provider_address}" >> "${temporary_path}"
      fi
    done < "${firewall_interfaces_path}"
  fi

  remove_protected_rules_by_pattern "${requested_interface}"

  if [[ -s "${temporary_path}" ]]; then
    chmod 0644 "${temporary_path}"
    mv -f "${temporary_path}" "${firewall_interfaces_path}"
  else
    rm -f "${temporary_path}" "${firewall_interfaces_path}"
  fi
}

verify_protected_interface_rules() {
  if [[ ! -f "${firewall_interfaces_path}" ]]; then
    return 0
  fi

  local interface_name
  local local_address
  local provider_address
  while read -r interface_name local_address provider_address; do
    [[ -z "${interface_name}" ]] && continue
    validate_protected_triplet \
      "${interface_name}" \
      "${local_address}" \
      "${provider_address}"
    verify_protected_triplet \
      "${interface_name}" \
      "${local_address}" \
      "${provider_address}"
  done < "${firewall_interfaces_path}"
}

publish_firewall_ready() {
  local readiness_reason="${1:-vpn-unavailable}"
  local interfaces_json="["
  local separator=""
  local interface_name
  local local_address
  local provider_address

  if [[ -f "${firewall_interfaces_path}" ]]; then
    while read -r interface_name local_address provider_address; do
      [[ -z "${interface_name}" ]] && continue
      validate_protected_triplet \
        "${interface_name}" \
        "${local_address}" \
        "${provider_address}"
      interfaces_json+="${separator}{\"interface\":\"${interface_name}\",\"address\":\"${local_address}\",\"providerAddress\":\"${provider_address}\"}"
      separator=","
    done < "${firewall_interfaces_path}"
  fi
  interfaces_json+="]"

  local readiness_content
  if [[ "${interfaces_json}" == "[]" ]]; then
    readiness_content="$(printf '{"state":"blocked","reason":"%s","interfaces":[],"backend":"%s","uid":%s}\n' \
      "${readiness_reason}" \
      "${firewall_backend}" \
      "${PUID}")"
  else
    readiness_content="$(printf '{"state":"protected","interfaces":%s,"backend":"%s","uid":%s}\n' \
      "${interfaces_json}" \
      "${firewall_backend}" \
      "${PUID}")"
  fi

  write_runtime_state_atomic "${firewall_ready_path}" "${readiness_content}"$'\n'
}
