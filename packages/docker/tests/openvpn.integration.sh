#!/usr/bin/env bash
set -euo pipefail
set -o errtrace

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly project_directory="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

readonly image_name="transmission-vpn:test"
readonly test_identifier="$$"
readonly network_name="transmission-vpn-ovpn-test-${test_identifier}"
readonly peer_container_name="transmission-vpn-ovpn-peer-${test_identifier}"
readonly protected_container_name="transmission-vpn-ovpn-client-${test_identifier}"
readonly api_url="http://127.0.0.1:22602"

test_state_directory=""
session_cookie=""
csrf_token=""
diagnostics_printed="false"

cleanup() {
  docker rm --force --volumes "${protected_container_name}" > /dev/null 2>&1 || true
  docker rm --force --volumes "${peer_container_name}" > /dev/null 2>&1 || true
  docker network rm "${network_name}" > /dev/null 2>&1 || true

  if [[ -n "${test_state_directory}" ]]; then
    rm -rf "${test_state_directory}"
  fi
}

print_failure_diagnostics() {
  if [[ "${diagnostics_printed}" == "true" ]]; then
    return 0
  fi
  diagnostics_printed="true"

  if ! docker inspect "${protected_container_name}" > /dev/null 2>&1; then
    return 0
  fi

  printf '%s\n' 'openvpn.integration: last 80 container log lines:' >&2
  docker logs "${protected_container_name}" 2>&1 | tail -n 80 >&2 || true
  printf '%s\n' 'openvpn.integration: /run/transmission-vpn/vpn.status:' >&2
  docker exec "${protected_container_name}" \
    cat /run/transmission-vpn/vpn.status >&2 || true
  printf '%s\n' 'openvpn.integration: /run/transmission-vpn/firewall.ready:' >&2
  docker exec "${protected_container_name}" \
    cat /run/transmission-vpn/firewall.ready >&2 || true
}

fail() {
  local message="${1}"

  printf 'openvpn.integration: %s\n' "${message}" >&2
  print_failure_diagnostics

  return 1
}

generate_test_pki() {
  local pki_directory="${test_state_directory}/pki"
  mkdir -p "${pki_directory}"

  docker run --rm \
    --mount "type=bind,source=${pki_directory},target=/pki" \
    --entrypoint bash \
    "${image_name}" \
    -c '
      set -euo pipefail
      openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -subj /CN=transmission-vpn-test-ca \
        -addext "basicConstraints = critical, CA:true" \
        -addext "keyUsage = critical, keyCertSign, cRLSign" \
        -keyout /pki/ca.key -out /pki/ca.crt
      openssl req -nodes -newkey rsa:2048 \
        -subj /CN=openvpn-test-server \
        -keyout /pki/server.key -out /pki/server.csr
      printf "keyUsage = critical, digitalSignature, keyEncipherment\nextendedKeyUsage = serverAuth\nsubjectAltName = DNS:openvpn-test-server\n" > /pki/server.ext
      openssl x509 -req -days 1 -sha256 \
        -in /pki/server.csr -CA /pki/ca.crt -CAkey /pki/ca.key -CAcreateserial \
        -extfile /pki/server.ext -out /pki/server.crt
      openssl req -nodes -newkey rsa:2048 \
        -subj /CN=openvpn-test-client \
        -keyout /pki/client.key -out /pki/client.csr
      printf "keyUsage = critical, digitalSignature\nextendedKeyUsage = clientAuth\n" > /pki/client.ext
      openssl x509 -req -days 1 -sha256 \
        -in /pki/client.csr -CA /pki/ca.crt -CAkey /pki/ca.key -CAserial /pki/ca.srl \
        -extfile /pki/client.ext -out /pki/client.crt
      chmod 0644 /pki/ca.crt /pki/server.crt /pki/server.key /pki/client.crt /pki/client.key
    '
}

write_peer_files() {
  local peer_directory="${test_state_directory}/peer"
  mkdir -p "${peer_directory}"

  cat > "${peer_directory}/server.conf" << 'CONF'
port 1194
proto udp4
dev tun0
topology subnet
server 10.98.0.0 255.255.255.0
ca /run/pki/ca.crt
cert /run/pki/server.crt
key /run/pki/server.key
dh none
tls-version-min 1.2
data-ciphers AES-256-GCM
keepalive 2 10
push "dhcp-option DNS 10.98.0.1"
persist-key
persist-tun
explicit-exit-notify 1
verb 3
CONF

  cat > "${peer_directory}/dns.pl" << 'PERL'
use strict;
use warnings;
use IO::Socket::INET;

my $socket = IO::Socket::INET->new(LocalAddr => '10.98.0.1', LocalPort => 53, Proto => 'udp')
  or die "dns: $!\n";
while (1) {
  my $query = '';
  my $client = $socket->recv($query, 512);
  next unless defined $client && length($query) >= 17;
  my ($identifier) = unpack('n', $query);
  my $offset = 12;
  while ($offset < length($query)) {
    my $length = ord(substr($query, $offset, 1));
    last if $length == 0;
    $offset += $length + 1;
  }
  next if $offset + 5 > length($query);
  my $question = substr($query, 12, $offset + 5 - 12);
  my ($type) = unpack('n', substr($query, $offset + 1, 2));
  my $answers = ($type == 1) ? 1 : 0;
  my $response = pack('nnnnnn', $identifier, 0x8180, 1, $answers, 0, 0) . $question;
  $response .= pack('nnnNn', 0xc00c, 1, 1, 60, 4) . pack('C4', 9, 9, 9, 9) if $answers;
  $socket->send($response, 0, $client);
}
PERL

  cat > "${peer_directory}/tcp.pl" << 'PERL'
use strict;
use warnings;
use IO::Socket::INET;

my $server = IO::Socket::INET->new(LocalPort => $ARGV[0], Listen => 128, ReuseAddr => 1, Proto => 'tcp')
  or die "tcp $ARGV[0]: $!\n";
while (1) {
  my $client = $server->accept or next;
  if (defined $ARGV[1]) {
    open my $marker, '>', $ARGV[1] or die "source marker: $!\n";
    print {$marker} $client->peerhost . "\n";
    close $marker;
  }
  close $client;
}
PERL

  cat > "${peer_directory}/watched.pl" << 'PERL'
use strict;
use warnings;
use IO::Socket::INET;

my $server = IO::Socket::INET->new(LocalPort => 8080, Listen => 128, ReuseAddr => 1, Proto => 'tcp')
  or die "watched: $!\n";
while (1) {
  my $client = $server->accept or next;
  open my $marker, '>', '/tmp/openvpn-eth0-hit' or die "marker: $!\n";
  print {$marker} "hit\n";
  close $marker;
  close $client;
}
PERL

  cat > "${peer_directory}/start.sh" << 'PEER'
#!/bin/bash
set -euo pipefail

openvpn --config /run/peer/server.conf &
openvpn_pid=$!
trap 'kill "${openvpn_pid}" > /dev/null 2>&1 || true' EXIT TERM INT

for attempt in $(seq 1 100); do
  if ip link show tun0 > /dev/null 2>&1; then
    break
  fi
  if ! kill -0 "${openvpn_pid}" > /dev/null 2>&1; then
    wait "${openvpn_pid}"
  fi
  if [[ "${attempt}" -eq 100 ]]; then
    printf 'OpenVPN peer did not create tun0.\n' >&2
    exit 1
  fi
  sleep 0.1
done

ip address add 1.1.1.1/32 dev lo
ip address add 9.9.9.9/32 dev lo
perl /run/peer/tcp.pl 443 /tmp/openvpn-source-443 &
perl /run/peer/watched.pl &
perl /run/peer/dns.pl &

wait "${openvpn_pid}"
PEER
  chmod 0755 "${peer_directory}/start.sh"

  mkdir -p "${test_state_directory}/secrets"
  printf '%s\n' 'integration-claim-secret-123' \
    > "${test_state_directory}/secrets/transmission-vpn-claim"
}

write_client_profile() {
  {
    cat << PROFILE
client
dev tun
proto udp4
remote ${peer_container_name} 1194
verify-x509-name openvpn-test-server name
nobind
persist-key
persist-tun
remote-cert-tls server
ping 2
ping-restart 10
verb 3
<ca>
PROFILE
    cat "${test_state_directory}/pki/ca.crt"
    printf '%s\n' '</ca>' '<cert>'
    cat "${test_state_directory}/pki/client.crt"
    printf '%s\n' '</cert>' '<key>'
    cat "${test_state_directory}/pki/client.key"
    printf '%s\n' '</key>'
  } > "${test_state_directory}/client.ovpn"
}

api_request() {
  local method="${1}"
  local path="${2}"
  local body_path="${3:-}"
  local arguments=(
    -q -O - --content-on-error
    --header "Cookie: tvpn_session=${session_cookie}; tvpn_csrf=${csrf_token}"
    --header "X-CSRF-Token: ${csrf_token}"
  )
  if [[ "${method}" == "POST" ]]; then
    arguments+=(--header 'Content-Type: application/json')
    if [[ -n "${body_path}" ]]; then
      docker exec -i "${protected_container_name}" sh -c 'cat > /tmp/request.json' \
        < "${body_path}"
      arguments+=(--post-file /tmp/request.json)
    else
      arguments+=(--post-data '{}')
    fi
  fi

  docker exec "${protected_container_name}" wget "${arguments[@]}" "${api_url}${path}"
}

wait_for_control_plane() {
  local attempt
  for attempt in $(seq 1 30); do
    if docker exec "${protected_container_name}" \
      wget -q -O /dev/null http://127.0.0.1:22602/api/v1/health/live; then
      return 0
    fi
    if [[ "$(docker inspect --format '{{.State.Running}}' "${protected_container_name}")" != "true" ]]; then
      fail 'The OpenVPN client container exited before its services became ready.'
    fi
    sleep 1
  done

  fail 'The OpenVPN client control plane did not become ready within 30 seconds.'
}

wait_for_services() {
  local attempt
  for attempt in $(seq 1 30); do
    if docker exec "${protected_container_name}" \
      /usr/local/libexec/transmission-vpn/healthcheck.sh > /dev/null 2>&1; then
      return 0
    fi

    sleep 1
  done

  fail 'The OpenVPN client services did not become ready within 30 seconds.'
}

claim_control_api() {
  local headers
  headers="$(docker exec "${protected_container_name}" wget -S \
    -O /tmp/claim-response.json \
    --header 'Content-Type: application/json' \
    --post-data '{"claimCode":"integration-claim-secret-123","username":"administrator","password":"integration test password"}' \
    "${api_url}/api/v1/setup/claim" 2>&1)"
  session_cookie="$(printf '%s\n' "${headers}" \
    | sed -n 's/.*[Ss]et-[Cc]ookie: tvpn_session=\([^;]*\).*/\1/p' \
    | head -n 1)"
  csrf_token="$(printf '%s\n' "${headers}" \
    | sed -n 's/.*[Ss]et-[Cc]ookie: tvpn_csrf=\([^;]*\).*/\1/p' \
    | head -n 1)"
  if [[ -z "${session_cookie}" || -z "${csrf_token}" ]]; then
    fail 'The setup claim did not return authentication cookies.'
  fi
}

upload_and_connect() {
  local profile_json
  profile_json="$(sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' "${test_state_directory}/client.ovpn" \
    | awk '{ printf "%s\\n", $0 }')"
  printf '{"tunnel":"openvpn","profileName":"client.ovpn","profile":"%s"}' \
    "${profile_json}" > "${test_state_directory}/upload.json"

  local upload_response
  upload_response="$(api_request POST /api/v1/vpn/profiles/custom \
    "${test_state_directory}/upload.json")"
  local profile_id
  profile_id="$(printf '%s' "${upload_response}" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
  if [[ "${profile_id}" != custom:* || "${upload_response}" != *'"tunnel":"openvpn"'* ]]; then
    fail "The OpenVPN upload returned an unexpected profile: ${upload_response}"
  fi

  local status_response
  status_response="$(api_request GET /api/v1/vpn/status)"
  local revision
  revision="$(printf '%s' "${status_response}" \
    | sed -n 's/.*"revision":\([0-9][0-9]*\).*/\1/p')"
  if [[ -z "${revision}" ]]; then
    revision=0
  fi
  printf '{"expectedRevision":%s,"providerId":"custom","tunnel":"openvpn","profileIds":["%s"],"endpointStrategy":"sticky","credentials":{"username":"integration","password":"integration"},"dnsServers":[],"retryIntervalSeconds":3}' \
    "${revision}" \
    "${profile_id}" > "${test_state_directory}/connect.json"

  local connect_response
  if ! connect_response="$(api_request POST /api/v1/vpn/connect \
    "${test_state_directory}/connect.json")"; then
    fail "The OpenVPN connection failed: ${connect_response}"
  fi
  if [[ "${connect_response}" != *'"state":"protected"'* ]]; then
    fail "The OpenVPN connection did not become protected: ${connect_response}"
  fi
}

wait_for_state() {
  local wanted_state="${1}"
  local timeout_seconds="${2}"
  local attempt
  for attempt in $(seq 1 "${timeout_seconds}"); do
    if docker exec "${protected_container_name}" grep -Fq \
      "\"state\":\"${wanted_state}\"" /run/transmission-vpn/vpn.status 2> /dev/null; then
      return 0
    fi
    sleep 1
  done

  fail "The OpenVPN connection did not reach ${wanted_state} within ${timeout_seconds} seconds."
}

tunnel_address() {
  docker exec "${protected_container_name}" sed -n \
    's/.*"address":"\([0-9.]*\)".*/\1/p' \
    /run/transmission-vpn/vpn.status
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

transmission_reaches_bound() {
  local source_address="${1}"
  local address="${2}"
  local port="${3}"

  docker exec "${protected_container_name}" \
    /command/s6-setuidgid transmission \
    nc -z -w 3 -s "${source_address}" "${address}" "${port}" > /dev/null 2>&1
}

transmission_reaches_unbound() {
  local address="${1}"
  local port="${2}"

  docker exec "${protected_container_name}" \
    /command/s6-setuidgid transmission \
    nc -z -w 3 "${address}" "${port}" > /dev/null 2>&1
}

verify_protected_path() {
  local local_address="198.18.0.1"
  local address
  address="$(tunnel_address)"
  if [[ -z "${address}" ]]; then
    fail 'The protected OpenVPN status does not contain an address.'
  fi

  local rule
  rule="$(docker exec "${protected_container_name}" ip -4 rule show)"
  if [[ "${rule}" != *"from ${local_address} lookup 1000"* ]]; then
    fail "The OpenVPN source rule is missing for ${local_address}: ${rule}"
  fi
  if [[ "${address}" != "${local_address}" \
    && "${rule}" == *"from ${address} lookup 1000"* ]]; then
    fail "The provider address ${address} still owns slot-zero policy routing: ${rule}"
  fi
  local table_route
  table_route="$(docker exec "${protected_container_name}" \
    ip -4 route show table 1000)"
  if [[ "${table_route}" != *'default dev tun0'* \
    || "${table_route}" != *'unreachable default metric 4294967295'* ]]; then
    fail "The OpenVPN slot table is missing its tunnel default or unreachable fallback: ${table_route}"
  fi
  local route
  route="$(docker exec "${protected_container_name}" \
    ip -4 route get 1.1.1.1 from "${local_address}")"
  if [[ "${route}" != *' dev tun0 '* ]]; then
    fail "Traffic from ${local_address} does not select tun0: ${route}"
  fi
  local main_routes
  main_routes="$(docker exec "${protected_container_name}" ip -4 route show table main)"
  if printf '%s\n' "${main_routes}" | grep -Eq '^0\.0\.0\.0/1([[:space:]]|$)'; then
    fail "OpenVPN changed the main default route: ${main_routes}"
  fi
  local connected_routes
  connected_routes="$(docker exec "${protected_container_name}" \
    ip -4 route show table main dev tun0 proto kernel)"
  if [[ -n "${connected_routes}" ]]; then
    fail "tun0 left a provider connected route in the main table: ${connected_routes}"
  fi

  local resolver_routes
  resolver_routes="$(docker exec "${protected_container_name}" \
    ip -4 route show table main proto 211)"
  if [[ "${resolver_routes}" != *'10.98.0.1'* \
    || "${resolver_routes}" != *'dev tun0'* \
    || "${resolver_routes}" != *"src ${local_address}"* ]]; then
    fail "The OpenVPN resolver pin is not proto 211 through tun0 from ${local_address}: ${resolver_routes}"
  fi
  local firewall_interfaces
  firewall_interfaces="$(docker exec "${protected_container_name}" \
    cat /run/transmission-vpn/firewall.interfaces)"
  if [[ "${firewall_interfaces}" != "tun0 ${local_address} ${address}" ]]; then
    fail "The OpenVPN firewall state is '${firewall_interfaces}', expected 'tun0 ${local_address} ${address}'."
  fi

  local selected_backend
  selected_backend="$(docker exec "${protected_container_name}" \
    cat /run/transmission-vpn/firewall.backend)"
  local ipv4_command="iptables"
  if [[ "${selected_backend}" == "legacy" ]]; then
    ipv4_command="iptables-legacy"
  fi
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 -C OUTPUT \
    -j TVPN_SOURCE_BACKSTOP
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_SOURCE_BACKSTOP -s 198.18.0.0/18 ! -o lo -j DROP
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_SOURCE_BACKSTOP -s "${local_address}/32" -o tun0 -j RETURN
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_SOURCE_BACKSTOP -s "${address}/32" ! -o tun0 -j DROP
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 -t nat \
    -C POSTROUTING -o tun0 -s "${local_address}/32" \
    -j SNAT --to-source "${address}"
  docker exec "${protected_container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_TRANSMISSION -s "${local_address}/32" -o tun0 -j ACCEPT

  local peer_address
  peer_address="$(docker inspect --format \
    '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
    "${peer_container_name}")"
  local runtime_profile
  runtime_profile="$(docker exec "${protected_container_name}" \
    cat /run/transmission-vpn/openvpn/0/active.ovpn)"
  if [[ "${runtime_profile}" != *"remote ${peer_address} 1194"* ]]; then
    fail "The OpenVPN runtime profile did not replace the remote hostname with bootstrap-resolved IPv4 ${peer_address}: ${runtime_profile}"
  fi
  if [[ "${runtime_profile}" != *'verify-x509-name openvpn-test-server name'* ]]; then
    fail "The OpenVPN runtime profile lost verify-x509-name: ${runtime_profile}"
  fi

  local attempt
  local default_connection_id
  default_connection_id="$(docker exec "${protected_container_name}" sed -n \
    's/.*"connectionId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    /run/transmission-vpn/services/transmission.ready)"
  if [[ ! "${default_connection_id}" =~ ^vpc-[0-9a-f]{16}$ ]]; then
    fail "Invalid default Transmission connection identifier: ${default_connection_id}"
  fi
  local transmission_settings_path="/config/transmission/${default_connection_id}/settings.json"
  for attempt in $(seq 1 15); do
    if docker exec "${protected_container_name}" grep -Fq \
      "\"bind-address-ipv4\": \"${local_address}\"" "${transmission_settings_path}"; then
      break
    fi
    if [[ "${attempt}" -eq 15 ]]; then
      fail "Transmission did not bind settings.json to ${local_address} within 15 seconds."
    fi
    sleep 1
  done

  docker exec "${peer_container_name}" rm -f /tmp/openvpn-source-443
  if ! transmission_reaches_bound "${local_address}" 1.1.1.1 443; then
    fail "Transmission could not reach the OpenVPN peer when bound to ${local_address}."
  fi
  local observed_source
  observed_source="$(docker exec "${peer_container_name}" \
    cat /tmp/openvpn-source-443 2> /dev/null || true)"
  if [[ "${observed_source}" != "${address}" ]]; then
    fail "The OpenVPN peer saw ${observed_source:-no source}, expected SNAT provider address ${address}."
  fi
  if transmission_reaches_unbound 1.1.1.1 443; then
    fail 'An unbound Transmission-user connection reached 1.1.1.1.'
  fi
}

verify_peer_drop_and_recovery() {
  local peer_address
  peer_address="$(docker inspect --format \
    '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
    "${peer_container_name}")"
  docker exec "${peer_container_name}" rm -f /tmp/openvpn-eth0-hit
  local provider_address
  provider_address="$(tunnel_address)"
  docker exec "${peer_container_name}" iptables -w 5 -I INPUT 1 \
    -p udp --dport 1194 -j DROP

  local attempt
  for attempt in $(seq 1 5); do
    docker exec "${protected_container_name}" \
      nc -z -w 1 -s 198.18.0.1 "${peer_address}" 8080 > /dev/null 2>&1 || true
    docker exec "${protected_container_name}" \
      nc -z -w 1 -s "${provider_address}" "${peer_address}" 8080 > /dev/null 2>&1 || true
  done

  wait_for_state reconnecting 60
  docker exec "${protected_container_name}" grep -Fq '"state":"blocked"' \
    /run/transmission-vpn/firewall.ready
  if transmission_reaches_unbound "${peer_address}" 8080; then
    fail 'Transmission reached the OpenVPN peer over eth0 while reconnecting.'
  fi
  if docker exec "${peer_container_name}" test -e /tmp/openvpn-eth0-hit; then
    fail 'Traffic sourced from 198.18.0.1 or the OpenVPN provider address left eth0 while the peer tunnel was down.'
  fi

  docker exec "${peer_container_name}" iptables -w 5 -D INPUT \
    -p udp --dport 1194 -j DROP
  wait_for_state protected 60
  if ! transmission_reaches_bound 198.18.0.1 1.1.1.1 443; then
    fail 'Transmission did not recover through tun0 after the peer returned.'
  fi
}

main() {
  trap cleanup EXIT
  trap print_failure_diagnostics ERR

  docker build --tag "${image_name}" "${project_directory}"
  test_state_directory="$(mktemp -d "${project_directory}/.openvpn-integration-state.XXXXXX")"
  generate_test_pki
  write_peer_files
  write_client_profile
  docker network create "${network_name}" > /dev/null

  docker run --detach \
    --name "${peer_container_name}" \
    --network "${network_name}" \
    --cap-add NET_ADMIN \
    --device /dev/net/tun \
    --mount "type=bind,source=${test_state_directory}/peer,target=/run/peer,readonly" \
    --mount "type=bind,source=${test_state_directory}/pki,target=/run/pki,readonly" \
    --entrypoint /run/peer/start.sh \
    "${image_name}" > /dev/null

  docker run --detach \
    --name "${protected_container_name}" \
    --network "${network_name}" \
    --cap-add NET_ADMIN \
    --device /dev/net/tun \
    --env PGID=12345 \
    --env PUID=12345 \
    --env TZ=UTC \
    --mount "type=bind,source=${test_state_directory}/secrets,target=/run/secrets,readonly" \
    "${image_name}" > /dev/null

  wait_for_control_plane
  claim_control_api
  upload_and_connect
  wait_for_services
  verify_slot_routing_foundation
  verify_protected_path
  verify_peer_drop_and_recovery

  printf 'openvpn.integration: OpenVPN policy routing, source binding, fail-closed peer loss, and recovery passed.\n'
}

main "$@"
