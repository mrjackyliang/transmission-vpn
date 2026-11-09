#!/usr/bin/env bash

# Source this file from the E4 multi-vpn integration test after two slot-zero and
# slot-one WireGuard peers are protected at the same time. Both peers must assign the
# same provider address, expose target_address:target_port through their wg0 interface,
# and use peer_container_zero and peer_container_one as their Docker container names.
# The function returns nonzero with a specific diagnostic; it does not build an image,
# create containers, or install an EXIT trap owned by the parent harness.
verify_duplicate_wireguard_provider_addresses() {
  local protected_container_name="${1}"
  local peer_container_zero_name="${2}"
  local peer_container_one_name="${3}"
  local provider_address="${4}"
  local target_address="${5:-1.1.1.1}"
  local target_port="${6:-443}"
  local local_address_zero="198.18.0.1"
  local local_address_one="198.18.1.1"
  local counter_chain="TVPN_DUPLICATE_SOURCE"

  local rule_output
  rule_output="$(docker exec "${protected_container_name}" ip -4 rule show)"
  if [[ "${rule_output}" != *"from ${local_address_zero} lookup 1000"* ]]; then
    printf 'multi-vpn duplicate-address case: slot zero does not route from %s: %s\n' \
      "${local_address_zero}" "${rule_output}" >&2

    return 1
  fi
  if [[ "${rule_output}" != *"from ${local_address_one} lookup 1001"* ]]; then
    printf 'multi-vpn duplicate-address case: slot one does not route from %s: %s\n' \
      "${local_address_one}" "${rule_output}" >&2

    return 1
  fi
  if [[ "${rule_output}" == *"from ${provider_address} lookup 1000"* \
    || "${rule_output}" == *"from ${provider_address} lookup 1001"* ]]; then
    printf 'multi-vpn duplicate-address case: provider address %s still owns a policy rule: %s\n' \
      "${provider_address}" "${rule_output}" >&2

    return 1
  fi

  local route_zero
  route_zero="$(docker exec "${protected_container_name}" \
    ip -4 route get "${target_address}" from "${local_address_zero}")"
  if [[ "${route_zero}" != *' dev wg0 '* ]]; then
    printf 'multi-vpn duplicate-address case: slot zero selected the wrong tunnel: %s\n' \
      "${route_zero}" >&2

    return 1
  fi
  local route_one
  route_one="$(docker exec "${protected_container_name}" \
    ip -4 route get "${target_address}" from "${local_address_one}")"
  if [[ "${route_one}" != *' dev wg1 '* ]]; then
    printf 'multi-vpn duplicate-address case: slot one selected the wrong tunnel: %s\n' \
      "${route_one}" >&2

    return 1
  fi

  local firewall_interfaces
  firewall_interfaces="$(docker exec "${protected_container_name}" \
    cat /run/transmission-vpn/firewall.interfaces)"
  if [[ "${firewall_interfaces}" != *"wg0 ${local_address_zero} ${provider_address}"* \
    || "${firewall_interfaces}" != *"wg1 ${local_address_one} ${provider_address}"* ]]; then
    printf 'multi-vpn duplicate-address case: both same-address firewall projections are not active: %s\n' \
      "${firewall_interfaces}" >&2

    return 1
  fi

  local selected_backend
  selected_backend="$(docker exec "${protected_container_name}" \
    cat /run/transmission-vpn/firewall.backend)"
  local ipv4_command="iptables"
  if [[ "${selected_backend}" == "legacy" ]]; then
    ipv4_command="iptables-legacy"
  fi
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 -t nat \
    -C POSTROUTING -o wg0 -s "${local_address_zero}/32" \
    -j SNAT --to-source "${provider_address}"
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 -t nat \
    -C POSTROUTING -o wg1 -s "${local_address_one}/32" \
    -j SNAT --to-source "${provider_address}"

  local peer_container_name
  for peer_container_name in "${peer_container_zero_name}" "${peer_container_one_name}"; do
    docker exec "${peer_container_name}" iptables -w 5 -N "${counter_chain}"
    docker exec "${peer_container_name}" iptables -w 5 -A "${counter_chain}" \
      -i wg0 -s "${provider_address}/32" -d "${target_address}/32" \
      -p tcp --dport "${target_port}" -j RETURN
    docker exec "${peer_container_name}" iptables -w 5 -I INPUT 1 -j "${counter_chain}"
    docker exec "${peer_container_name}" iptables -w 5 -Z "${counter_chain}"
  done

  local probe_error=""
  if ! docker exec "${protected_container_name}" \
    /command/s6-setuidgid transmission \
    nc -z -w 3 -s "${local_address_zero}" "${target_address}" "${target_port}"; then
    probe_error="slot zero could not reach its WireGuard peer"
  elif ! docker exec "${protected_container_name}" \
    /command/s6-setuidgid transmission \
    nc -z -w 3 -s "${local_address_one}" "${target_address}" "${target_port}"; then
    probe_error="slot one could not reach its WireGuard peer"
  fi

  local zero_packets
  zero_packets="$(docker exec "${peer_container_zero_name}" \
    iptables -w 5 -L "${counter_chain}" -v -x -n \
    | awk '$1 ~ /^[0-9]+$/ { print $1; exit }')"
  local one_packets
  one_packets="$(docker exec "${peer_container_one_name}" \
    iptables -w 5 -L "${counter_chain}" -v -x -n \
    | awk '$1 ~ /^[0-9]+$/ { print $1; exit }')"

  for peer_container_name in "${peer_container_zero_name}" "${peer_container_one_name}"; do
    docker exec "${peer_container_name}" iptables -w 5 -D INPUT -j "${counter_chain}"
    docker exec "${peer_container_name}" iptables -w 5 -F "${counter_chain}"
    docker exec "${peer_container_name}" iptables -w 5 -X "${counter_chain}"
  done

  if [[ -n "${probe_error}" ]]; then
    printf 'multi-vpn duplicate-address case: %s.\n' "${probe_error}" >&2

    return 1
  fi
  if [[ -z "${zero_packets}" || "${zero_packets}" -eq 0 ]]; then
    printf 'multi-vpn duplicate-address case: peer zero did not observe provider source %s.\n' \
      "${provider_address}" >&2

    return 1
  fi
  if [[ -z "${one_packets}" || "${one_packets}" -eq 0 ]]; then
    printf 'multi-vpn duplicate-address case: peer one did not observe provider source %s.\n' \
      "${provider_address}" >&2

    return 1
  fi
}
