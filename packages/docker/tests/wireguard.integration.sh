#!/usr/bin/env bash
set -euo pipefail
set -o errtrace

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly project_directory="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

readonly image_name="transmission-vpn:test"
readonly test_identifier="$$"
readonly network_name="transmission-vpn-wg-test-${test_identifier}"
readonly peer_container_name="transmission-vpn-wg-peer-${test_identifier}"
readonly kernel_container_name="transmission-vpn-wg-kernel-${test_identifier}"
readonly userspace_container_name="transmission-vpn-wg-userspace-${test_identifier}"
readonly api_url="http://127.0.0.1:22602"

test_state_directory=""
session_cookie=""
csrf_token=""
diagnostic_container_name=""
diagnostics_printed="false"

cleanup() {
  docker rm --force --volumes "${userspace_container_name}" > /dev/null 2>&1 || true
  docker rm --force --volumes "${kernel_container_name}" > /dev/null 2>&1 || true
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

  if [[ -z "${diagnostic_container_name}" ]] || \
    ! docker inspect "${diagnostic_container_name}" > /dev/null 2>&1; then
    return 0
  fi

  printf 'wireguard.integration: last 80 log lines for %s:\n' \
    "${diagnostic_container_name}" >&2
  docker logs "${diagnostic_container_name}" 2>&1 | tail -n 80 >&2 || true
  printf 'wireguard.integration: %s /run/transmission-vpn/vpn.status:\n' \
    "${diagnostic_container_name}" >&2
  docker exec "${diagnostic_container_name}" \
    cat /run/transmission-vpn/vpn.status >&2 || true
  printf 'wireguard.integration: %s /run/transmission-vpn/firewall.ready:\n' \
    "${diagnostic_container_name}" >&2
  docker exec "${diagnostic_container_name}" \
    cat /run/transmission-vpn/firewall.ready >&2 || true
}

report_unhandled_error() {
  local exit_status="${1}"
  local line_number="${2}"
  local command="${3}"

  printf 'wireguard.integration: command failed at line %s: %s\n' \
    "${line_number}" "${command}" >&2
  print_failure_diagnostics

  return "${exit_status}"
}

fail() {
  local message="${1}"

  printf 'wireguard.integration: %s\n' "${message}" >&2
  print_failure_diagnostics

  return 1
}

expect_count() {
  local actual_count="${1}"
  local expected_count="${2}"
  local description="${3}"

  if [[ "${actual_count}" -ne "${expected_count}" ]]; then
    fail "${description} count was ${actual_count}, expected ${expected_count}."
  fi
}

# The peer answers DNS for every name with 9.9.9.9, which is enough for the
# controller's lookup check without reaching the internet.
write_peer_files() {
  local peer_directory="${test_state_directory}/peer"
  mkdir -p "${peer_directory}"

  docker run --rm --entrypoint wg "${image_name}" genkey > "${peer_directory}/server.key"
  docker run --rm --entrypoint wg "${image_name}" genkey > "${test_state_directory}/client.key"
  docker run --rm -i --entrypoint wg "${image_name}" pubkey \
    < "${peer_directory}/server.key" > "${test_state_directory}/server.pub"
  docker run --rm -i --entrypoint wg "${image_name}" pubkey \
    < "${test_state_directory}/client.key" > "${peer_directory}/client.pub"
  chmod 644 "${peer_directory}/server.key" "${test_state_directory}/client.key"

  docker run --rm \
    --mount "type=bind,source=${peer_directory},target=/run/peer" \
    --entrypoint bash \
    "${image_name}" \
    -c '
      set -euo pipefail
      openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -subj /CN=transmission-vpn-blocklist-test-ca \
        -addext "basicConstraints = critical, CA:true" \
        -addext "keyUsage = critical, keyCertSign, cRLSign" \
        -keyout /run/peer/blocklist-ca.key -out /run/peer/blocklist-ca.crt
      openssl req -nodes -newkey rsa:2048 \
        -subj /CN=1.1.1.1 \
        -keyout /run/peer/blocklist-server.key -out /run/peer/blocklist-server.csr
      printf "keyUsage = critical, digitalSignature, keyEncipherment\nextendedKeyUsage = serverAuth\nsubjectAltName = IP:1.1.1.1\n" \
        > /run/peer/blocklist-server.ext
      openssl x509 -req -days 1 -sha256 \
        -in /run/peer/blocklist-server.csr \
        -CA /run/peer/blocklist-ca.crt \
        -CAkey /run/peer/blocklist-ca.key \
        -CAcreateserial \
        -extfile /run/peer/blocklist-server.ext \
        -out /run/peer/blocklist-server.crt
      chmod 0644 \
        /run/peer/blocklist-ca.crt \
        /run/peer/blocklist-server.crt \
        /run/peer/blocklist-server.key
    '
  printf '%s\n' \
    'integration:8.8.8.0-8.8.8.255' \
    '2001:db8:ffff::/126' \
    > "${peer_directory}/blocklist.txt"

  cat > "${peer_directory}/dns.pl" << 'PERL'
use strict;
use warnings;
use IO::Socket::INET;

my $socket = IO::Socket::INET->new(LocalAddr => '10.99.0.1', LocalPort => 53, Proto => 'udp')
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

# Each connection is closed as soon as it's accepted, so a probe whose client died with
# a killed controller can't hold up the next one, as a one-at-a-time nc would.
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

  cat > "${peer_directory}/http.pl" << 'PERL'
use strict;
use warnings;
use IO::Socket::INET;

my $server = IO::Socket::INET->new(LocalPort => 80, Listen => 128, ReuseAddr => 1, Proto => 'tcp')
  or die "http: $!\n";

while (1) {
  my $client = $server->accept or next;
  while (my $line = <$client>) {
    last if $line eq "\r\n";
  }
  print $client "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok";
  close $client;
}
PERL

  cat > "${peer_directory}/watched-http.pl" << 'PERL'
use strict;
use warnings;
use IO::Socket::INET;

my $server = IO::Socket::INET->new(LocalPort => 8081, Listen => 128, ReuseAddr => 1, Proto => 'tcp')
  or die "watched http: $!\n";

while (1) {
  my $client = $server->accept or next;
  open my $marker, '>', '/tmp/web-proxy-eth0-hit' or die "marker: $!\n";
  print {$marker} "hit\n";
  close $marker;
  print $client "HTTP/1.1 200 OK\r\nContent-Length: 3\r\nConnection: close\r\n\r\nbad";
  close $client;
}
PERL

  cat > "${peer_directory}/proxy-http.pl" << 'PERL'
use strict;
use warnings;
use IO::Socket::INET;

my $timeout_seconds = 20;
$SIG{ALRM} = sub { die "HTTP proxy client timed out after $timeout_seconds seconds\n"; };
alarm $timeout_seconds;

my ($proxy_host, $proxy_port, $target, $authorization) = @ARGV;
my $socket = IO::Socket::INET->new(
  PeerHost => $proxy_host,
  PeerPort => $proxy_port,
  Proto => 'tcp',
  Timeout => 5,
) or die "proxy connect: $!\n";
$socket->autoflush(1);

print $socket "GET $target HTTP/1.1\r\nHost: proxy-target.test\r\nConnection: close\r\n";
print $socket "Proxy-Authorization: $authorization\r\n" if $authorization ne '-';
print $socket "\r\n";

my $content = '';
while (1) {
  my $read = sysread($socket, my $chunk, 4096);
  last unless defined $read && $read > 0;
  $content .= $chunk;
}
print $content;
alarm 0;
PERL

  cat > "${peer_directory}/socks-client.pl" << 'PERL'
use strict;
use warnings;
use IO::Socket::INET;

my $timeout_seconds = 20;
$SIG{ALRM} = sub { die "SOCKS5 client timed out after $timeout_seconds seconds\n"; };
alarm $timeout_seconds;

sub read_exact {
  my ($socket, $length) = @_;
  my $content = '';
  while (length($content) < $length) {
    my $read = sysread($socket, my $chunk, $length - length($content));
    die "short SOCKS5 response\n" unless defined $read && $read > 0;
    $content .= $chunk;
  }
  return $content;
}

my ($proxy_host, $proxy_port, $username, $password) = @ARGV;
my $socket = IO::Socket::INET->new(
  PeerHost => $proxy_host,
  PeerPort => $proxy_port,
  Proto => 'tcp',
  Timeout => 5,
) or die "SOCKS5 connect: $!\n";
$socket->autoflush(1);

print $socket pack('C*', 5, 1, 2);
die "SOCKS5 authentication method refused\n" unless read_exact($socket, 2) eq pack('C*', 5, 2);
print $socket pack('CC', 1, length($username)) . $username . pack('C', length($password)) . $password;
die "SOCKS5 authentication failed\n" unless read_exact($socket, 2) eq pack('C*', 1, 0);

my $domain = 'proxy-target.test';
print $socket pack('C*', 5, 1, 0, 3, length($domain)) . $domain . pack('n', 80);
my $reply = read_exact($socket, 10);
die "SOCKS5 CONNECT failed with " . ord(substr($reply, 1, 1)) . "\n"
  unless ord(substr($reply, 1, 1)) == 0;

print $socket "GET / HTTP/1.1\r\nHost: proxy-target.test\r\nConnection: close\r\n\r\n";
my $content = '';
while (1) {
  my $read = sysread($socket, my $chunk, 4096);
  last unless defined $read && $read > 0;
  $content .= $chunk;
}
print $content;
alarm 0;
PERL

  cat > "${peer_directory}/start.sh" << 'PEER'
#!/bin/bash
set -euo pipefail

ip link add wg0 type wireguard
wg set wg0 \
  private-key /run/peer/server.key \
  listen-port 51820 \
  peer "$(cat /run/peer/client.pub)" allowed-ips 10.99.0.2/32
ip address add 10.99.0.1/24 dev wg0
ip link set wg0 up

# The controller's egress probes and the Transmission check dial these through the
# tunnel; only the peer answers them, so success proves the tunnel path.
ip address add 1.1.1.1/32 dev lo
ip address add 9.9.9.9/32 dev lo
iptables -N TVPN_BLOCKLIST_WG0
iptables -A TVPN_BLOCKLIST_WG0 -j RETURN
iptables -I INPUT 1 -i wg0 -d 1.1.1.1 -p tcp --dport 443 -j TVPN_BLOCKLIST_WG0
iptables -N TVPN_BLOCKLIST_ETH0
iptables -A TVPN_BLOCKLIST_ETH0 -j RETURN
iptables -I INPUT 1 -i eth0 -d 1.1.1.1 -p tcp --dport 443 -j TVPN_BLOCKLIST_ETH0
cd /run/peer
openssl s_server \
  -accept 1.1.1.1:443 \
  -cert /run/peer/blocklist-server.crt \
  -key /run/peer/blocklist-server.key \
  -state \
  -WWW \
  > /tmp/blocklist-https.log 2>&1 &
perl /run/peer/tcp.pl 8080 /tmp/wireguard-source-8080 &
perl /run/peer/http.pl &
perl /run/peer/watched-http.pl &

exec perl /run/peer/dns.pl
PEER
  chmod 755 "${peer_directory}/start.sh"

  cat > "${test_state_directory}/userspace-run" << 'RUN'
#!/command/with-contenv bash
set -euo pipefail

exec /usr/local/bin/transmission-vpn-vpn-controller --wireguard-implementation userspace
RUN
  chmod 755 "${test_state_directory}/userspace-run"

  mkdir -p "${test_state_directory}/secrets"
  printf '%s\n' 'integration-claim-secret-123' > "${test_state_directory}/secrets/transmission-vpn-claim"
}

# The uploaded file carries IPv6 lines and ::/0 on purpose: the normalizer must strip
# them, and the controller must still route only IPv4 into wg0.
write_client_configuration() {
  cat > "${test_state_directory}/home.conf" << CONF
[Interface]
PrivateKey = $(cat "${test_state_directory}/client.key")
Address = 10.99.0.2/32, fd00::2/128
DNS = 10.99.0.1, fd00::1

[Peer]
PublicKey = $(cat "${test_state_directory}/server.pub")
Endpoint = ${peer_container_name}:51820
AllowedIPs = 0.0.0.0/0, ::/0
CONF
}

start_protected_container() {
  local container_name="${1}"
  shift

  diagnostic_container_name="${container_name}"

  docker run --detach \
    --name "${container_name}" \
    --network "${network_name}" \
    --cap-add NET_ADMIN \
    --device /dev/net/tun \
    --env PGID=12345 \
    --env PUID=12345 \
    --env TZ=UTC \
    --mount "type=bind,source=${test_state_directory}/secrets,target=/run/secrets,readonly" \
    "$@" \
    "${image_name}" > /dev/null

  # The console answers before the VPN controller listens, and every VPN request needs
  # the controller, so both must be ready.
  local attempt
  for attempt in $(seq 1 30); do
    if docker exec "${container_name}" \
      wget -q -O /dev/null http://127.0.0.1:22602/api/v1/health/live \
      && docker exec "${container_name}" \
        test -f /run/transmission-vpn/services/vpn-controller.ready; then
      return 0
    fi

    sleep 1
  done

  fail "${container_name} control plane did not become ready within 30 seconds."
}

wait_for_services() {
  local container_name="${1}"
  local attempt

  for attempt in $(seq 1 30); do
    if docker exec "${container_name}" \
      /usr/local/libexec/transmission-vpn/healthcheck.sh > /dev/null 2>&1; then
      return 0
    fi

    sleep 1
  done

  fail "${container_name} services did not become ready within 30 seconds."
}

api_request() {
  local container_name="${1}"
  local method="${2}"
  local path="${3}"
  local body_path="${4:-}"

  local arguments=(
    -q -O - --content-on-error
    --header "Cookie: tvpn_session=${session_cookie}; tvpn_csrf=${csrf_token}"
    --header "X-CSRF-Token: ${csrf_token}"
  )
  if [[ "${method}" == "POST" ]]; then
    arguments+=(--header 'Content-Type: application/json')
    if [[ -n "${body_path}" ]]; then
      docker exec -i "${container_name}" sh -c 'cat > /tmp/request.json' < "${body_path}"
      arguments+=(--post-file /tmp/request.json)
    else
      arguments+=(--post-data '{}')
    fi
  elif [[ "${method}" == "PUT" || "${method}" == "DELETE" ]]; then
    arguments+=(--method "${method}")
    if [[ -n "${body_path}" ]]; then
      docker exec -i "${container_name}" sh -c 'cat > /tmp/request.json' < "${body_path}"
      arguments+=(--header 'Content-Type: application/json' --body-file /tmp/request.json)
    fi
  fi

  docker exec "${container_name}" wget "${arguments[@]}" "${api_url}${path}"
}

peer_blocklist_packets() {
  local chain_name="${1}"

  docker exec "${peer_container_name}" \
    iptables -L "${chain_name}" -v -n -x \
    | awk '$3 == "RETURN" { print $1; exit }'
}

claim_control_api() {
  local container_name="${1}"

  local claim_response_headers
  claim_response_headers="$(docker exec "${container_name}" wget -S \
    -O /tmp/claim-response.json \
    --header 'Content-Type: application/json' \
    --post-data '{"claimCode":"integration-claim-secret-123","username":"administrator","password":"integration test password"}' \
    "${api_url}/api/v1/setup/claim" 2>&1)"

  session_cookie="$(printf '%s\n' "${claim_response_headers}" \
    | sed -n 's/.*[Ss]et-[Cc]ookie: tvpn_session=\([^;]*\).*/\1/p' \
    | head -n 1)"
  csrf_token="$(printf '%s\n' "${claim_response_headers}" \
    | sed -n 's/.*[Ss]et-[Cc]ookie: tvpn_csrf=\([^;]*\).*/\1/p' \
    | head -n 1)"
  if [[ -z "${session_cookie}" || -z "${csrf_token}" ]]; then
    fail "The setup claim on ${container_name} did not return authentication cookies."
  fi
}

upload_and_connect() {
  local container_name="${1}"

  local profile_json
  profile_json="$(sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' "${test_state_directory}/home.conf" \
    | awk '{ printf "%s\\n", $0 }')"
  printf '{"tunnel":"wireguard","profileName":"home.conf","profile":"%s"}' "${profile_json}" \
    > "${test_state_directory}/upload.json"

  local upload_response
  if ! upload_response="$(api_request "${container_name}" POST /api/v1/vpn/profiles/custom \
    "${test_state_directory}/upload.json")"; then
    fail "The WireGuard upload failed: ${upload_response}"
  fi

  local profile_id
  profile_id="$(printf '%s' "${upload_response}" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
  if [[ "${profile_id}" != custom:wg-home:* || "${upload_response}" != *'"tunnel":"wireguard"'* ]]; then
    fail "The WireGuard upload returned an unexpected profile: ${upload_response}"
  fi

  local status_response
  status_response="$(api_request "${container_name}" GET /api/v1/vpn/status)"
  local revision
  revision="$(printf '%s' "${status_response}" \
    | sed -n 's/.*"revision":\([0-9][0-9]*\).*/\1/p')"
  if [[ -z "${revision}" ]]; then
    revision=0
  fi

  printf '{"expectedRevision":%s,"providerId":"custom","tunnel":"wireguard","profileIds":["%s"],"endpointStrategy":"sticky","credentials":{},"dnsServers":[],"retryIntervalSeconds":3}' \
    "${revision}" "${profile_id}" > "${test_state_directory}/connect.json"

  local connect_response
  if ! connect_response="$(api_request "${container_name}" POST /api/v1/vpn/connect \
    "${test_state_directory}/connect.json")"; then
    fail "The WireGuard connection failed: ${connect_response}"
  fi
  if [[ "${connect_response}" != *'"state":"protected"'* ]]; then
    fail "The WireGuard connection was not protected: ${connect_response}"
  fi
}

wait_for_state() {
  local container_name="${1}"
  local wanted_state="${2}"
  local timeout_seconds="${3}"

  local attempt
  for attempt in $(seq 1 "${timeout_seconds}"); do
    if docker exec "${container_name}" grep -Fq "\"state\":\"${wanted_state}\"" \
      /run/transmission-vpn/vpn.status 2> /dev/null; then
      return 0
    fi

    sleep 1
  done

  fail "${container_name} did not reach ${wanted_state} within ${timeout_seconds} seconds."
}

# The status file can still show the state from before a crash, so a restart is
# followed through the controller's state log lines instead.
count_state_lines() {
  local container_name="${1}"
  local state="${2}"

  docker logs "${container_name}" 2>&1 \
    | grep -F '"msg":"VPN state changed"' \
    | grep -c -F "\"state\":\"${state}\"" || true
}

count_startup_block_lines() {
  local container_name="${1}"

  docker logs "${container_name}" 2>&1 \
    | grep -c -F '"msg":"VPN controller blocked all VPN egress at startup"' || true
}

transmission_reaches_bound() {
  local container_name="${1}"
  local source_address="${2}"
  local address="${3}"
  local port="${4}"

  docker exec "${container_name}" \
    /command/s6-setuidgid transmission \
    nc -z -w 3 -s "${source_address}" "${address}" "${port}" > /dev/null 2>&1
}

transmission_reaches_unbound() {
  local container_name="${1}"
  local address="${2}"
  local port="${3}"

  docker exec "${container_name}" \
    /command/s6-setuidgid transmission \
    nc -z -w 3 "${address}" "${port}" > /dev/null 2>&1
}

tunnel_address() {
  local container_name="${1}"

  docker exec "${container_name}" sed -n \
    's/.*"address":"\([0-9.]*\)".*/\1/p' \
    /run/transmission-vpn/vpn.status
}

verify_slot_routing_foundation() {
  local container_name="${1}"
  local slot

  for slot in $(seq 0 63); do
    local local_address="198.18.${slot}.1"
    local table="$((1000 + slot))"
    local local_addresses
    local_addresses="$(docker exec "${container_name}" \
      ip -o -4 address show dev lo to "${local_address}/32")"
    if [[ "${local_addresses}" != *" ${local_address}/32 "* ]]; then
      fail "Slot ${slot} is missing local address ${local_address}/32 on lo: ${local_addresses}"
    fi

    local source_rule
    source_rule="$(docker exec "${container_name}" ip -4 rule show priority "${table}")"
    if [[ "${source_rule}" != *"from ${local_address} lookup ${table}"* ]]; then
      fail "Slot ${slot} is missing priority-${table} source rule for ${local_address}: ${source_rule}"
    fi

    local slot_routes
    slot_routes="$(docker exec "${container_name}" ip -4 route show table "${table}")"
    if [[ "${slot_routes}" != *'unreachable default metric 4294967295'* ]]; then
      fail "Slot ${slot} table ${table} is missing its maximum-metric unreachable default: ${slot_routes}"
    fi
  done
}

proxy_http_request() {
  local proxy_address="${1}"
  local target="${2}"
  local authorization="${3}"

  docker exec "${peer_container_name}" \
    perl /run/peer/proxy-http.pl "${proxy_address}" 22605 "${target}" "${authorization}"
}

verify_web_proxy() {
  local container_name="${1}"
  local protected_address
  protected_address="$(docker inspect --format \
    '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
    "${container_name}")"
  local peer_address
  peer_address="$(docker inspect --format \
    '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
    "${peer_container_name}")"

  printf '%s\n' \
    '{"username":"integration"}' \
    > "${test_state_directory}/web-proxy-login.json"
  local login_response
  login_response="$(api_request "${container_name}" POST /api/v1/web-proxy/logins \
    "${test_state_directory}/web-proxy-login.json")"
  if [[ "${login_response}" != *'"username":"integration"'* \
    || "${login_response}" == *'passwordHash'* ]]; then
    fail "The web proxy login response was unexpected: ${login_response}"
  fi

  local proxy_password
  if ! proxy_password="$(printf '%s' "${login_response}" | perl -MJSON::PP=decode_json -e '
    my $document = eval { decode_json(do { local $/; <STDIN> }) } or exit 1;
    my $password = $document->{password} // "";
    exit 1 unless $password ne "";
    print $password;
  ')"; then
    fail "The web proxy login response did not contain a generated password: ${login_response}"
  fi

  printf '%s\n' '{"enabled":true}' > "${test_state_directory}/web-proxy-enable.json"
  local enable_response
  enable_response="$(api_request "${container_name}" PUT /api/v1/web-proxy \
    "${test_state_directory}/web-proxy-enable.json")"
  if [[ "${enable_response}" != *'"enabled":true'* ]]; then
    fail "The web proxy did not enable: ${enable_response}"
  fi

  local attempt
  for attempt in $(seq 1 10); do
    if docker exec "${peer_container_name}" nc -z -w 1 "${protected_address}" 22605; then
      break
    fi
    if [[ "${attempt}" -eq 10 ]]; then
      fail 'The enabled web proxy did not open its listener within 10 seconds.'
    fi

    sleep 1
  done

  local encoded_credentials
  encoded_credentials="$(printf '%s' "integration:${proxy_password}" \
    | base64 \
    | tr -d '\n')"
  local authorization="Basic ${encoded_credentials}"
  local response
  response="$(proxy_http_request \
    "${protected_address}" \
    'http://1.1.1.1/' \
    "${authorization}")"
  if [[ "${response}" != *'200 OK'* || "${response}" != *$'\r\n\r\nok'* ]]; then
    fail "Authenticated HTTP proxying failed: ${response}"
  fi

  response="$(proxy_http_request \
    "${protected_address}" \
    'http://1.1.1.1/' \
    '-')"
  if [[ "${response}" != *'407 Proxy Authentication Required'* ]]; then
    fail "The HTTP proxy accepted a request without credentials: ${response}"
  fi

  response="$(docker exec "${peer_container_name}" \
    perl /run/peer/socks-client.pl \
    "${protected_address}" \
    22605 \
    integration \
    "${proxy_password}")"
  if [[ "${response}" != *'200 OK'* || "${response}" != *$'\r\n\r\nok'* ]]; then
    fail "Authenticated SOCKS5 proxying failed: ${response}"
  fi

  response="$(proxy_http_request \
    "${protected_address}" \
    "http://${peer_address}:8081/" \
    "${authorization}")"
  if [[ "${response}" != *'403 Forbidden'* ]]; then
    fail "The web proxy did not refuse its private peer destination: ${response}"
  fi

  response="$(proxy_http_request \
    "${protected_address}" \
    'http://127.0.0.1:9092/' \
    "${authorization}")"
  if [[ "${response}" != *'403 Forbidden'* ]]; then
    fail "The web proxy did not refuse its loopback destination: ${response}"
  fi

  docker exec "${peer_container_name}" rm -f /tmp/web-proxy-eth0-hit
  docker exec "${peer_container_name}" ip link set wg0 down
  wait_for_state "${container_name}" reconnecting 150

  response=""
  for attempt in $(seq 1 10); do
    response="$(proxy_http_request \
      "${protected_address}" \
      "http://${peer_address}:8081/" \
      "${authorization}")"
    if [[ "${response}" == *'503 Service Unavailable'* ]]; then
      break
    fi
    if [[ "${attempt}" -eq 10 ]]; then
      fail "The web proxy did not report the unavailable VPN: ${response}"
    fi

    sleep 1
  done
  if docker exec "${peer_container_name}" test -e /tmp/web-proxy-eth0-hit; then
    fail 'The web proxy reached the peer over eth0 while the VPN was unavailable.'
  fi

  docker exec "${peer_container_name}" ip link set wg0 up
  wait_for_state "${container_name}" protected 90

  printf '%s\n' '{"enabled":false}' > "${test_state_directory}/web-proxy-disable.json"
  local disable_response
  disable_response="$(api_request "${container_name}" PUT /api/v1/web-proxy \
    "${test_state_directory}/web-proxy-disable.json")"
  if [[ "${disable_response}" != *'"enabled":false'* ]]; then
    fail "The web proxy did not disable: ${disable_response}"
  fi

  for attempt in $(seq 1 10); do
    if ! docker exec "${peer_container_name}" nc -z -w 1 "${protected_address}" 22605; then
      return 0
    fi

    sleep 1
  done

  fail 'The disabled web proxy left its listener open.'
}

verify_protected_tunnel() {
  local container_name="${1}"
  local implementation="${2}"
  local local_address="198.18.0.1"

  local address
  address="$(tunnel_address "${container_name}")"
  if [[ -z "${address}" ]]; then
    fail 'The protected WireGuard status does not contain a tunnel address.'
  fi

  local rule
  rule="$(docker exec "${container_name}" ip -4 rule show)"
  if [[ "${rule}" != *"from ${local_address} lookup 1000"* ]]; then
    fail "The slot-zero source rule is missing for ${local_address}: ${rule}"
  fi
  if [[ "${address}" != "${local_address}" \
    && "${rule}" == *"from ${address} lookup 1000"* ]]; then
    fail "The provider address ${address} still owns slot-zero policy routing: ${rule}"
  fi

  local main_routes
  main_routes="$(docker exec "${container_name}" ip -4 route show table main)"
  if printf '%s\n' "${main_routes}" | grep -Eq '^0\.0\.0\.0/1([[:space:]]|$)'; then
    fail "The WireGuard controller installed a 0.0.0.0/1 route in the main table: ${main_routes}"
  fi

  local route
  route="$(docker exec "${container_name}" ip -4 route get 1.1.1.1 from "${local_address}")"
  if [[ "${route}" != *" dev wg0 "* ]]; then
    fail "Source traffic from ${local_address} does not route through wg0: ${route}"
  fi

  local slot_routes
  slot_routes="$(docker exec "${container_name}" ip -4 route show table 1000)"
  if [[ "${slot_routes}" != *'default dev wg0'* \
    || "${slot_routes}" != *'unreachable default metric 4294967295'* ]]; then
    fail "The WireGuard slot table is missing its tunnel default or unreachable fallback: ${slot_routes}"
  fi

  local resolver_routes
  resolver_routes="$(docker exec "${container_name}" ip -4 route show table main proto 211)"
  if [[ "${resolver_routes}" != *"10.99.0.1"* \
    || "${resolver_routes}" != *"dev wg0"* \
    || "${resolver_routes}" != *"src ${local_address}"* ]]; then
    fail "The proto 211 resolver pin does not use wg0 from ${local_address}: ${resolver_routes}"
  fi

  local firewall_interfaces
  firewall_interfaces="$(docker exec "${container_name}" cat /run/transmission-vpn/firewall.interfaces)"
  if [[ "${firewall_interfaces}" != "wg0 ${local_address} ${address}" ]]; then
    fail "The firewall interface state is '${firewall_interfaces}', expected 'wg0 ${local_address} ${address}'."
  fi
  docker exec "${container_name}" grep -Fq \
    "{\"interface\":\"wg0\",\"address\":\"${local_address}\",\"providerAddress\":\"${address}\"}" \
    /run/transmission-vpn/firewall.ready

  local selected_backend
  selected_backend="$(docker exec "${container_name}" \
    cat /run/transmission-vpn/firewall.backend)"
  local ipv4_command="iptables"
  if [[ "${selected_backend}" == "legacy" ]]; then
    ipv4_command="iptables-legacy"
  fi
  docker exec "${container_name}" "${ipv4_command}" -w 5 -C OUTPUT \
    -j TVPN_SOURCE_BACKSTOP
  docker exec "${container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_SOURCE_BACKSTOP -s 198.18.0.0/18 -j DROP
  docker exec "${container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_SOURCE_BACKSTOP -s "${local_address}/32" -o wg0 -j RETURN
  docker exec "${container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_SOURCE_BACKSTOP -s "${address}/32" ! -o wg0 -j DROP
  docker exec "${container_name}" "${ipv4_command}" -w 5 -t nat \
    -C POSTROUTING -o wg0 -s "${local_address}/32" \
    -j SNAT --to-source "${address}"
  docker exec "${container_name}" "${ipv4_command}" -w 5 \
    -C TVPN_TUNNELS -s "${local_address}/32" -o wg0 -j ACCEPT

  local link_address
  link_address="$(docker exec "${container_name}" ip -o -4 address show dev wg0)"
  if [[ "${link_address}" != *" ${address}/32 "* \
    || "${link_address}" != *' noprefixroute '* ]]; then
    fail "wg0 does not carry ${address}/32 with noprefixroute: ${link_address}"
  fi
  local connected_routes
  connected_routes="$(docker exec "${container_name}" \
    ip -4 route show table main dev wg0 proto kernel)"
  if [[ -n "${connected_routes}" ]]; then
    fail "wg0 left a provider connected route in the main table: ${connected_routes}"
  fi

  local allowed_ips
  allowed_ips="$(docker exec "${container_name}" wg show wg0 allowed-ips)"
  if [[ "${allowed_ips}" != *"0.0.0.0/0" || "${allowed_ips}" == *"::/0"* ]]; then
    fail "wg0 allows more than IPv4: ${allowed_ips}"
  fi
  if docker exec "${container_name}" ip -6 address show dev wg0 scope global | grep -Fq 'inet6'; then
    fail 'wg0 received an IPv6 address from the uploaded file.'
  fi

  local resolver
  resolver="$(docker exec "${container_name}" cat /etc/resolv.conf)"
  if [[ "${resolver}" != *"nameserver 10.99.0.1"* || "${resolver}" == *"fd00::1"* ]]; then
    fail "The protected resolver is wrong: ${resolver}"
  fi

  local status_response
  status_response="$(api_request "${container_name}" GET /api/v1/vpn/status)"
  if [[ "${status_response}" != *'"tunnel":"wireguard"'* \
    || "${status_response}" != *"\"implementation\":\"${implementation}\""* \
    || "${status_response}" != *'"lastHandshakeAt":'* ]]; then
    fail "The VPN status does not describe the ${implementation} WireGuard tunnel: ${status_response}"
  fi

  local attempt
  local default_connection_id
  default_connection_id="$(docker exec "${container_name}" sed -n \
    's/.*"connectionId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    /run/transmission-vpn/services/transmission.ready)"
  if [[ ! "${default_connection_id}" =~ ^vpc-[0-9a-f]{16}$ ]]; then
    fail "Invalid default Transmission connection identifier: ${default_connection_id}"
  fi
  local transmission_settings_path="/config/transmission/${default_connection_id}/settings.json"
  for attempt in $(seq 1 15); do
    if docker exec "${container_name}" grep -Fq \
      "\"bind-address-ipv4\": \"${local_address}\"" \
      "${transmission_settings_path}"; then
      break
    fi
    if [[ "${attempt}" -eq 15 ]]; then
      fail "Transmission did not bind settings.json to ${local_address} within 15 seconds."
    fi

    sleep 1
  done

  docker exec "${peer_container_name}" rm -f /tmp/wireguard-source-8080
  if ! transmission_reaches_bound "${container_name}" "${local_address}" 1.1.1.1 8080; then
    fail "Transmission could not reach the tunnel peer when bound to ${local_address}."
  fi
  local observed_source
  observed_source="$(docker exec "${peer_container_name}" \
    cat /tmp/wireguard-source-8080 2> /dev/null || true)"
  if [[ "${observed_source}" != "${address}" ]]; then
    fail "The WireGuard peer saw ${observed_source:-no source}, expected SNAT provider address ${address}."
  fi
  if transmission_reaches_unbound "${container_name}" 1.1.1.1 443; then
    fail 'An unbound Transmission-user connection reached 1.1.1.1 outside source policy routing.'
  fi

  local peer_address
  peer_address="$(docker inspect --format \
    '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
    "${peer_container_name}")"
  if transmission_reaches_unbound "${container_name}" "${peer_address}" 8080; then
    fail 'Transmission reached the peer outside the tunnel on eth0.'
  fi
}

verify_blocklist_merger() {
  local container_name="${1}"

  local peer_address
  peer_address="$(docker inspect --format \
    '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
    "${peer_container_name}")"
  docker exec "${container_name}" \
    ip route replace 1.1.1.1/32 via "${peer_address}" dev eth0

  docker exec -i --user root "${container_name}" sh -c \
    'cat > /usr/local/share/ca-certificates/transmission-vpn-blocklist-test.crt' \
    < "${test_state_directory}/peer/blocklist-ca.crt"
  docker exec --user root "${container_name}" update-ca-certificates > /dev/null

  local settings_response
  settings_response="$(api_request "${container_name}" GET /api/v1/settings)"
  local revision
  revision="$(printf '%s' "${settings_response}" \
    | sed -n 's/.*"revision":\([0-9][0-9]*\).*/\1/p')"
  if [[ -z "${revision}" ]]; then
    fail "The settings response has no revision: ${settings_response}"
  fi
  printf '{"expectedRevision":%s,"changes":{"transmission.blocklistEnabled":true,"transmission.blocklistSources":["https://1.1.1.1/blocklist.txt"]}}' \
    "${revision}" > "${test_state_directory}/blocklist-settings.json"
  local save_response
  if ! save_response="$(api_request \
    "${container_name}" \
    PUT \
    /api/v1/settings \
    "${test_state_directory}/blocklist-settings.json")"; then
    fail "Saving the blocklist source failed: ${save_response}"
  fi

  local attempt
  local status_response=""
  for attempt in $(seq 1 45); do
    status_response="$(api_request "${container_name}" GET /api/v1/blocklists)"
    if [[ "${status_response}" == *'"state":"idle"'* \
      && "${status_response}" == *'"state":"ok"'* \
      && "${status_response}" == *'"ranges":2'* ]]; then
      break
    fi
    if [[ "${attempt}" -eq 45 ]]; then
      fail "The merged blocklist did not become ready: ${status_response}"
    fi

    sleep 1
  done

  local default_connection_id
  default_connection_id="$(docker exec "${container_name}" sed -n \
    's/.*"connectionId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    /run/transmission-vpn/services/transmission.ready)"
  local blocklist_directory="/config/transmission/${default_connection_id}/blocklists"
  local blocklist_files
  blocklist_files="$(docker exec "${container_name}" \
    find "${blocklist_directory}" -maxdepth 1 -type f -name 'tvpn-*.txt' -printf '%f\n')"
  if [[ "$(printf '%s\n' "${blocklist_files}" | sed '/^$/d' | wc -l)" -ne 1 ]]; then
    fail "The daemon blocklist folder does not hold exactly one tvpn file: ${blocklist_files}"
  fi
  if ! docker exec "${container_name}" grep -Fq \
    'tvpn:8.8.8.0-8.8.8.255' \
    "${blocklist_directory}/${blocklist_files}"; then
    fail "The daemon blocklist file does not contain the normalized IPv4 range."
  fi

  local wg0_packets
  wg0_packets="$(peer_blocklist_packets TVPN_BLOCKLIST_WG0)"
  local eth0_packets
  eth0_packets="$(peer_blocklist_packets TVPN_BLOCKLIST_ETH0)"
  if [[ ! "${wg0_packets}" =~ ^[0-9]+$ || ! "${eth0_packets}" =~ ^[0-9]+$ ]]; then
    fail "The blocklist route counters are unavailable: wg0=${wg0_packets}, eth0=${eth0_packets}."
  fi
  if [[ "${wg0_packets}" -eq 0 || "${eth0_packets}" -ne 0 ]]; then
    fail "The first blocklist download used unexpected peer routes: wg0=${wg0_packets}, eth0=${eth0_packets}."
  fi

  docker exec "${peer_container_name}" ip link set wg0 down
  wait_for_state "${container_name}" reconnecting 150
  api_request "${container_name}" POST /api/v1/blocklists/update > /dev/null
  for attempt in $(seq 1 15); do
    status_response="$(api_request "${container_name}" GET /api/v1/blocklists)"
    if [[ "${status_response}" == *'"state":"waiting-for-vpn"'* ]]; then
      break
    fi
    if [[ "${attempt}" -eq 15 ]]; then
      fail "The blocklist update did not wait for VPN protection: ${status_response}"
    fi

    sleep 1
  done
  local eth0_packets_after
  eth0_packets_after="$(peer_blocklist_packets TVPN_BLOCKLIST_ETH0)"
  if [[ "${eth0_packets_after}" -ne "${eth0_packets}" ]]; then
    fail "The waiting blocklist update reached the peer over eth0: before=${eth0_packets}, after=${eth0_packets_after}."
  fi

  docker exec "${peer_container_name}" ip link set wg0 up
  wait_for_state "${container_name}" protected 90
  for attempt in $(seq 1 45); do
    status_response="$(api_request "${container_name}" GET /api/v1/blocklists)"
    if [[ "${status_response}" == *'"state":"idle"'* \
      && "${status_response}" == *'"state":"ok"'* ]]; then
      docker exec "${container_name}" \
        ip route del 1.1.1.1/32 via "${peer_address}" dev eth0

      return 0
    fi
    sleep 1
  done

  fail "The waiting blocklist update did not finish after WireGuard recovered: ${status_response}"
}

verify_dead_server_blocks() {
  local container_name="${1}"

  local provider_address
  provider_address="$(tunnel_address "${container_name}")"
  local peer_address
  peer_address="$(docker inspect --format \
    '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
    "${peer_container_name}")"
  docker exec "${peer_container_name}" rm -f /tmp/web-proxy-eth0-hit

  docker exec "${peer_container_name}" ip link set wg0 down
  local attempt
  for attempt in $(seq 1 5); do
    docker exec "${container_name}" \
      nc -z -w 1 -s 198.18.0.1 "${peer_address}" 8081 > /dev/null 2>&1 || true
    docker exec "${container_name}" \
      nc -z -w 1 -s "${provider_address}" "${peer_address}" 8081 > /dev/null 2>&1 || true
  done
  wait_for_state "${container_name}" reconnecting 150

  docker exec "${container_name}" grep -Fq '"state":"blocked"' /run/transmission-vpn/firewall.ready
  if transmission_reaches_unbound "${container_name}" 1.1.1.1 443; then
    fail 'Transmission reached the tunnel side while the server was dead.'
  fi
  if docker exec "${peer_container_name}" test -e /tmp/web-proxy-eth0-hit; then
    fail 'Traffic sourced from 198.18.0.1 or the WireGuard provider address left eth0 while the peer tunnel was down.'
  fi

  docker exec "${peer_container_name}" ip link set wg0 up
  wait_for_state "${container_name}" protected 90
  docker exec "${container_name}" grep -Fq '"interface":"wg0"' /run/transmission-vpn/firewall.ready
  if ! transmission_reaches_bound "${container_name}" 198.18.0.1 1.1.1.1 443; then
    fail 'Transmission could not reach the tunnel side after the server returned.'
  fi
}

# s6 restarts a crashed controller, which comes back blocked and without its tunnel.
# The control API must notice and reconnect the saved configuration on its own.
verify_controller_crash_recovers() {
  local container_name="${1}"

  local controller_pid
  controller_pid="$(docker exec "${container_name}" pidof transmission-vpn-vpn-controller)"
  local startup_block_lines
  startup_block_lines="$(count_startup_block_lines "${container_name}")"
  local protected_lines
  protected_lines="$(count_state_lines "${container_name}" protected)"

  docker exec "${container_name}" sh -c 'kill -KILL "$(pidof transmission-vpn-vpn-controller)"'

  local attempt
  for attempt in $(seq 1 60); do
    if [[ "$(count_state_lines "${container_name}" protected)" -gt "${protected_lines}" ]]; then
      break
    fi
    if [[ "${attempt}" -eq 60 ]]; then
      fail 'The VPN was not reconnected within 60 seconds after the controller crashed.'
    fi

    sleep 1
  done

  if [[ "$(docker exec "${container_name}" pidof transmission-vpn-vpn-controller)" == "${controller_pid}" ]]; then
    fail 'The controller was not restarted after it crashed.'
  fi
  if [[ "$(count_startup_block_lines "${container_name}")" -le "${startup_block_lines}" ]]; then
    fail 'The restarted controller did not start blocked.'
  fi

  local local_address="198.18.0.1"
  local provider_address
  provider_address="$(tunnel_address "${container_name}")"
  if [[ -z "${provider_address}" ]]; then
    fail 'The reconnected WireGuard status did not contain a provider address.'
  fi

  local link_output
  link_output="$(docker exec "${container_name}" \
    ip -o link show dev wg0 2> /dev/null || true)"
  local link_count
  link_count="$(printf '%s\n' "${link_output}" \
    | grep -Ec '^[0-9]+: wg0(:|@)' || true)"
  expect_count "${link_count}" 1 'wg0 link'

  local slot_routes
  slot_routes="$(docker exec "${container_name}" ip -4 route show table 1000)"
  local tunnel_default_count
  tunnel_default_count="$(printf '%s\n' "${slot_routes}" \
    | grep -Ec '^default dev wg0([[:space:]]|$)' || true)"
  expect_count "${tunnel_default_count}" 1 'wg0 table-1000 default route'

  local selected_backend
  selected_backend="$(docker exec "${container_name}" \
    cat /run/transmission-vpn/firewall.backend)"
  local ipv4_command="iptables"
  if [[ "${selected_backend}" == "legacy" ]]; then
    ipv4_command="iptables-legacy"
  fi

  local backstop_rules
  backstop_rules="$(docker exec "${container_name}" \
    "${ipv4_command}" -w 5 -S TVPN_SOURCE_BACKSTOP)"
  local backstop_return_count
  backstop_return_count="$(printf '%s\n' "${backstop_rules}" \
    | grep -Fxc -- "-A TVPN_SOURCE_BACKSTOP -s ${local_address}/32 -o wg0 -j RETURN" || true)"
  expect_count "${backstop_return_count}" 1 'wg0 source-backstop RETURN rule'

  local provider_drop_count
  provider_drop_count="$(printf '%s\n' "${backstop_rules}" \
    | grep -Fxc -- "-A TVPN_SOURCE_BACKSTOP -s ${provider_address}/32 ! -o wg0 -j DROP" || true)"
  expect_count "${provider_drop_count}" 1 'wg0 provider-address drop rule'

  local nat_rules
  nat_rules="$(docker exec "${container_name}" \
    "${ipv4_command}" -w 5 -t nat -S POSTROUTING)"
  local snat_count
  snat_count="$(printf '%s\n' "${nat_rules}" \
    | grep -Fxc -- "-A POSTROUTING -s ${local_address}/32 -o wg0 -j SNAT --to-source ${provider_address}" || true)"
  expect_count "${snat_count}" 1 'wg0 SNAT rule'

  local tunnel_rules
  tunnel_rules="$(docker exec "${container_name}" \
    "${ipv4_command}" -w 5 -S TVPN_TUNNELS)"
  local tunnel_accept_count
  tunnel_accept_count="$(printf '%s\n' "${tunnel_rules}" \
    | grep -Fxc -- "-A TVPN_TUNNELS -s ${local_address}/32 -o wg0 -j ACCEPT" || true)"
  expect_count "${tunnel_accept_count}" 1 'wg0 tunnel accept rule'

  docker exec "${container_name}" grep -Fq '"interface":"wg0"' /run/transmission-vpn/firewall.ready
  if ! transmission_reaches_bound "${container_name}" 198.18.0.1 1.1.1.1 443; then
    fail 'Transmission could not reach the tunnel side after the controller restarted.'
  fi
}

verify_shutdown_order() {
  local container_name="${1}"

  docker stop --time 20 "${container_name}" > /dev/null

  local container_logs
  container_logs="$(docker logs "${container_name}" 2>&1)"

  local last_state_line
  last_state_line="$(printf '%s\n' "${container_logs}" \
    | grep -F '"msg":"VPN state changed"' \
    | tail -n 1 || true)"
  if [[ "${last_state_line}" != *'"state":"blocked"'* ]]; then
    fail "The controller did not end blocked: ${last_state_line}"
  fi

  local blocked_line
  blocked_line="$(printf '%s\n' "${container_logs}" \
    | grep -n -F '"msg":"VPN state changed"' \
    | grep -F '"state":"blocked"' \
    | tail -n 1 \
    | cut -d: -f1 || true)"
  local teardown_line
  teardown_line="$(printf '%s\n' "${container_logs}" \
    | grep -n -F 'firewall-down: fail-closed rules were removed' \
    | cut -d: -f1 || true)"
  if [[ -z "${blocked_line}" || -z "${teardown_line}" \
    || "${blocked_line}" -ge "${teardown_line}" ]]; then
    fail 'The firewall was removed before the WireGuard tunnel was blocked and stopped.'
  fi
}

verify_userspace_tunnel() {
  start_protected_container "${userspace_container_name}" \
    --mount "type=bind,source=${test_state_directory}/userspace-run,target=/etc/s6-overlay/s6-rc.d/vpn-controller/run,readonly"
  claim_control_api "${userspace_container_name}"
  upload_and_connect "${userspace_container_name}"
  wait_for_services "${userspace_container_name}"

  if ! docker exec "${userspace_container_name}" pidof wireguard-go > /dev/null; then
    fail 'The userspace engine is not running wireguard-go.'
  fi
  verify_protected_tunnel "${userspace_container_name}" userspace

  verify_controller_crash_recovers "${userspace_container_name}"
  if [[ "$(docker exec "${userspace_container_name}" pidof wireguard-go | wc -w)" -ne 1 ]]; then
    fail 'The crashed controller left its wireguard-go running.'
  fi
  verify_shutdown_order "${userspace_container_name}"
}

main() {
  trap cleanup EXIT
  trap 'report_unhandled_error "$?" "${LINENO}" "${BASH_COMMAND}"' ERR

  docker build --tag "${image_name}" "${project_directory}"

  test_state_directory="$(mktemp -d "${project_directory}/.integration-state.XXXXXX")"
  write_peer_files
  write_client_configuration
  docker network create "${network_name}" > /dev/null

  docker run --detach \
    --name "${peer_container_name}" \
    --network "${network_name}" \
    --cap-add NET_ADMIN \
    --mount "type=bind,source=${test_state_directory}/peer,target=/run/peer,readonly" \
    --entrypoint /run/peer/start.sh \
    "${image_name}" > /dev/null

  start_protected_container "${kernel_container_name}"
  claim_control_api "${kernel_container_name}"
  upload_and_connect "${kernel_container_name}"
  wait_for_services "${kernel_container_name}"
  verify_slot_routing_foundation "${kernel_container_name}"
  verify_protected_tunnel "${kernel_container_name}" kernel
  verify_web_proxy "${kernel_container_name}"
  verify_blocklist_merger "${kernel_container_name}"
  verify_dead_server_blocks "${kernel_container_name}"
  verify_controller_crash_recovers "${kernel_container_name}"
  verify_shutdown_order "${kernel_container_name}"

  verify_userspace_tunnel

  printf 'wireguard.integration: WireGuard protection, recovery from a dead server or a controller crash, and userspace fallback passed.\n'
}

main "$@"
