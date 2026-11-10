#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly project_directory="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

readonly image_name="transmission-vpn:test"
readonly test_identifier="$$"
readonly network_name="transmission-vpn-test-${test_identifier}"
readonly peer_container_name="transmission-vpn-peer-${test_identifier}"
readonly protected_container_name="transmission-vpn-protected-${test_identifier}"
readonly unprivileged_container_name="transmission-vpn-unprivileged-${test_identifier}"

test_state_directory=""
claim_secret_path=""
seed_database_path=""

cleanup() {
  docker rm --force --volumes "${unprivileged_container_name}" > /dev/null 2>&1 || true
  docker rm --force --volumes "${protected_container_name}" > /dev/null 2>&1 || true
  docker rm --force --volumes "${peer_container_name}" > /dev/null 2>&1 || true
  docker network rm "${network_name}" > /dev/null 2>&1 || true

  if [[ -n "${claim_secret_path}" ]]; then
    rm -f "${claim_secret_path}"
  fi
  if [[ -n "${seed_database_path}" ]]; then
    rm -f "${seed_database_path}"
  fi
  if [[ -n "${test_state_directory}" ]]; then
    rmdir "${test_state_directory}" > /dev/null 2>&1 || true
  fi
}

wait_for_control_plane() {
  local attempt

  for attempt in $(seq 1 30); do
    if docker exec "${protected_container_name}" \
      wget -q -O /dev/null http://127.0.0.1:22602/api/v1/health/live; then
      return 0
    fi

    if [[ "$(docker inspect --format '{{.State.Running}}' "${protected_container_name}")" != "true" ]]; then
      docker logs "${protected_container_name}" >&2
      fail 'The protected container exited before its control plane became ready.'
    fi

    sleep 1
  done

  docker logs "${protected_container_name}" >&2
  fail 'The protected container control plane did not become ready within 30 seconds.'
}

seed_default_connection() {
  if ! command -v sqlite3 > /dev/null; then
    fail 'sqlite3 is required to seed the E3 storage-only VPN connection.'
  fi

  docker stop --time 10 "${protected_container_name}" > /dev/null
  seed_database_path="$(mktemp "${TMPDIR:-/tmp}/transmission-vpn-state.XXXXXX")"
  docker cp \
    "${protected_container_name}:/config/app/state.sqlite3" \
    "${seed_database_path}"
  sqlite3 "${seed_database_path}" <<'SQL'
PRAGMA foreign_keys = ON;
INSERT INTO vpn_connections (
  id,
  slot,
  name,
  is_default,
  enabled,
  provider_id,
  tunnel,
  endpoint_strategy,
  credentials_nonce,
  credentials_ciphertext,
  credentials_legacy_profile_id,
  dns_servers_json,
  retry_interval_seconds,
  peer_port,
  revision,
  created_at,
  updated_at
) VALUES (
  'vpc-0000000000000001',
  0,
  'Integration test',
  1,
  0,
  'custom',
  'wireguard',
  'sticky',
  NULL,
  NULL,
  NULL,
  '[]',
  10,
  51413,
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
SQL
  docker cp \
    "${seed_database_path}" \
    "${protected_container_name}:/config/app/state.sqlite3"
  docker run --rm \
    --volumes-from "${protected_container_name}" \
    --entrypoint /bin/sh \
    "${image_name}" \
    -c 'chown control:control /config/app/state.sqlite3 && chmod 0600 /config/app/state.sqlite3'
  docker start "${protected_container_name}" > /dev/null
}

fail() {
  local message="${1}"

  printf 'fail-closed.integration: %s\n' "${message}" >&2

  return 1
}

wait_for_services() {
  local attempt
  local health_output=""

  for attempt in $(seq 1 30); do
    if health_output="$(docker exec "${protected_container_name}" \
      /usr/local/libexec/transmission-vpn/healthcheck.sh 2>&1)"; then
      return 0
    fi

    if [[ "$(docker inspect --format '{{.State.Running}}' "${protected_container_name}")" != "true" ]]; then
      docker logs "${protected_container_name}" >&2
      fail 'The protected container exited before its services became ready.'
    fi

    sleep 1
  done

  docker logs "${protected_container_name}" >&2
  printf '%s\n' "${health_output}" >&2
  fail 'The protected container did not become ready within 30 seconds.'
}

verify_runtime_identity() {
  local actual_user_id
  actual_user_id="$(docker exec "${protected_container_name}" id -u transmission)"

  local actual_group_id
  actual_group_id="$(docker exec "${protected_container_name}" id -g transmission)"

  if [[ "${actual_user_id}" != "12345" || "${actual_group_id}" != "12345" ]]; then
    fail "Expected Transmission identity 12345:12345, received ${actual_user_id}:${actual_group_id}."
  fi

  local web_proxy_user_id
  web_proxy_user_id="$(docker exec "${protected_container_name}" id -u webproxy)"
  local web_proxy_group_id
  web_proxy_group_id="$(docker exec "${protected_container_name}" id -g webproxy)"
  if [[ "${web_proxy_user_id}" != "65531" || "${web_proxy_group_id}" != "65531" ]]; then
    fail "Expected web proxy identity 65531:65531, received ${web_proxy_user_id}:${web_proxy_group_id}."
  fi

  local pid_one_user_id
  pid_one_user_id="$(docker exec "${protected_container_name}" \
    awk '/^Uid:/ { print $2; exit }' /proc/1/status)"
  if [[ "${pid_one_user_id}" != "0" ]]; then
    fail "s6 PID 1 is running as UID ${pid_one_user_id}, expected root."
  fi

  local control_api_process_id
  control_api_process_id="$(docker exec "${protected_container_name}" \
    pidof transmission-vpn-api)"
  local control_api_user_id
  control_api_user_id="$(docker exec "${protected_container_name}" \
    awk '/^Uid:/ { print $2; exit }' "/proc/${control_api_process_id}/status")"
  local control_api_group_id
  control_api_group_id="$(docker exec "${protected_container_name}" \
    awk '/^Gid:/ { print $2; exit }' "/proc/${control_api_process_id}/status")"
  if [[ "${control_api_user_id}" != "12345" || "${control_api_group_id}" != "65532" ]]; then
    fail "The control API is running as ${control_api_user_id}:${control_api_group_id}, expected 12345:65532."
  fi

  local directory_process_id
  directory_process_id="$(docker exec "${protected_container_name}" \
    pidof transmission-vpn-directory-controller)"
  local directory_user_id
  directory_user_id="$(docker exec "${protected_container_name}" \
    awk '/^Uid:/ { print $2; exit }' "/proc/${directory_process_id}/status")"
  if [[ "${directory_user_id}" != "12345" ]]; then
    fail "The directory controller is running as UID ${directory_user_id}, expected 12345."
  fi

  local runner_process_id
  runner_process_id="$(docker exec "${protected_container_name}" \
    pidof transmission-vpn-transmission-runner)"
  local runner_user_id
  runner_user_id="$(docker exec "${protected_container_name}" \
    awk '/^Uid:/ { print $2; exit }' "/proc/${runner_process_id}/status")"
  if [[ "${runner_user_id}" != "12345" ]]; then
    fail "The Transmission runner is running as UID ${runner_user_id}, expected 12345."
  fi

  local vpn_process_id
  vpn_process_id="$(docker exec "${protected_container_name}" \
    pidof transmission-vpn-vpn-controller)"
  local vpn_user_id
  vpn_user_id="$(docker exec "${protected_container_name}" \
    awk '/^Uid:/ { print $2; exit }' "/proc/${vpn_process_id}/status")"
  if [[ "${vpn_user_id}" != "0" ]]; then
    fail "The VPN controller is running as UID ${vpn_user_id}, expected root."
  fi

  local web_proxy_process_id
  web_proxy_process_id="$(docker exec "${protected_container_name}" \
    pidof transmission-vpn-web-proxy)"
  local web_proxy_process_user_id
  web_proxy_process_user_id="$(docker exec "${protected_container_name}" \
    awk '/^Uid:/ { print $2; exit }' "/proc/${web_proxy_process_id}/status")"
  if [[ "${web_proxy_process_user_id}" != "65531" ]]; then
    fail "The web proxy is running as UID ${web_proxy_process_user_id}, expected 65531."
  fi

  local transmission_config_permissions
  transmission_config_permissions="$(docker exec "${protected_container_name}" \
    stat -c '%a %u %g' /run/transmission-vpn/transmission-config)"
  if [[ "${transmission_config_permissions}" != "2750 12345 12345" ]]; then
    fail "Unexpected Transmission config runtime permissions: ${transmission_config_permissions}"
  fi

  local transmission_state_permissions
  transmission_state_permissions="$(docker exec "${protected_container_name}" \
    stat -c '%a %u %g' /run/transmission-vpn/transmission-state)"
  if [[ "${transmission_state_permissions}" != "2750 12345 65532" ]]; then
    fail "Unexpected Transmission state runtime permissions: ${transmission_state_permissions}"
  fi

  local services_permissions
  services_permissions="$(docker exec "${protected_container_name}" \
    stat -c '%a %u %g' /run/transmission-vpn/services)"
  if [[ "${services_permissions}" != "1777 0 0" ]]; then
    fail "The shared readiness directory must remain root-owned mode 1777, received: ${services_permissions}"
  fi

  local daemon_list_mode
  daemon_list_mode="$(docker exec "${protected_container_name}" \
    stat -c '%a' /run/transmission-vpn/transmission-config/daemons.json)"
  local base_settings_mode
  base_settings_mode="$(docker exec "${protected_container_name}" \
    stat -c '%a' /run/transmission-vpn/transmission-config/settings-base.json)"
  if [[ "${daemon_list_mode}" != "640" || "${base_settings_mode}" != "640" ]]; then
    fail "Unexpected Transmission runtime file modes: daemons=${daemon_list_mode}, settings=${base_settings_mode}"
  fi
}

# Checks one family's egress chain rule by rule, then its rule count, so a missing,
# extra, or reordered drop is caught. NAS kernels such as Synology's have no owner
# match, so no rule in the family may need it either.
verify_egress_chain() {
  local family_command="${1}"
  shift

  local expected_rules=("$@")
  local expected_rule
  local rule_fields=()

  docker exec "${protected_container_name}" "${family_command}" -w 5 -C OUTPUT \
    -j TVPN_EGRESS
  for expected_rule in "${expected_rules[@]}"; do
    read -r -a rule_fields <<< "${expected_rule}"
    if ! docker exec "${protected_container_name}" "${family_command}" -w 5 \
      -C TVPN_EGRESS "${rule_fields[@]}"; then
      fail "${family_command} TVPN_EGRESS is missing: ${expected_rule}"
    fi
  done

  local installed_rules
  installed_rules="$(docker exec "${protected_container_name}" \
    "${family_command}" -w 5 -S TVPN_EGRESS)"
  local installed_rule_count
  installed_rule_count="$(printf '%s\n' "${installed_rules}" | grep -c '^-A ')"
  if [[ "${installed_rule_count}" -ne "${#expected_rules[@]}" ]]; then
    fail "${family_command} TVPN_EGRESS has ${installed_rule_count} rules, expected ${#expected_rules[@]}: ${installed_rules}"
  fi
  if [[ "$(printf '%s\n' "${installed_rules}" | tail -n 1)" != "-A TVPN_EGRESS -j DROP" ]]; then
    fail "${family_command} TVPN_EGRESS does not end by dropping egress: ${installed_rules}"
  fi

  local table_name
  for table_name in filter nat; do
    if docker exec "${protected_container_name}" "${family_command}" -w 5 \
      -t "${table_name}" -S | grep -Fq -- '-m owner'; then
      fail "${family_command} ${table_name} rules use the owner match."
    fi
  done
}

verify_firewall_rules() {
  local selected_backend
  selected_backend="$(docker exec "${protected_container_name}" \
    cat /run/transmission-vpn/firewall.backend)"

  local ipv4_command
  local ipv6_command

  case "${selected_backend}" in
    "legacy")
      ipv4_command="iptables-legacy"
      ipv6_command="ip6tables-legacy"
      ;;

    "nft")
      ipv4_command="iptables"
      ipv6_command="ip6tables"
      ;;

    *)
      fail "Unexpected firewall backend: ${selected_backend}"
      ;;
  esac

  # Each family's egress chain, in order. IPv6 avoids connection tracking, which older
  # NAS kernels such as Synology's 4.4 keep in a separate module that may be missing.
  local ipv4_egress_rules=(
    "-m mark --mark 0xca6c -j ACCEPT"
    "-o lo -p udp -m conntrack --ctstate NEW --ctorigdstport 53 -j DROP"
    "-o lo -p tcp -m conntrack --ctstate NEW --ctorigdstport 53 -j DROP"
    "-o lo -j ACCEPT"
    "-o tun+ -p tcp --sport 22605 -j DROP"
    "-o wg+ -p tcp --sport 22605 -j DROP"
    "-p tcp --sport 22605 -d 10.0.0.0/8 -j ACCEPT"
    "-p tcp --sport 22605 -d 172.16.0.0/12 -j ACCEPT"
    "-p tcp --sport 22605 -d 192.168.0.0/16 -j ACCEPT"
    "-p tcp --sport 22605 -j DROP"
    "-m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT"
    "-j TVPN_TUNNELS"
    "-j DROP"
  )
  local ipv6_egress_rules=(
    "-m mark --mark 0xca6c -j ACCEPT"
    "-p ipv6-icmp --icmpv6-type 133 -j ACCEPT"
    "-p ipv6-icmp --icmpv6-type 135 -j ACCEPT"
    "-p ipv6-icmp --icmpv6-type 136 -j ACCEPT"
    "-p ipv6-icmp --icmpv6-type 143 -j ACCEPT"
    "-o lo -p udp --dport 53 -j DROP"
    "-o lo -p tcp --dport 53 -j DROP"
    "-o lo -j ACCEPT"
    "-o tun+ -p tcp --sport 22605 -j DROP"
    "-o wg+ -p tcp --sport 22605 -j DROP"
    "-p tcp --sport 22605 -d fc00::/7 -j ACCEPT"
    "-p tcp --sport 22605 -d fe80::/10 -j ACCEPT"
    "-p tcp --sport 22605 -j DROP"
    "-p tcp --sport 22602 -j ACCEPT"
    "-p tcp --sport 9091 -j ACCEPT"
    "-j DROP"
  )

  verify_egress_chain "${ipv4_command}" "${ipv4_egress_rules[@]}"
  if docker exec "${protected_container_name}" test -s /proc/net/if_inet6; then
    verify_egress_chain "${ipv6_command}" "${ipv6_egress_rules[@]}"
    if docker exec "${protected_container_name}" "${ipv6_command}" -w 5 \
      -S TVPN_EGRESS | grep -Fq -- '-m conntrack'; then
      fail 'The IPv6 egress chain depends on connection tracking.'
    fi
  fi

  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 -C OUTPUT \
    -j TVPN_SOURCE_BACKSTOP
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_SOURCE_BACKSTOP \
    -s 198.18.0.0/18 -j DROP

  local output_rules
  output_rules="$(docker exec "${protected_container_name}" \
    "${ipv4_command}" -w 5 -S OUTPUT)"
  local backstop_line
  backstop_line="$(printf '%s\n' "${output_rules}" | grep -n -- '-j TVPN_SOURCE_BACKSTOP' | head -n 1 | cut -d: -f1)"
  local egress_line
  egress_line="$(printf '%s\n' "${output_rules}" | grep -n -- '-j TVPN_EGRESS' | head -n 1 | cut -d: -f1)"
  if [[ -z "${backstop_line}" || -z "${egress_line}" \
    || "${backstop_line}" -ge "${egress_line}" ]]; then
    fail "The source backstop is not ahead of the egress chain in OUTPUT: ${output_rules}"
  fi
}

verify_slot_routing_foundation() {
  local slot

  for slot in $(seq 0 63); do
    local local_address="198.18.${slot}.1"
    local table="$((1000 + slot))"
    local local_addresses
    local_addresses="$(docker exec "${protected_container_name}" \
      ip -o -4 address show dev lo to "${local_address}/32")"
    if [[ "${local_addresses}" != *" ${local_address}/32 "* ]]; then
      fail "Slot ${slot} is missing local address ${local_address}/32 on lo: ${local_addresses}"
    fi

    local source_rule
    source_rule="$(docker exec "${protected_container_name}" \
      ip -4 rule show priority "${table}")"
    if [[ "${source_rule}" != *"from ${local_address} lookup ${table}"* ]]; then
      fail "Slot ${slot} is missing priority-${table} source rule for ${local_address}: ${source_rule}"
    fi

    local slot_routes
    slot_routes="$(docker exec "${protected_container_name}" \
      ip -4 route show table "${table}")"
    if [[ "${slot_routes}" != *'unreachable default metric 4294967295'* ]]; then
      fail "Slot ${slot} table ${table} is missing its maximum-metric unreachable default: ${slot_routes}"
    fi
  done
}

verify_transmission_runtime() {
  local pinned_series
  pinned_series="$(sed -n 's/^ARG TRANSMISSION_SERIES="\([^"]*\)"/\1/p' "${project_directory}/Dockerfile")"

  local transmission_version
  transmission_version="$(docker exec "${protected_container_name}" \
    transmission-daemon --version 2>&1)"
  if [[ -z "${pinned_series}" || "${transmission_version}" != *" ${pinned_series}."* ]]; then
    fail "Expected a Transmission ${pinned_series} release, received: ${transmission_version}"
  fi

  local transmission_process_id
  transmission_process_id="$(docker exec "${protected_container_name}" pidof transmission-daemon)"

  if [[ -z "${transmission_process_id}" ]]; then
    fail 'The Transmission daemon process is missing.'
  fi

  local process_user_id
  process_user_id="$(docker exec "${protected_container_name}" \
    awk '/^Uid:/ { print $2; exit }' "/proc/${transmission_process_id}/status")"
  if [[ "${process_user_id}" != "12345" ]]; then
    fail "Transmission is running as UID ${process_user_id}, expected 12345."
  fi

  local default_connection_id
  default_connection_id="$(docker exec "${protected_container_name}" sed -n \
    's/.*"connectionId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    /run/transmission-vpn/services/transmission.ready)"
  if [[ ! "${default_connection_id}" =~ ^vpc-[0-9a-f]{16}$ ]]; then
    fail "Invalid default Transmission connection identifier: ${default_connection_id}"
  fi

  local transmission_settings_path="/config/transmission/${default_connection_id}/settings.json"

  docker exec "${protected_container_name}" grep -Fq \
    '"rpc-bind-address": "127.0.0.1"' \
    "${transmission_settings_path}"
  docker exec "${protected_container_name}" grep -Fq \
    '"rpc-port": 9092' \
    "${transmission_settings_path}"
  docker exec "${protected_container_name}" grep -Fq \
    '"bind-address-ipv4": "198.18.0.1"' \
    "${transmission_settings_path}"
  docker exec "${protected_container_name}" test -f \
    "/run/transmission-vpn/transmission-state/${default_connection_id}.json"
  docker exec "${protected_container_name}" test -d /data/downloads
  docker exec "${protected_container_name}" test -d /data/incomplete

  local protected_address
  protected_address="$(docker inspect --format \
    '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
    "${protected_container_name}")"
  if docker exec "${peer_container_name}" nc -z -w 2 "${protected_address}" 9092; then
    fail 'The native Transmission RPC listener is reachable outside loopback.'
  fi
}

verify_dynamic_firewall_boundary() {
  local selected_backend
  selected_backend="$(docker exec "${protected_container_name}" \
    cat /run/transmission-vpn/firewall.backend)"

  local ipv4_command="iptables"
  local ipv6_command="ip6tables"
  if [[ "${selected_backend}" == "legacy" ]]; then
    ipv4_command="iptables-legacy"
    ipv6_command="ip6tables-legacy"
  fi

  docker exec "${protected_container_name}" ip link add tun63 type dummy
  docker exec "${protected_container_name}" ip link set tun63 up
  docker exec "${protected_container_name}" \
    /usr/local/libexec/transmission-vpn/firewall-protect.sh \
    tun63 198.18.63.1 198.51.100.2
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_TUNNELS -s 198.18.63.1/32 -o tun63 -j ACCEPT
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_SOURCE_BACKSTOP -s 198.18.63.1/32 -o tun63 -j RETURN
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_SOURCE_BACKSTOP -s 198.51.100.2/32 ! -o tun63 -j DROP
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 -t nat \
    -C POSTROUTING -o tun63 -s 198.18.63.1/32 \
    -j SNAT --to-source 198.51.100.2
  if docker exec "${protected_container_name}" test -s /proc/net/if_inet6 \
    && docker exec "${protected_container_name}" "${ipv6_command}" -w 5 \
      -S TVPN_EGRESS | grep -Fq -- '-o tun63'; then
    fail 'The protected tun63 path installed an IPv6 interface allow rule.'
  fi
  local firewall_interfaces
  firewall_interfaces="$(docker exec "${protected_container_name}" \
    cat /run/transmission-vpn/firewall.interfaces)"
  if [[ "${firewall_interfaces}" != "tun63 198.18.63.1 198.51.100.2" ]]; then
    fail "The first protected firewall state is unexpected: ${firewall_interfaces}"
  fi

  docker exec "${protected_container_name}" ip link add wg62 type dummy
  docker exec "${protected_container_name}" ip link set wg62 up
  docker exec "${protected_container_name}" \
    /usr/local/libexec/transmission-vpn/firewall-protect.sh \
    wg62 198.18.62.1 198.51.100.3
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_TUNNELS -s 198.18.62.1/32 -o wg62 -j ACCEPT

  docker exec "${protected_container_name}" \
    /usr/local/libexec/transmission-vpn/firewall-block.sh integration-test tun63
  if docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_TUNNELS -s 198.18.63.1/32 -o tun63 -j ACCEPT > /dev/null 2>&1; then
    fail 'The selected tun63 rule survived its blocked transition.'
  fi
  if docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_SOURCE_BACKSTOP -s 198.18.63.1/32 -o tun63 -j RETURN > /dev/null 2>&1; then
    fail 'The selected tun63 backstop return survived its blocked transition.'
  fi
  if docker exec "${protected_container_name}" "${ipv4_command}" -w 5 -t nat \
    -C POSTROUTING -o tun63 -s 198.18.63.1/32 \
    -j SNAT --to-source 198.51.100.2 > /dev/null 2>&1; then
    fail 'The selected tun63 SNAT rule survived its blocked transition.'
  fi
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_TUNNELS -s 198.18.62.1/32 -o wg62 -j ACCEPT
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 -t nat \
    -C POSTROUTING -o wg62 -s 198.18.62.1/32 \
    -j SNAT --to-source 198.51.100.3
  firewall_interfaces="$(docker exec "${protected_container_name}" \
    cat /run/transmission-vpn/firewall.interfaces)"
  if [[ "${firewall_interfaces}" != "wg62 198.18.62.1 198.51.100.3" ]]; then
    fail "Blocking tun63 changed another protected interface: ${firewall_interfaces}"
  fi
  docker exec "${protected_container_name}" grep -Fq '"state":"protected"' \
    /run/transmission-vpn/firewall.ready

  docker exec "${protected_container_name}" \
    /usr/local/libexec/transmission-vpn/firewall-block.sh integration-test
  if docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_TUNNELS -s 198.18.62.1/32 -o wg62 -j ACCEPT > /dev/null 2>&1; then
    fail 'The all-interface block left the wg62 tunnel rule installed.'
  fi
  if docker exec "${protected_container_name}" "${ipv4_command}" -w 5 -t nat \
    -C POSTROUTING -o wg62 -s 198.18.62.1/32 \
    -j SNAT --to-source 198.51.100.3 > /dev/null 2>&1; then
    fail 'The all-interface block left the wg62 SNAT rule installed.'
  fi
  if docker exec "${protected_container_name}" test -e \
    /run/transmission-vpn/firewall.interfaces; then
    fail 'The all-interface block left firewall.interfaces behind.'
  fi
  docker exec "${protected_container_name}" grep -Fq \
    '"state":"blocked"' \
    /run/transmission-vpn/firewall.ready

  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -I TVPN_TUNNELS 1 -s 198.18.63.1/32 -o tun63 -j ACCEPT
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -I TVPN_SOURCE_BACKSTOP 1 -s 198.18.63.1/32 -o tun63 -j RETURN
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -I TVPN_SOURCE_BACKSTOP 1 -s 198.51.100.2/32 ! -o tun63 -j DROP
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 -t nat \
    -A POSTROUTING -o tun63 -s 198.18.63.1/32 \
    -j SNAT --to-source 198.51.100.2
  docker exec "${protected_container_name}" sh -c \
    "printf '%s\\n' 'tun63 198.51.100.2' > /run/transmission-vpn/firewall.interfaces"
  docker exec "${protected_container_name}" \
    /usr/local/libexec/transmission-vpn/firewall-block.sh startup-pattern-test
  if docker exec "${protected_container_name}" test -e \
    /run/transmission-vpn/firewall.interfaces; then
    fail 'The startup block retained an obsolete two-column firewall state file.'
  fi
  if docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -S TVPN_SOURCE_BACKSTOP | grep -Eq -- '(! -o|-o) tun63'; then
    fail 'The startup block left an unrecorded tun63 backstop rule installed.'
  fi
  if docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -S TVPN_TUNNELS | grep -Fq -- '-o tun63'; then
    fail 'The startup block left an unrecorded tun63 tunnel accept rule installed.'
  fi
  if docker exec "${protected_container_name}" "${ipv4_command}" -w 5 -t nat \
    -S POSTROUTING | grep -Fq -- '-o tun63'; then
    fail 'The startup block left an unrecorded tun63 SNAT rule installed.'
  fi
  docker exec "${protected_container_name}" ip link delete tun63
  docker exec "${protected_container_name}" ip link delete wg62
}

# Synology shared folders ignore group permissions, so only a folder's owner can write.
# Owner-only modes stand in for that host while the claim below writes the console state.
restrict_config_to_owner() {
  docker exec "${protected_container_name}" \
    find /config/app /config/vpn -type d -exec chmod 0700 {} +
  docker exec "${protected_container_name}" \
    find /config/app /config/vpn -type f -exec chmod 0600 {} +

  if ! docker exec "${protected_container_name}" \
    /command/s6-setuidgid control \
    touch /config/app/keys/.owner-only-probe; then
    fail 'The control plane cannot write to its owner-only state folder.'
  fi

  docker exec "${protected_container_name}" rm -f /config/app/keys/.owner-only-probe
}

claim_and_verify_control_api() {
  local claim_response_headers
  claim_response_headers="$(docker exec "${protected_container_name}" wget -S \
    -O /tmp/claim-response.json \
    --header 'Content-Type: application/json' \
    --post-data '{"claimCode":"integration-claim-secret-123","username":"administrator","password":"integration test password"}' \
    http://127.0.0.1:22602/api/v1/setup/claim 2>&1)"

  local session_token
  session_token="$(printf '%s\n' "${claim_response_headers}" \
    | sed -n 's/.*[Ss]et-[Cc]ookie: tvpn_session=\([^;]*\).*/\1/p' \
    | head -n 1)"
  local csrf_token
  csrf_token="$(printf '%s\n' "${claim_response_headers}" \
    | sed -n 's/.*[Ss]et-[Cc]ookie: tvpn_csrf=\([^;]*\).*/\1/p' \
    | head -n 1)"
  if [[ -z "${session_token}" || -z "${csrf_token}" ]]; then
    printf '%s\n' "${claim_response_headers}" >&2
    fail 'The setup claim did not return browser authentication cookies.'
  fi

  local cookie_header="Cookie: tvpn_session=${session_token}; tvpn_csrf=${csrf_token}"
  local torrents_response
  torrents_response="$(docker exec "${protected_container_name}" wget -q -O - \
    --header "${cookie_header}" \
    http://127.0.0.1:22602/api/v1/torrents)"
  if [[ "${torrents_response}" != *'"items":[]'* ]]; then
    fail "The authenticated torrent adapter returned an unexpected response: ${torrents_response}"
  fi

  local previous_process_id
  previous_process_id="$(docker exec "${protected_container_name}" pidof transmission-daemon)"
  local restart_response
  restart_response="$(docker exec "${protected_container_name}" wget -q -O - \
    --header 'Content-Type: application/json' \
    --header "${cookie_header}" \
    --header "X-CSRF-Token: ${csrf_token}" \
    --post-data '{"confirm":true}' \
    http://127.0.0.1:22602/api/v1/transmission/restart)"
  if [[ "${restart_response}" != *'"status":"restarting"'* ]]; then
    fail "The controlled restart returned an unexpected response: ${restart_response}"
  fi

  local attempt
  for attempt in $(seq 1 30); do
    local current_process_id
    current_process_id="$(docker exec "${protected_container_name}" \
      pidof transmission-daemon 2> /dev/null || true)"
    if [[ -n "${current_process_id}" && "${current_process_id}" != "${previous_process_id}" ]]; then
      if docker exec "${protected_container_name}" \
        /usr/local/libexec/transmission-vpn/healthcheck.sh > /dev/null 2>&1; then
        return 0
      fi
    fi

    sleep 1
  done

  docker logs "${protected_container_name}" >&2
  fail 'Transmission did not return healthy after the confirmed restart.'
}

verify_egress_is_fail_closed() {
  local peer_address
  peer_address="$(docker inspect --format \
    '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
    "${peer_container_name}")"

  if [[ -z "${peer_address}" || "${peer_address}" == "invalid IP" ]]; then
    fail 'The test peer does not have a container-network address.'
  fi

  # Nothing in the container opens a connection over its own network unless the VPN
  # controller marks it, root included.
  if docker exec "${protected_container_name}" nc -z -w 2 "${peer_address}" 8080; then
    fail 'An unmarked root process reached the test peer outside the VPN.'
  fi
  if docker exec "${protected_container_name}" \
    timeout 5 \
    getent ahostsv4 "${peer_container_name}" > /dev/null; then
    fail 'An unmarked root process used the container resolver outside the VPN.'
  fi

  # The console reaches the network through the controller's direct socket, so alerts
  # and VPN catalogs still work while every VPN connection is down. The hostname also
  # proves the controller's marked lookups get answers from Docker's resolver.
  if docker exec "${protected_container_name}" \
    /command/s6-setuidgid control \
    nc -z -w 2 "${peer_address}" 8080; then
    fail 'The control plane opened its own connection outside the VPN.'
  fi
  if docker exec "${protected_container_name}" \
    timeout 5 \
    /command/s6-setuidgid control \
    getent ahostsv4 "${peer_container_name}" > /dev/null; then
    fail 'The control plane used the container resolver outside the VPN.'
  fi
  if ! docker exec "${protected_container_name}" \
    /command/s6-setuidgid control \
    /usr/local/bin/transmission-vpn-api -probe-direct-dial "${peer_container_name}:8080"; then
    fail 'The control plane could not reach the test peer through the VPN controller.'
  fi

  # The controller's sockets belong to the console's group. Transmission shares the
  # console's user, but not its group, so it can't ask for a connection.
  if docker exec "${protected_container_name}" \
    /command/s6-setuidgid transmission \
    /usr/local/bin/transmission-vpn-api -probe-direct-dial "${peer_address}:8080" > /dev/null 2>&1; then
    fail 'Transmission opened a connection outside the VPN through the VPN controller.'
  fi
  if docker exec "${protected_container_name}" \
    /command/s6-setuidgid webproxy \
    /usr/local/bin/transmission-vpn-api -probe-direct-dial "${peer_address}:8080" > /dev/null 2>&1; then
    fail 'The web proxy opened a connection outside the VPN through the VPN controller.'
  fi

  if docker exec "${protected_container_name}" \
    /command/s6-setuidgid transmission \
    nc -z -w 2 "${peer_address}" 8080; then
    fail 'Transmission reached a non-tunnel peer while protection was blocked.'
  fi
  if docker exec "${protected_container_name}" \
    /command/s6-setuidgid transmission \
    nc -z -w 2 -s 198.18.0.1 "${peer_address}" 8080; then
    fail 'Slot-local Transmission traffic escaped its unreachable table while protection was blocked.'
  fi

  if docker exec "${protected_container_name}" \
    /command/s6-setuidgid webproxy \
    nc -z -w 2 "${peer_address}" 8080; then
    fail 'The web proxy reached a non-tunnel peer while protection was blocked.'
  fi

  # A slot address may only leave through its own tunnel. The web proxy sends every
  # request from one, so its requests can't reach loopback services.
  if docker exec "${protected_container_name}" \
    /command/s6-setuidgid webproxy \
    nc -z -w 2 -s 198.18.0.1 127.0.0.1 9092; then
    fail 'A slot-addressed web proxy request reached the loopback-only Transmission RPC listener.'
  fi

  if docker exec "${protected_container_name}" \
    timeout 5 \
    /command/s6-setuidgid transmission \
    getent ahostsv4 "${peer_container_name}" > /dev/null; then
    fail 'Transmission reached the container resolver while protection was blocked.'
  fi
}

verify_shutdown_order() {
  docker stop --time 10 "${protected_container_name}" > /dev/null

  local container_logs
  container_logs="$(docker logs "${protected_container_name}")"

  local firewall_line
  firewall_line="$(printf '%s\n' "${container_logs}" \
    | grep -n -F 'firewall-init: Transmission egress is blocked' \
    | cut -d: -f1 \
    | tail -n 1)"

  local transmission_line
  transmission_line="$(printf '%s\n' "${container_logs}" \
    | grep -n -F '"msg":"Transmission daemon is ready"' \
    | cut -d: -f1 \
    | tail -n 1)"

  if [[ "${firewall_line}" -ge "${transmission_line}" ]]; then
    fail 'A protected longrun started before the firewall boundary was ready.'
  fi

  if [[ "${container_logs}" != *"firewall-down: fail-closed rules were removed after protected services stopped."* ]]; then
    fail 'Firewall teardown did not run during reverse-order s6 shutdown.'
  fi
}

verify_firewall_failure_is_fatal() {
  docker run --detach \
    --name "${unprivileged_container_name}" \
    --network "${network_name}" \
    --device /dev/net/tun \
    --env PGID=12346 \
    --env PUID=12346 \
    --env TZ=UTC \
    "${image_name}" > /dev/null

  local attempt

  for attempt in $(seq 1 10); do
    if [[ "$(docker inspect --format '{{.State.Running}}' "${unprivileged_container_name}")" != "true" ]]; then
      break
    fi

    sleep 1
  done

  if [[ "$(docker inspect --format '{{.State.Running}}' "${unprivileged_container_name}")" == "true" ]]; then
    fail 'The container stayed active after firewall setup failed without NET_ADMIN.'
  fi

  local container_logs
  container_logs="$(docker logs "${unprivileged_container_name}")"

  if [[ "${container_logs}" == *'"msg":"Transmission daemon is ready"'* \
    || "${container_logs}" == *'"msg":"VPN state changed"'* ]]; then
    fail 'A protected service started after firewall setup failed.'
  fi
}

main() {
  trap cleanup EXIT

  test_state_directory="$(mktemp -d "${project_directory}/.integration-state.XXXXXX")"
  claim_secret_path="${test_state_directory}/transmission-vpn-claim"
  printf '%s\n' 'integration-claim-secret-123' > "${claim_secret_path}"

  docker build --tag "${image_name}" "${project_directory}"
  docker network create "${network_name}" > /dev/null

  docker run --detach \
    --name "${peer_container_name}" \
    --network "${network_name}" \
    --entrypoint /bin/sh \
    "${image_name}" \
    -c 'exec nc -lk 8080' > /dev/null

  docker run --detach \
    --name "${protected_container_name}" \
    --network "${network_name}" \
    --cap-add NET_ADMIN \
    --device /dev/net/tun \
    --env PGID=12345 \
    --env PUID=12345 \
    --env TZ=UTC \
    --mount "type=bind,source=${test_state_directory},target=/run/secrets,readonly" \
    "${image_name}" > /dev/null

  wait_for_control_plane
  seed_default_connection
  wait_for_services
  verify_runtime_identity
  verify_firewall_rules
  verify_slot_routing_foundation
  verify_transmission_runtime
  verify_dynamic_firewall_boundary
  verify_egress_is_fail_closed
  restrict_config_to_owner
  claim_and_verify_control_api
  verify_shutdown_order
  verify_firewall_failure_is_fatal

  printf 'fail-closed.integration: real Transmission supervision and blocked egress passed.\n'
}

main "$@"
