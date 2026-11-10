#!/usr/bin/env bash
set -euo pipefail
set -o errtrace

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly project_directory="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# shellcheck source=multi-vpn-duplicate-address.case.sh
source "${SCRIPT_DIR}/multi-vpn-duplicate-address.case.sh"

readonly image_name="transmission-vpn:test"
readonly test_identifier="$$"
readonly network_zero="transmission-vpn-multi-zero-${test_identifier}"
readonly network_one="transmission-vpn-multi-one-${test_identifier}"
readonly peer_zero="transmission-vpn-multi-peer-zero-${test_identifier}"
readonly peer_one="transmission-vpn-multi-peer-one-${test_identifier}"
readonly protected_container="transmission-vpn-multi-${test_identifier}"
readonly api_url="http://127.0.0.1:22602"
readonly default_proxy_username="default-proxy"
readonly connection_proxy_username="connection-two-proxy"

test_state_directory=""
session_cookie=""
csrf_token=""
default_proxy_password=""
connection_proxy_password=""
diagnostics_printed="false"

cleanup() {
  docker rm --force --volumes "${protected_container}" > /dev/null 2>&1 || true
  docker rm --force --volumes "${peer_zero}" > /dev/null 2>&1 || true
  docker rm --force --volumes "${peer_one}" > /dev/null 2>&1 || true
  docker network rm "${network_zero}" > /dev/null 2>&1 || true
  docker network rm "${network_one}" > /dev/null 2>&1 || true

  if [[ -n "${test_state_directory}" ]]; then
    rm -rf "${test_state_directory}"
  fi
}

print_failure_diagnostics() {
  if [[ "${diagnostics_printed}" == "true" ]]; then
    return 0
  fi
  diagnostics_printed="true"

  if ! docker inspect "${protected_container}" > /dev/null 2>&1; then
    return 0
  fi

  printf 'multi-vpn.integration: last 120 protected-container log lines:\n' >&2
  docker logs "${protected_container}" 2>&1 | tail -n 120 >&2 || true
  printf 'multi-vpn.integration: connection status files:\n' >&2
  docker exec "${protected_container}" sh -c \
    'for path in /run/transmission-vpn/vpn.status.d/*.json; do echo "$path"; cat "$path"; done' \
    >&2 || true
  printf 'multi-vpn.integration: daemon list and states:\n' >&2
  docker exec "${protected_container}" sh -c \
    'cat /run/transmission-vpn/transmission-config/daemons.json; for path in /run/transmission-vpn/transmission-state/*.json; do echo "$path"; cat "$path"; done' \
    >&2 || true
  printf 'multi-vpn.integration: published web proxy configuration (hashes redacted):\n' >&2
  docker exec "${protected_container}" sed \
    's/"passwordHash":"[^"]*"/"passwordHash":"[REDACTED]"/g' \
    /run/transmission-vpn/web-proxy/config.json >&2 || true
  printf 'multi-vpn.integration: web proxy status file:\n' >&2
  docker exec "${protected_container}" cat \
    /run/transmission-vpn/web-proxy-state/status.json >&2 || true
  printf 'multi-vpn.integration: last 40 web proxy log lines:\n' >&2
  docker logs "${protected_container}" 2>&1 \
    | grep -Ei 'web proxy|web-proxy' \
    | tail -n 40 >&2 || true
}

fail() {
  local message="${1}"

  printf 'multi-vpn.integration: %s\n' "${message}" >&2
  print_failure_diagnostics

  exit 1
}

write_peer_programs() {
  local shared_directory="${test_state_directory}/peer-shared"
  mkdir -p "${shared_directory}"

  cat > "${shared_directory}/dns.pl" << 'PERL'
use strict;
use warnings;
use IO::Socket::INET;

my ($address, $marker) = @ARGV;
my $socket = IO::Socket::INET->new(LocalAddr => $address, LocalPort => 53, Proto => 'udp')
  or die "dns $address: $!\n";

while (1) {
  my $query = '';
  my $client = $socket->recv($query, 512);
  next unless defined $client && length($query) >= 17;

  open my $seen, '>>', $marker or die "dns marker: $!\n";
  print {$seen} "query\n";
  close $seen;

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
  $response .= pack('nnnNn', 0xc00c, 1, 1, 60, 4) . pack('C4', 1, 1, 1, 1) if $answers;
  $socket->send($response, 0, $client);
}
PERL

  cat > "${shared_directory}/tcp.pl" << 'PERL'
use strict;
use warnings;
use IO::Socket::INET;

my ($port, $marker) = @ARGV;
my $server = IO::Socket::INET->new(LocalPort => $port, Listen => 128, ReuseAddr => 1, Proto => 'tcp')
  or die "tcp $port: $!\n";

while (1) {
  my $client = $server->accept or next;
  if (defined $marker) {
    open my $seen, '>', $marker or die "tcp marker: $!\n";
    print {$seen} $client->peerhost . "\n";
    close $seen;
  }
  close $client;
}
PERL

  cat > "${shared_directory}/start.sh" << 'PEER'
#!/bin/bash
set -euo pipefail

ip link add wg0 type wireguard
peer_allowed_ips="${PEER_CLIENT_ADDRESS}/32"
if [[ -n "${PEER_ADDITIONAL_CLIENT_ADDRESS:-}" ]]; then
  peer_allowed_ips="${peer_allowed_ips},${PEER_ADDITIONAL_CLIENT_ADDRESS}/32"
fi
wg set wg0 \
  private-key /run/peer/server.key \
  listen-port 51820 \
  peer "$(cat /run/peer/client.pub)" allowed-ips "${peer_allowed_ips}"
ip address add "${PEER_DNS_ADDRESS}/24" dev wg0
ip link set wg0 up
ip route replace "${PEER_CLIENT_ADDRESS}/32" dev wg0
if [[ -n "${PEER_ADDITIONAL_CLIENT_ADDRESS:-}" ]]; then
  ip route replace "${PEER_ADDITIONAL_CLIENT_ADDRESS}/32" dev wg0
fi
ip address add 1.1.1.1/32 dev lo

perl /run/shared/tcp.pl 443 /tmp/tunnel-source &
perl /run/shared/tcp.pl 8081 /tmp/eth0-hit &
exec perl /run/shared/dns.pl "${PEER_DNS_ADDRESS}" /tmp/dns-hit
PEER
  chmod 755 "${shared_directory}/start.sh"
}

write_peer_keys_and_profiles() {
  local index
  for index in 0 1; do
    local peer_directory="${test_state_directory}/peer-${index}"
    mkdir -p "${peer_directory}"
    docker run --rm --entrypoint wg "${image_name}" genkey > "${peer_directory}/server.key"
    docker run --rm --entrypoint wg "${image_name}" genkey > "${test_state_directory}/client-${index}.key"
    docker run --rm -i --entrypoint wg "${image_name}" pubkey \
      < "${peer_directory}/server.key" > "${test_state_directory}/server-${index}.pub"
    docker run --rm -i --entrypoint wg "${image_name}" pubkey \
      < "${test_state_directory}/client-${index}.key" > "${peer_directory}/client.pub"
    chmod 644 "${peer_directory}/server.key" "${test_state_directory}/client-${index}.key"
  done

  cat > "${test_state_directory}/connection-0.conf" << CONF
[Interface]
PrivateKey = $(cat "${test_state_directory}/client-0.key")
Address = 10.99.0.2/32
DNS = 10.99.0.1

[Peer]
PublicKey = $(cat "${test_state_directory}/server-0.pub")
Endpoint = ${peer_zero}:51820
AllowedIPs = 0.0.0.0/0
CONF

  cat > "${test_state_directory}/connection-1.conf" << CONF
[Interface]
PrivateKey = $(cat "${test_state_directory}/client-1.key")
Address = 10.99.1.2/32
DNS = 10.99.1.1

[Peer]
PublicKey = $(cat "${test_state_directory}/server-1.pub")
Endpoint = ${peer_one}:51820
AllowedIPs = 0.0.0.0/0
CONF

  cat > "${test_state_directory}/connection-1-duplicate.conf" << CONF
[Interface]
PrivateKey = $(cat "${test_state_directory}/client-1.key")
Address = 10.99.0.2/32
DNS = 10.99.1.1

[Peer]
PublicKey = $(cat "${test_state_directory}/server-1.pub")
Endpoint = ${peer_one}:51820
AllowedIPs = 0.0.0.0/0
CONF
}

start_peers() {
  docker network create "${network_zero}" > /dev/null
  docker network create "${network_one}" > /dev/null

  docker run --detach \
    --name "${peer_zero}" \
    --network "${network_zero}" \
    --cap-add NET_ADMIN \
    --env PEER_CLIENT_ADDRESS=10.99.0.2 \
    --env PEER_DNS_ADDRESS=10.99.0.1 \
    --mount "type=bind,source=${test_state_directory}/peer-0,target=/run/peer,readonly" \
    --mount "type=bind,source=${test_state_directory}/peer-shared,target=/run/shared,readonly" \
    --entrypoint /run/shared/start.sh \
    "${image_name}" > /dev/null

  docker run --detach \
    --name "${peer_one}" \
    --network "${network_one}" \
    --cap-add NET_ADMIN \
    --env PEER_ADDITIONAL_CLIENT_ADDRESS=10.99.0.2 \
    --env PEER_CLIENT_ADDRESS=10.99.1.2 \
    --env PEER_DNS_ADDRESS=10.99.1.1 \
    --mount "type=bind,source=${test_state_directory}/peer-1,target=/run/peer,readonly" \
    --mount "type=bind,source=${test_state_directory}/peer-shared,target=/run/shared,readonly" \
    --entrypoint /run/shared/start.sh \
    "${image_name}" > /dev/null

  local attempt

  for attempt in $(seq 1 20); do
    if docker exec "${peer_zero}" wg show wg0 > /dev/null 2>&1 \
      && docker exec "${peer_one}" wg show wg0 > /dev/null 2>&1; then
      return 0
    fi

    sleep 1
  done

  fail 'Both WireGuard peers did not become ready within 20 seconds.'
}

# The console answers before the VPN controller listens, and every VPN request needs the
# controller, so both must be ready.
wait_for_control_plane() {
  local attempt
  for attempt in $(seq 1 30); do
    if docker exec "${protected_container}" \
      wget -q -O /dev/null "${api_url}/api/v1/health/live" \
      && docker exec "${protected_container}" \
        test -f /run/transmission-vpn/services/vpn-controller.ready; then
      return 0
    fi
    sleep 1
  done

  fail 'The protected container control plane did not become live within 30 seconds.'
}

start_protected_container() {
  mkdir -p "${test_state_directory}/secrets"
  printf '%s\n' 'integration-claim-secret-123' \
    > "${test_state_directory}/secrets/transmission-vpn-claim"

  docker run --detach \
    --name "${protected_container}" \
    --network "${network_zero}" \
    --cap-add NET_ADMIN \
    --device /dev/net/tun \
    --memory 1g \
    --cpus 2 \
    --env PGID=12345 \
    --env PUID=12345 \
    --env TZ=UTC \
    --mount "type=bind,source=${test_state_directory}/secrets,target=/run/secrets,readonly" \
    "${image_name}" > /dev/null
  docker network connect "${network_one}" "${protected_container}"
  wait_for_control_plane
}

claim_control_api() {
  local response_headers
  response_headers="$(docker exec "${protected_container}" wget -S \
    -O /tmp/claim-response.json \
    --header 'Content-Type: application/json' \
    --post-data '{"claimCode":"integration-claim-secret-123","username":"administrator","password":"integration test password"}' \
    "${api_url}/api/v1/setup/claim" 2>&1)"

  session_cookie="$(printf '%s\n' "${response_headers}" \
    | sed -n 's/.*[Ss]et-[Cc]ookie: tvpn_session=\([^;]*\).*/\1/p' \
    | head -n 1)"
  csrf_token="$(printf '%s\n' "${response_headers}" \
    | sed -n 's/.*[Ss]et-[Cc]ookie: tvpn_csrf=\([^;]*\).*/\1/p' \
    | head -n 1)"
  if [[ -z "${session_cookie}" || -z "${csrf_token}" ]]; then
    fail 'The setup claim did not return the session and CSRF cookies.'
  fi
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
      docker exec -i "${protected_container}" sh -c 'cat > /tmp/request.json' < "${body_path}"
      arguments+=(--post-file /tmp/request.json)
    else
      arguments+=(--post-data '{}')
    fi
  elif [[ "${method}" == "PUT" || "${method}" == "DELETE" ]]; then
    arguments+=(--method "${method}")
    if [[ -n "${body_path}" ]]; then
      docker exec -i "${protected_container}" sh -c 'cat > /tmp/request.json' < "${body_path}"
      arguments+=(--header 'Content-Type: application/json' --body-file /tmp/request.json)
    fi
  fi

  docker exec "${protected_container}" wget "${arguments[@]}" "${api_url}${path}"
}

upload_wireguard_profile() {
  local index="${1}"
  local profile_json
  profile_json="$(sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' \
    "${test_state_directory}/connection-${index}.conf" \
    | awk '{ printf "%s\\n", $0 }')"
  printf '{"tunnel":"wireguard","profileName":"connection-%s.conf","profile":"%s"}' \
    "${index}" "${profile_json}" > "${test_state_directory}/upload-${index}.json"

  local response
  if ! response="$(api_request POST /api/v1/vpn/profiles/custom \
    "${test_state_directory}/upload-${index}.json")"; then
    fail "Uploading WireGuard profile ${index} failed: ${response}"
  fi
  local profile_id
  profile_id="$(printf '%s' "${response}" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
  if [[ "${profile_id}" != custom:wg-* ]]; then
    fail "WireGuard profile ${index} returned an unexpected identifier: ${response}"
  fi

  printf '%s' "${profile_id}"
}

create_connection() {
  local name="${1}"
  local profile_id="${2}"
  local index="${3}"
  printf '{"name":"%s","providerId":"custom","tunnel":"wireguard","profileIds":["%s"],"endpointStrategy":"sticky","credentials":{},"dnsServers":[],"retryIntervalSeconds":3}' \
    "${name}" "${profile_id}" > "${test_state_directory}/connection-${index}.json"

  local response
  if ! response="$(api_request POST /api/v1/vpn/connections \
    "${test_state_directory}/connection-${index}.json")"; then
    fail "Creating connection ${name} failed: ${response}"
  fi
  local connection_id
  connection_id="$(printf '%s' "${response}" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
  if [[ "${connection_id}" != vpc-* ]]; then
    fail "Creating connection ${name} returned no connection identifier: ${response}"
  fi

  printf '%s' "${connection_id}"
}

wait_for_connection() {
  local connection_id="${1}"
  local wanted_state="${2}"
  local wanted_port="${3}"
  local timeout_seconds="${4:-45}"
  local attempt
  local response=""

  for attempt in $(seq 1 "${timeout_seconds}"); do
    if response="$(api_request GET "/api/v1/vpn/connections/${connection_id}")"; then
      if [[ "${response}" == *"\"runtime\":{\"state\":\"${wanted_state}\""* \
        && "${response}" == *'"daemon":{"state":"ready"'* \
        && "${response}" == *"\"rpcPort\":${wanted_port}"* ]]; then
        return 0
      fi
    else
      response="request failed during attempt ${attempt}"
    fi
    sleep 1
  done

  fail "Connection ${connection_id} did not reach ${wanted_state} with a ready daemon on ${wanted_port} within ${timeout_seconds} seconds: ${response}"
}

verify_connection_layout() {
  local connection_zero_id="${1}"
  local connection_one_id="${2}"
  local first
  local second
  first="$(api_request GET "/api/v1/vpn/connections/${connection_zero_id}")"
  second="$(api_request GET "/api/v1/vpn/connections/${connection_one_id}")"

  if [[ "${first}" != *'"slot":0'* || "${first}" != *'"interface":"wg0"'* \
    || "${first}" != *'"rpcPort":9092'* \
    || "${first}" != *'"bindAddress":"198.18.0.1"'* \
    || "${first}" != *"\"remoteHost\":\"${peer_zero}\""* \
    || "${first}" != *'"address":"10.99.0.2"'* ]]; then
    fail "Connection one did not use slot 0, wg0, peer zero, provider address 10.99.0.2, RPC port 9092, and bind address 198.18.0.1: ${first}"
  fi
  if [[ "${second}" != *'"slot":1'* || "${second}" != *'"interface":"wg1"'* \
    || "${second}" != *'"rpcPort":9093'* \
    || "${second}" != *'"bindAddress":"198.18.1.1"'* \
    || "${second}" != *"\"remoteHost\":\"${peer_one}\""* \
    || "${second}" != *'"address":"10.99.1.2"'* ]]; then
    fail "Connection two did not use slot 1, wg1, peer one, provider address 10.99.1.2, RPC port 9093, and bind address 198.18.1.1: ${second}"
  fi
  if ! docker exec "${protected_container}" grep -Fq \
    '"dnsServers":["10.99.0.1"]' \
    "/run/transmission-vpn/vpn.status.d/${connection_zero_id}.json"; then
    fail 'Connection one did not publish peer zero as its resolver.'
  fi
  if ! docker exec "${protected_container}" grep -Fq \
    '"dnsServers":["10.99.1.1"]' \
    "/run/transmission-vpn/vpn.status.d/${connection_one_id}.json"; then
    fail 'Connection two did not publish peer one as its resolver.'
  fi

  local daemon_id
  local bind_address
  for daemon_id in "${connection_zero_id}" "${connection_one_id}"; do
    if [[ "${daemon_id}" == "${connection_zero_id}" ]]; then
      bind_address="198.18.0.1"
    else
      bind_address="198.18.1.1"
    fi
    if ! docker exec "${protected_container}" grep -Fq \
      "\"bindAddress\":\"${bind_address}\"" \
      "/run/transmission-vpn/transmission-state/${daemon_id}.json"; then
      fail "Daemon ${daemon_id} state did not report bindAddress ${bind_address}."
    fi
    if ! docker exec "${protected_container}" grep -Fq \
      "\"bind-address-ipv4\": \"${bind_address}\"" \
      "/config/transmission/${daemon_id}/settings.json"; then
      fail "Daemon ${daemon_id} settings.json did not bind to ${bind_address}."
    fi
  done

  if docker exec "${protected_container}" /command/s6-setuidgid transmission \
    nc -z -w 3 1.1.1.1 443; then
    fail 'An unbound Transmission-user socket reached a live tunnel target.'
  fi

  local rules
  rules="$(docker exec "${protected_container}" ip -4 rule show)"
  if [[ "${rules}" != *'from 198.18.0.1 lookup 1000'* \
    || "${rules}" != *'from 198.18.1.1 lookup 1001'* ]]; then
    fail "The two connection policy tables are not active: ${rules}"
  fi
}

verify_isolation() {
  docker exec "${peer_zero}" rm -f /tmp/tunnel-source
  docker exec "${peer_one}" rm -f /tmp/tunnel-source

  if ! docker exec "${protected_container}" /command/s6-setuidgid transmission \
    nc -z -w 3 -s 198.18.0.1 1.1.1.1 443; then
    fail 'Slot 0 could not reach its WireGuard peer from 198.18.0.1.'
  fi
  if [[ "$(docker exec "${peer_zero}" cat /tmp/tunnel-source 2> /dev/null || true)" != '10.99.0.2' ]]; then
    fail 'Peer zero did not see slot 0 after SNAT as 10.99.0.2.'
  fi
  if docker exec "${peer_one}" test -e /tmp/tunnel-source; then
    fail 'Slot 0 traffic reached peer one instead of peer zero.'
  fi

  docker exec "${peer_zero}" rm -f /tmp/tunnel-source
  if ! docker exec "${protected_container}" /command/s6-setuidgid transmission \
    nc -z -w 3 -s 198.18.1.1 1.1.1.1 443; then
    fail 'Slot 1 could not reach its WireGuard peer from 198.18.1.1.'
  fi
  if [[ "$(docker exec "${peer_one}" cat /tmp/tunnel-source 2> /dev/null || true)" != '10.99.1.2' ]]; then
    fail 'Peer one did not see slot 1 after SNAT as 10.99.1.2.'
  fi
  if docker exec "${peer_zero}" test -e /tmp/tunnel-source; then
    fail 'Slot 1 traffic reached peer zero instead of peer one.'
  fi
}

update_connection_wireguard_profile() {
  local connection_id="${1}"
  local profile_id="${2}"
  local rpc_port="${3}"
  local current
  if ! current="$(api_request GET "/api/v1/vpn/connections/${connection_id}")"; then
    fail "Reading connection ${connection_id} before a profile update failed: ${current}"
  fi

  local revision
  revision="$(printf '%s' "${current}" | sed -n 's/.*"revision":\([0-9][0-9]*\).*/\1/p')"
  if [[ -z "${revision}" ]]; then
    fail "Connection ${connection_id} did not report a revision before a profile update: ${current}"
  fi

  printf '{"expectedRevision":%s,"configuration":{"providerId":"custom","tunnel":"wireguard","profileIds":["%s"],"endpointStrategy":"sticky","credentials":{},"dnsServers":[],"retryIntervalSeconds":3}}' \
    "${revision}" "${profile_id}" > "${test_state_directory}/connection-update.json"

  local response
  if ! response="$(api_request PUT "/api/v1/vpn/connections/${connection_id}" \
    "${test_state_directory}/connection-update.json")"; then
    fail "Updating connection ${connection_id} to profile ${profile_id} failed: ${response}"
  fi
  if [[ "${response}" != *"\"profileIds\":[\"${profile_id}\"]"* ]]; then
    fail "Connection ${connection_id} did not retain profile ${profile_id}: ${response}"
  fi

  wait_for_connection "${connection_id}" protected "${rpc_port}" 90
}

verify_duplicate_provider_address_case() {
  local connection_id="${1}"
  local duplicate_profile_id="${2}"
  local distinct_profile_id="${3}"

  update_connection_wireguard_profile "${connection_id}" "${duplicate_profile_id}" 9093

  verify_duplicate_wireguard_provider_addresses \
    "${protected_container}" "${peer_zero}" "${peer_one}" 10.99.0.2 1.1.1.1 443

  update_connection_wireguard_profile "${connection_id}" "${distinct_profile_id}" 9093
}

verify_default_dns() {
  local expected_peer="${1}"
  local unexpected_peer="${2}"
  local expected_server="${3}"

  docker exec "${peer_zero}" rm -f /tmp/dns-hit
  docker exec "${peer_one}" rm -f /tmp/dns-hit
  if ! docker exec "${protected_container}" /command/s6-setuidgid transmission \
    getent ahostsv4 e4-default-dns.test > /dev/null; then
    fail "The transmission user could not resolve through default DNS ${expected_server}."
  fi
  if ! docker exec "${expected_peer}" test -s /tmp/dns-hit; then
    fail "Default DNS ${expected_server} did not receive the transmission user's lookup."
  fi
  if docker exec "${unexpected_peer}" test -e /tmp/dns-hit; then
    fail "The non-default peer received a DNS lookup intended for ${expected_server}."
  fi
}

create_web_proxy_login() {
  local username="${1}"
  local connection_json="${2}"
  printf '{"username":"%s","connectionId":%s}' \
    "${username}" "${connection_json}" \
    > "${test_state_directory}/web-proxy-login.json"

  local response
  if ! response="$(api_request POST /api/v1/web-proxy/logins \
    "${test_state_directory}/web-proxy-login.json")"; then
    fail "Creating web proxy login ${username} failed: ${response}"
  fi
  local login
  if ! login="$(printf '%s' "${response}" | perl -MJSON::PP=decode_json -e '
    my $document = eval { decode_json(do { local $/; <STDIN> }) } or exit 1;
    my $login = $document->{login} // {};
    my $login_id = $login->{id} // "";
    my $password = $document->{password} // "";
    exit 1 unless $login_id =~ /^wpl-/ && $password ne "";
    print $login_id, "\t", $password;
  ')"; then
    fail "The web proxy login response was unexpected: ${response}"
  fi

  printf '%s' "${login}"
}

enable_web_proxy() {
  printf '%s' '{"enabled":true}' > "${test_state_directory}/enable-web-proxy.json"
  local response
  if ! response="$(api_request PUT /api/v1/web-proxy \
    "${test_state_directory}/enable-web-proxy.json")"; then
    fail "Enabling the web proxy failed: ${response}"
  fi

  local attempt
  for attempt in $(seq 1 20); do
    if response="$(api_request GET /api/v1/web-proxy)"; then
      if [[ "${response}" == *'"state":"listening"'* ]]; then
        return 0
      fi
    else
      response="request failed during attempt ${attempt}"
    fi
    sleep 1
  done

  fail "The web proxy did not start listening: ${response}"
}

wait_for_web_proxy_config_route() {
  local username="${1}"
  local connection_id="${2}"
  local attempt
  local configuration=""

  for attempt in $(seq 1 15); do
    if configuration="$(docker exec "${protected_container}" cat \
      /run/transmission-vpn/web-proxy/config.json 2> /dev/null)"; then
      if printf '%s' "${configuration}" | perl -MJSON::PP -e '
        use strict;
        use warnings;
        my ($username, $connection_id) = @ARGV;
        my $document = eval { decode_json(do { local $/; <STDIN> }) } or exit 1;
        my ($login) = grep {
          ($_->{username} // "") eq $username
        } @{$document->{logins} // []};
        exit 1 unless $login;
        exit(($login->{connectionId} // "") eq $connection_id ? 0 : 1);
      ' "${username}" "${connection_id}"; then
        return 0
      fi
    fi

    sleep 1
  done

  fail "The published web proxy configuration did not route ${username} through ${connection_id} within 15 seconds."
}

move_response_has_torrent() {
  local response="${1}"
  local hash="${2}"

  printf '%s' "${response}" | perl -MJSON::PP -e '
    use strict;
    use warnings;
    my $hash = lc shift;
    my $document = eval { decode_json(do { local $/; <STDIN> }) } or exit 1;
    my ($move) = grep {
      lc($_->{hash} // "") eq $hash
    } @{$document->{moved} // []};
    exit 1 unless $move && ($move->{result} // "") eq "moved";
  ' "${hash}"
}

web_proxy_connect() {
  local username="${1}"
  local password="${2}"
  local destination="${3:-1.1.1.1:443}"
  local authorization
  authorization="$(printf '%s:%s' "${username}" "${password}" | base64 | tr -d '\n')"
  printf 'CONNECT %s HTTP/1.1\r\nHost: %s\r\nProxy-Authorization: Basic %s\r\nConnection: close\r\n\r\n' \
    "${destination}" "${destination}" "${authorization}" \
    > "${test_state_directory}/proxy-request.txt"

  docker exec -i "${peer_zero}" nc -w 8 "${protected_container}" 22605 \
    < "${test_state_directory}/proxy-request.txt" 2> /dev/null || true
}

verify_web_proxy_dns_route() {
  local username="${1}"
  local password="${2}"
  local expected_peer="${3}"
  local unexpected_peer="${4}"
  local expected_provider_address="${5}"
  docker exec "${peer_zero}" rm -f /tmp/dns-hit /tmp/tunnel-source
  docker exec "${peer_one}" rm -f /tmp/dns-hit /tmp/tunnel-source

  local response
  response="$(web_proxy_connect "${username}" "${password}" 'e5-proxy.test:443')"
  if [[ "${response}" != *'HTTP/1.1 200 Connection Established'* ]]; then
    fail "Web proxy DNS request for ${username} did not use its answer: ${response}"
  fi
  if ! docker exec "${expected_peer}" test -s /tmp/dns-hit; then
    fail "Web proxy DNS for ${username} did not reach ${expected_peer}."
  fi
  if docker exec "${unexpected_peer}" test -e /tmp/dns-hit; then
    fail "Web proxy DNS for ${username} also reached ${unexpected_peer}."
  fi
  if [[ "$(docker exec "${expected_peer}" cat /tmp/tunnel-source 2> /dev/null || true)" != "${expected_provider_address}" ]]; then
    fail "Web proxy DNS answer for ${username} was not used through ${expected_peer}."
  fi
  if docker exec "${unexpected_peer}" test -e /tmp/tunnel-source; then
    fail "Web proxy DNS request for ${username} also left through ${unexpected_peer}."
  fi
}

verify_web_proxy_route() {
  local username="${1}"
  local password="${2}"
  local expected_peer="${3}"
  local unexpected_peer="${4}"
  local expected_provider_address="${5}"
  local attempt
  local response=""
  local expected_source=""
  local unexpected_source=""
  for attempt in $(seq 1 15); do
    docker exec "${peer_zero}" rm -f /tmp/tunnel-source
    docker exec "${peer_one}" rm -f /tmp/tunnel-source

    response="$(web_proxy_connect "${username}" "${password}")"
    expected_source="$(docker exec "${expected_peer}" \
      cat /tmp/tunnel-source 2> /dev/null || true)"
    unexpected_source="$(docker exec "${unexpected_peer}" \
      cat /tmp/tunnel-source 2> /dev/null || true)"
    if [[ "${response}" == *'HTTP/1.1 200 Connection Established'* \
      && "${expected_source}" == "${expected_provider_address}" \
      && -z "${unexpected_source}" ]]; then
      return 0
    fi

    sleep 1
  done

  if [[ "${response}" != *'HTTP/1.1 200 Connection Established'* ]]; then
    fail "Web proxy login ${username} did not connect through its VPN: ${response}"
  fi
  if [[ "${expected_source}" != "${expected_provider_address}" ]]; then
    fail "Web proxy login ${username} did not leave through ${expected_peer}; observed source ${expected_source:-none}."
  fi
  if [[ -n "${unexpected_source}" ]]; then
    fail "Web proxy login ${username} also reached ${unexpected_peer} from ${unexpected_source}."
  fi
}

verify_web_proxy_routes() {
  verify_web_proxy_route \
    "${default_proxy_username}" "${default_proxy_password}" \
    "${peer_zero}" "${peer_one}" 10.99.0.2
  verify_web_proxy_route \
    "${connection_proxy_username}" "${connection_proxy_password}" \
    "${peer_one}" "${peer_zero}" 10.99.1.2
}

verify_failure_isolation() {
  local connection_zero_id="${1}"
  local connection_one_id="${2}"
  docker exec "${peer_one}" ip link set wg0 down

  local attempt
  local second=""
  local failure_observed="false"
  for attempt in $(seq 1 150); do
    if second="$(api_request GET "/api/v1/vpn/connections/${connection_one_id}")"; then
      if [[ "${second}" != *'"runtime":{"state":"protected"'* ]]; then
        failure_observed="true"
        break
      fi
    else
      second="request failed during attempt ${attempt}"
    fi
    sleep 1
  done
  if [[ "${failure_observed}" != "true" ]]; then
    fail "Connection two did not report a non-protected state within 150 seconds after its peer went down: ${second}"
  fi

  if ! docker exec "${protected_container}" /command/s6-setuidgid transmission \
    nc -z -w 3 -s 198.18.0.1 1.1.1.1 443; then
    fail 'Connection one stopped working when only connection two failed.'
  fi
  local slot_one_routes
  slot_one_routes="$(docker exec "${protected_container}" \
    ip -4 route show table 1001)"
  if [[ "${slot_one_routes}" != *'unreachable default metric 4294967295'* \
    || "${slot_one_routes}" == *'default dev '* ]]; then
    fail "Connection two did not retain its unreachable fail-closed route: ${slot_one_routes}"
  fi
  if docker exec "${protected_container}" /command/s6-setuidgid transmission \
    nc -z -w 3 -s 198.18.1.1 1.1.1.1 443; then
    fail 'Connection two reached its target while its WireGuard peer was down.'
  fi

  local peer_one_address
  peer_one_address="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${peer_one}")"
  local leak_chain="TVPN_MULTI_LEAK_PROBE"
  docker exec "${peer_one}" iptables -w 5 -N "${leak_chain}"
  docker exec "${peer_one}" iptables -w 5 -A "${leak_chain}" \
    ! -i wg0 -s 198.18.0.0/18 -j RETURN
  docker exec "${peer_one}" iptables -w 5 -A "${leak_chain}" \
    ! -i wg0 -s 10.99.1.2/32 -j RETURN
  docker exec "${peer_one}" iptables -w 5 -I INPUT 1 -j "${leak_chain}"
  docker exec "${peer_one}" iptables -w 5 -Z "${leak_chain}"
  docker exec "${protected_container}" /command/s6-setuidgid transmission \
    nc -z -w 3 -s 198.18.1.1 "${peer_one_address}" 8081 > /dev/null 2>&1 || true
  docker exec "${protected_container}" /command/s6-setuidgid transmission \
    nc -z -w 3 -s 10.99.1.2 "${peer_one_address}" 8081 > /dev/null 2>&1 || true
  local leaked_packets
  leaked_packets="$(docker exec "${peer_one}" iptables -w 5 \
    -L "${leak_chain}" -v -x -n \
    | awk '$1 ~ /^[0-9]+$/ { packets += $1 } END { print packets + 0 }')"
  docker exec "${peer_one}" iptables -w 5 -D INPUT -j "${leak_chain}"
  docker exec "${peer_one}" iptables -w 5 -F "${leak_chain}"
  docker exec "${peer_one}" iptables -w 5 -X "${leak_chain}"
  if [[ "${leaked_packets}" -ne 0 ]]; then
    fail "Blocked slot/provider traffic escaped outside wg0 (${leaked_packets} packets observed)."
  fi

  local proxy_response=""
  for attempt in $(seq 1 5); do
    proxy_response="$(web_proxy_connect \
      "${connection_proxy_username}" "${connection_proxy_password}")"
    if [[ "${proxy_response}" == *'HTTP/1.1 503 Service Unavailable'* ]]; then
      break
    fi
    sleep 1
  done
  if [[ "${proxy_response}" != *'HTTP/1.1 503 Service Unavailable'* ]]; then
    fail "The connection-two proxy login did not fail closed with its tunnel down: ${proxy_response}"
  fi
  verify_web_proxy_route \
    "${default_proxy_username}" "${default_proxy_password}" \
    "${peer_zero}" "${peer_one}" 10.99.0.2

  local status
  status="$(api_request GET /api/v1/status)"
  if [[ "${status}" != *'"protectionState":"partial"'* \
    || "${status}" != *'"protectedCount":1,"enabledCount":2'* ]]; then
    fail "The appliance did not report partial protection: ${status}"
  fi
  local first
  first="$(api_request GET "/api/v1/vpn/connections/${connection_zero_id}")"
  if [[ "${first}" != *'"runtime":{"state":"protected"'* ]]; then
    fail "Connection one did not remain protected during connection two's failure: ${first}"
  fi
  local proxy_status
  proxy_status="$(api_request GET /api/v1/web-proxy)"
  if [[ "${proxy_status}" != *'"state":"listening"'* ]]; then
    fail "The proxy did not stay listening for the protected default login: ${proxy_status}"
  fi

  docker exec "${peer_one}" ip link set wg0 up
  wait_for_connection "${connection_one_id}" protected 9093 90
}

switch_default() {
  local connection_id="${1}"
  printf '{"connectionId":"%s"}' "${connection_id}" \
    > "${test_state_directory}/default.json"
  local response
  if ! response="$(api_request PUT /api/v1/vpn/default \
    "${test_state_directory}/default.json")"; then
    fail "Switching the default to ${connection_id} failed: ${response}"
  fi
  if ! printf '%s' "${response}" | perl -MJSON::PP -e '
    use strict;
    use warnings;
    my $connection_id = shift;
    my $document = eval { decode_json(do { local $/; <STDIN> }) } or exit 1;
    my ($connection) = grep {
      ($_->{id} // "") eq $connection_id
    } @{$document->{connections} // []};
    exit 1 unless $connection && $connection->{default};
  ' "${connection_id}"; then
    fail "The default-switch response did not contain the selected connection: ${response}"
  fi

  wait_for_web_proxy_config_route "${default_proxy_username}" "${connection_id}"
}

verify_default_switch() {
  local connection_one_id="${1}"
  switch_default "${connection_one_id}"

  local resolver_routes
  resolver_routes="$(docker exec "${protected_container}" ip -4 route show table main proto 211)"
  if [[ "${resolver_routes}" != *'10.99.1.1'* \
    || "${resolver_routes}" != *'dev wg1'* \
    || "${resolver_routes}" != *'src 198.18.1.1'* \
    || "${resolver_routes}" == *'10.99.0.1'* ]]; then
    fail "The resolver pins did not move exclusively to wg1: ${resolver_routes}"
  fi
  local resolver
  resolver="$(docker exec "${protected_container}" cat /etc/resolv.conf)"
  if [[ "${resolver}" != *'nameserver 10.99.1.1'* \
    || "${resolver}" == *'nameserver 10.99.0.1'* ]]; then
    fail "The resolver file did not move to connection two: ${resolver}"
  fi
  verify_default_dns "${peer_one}" "${peer_zero}" 10.99.1.1
}

create_connection_two_profile() {
  local connection_id="${1}"
  printf '%s' \
    '{"name":"Connection two","downloadDirectory":"/data/connection-two","labels":["connection-two"],"startPaused":true,"options":{"seeding":{"mode":"never"},"downloadLimitKBps":null,"uploadLimitKBps":null,"bandwidthPriority":0,"peerLimit":50,"queue":"normal"},"matchPatterns":["Second*"],"connectionId":"'"${connection_id}"'"}' \
    > "${test_state_directory}/torrent-profile.json"
  local response
  if ! response="$(api_request POST /api/v1/torrent-profiles \
    "${test_state_directory}/torrent-profile.json")"; then
    fail "Creating the connection-two torrent profile failed: ${response}"
  fi
  local profile_id
  profile_id="$(printf '%s' "${response}" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
  if [[ "${profile_id}" != tpr-* ]]; then
    fail "The torrent profile response was unexpected: ${response}"
  fi

  printf '%s' "${profile_id}"
}

build_full_metadata_torrent() {
  perl -MDigest::SHA=sha1,sha1_hex -MMIME::Base64=encode_base64 -e '
    use strict;
    use warnings;
    my $pieces = sha1("ab");
    my $info = "d5:filesl"
      . "d6:lengthi1e4:pathl9:first.binee"
      . "d6:lengthi1e4:pathl10:second.binee"
      . "e4:name7:Full E5"
      . "12:piece lengthi16384e"
      . "6:pieces20:" . $pieces . "e";
    my $torrent = "d8:announce22:http://127.0.0.1:655354:info" . $info . "e";
    open my $metainfo, ">", $ARGV[0] or die "metainfo: $!\n";
    print {$metainfo} encode_base64($torrent, "");
    close $metainfo;
    open my $hash, ">", $ARGV[1] or die "hash: $!\n";
    print {$hash} sha1_hex($info);
    close $hash;
  ' "${test_state_directory}/full-e5.torrent.b64" \
    "${test_state_directory}/full-e5.hash"
}

create_full_metadata_profile() {
  local connection_id="${1}"
  printf '%s' \
    '{"name":"Full metadata move","downloadDirectory":"/data/full-metadata","labels":["profile-full"],"startPaused":false,"options":{"seeding":{"mode":"never"},"downloadLimitKBps":null,"uploadLimitKBps":null,"bandwidthPriority":0,"peerLimit":50,"queue":"normal"},"matchPatterns":["Full E5*"],"connectionId":"'"${connection_id}"'"}' \
    > "${test_state_directory}/full-profile.json"
  local response
  if ! response="$(api_request POST /api/v1/torrent-profiles \
    "${test_state_directory}/full-profile.json")"; then
    fail "Creating the full-metadata torrent profile failed: ${response}"
  fi
  local profile_id
  profile_id="$(printf '%s' "${response}" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
  if [[ "${profile_id}" != tpr-* ]]; then
    fail "The full-metadata torrent profile response was unexpected: ${response}"
  fi

  printf '%s' "${profile_id}"
}

full_metadata_state_valid() {
  local response="${1}"
  local hash="${2}"
  printf '%s' "${response}" | perl -MJSON::PP -e '
    use strict;
    use warnings;
    my $hash = lc shift;
    my $content = do { local $/; <STDIN> };
    my $document = eval { decode_json($content) } or exit 1;
    my @torrents = @{$document->{arguments}->{torrents} // []};
    my ($torrent) = grep { lc($_->{hashString} // "") eq $hash } @torrents;
    exit 1 unless $torrent;
    my %labels = map { $_ => 1 } @{$torrent->{labels} // []};
    exit 1 unless $labels{"full-metadata"} && $labels{"e5"};
    my $files = $torrent->{files} // [];
    my $stats = $torrent->{fileStats} // [];
    exit 1 unless @$files == 2 && @$stats == 2;
    exit 1 unless ($files->[0]->{name} // "") eq "Full E5/renamed.bin";
    exit 1 unless ($files->[1]->{name} // "") eq "Full E5/second.bin";
    exit 1 unless $stats->[0]->{wanted} && ($stats->[0]->{priority} // 0) == 1;
    exit 1 if $stats->[1]->{wanted};
    exit 1 unless ($stats->[1]->{priority} // 0) == 0;
    # recheckProgress is 0 again once a check finishes. The data written before the
    # add proves the target verified after replaying the rename.
    exit 1 unless ($torrent->{recheckProgress} // 0) == 0;
    exit 1 unless ($stats->[0]->{bytesCompleted} // 0) == 1;
    exit 1 unless ($torrent->{status} // 0) == 4 || ($torrent->{status} // 0) == 6;
  ' "${hash}"
}

verify_full_metadata_move() {
  local authorization="${1}"
  local rpc_session_id="${2}"
  local source_connection_id="${3}"
  local target_connection_id="${4}"
  build_full_metadata_torrent
  local hash
  hash="$(cat "${test_state_directory}/full-e5.hash")"
  local metainfo
  metainfo="$(cat "${test_state_directory}/full-e5.torrent.b64")"
  local profile_id
  profile_id="$(create_full_metadata_profile "${source_connection_id}")"

  # The torrent's one piece is "ab". Writing its data lets verification on the target
  # find the renamed file.
  if ! docker exec --user 12345:12345 "${protected_container}" sh -c \
    'mkdir -p "/data/full-metadata/Full E5" && printf a > "/data/full-metadata/Full E5/first.bin" && printf b > "/data/full-metadata/Full E5/second.bin"'; then
    fail "Writing the full-metadata torrent's data failed."
  fi

  printf '{"method":"torrent-add","arguments":{"metainfo":"%s","labels":["full-metadata","e5"],"files-unwanted":[1],"priority-high":[0]},"tag":6}' \
    "${metainfo}" > "${test_state_directory}/add-full.json"
  local added
  if ! added="$(rpc_request "${authorization}" "${rpc_session_id}" \
    "${test_state_directory}/add-full.json")"; then
    fail "The facade request to add the full-metadata torrent failed: ${added}"
  fi
  if [[ "${added}" != *'"result":"success"'* \
    || "${added}" != *'"torrent-added"'* \
    || "${added}" != *"${hash}"* ]]; then
    fail "The facade could not add the full-metadata torrent: ${added}"
  fi

  printf '{"method":"torrent-rename-path","arguments":{"ids":["%s"],"path":"Full E5/first.bin","name":"renamed.bin"},"tag":7}' \
    "${hash}" > "${test_state_directory}/rename-full.json"
  local renamed
  if ! renamed="$(rpc_request "${authorization}" "${rpc_session_id}" \
    "${test_state_directory}/rename-full.json")"; then
    fail "The facade request to rename the full-metadata torrent file failed: ${renamed}"
  fi
  if [[ "${renamed}" != *'"result":"success"'* ]]; then
    fail "The facade could not rename the full-metadata torrent file: ${renamed}"
  fi

  printf '%s' \
    '{"name":"Full metadata move","downloadDirectory":"/data/full-metadata","labels":["profile-full"],"startPaused":false,"options":{"seeding":{"mode":"never"},"downloadLimitKBps":null,"uploadLimitKBps":null,"bandwidthPriority":0,"peerLimit":50,"queue":"normal"},"matchPatterns":["Full E5*"],"connectionId":"'"${target_connection_id}"'","moveTorrents":true}' \
    > "${test_state_directory}/move-full-profile.json"
  local moved
  if ! moved="$(api_request PUT "/api/v1/torrent-profiles/${profile_id}" \
    "${test_state_directory}/move-full-profile.json")"; then
    fail "Moving the full-metadata torrent failed: ${moved}"
  fi
  if ! move_response_has_torrent "${moved}" "${hash}"; then
    fail "The full-metadata torrent returned the wrong move result: ${moved}"
  fi
  wait_for_torrent_location "${hash}" 9092 9093

  printf '%s' \
    '{"method":"torrent-get","arguments":{"fields":["hashString","labels","files","fileStats","status","recheckProgress"]}}' \
    > "${test_state_directory}/full-state.json"
  local attempt
  local state=""
  for attempt in $(seq 1 30); do
    if state="$(daemon_rpc_request 9092 \
      "${test_state_directory}/full-state.json")" \
      && full_metadata_state_valid "${state}" "${hash}"; then
      return 0
    fi

    sleep 1
  done

  fail "The full-metadata torrent did not retain labels, selection, priorities, rename, verification, and started state: ${state}"
}

write_enable_rpc_request() {
  local settings
  settings="$(api_request GET /api/v1/settings)"
  local revision
  revision="$(printf '%s' "${settings}" | sed -n 's/.*"revision":\([0-9][0-9]*\).*/\1/p')"
  if [[ -z "${revision}" ]]; then
    fail "The settings response did not contain a revision: ${settings}"
  fi
  printf '{"expectedRevision":%s,"changes":{"rpc.compatibilityEnabled":true}}' \
    "${revision}" > "${test_state_directory}/enable-rpc.json"
}

create_rpc_login_and_enable_rpc() {
  # The RPC proxy switch does not depend on logins; with none it accepts no sign-ins.
  printf '%s' '{"username":"integration-rpc"}' > "${test_state_directory}/rpc-login.json"
  local login
  if ! login="$(api_request POST /api/v1/rpc/logins \
    "${test_state_directory}/rpc-login.json")"; then
    fail "Creating the compatible RPC login failed: ${login}"
  fi
  local password
  password="$(printf '%s' "${login}" | sed -n 's/.*"password":"\([^"]*\)".*/\1/p')"
  if [[ -z "${password}" ]]; then
    fail "The compatible RPC login did not return its one-time password: ${login}"
  fi

  write_enable_rpc_request
  local updated
  if ! updated="$(api_request PUT /api/v1/settings \
    "${test_state_directory}/enable-rpc.json")"; then
    fail "Enabling compatible RPC failed: ${updated}"
  fi

  printf '%s' "${password}"
}

rpc_handshake() {
  local authorization="${1}"
  printf '%s' '{"method":"session-get","arguments":{},"tag":1}' \
    > "${test_state_directory}/rpc.json"
  docker exec -i "${protected_container}" sh -c 'cat > /tmp/rpc.json' \
    < "${test_state_directory}/rpc.json"
  local headers
  headers="$(docker exec "${protected_container}" wget -S -O /tmp/rpc-response.json \
    --header "Authorization: Basic ${authorization}" \
    --header 'Content-Type: application/json' \
    --post-file /tmp/rpc.json \
    http://127.0.0.1:9091/transmission/rpc 2>&1 || true)"
  local session_id
  session_id="$(printf '%s\n' "${headers}" \
    | sed -n 's/.*[Xx]-[Tt]ransmission-[Ss]ession-[Ii]d: *\([^[:space:]]*\).*/\1/p' \
    | head -n 1)"
  if [[ -z "${session_id}" ]]; then
    fail "The RPC facade did not return its 409 session handshake: ${headers}"
  fi

  printf '%s' "${session_id}"
}

rpc_request() {
  local authorization="${1}"
  local rpc_session_id="${2}"
  local body_path="${3}"
  docker exec -i "${protected_container}" sh -c 'cat > /tmp/rpc.json' < "${body_path}"
  docker exec "${protected_container}" wget -q -O - --content-on-error \
    --header "Authorization: Basic ${authorization}" \
    --header "X-Transmission-Session-Id: ${rpc_session_id}" \
    --header 'Content-Type: application/json' \
    --post-file /tmp/rpc.json \
    http://127.0.0.1:9091/transmission/rpc
}

daemon_rpc_request() {
  local port="${1}"
  local body_path="${2}"
  docker exec -i "${protected_container}" sh -c 'cat > /tmp/daemon-rpc.json' \
    < "${body_path}"
  local headers
  headers="$(docker exec "${protected_container}" wget -S -O /tmp/daemon-rpc-response.json \
    --header 'Content-Type: application/json' \
    --post-file /tmp/daemon-rpc.json \
    "http://127.0.0.1:${port}/transmission/rpc" 2>&1 || true)"
  local session_id
  session_id="$(printf '%s\n' "${headers}" \
    | sed -n 's/.*[Xx]-[Tt]ransmission-[Ss]ession-[Ii]d: *\([^[:space:]]*\).*/\1/p' \
    | head -n 1)"
  if [[ -z "${session_id}" ]]; then
    fail "Transmission daemon ${port} did not return its session handshake: ${headers}"
  fi

  docker exec "${protected_container}" wget -q -O - --content-on-error \
    --header "X-Transmission-Session-Id: ${session_id}" \
    --header 'Content-Type: application/json' \
    --post-file /tmp/daemon-rpc.json \
    "http://127.0.0.1:${port}/transmission/rpc"
}

daemon_has_torrent() {
  local port="${1}"
  local hash="${2}"
  printf '%s' '{"method":"torrent-get","arguments":{"fields":["hashString"]}}' \
    > "${test_state_directory}/daemon-torrents.json"
  local response
  response="$(daemon_rpc_request "${port}" \
    "${test_state_directory}/daemon-torrents.json")"

  [[ "${response}" == *"${hash}"* ]]
}

wait_for_torrent_location() {
  local hash="${1}"
  local expected_port="${2}"
  local unexpected_port="${3}"
  local attempt
  for attempt in $(seq 1 30); do
    if daemon_has_torrent "${expected_port}" "${hash}" \
      && ! daemon_has_torrent "${unexpected_port}" "${hash}"; then
      return 0
    fi
    sleep 1
  done

  fail "Torrent ${hash} did not move exclusively to daemon ${expected_port}."
}

update_profile_connection() {
  local profile_id="${1}"
  local connection_id="${2}"
  printf '%s' \
    '{"name":"Connection two","downloadDirectory":"/data/connection-two","labels":["connection-two"],"startPaused":true,"options":{"seeding":{"mode":"never"},"downloadLimitKBps":null,"uploadLimitKBps":null,"bandwidthPriority":0,"peerLimit":50,"queue":"normal"},"matchPatterns":["Second*"],"connectionId":"'"${connection_id}"'","moveTorrents":true}' \
    > "${test_state_directory}/move-profile.json"
  local response
  if ! response="$(api_request PUT "/api/v1/torrent-profiles/${profile_id}" \
    "${test_state_directory}/move-profile.json")"; then
    fail "Moving profile ${profile_id} to ${connection_id} failed: ${response}"
  fi
  if ! move_response_has_torrent \
    "${response}" '2222222222222222222222222222222222222222'; then
    fail "Moving profile ${profile_id} returned the wrong move results: ${response}"
  fi
}

verify_profile_moves() {
  local profile_id="${1}"
  local connection_zero_id="${2}"
  local connection_one_id="${3}"
  local hash='2222222222222222222222222222222222222222'
  wait_for_torrent_location "${hash}" 9093 9092

  update_profile_connection "${profile_id}" "${connection_zero_id}"
  wait_for_torrent_location "${hash}" 9092 9093

  update_profile_connection "${profile_id}" "${connection_one_id}"
  wait_for_torrent_location "${hash}" 9093 9092
}

verify_rpc_facade() {
  local connection_zero_id="${1}"
  local connection_one_id="${2}"
  local profile_id
  profile_id="$(create_connection_two_profile "${connection_one_id}")"

  switch_default "${connection_zero_id}"
  local password
  password="$(create_rpc_login_and_enable_rpc)"
  local authorization
  authorization="$(printf 'integration-rpc:%s' "${password}" | base64 | tr -d '\n')"
  local rpc_session_id
  rpc_session_id="$(rpc_handshake "${authorization}")"

  printf '%s' '{"method":"torrent-add","arguments":{"filename":"magnet:?xt=urn:btih:1111111111111111111111111111111111111111&dn=First+E5"},"tag":2}' \
    > "${test_state_directory}/add-first.json"
  local first_add
  if ! first_add="$(rpc_request "${authorization}" "${rpc_session_id}" \
    "${test_state_directory}/add-first.json")"; then
    fail "The facade request to add the default connection torrent failed: ${first_add}"
  fi
  if [[ "${first_add}" != *'"result":"success"'* \
    || "${first_add}" != *'"torrent-added"'* ]]; then
    fail "The facade could not add the default connection torrent: ${first_add}"
  fi

  printf '%s' '{"method":"torrent-add","arguments":{"filename":"magnet:?xt=urn:btih:2222222222222222222222222222222222222222&dn=Second+E5"},"tag":3}' \
    > "${test_state_directory}/add-second.json"
  local second_add
  if ! second_add="$(rpc_request "${authorization}" "${rpc_session_id}" \
    "${test_state_directory}/add-second.json")"; then
    fail "The facade request to add the profile-routed torrent failed: ${second_add}"
  fi
  if [[ "${second_add}" != *'"result":"success"'* \
    || "${second_add}" != *'"torrent-added"'* ]]; then
    fail "The facade could not add the profile-routed connection-two torrent: ${second_add}"
  fi

  printf '%s' '{"method":"torrent-get","arguments":{"fields":["id","name","hashString"]},"tag":4}' \
    > "${test_state_directory}/get-torrents.json"
  local torrents
  if ! torrents="$(rpc_request "${authorization}" "${rpc_session_id}" \
    "${test_state_directory}/get-torrents.json")"; then
    fail "The facade torrent-get request failed: ${torrents}"
  fi
  if [[ "${torrents}" != *'"result":"success"'* \
    || "${torrents}" != *'1111111111111111111111111111111111111111'* \
    || "${torrents}" != *'2222222222222222222222222222222222222222'* ]]; then
    fail "The facade torrent-get did not merge both daemons: ${torrents}"
  fi
  local facade_ids
  if ! facade_ids="$(printf '%s' "${torrents}" \
    | grep -o '"id":[0-9][0-9]*' \
    | cut -d: -f2)"; then
    fail "The facade returned no numeric torrent IDs: ${torrents}"
  fi
  local facade_id_count
  facade_id_count="$(printf '%s\n' "${facade_ids}" | sed '/^$/d' | sort -u | wc -l | tr -d ' ')"
  if [[ "${facade_id_count}" -ne 2 ]] \
    || ! printf '%s\n' "${facade_ids}" | awk '$1 < 16777216 { found = 1 } END { exit !found }' \
    || ! printf '%s\n' "${facade_ids}" | awk '$1 >= 16777216 { found = 1 } END { exit !found }'; then
    fail "The facade did not return distinct slot-0 and slot-1 IDs: ${torrents}"
  fi

  printf '%s' '{"method":"session-close","arguments":{},"tag":5}' \
    > "${test_state_directory}/session-close.json"
  local refused
  if ! refused="$(rpc_request "${authorization}" "${rpc_session_id}" \
    "${test_state_directory}/session-close.json")"; then
    fail "The facade session-close request failed: ${refused}"
  fi
  if [[ "${refused}" != *'"result":"session-close is not supported by transmission-vpn"'* ]]; then
    fail "The facade did not refuse session-close: ${refused}"
  fi

  verify_full_metadata_move \
    "${authorization}" "${rpc_session_id}" \
    "${connection_one_id}" "${connection_zero_id}"

  printf '%s' "${profile_id}"
}

verify_delete_refused() {
  local connection_one_id="${1}"
  local profile_id="${2}"
  local login_id="${3}"
  local response
  if response="$(api_request DELETE "/api/v1/vpn/connections/${connection_one_id}")"; then
    fail "Deleting connection two succeeded despite its torrent: ${response}"
  fi
  if ! printf '%s' "${response}" | perl -MJSON::PP -e '
    use strict;
    use warnings;
    my ($profile_id, $login_id) = @ARGV;
    my $document = eval { decode_json(do { local $/; <STDIN> }) } or exit 1;
    my $error = $document->{error} // {};
    my $details = $error->{details} // {};
    my ($profile) = grep {
      ($_->{id} // "") eq $profile_id
    } @{$details->{profiles} // []};
    my ($login) = grep {
      ($_->{id} // "") eq $login_id
    } @{$details->{logins} // []};
    exit 1 unless ($error->{code} // "") eq "connection_in_use";
    exit 1 unless ($details->{torrents} // 0) == 1 && $profile && $login;
  ' "${profile_id}" "${login_id}"; then
    fail "Deleting connection two returned the wrong in-use error: ${response}"
  fi
}

verify_delete_with_move() {
  local connection_zero_id="${1}"
  local connection_one_id="${2}"
  local profile_id="${3}"
  local login_id="${4}"
  printf '{"moveTo":"%s"}' "${connection_zero_id}" \
    > "${test_state_directory}/delete-connection.json"
  local response
  if ! response="$(api_request DELETE "/api/v1/vpn/connections/${connection_one_id}" \
    "${test_state_directory}/delete-connection.json")"; then
    fail "Deleting connection two with moveTo failed: ${response}"
  fi
  if ! printf '%s' "${response}" | perl -MJSON::PP -e '
    use strict;
    use warnings;
    my $hash = "2222222222222222222222222222222222222222";
    my $document = eval { decode_json(do { local $/; <STDIN> }) } or exit 1;
    my ($move) = grep {
      lc($_->{hash} // "") eq $hash
    } @{$document->{moved} // []};
    exit 1 unless $move && ($move->{result} // "") eq "moved";
    exit 1 unless ($document->{profiles} // 0) == 1;
    exit 1 unless ($document->{logins} // 0) == 1;
  '; then
    fail "Deleting connection two returned the wrong move result: ${response}"
  fi

  wait_for_web_proxy_config_route \
    "${connection_proxy_username}" "${connection_zero_id}"

  local attempt
  for attempt in $(seq 1 30); do
    if daemon_has_torrent 9092 '2222222222222222222222222222222222222222'; then
      break
    fi
    sleep 1
  done
  if ! daemon_has_torrent 9092 '2222222222222222222222222222222222222222'; then
    fail 'The deleted connection torrent did not appear in the default daemon.'
  fi

  local profiles
  if ! profiles="$(api_request GET /api/v1/torrent-profiles)"; then
    fail "Reading torrent profiles after connection deletion failed: ${profiles}"
  fi
  if ! printf '%s' "${profiles}" | perl -MJSON::PP -e '
    use strict;
    use warnings;
    my $id = shift;
    my $document = decode_json(do { local $/; <STDIN> });
    my ($profile) = grep { ($_->{id} // "") eq $id } @{$document->{profiles} // []};
    exit 1 unless $profile && !defined $profile->{connectionId};
  ' "${profile_id}"; then
    fail "The deleted connection profile was not reassigned to the default: ${profiles}"
  fi
  local proxy
  if ! proxy="$(api_request GET /api/v1/web-proxy)"; then
    fail "Reading web proxy state after connection deletion failed: ${proxy}"
  fi
  if ! printf '%s' "${proxy}" | perl -MJSON::PP -e '
    use strict;
    use warnings;
    my ($login_id, $username, $connection_id) = @ARGV;
    my $document = eval { decode_json(do { local $/; <STDIN> }) } or exit 1;
    my ($login) = grep {
      ($_->{id} // "") eq $login_id
    } @{$document->{logins} // []};
    exit 1 unless $login;
    exit 1 unless ($login->{username} // "") eq $username;
    exit 1 unless $login->{passwordSet} && !defined $login->{connectionId};
    exit 1 unless ($login->{effectiveConnectionId} // "") eq $connection_id;
  ' "${login_id}" "${connection_proxy_username}" "${connection_zero_id}"; then
    fail "The deleted connection proxy login was not reassigned to the default: ${proxy}"
  fi

  local missing=""
  if missing="$(api_request GET "/api/v1/vpn/connections/${connection_one_id}")"; then
    fail "Connection two still existed after deletion: ${missing}"
  fi
  verify_web_proxy_route \
    "${connection_proxy_username}" "${connection_proxy_password}" \
    "${peer_zero}" "${peer_one}" 10.99.0.2
}

main() {
  trap cleanup EXIT
  trap print_failure_diagnostics ERR

  docker build --tag "${image_name}" "${project_directory}"
  test_state_directory="$(mktemp -d "${project_directory}/.multi-vpn-state.XXXXXX")"
  write_peer_programs
  write_peer_keys_and_profiles
  start_peers
  start_protected_container
  claim_control_api

  local profile_zero
  local profile_one
  local profile_one_duplicate
  profile_zero="$(upload_wireguard_profile 0)"
  profile_one="$(upload_wireguard_profile 1)"
  profile_one_duplicate="$(upload_wireguard_profile 1-duplicate)"
  local connection_zero_id
  local connection_one_id
  connection_zero_id="$(create_connection 'Connection one' "${profile_zero}" 0)"
  connection_one_id="$(create_connection 'Connection two' "${profile_one}" 1)"
  wait_for_connection "${connection_zero_id}" protected 9092
  wait_for_connection "${connection_one_id}" protected 9093

  verify_connection_layout "${connection_zero_id}" "${connection_one_id}"
  verify_isolation
  verify_duplicate_provider_address_case \
    "${connection_one_id}" "${profile_one_duplicate}" "${profile_one}"
  verify_default_dns "${peer_zero}" "${peer_one}" 10.99.0.1

  local default_proxy_login
  default_proxy_login="$(create_web_proxy_login "${default_proxy_username}" null)"
  default_proxy_password="${default_proxy_login#*$'\t'}"

  local connection_proxy_login
  local connection_proxy_login_id
  connection_proxy_login="$(create_web_proxy_login \
    "${connection_proxy_username}" "\"${connection_one_id}\"")"
  connection_proxy_login_id="${connection_proxy_login%%$'\t'*}"
  connection_proxy_password="${connection_proxy_login#*$'\t'}"

  enable_web_proxy
  verify_web_proxy_routes
  verify_web_proxy_dns_route \
    "${connection_proxy_username}" "${connection_proxy_password}" \
    "${peer_one}" "${peer_zero}" 10.99.1.2
  verify_failure_isolation "${connection_zero_id}" "${connection_one_id}"
  verify_default_switch "${connection_one_id}"
  verify_web_proxy_route \
    "${default_proxy_username}" "${default_proxy_password}" \
    "${peer_one}" "${peer_zero}" 10.99.1.2
  local torrent_profile_id
  torrent_profile_id="$(verify_rpc_facade \
    "${connection_zero_id}" "${connection_one_id}")"
  verify_profile_moves \
    "${torrent_profile_id}" "${connection_zero_id}" "${connection_one_id}"
  verify_delete_refused \
    "${connection_one_id}" "${torrent_profile_id}" "${connection_proxy_login_id}"
  verify_delete_with_move \
    "${connection_zero_id}" "${connection_one_id}" \
    "${torrent_profile_id}" "${connection_proxy_login_id}"

  printf 'multi-vpn.integration: isolated VPNs, per-login proxy routes, torrent moves, and move-to deletion passed.\n'
}

main "$@"
