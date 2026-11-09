#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly project_directory="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
readonly assembly_directory="${project_directory}/packages/docker"
readonly application_directory="${project_directory}/apps/transmission"

fail() {
  local message="${1}"

  printf 'foundation.test: %s\n' "${message}" >&2

  return 1
}

assert_file_contains() {
  local file_path="${1}"
  local expected_text="${2}"

  if ! grep -Fq -- "${expected_text}" "${file_path}"; then
    fail "${file_path} does not contain: ${expected_text}"
  fi
}

assert_file_not_contains() {
  local file_path="${1}"
  local unexpected_text="${2}"

  if grep -Fq -- "${unexpected_text}" "${file_path}"; then
    fail "${file_path} unexpectedly contains: ${unexpected_text}"
  fi
}

assert_file_exists() {
  local file_path="${1}"

  if [[ ! -f "${file_path}" ]]; then
    fail "Required file is missing: ${file_path}"
  fi
}

verify_dockerfile() {
  local dockerfile_path="${project_directory}/Dockerfile"

  assert_file_contains "${dockerfile_path}" "debian:trixie-20261005-slim@sha256:"
  assert_file_contains "${dockerfile_path}" "S6_OVERLAY_VERSION=\"3.2.3.2\""
  assert_file_contains "${dockerfile_path}" "TRANSMISSION_SERIES=\"4.1\""
  assert_file_contains "${dockerfile_path}" "COPY packages/docker/transmission-release.jq ./transmission-release.jq"
  assert_file_contains "${dockerfile_path}" "AS transmission-release"
  assert_file_not_contains "${dockerfile_path}" "ARG TRANSMISSION_VERSION"
  assert_file_contains "${dockerfile_path}" "TRANSMISSION_BUILD_JOBS=\"1\""
  assert_file_contains "${dockerfile_path}" "libevent-dev"
  assert_file_contains "${dockerfile_path}" "libminiupnpc-dev"
  assert_file_contains "${dockerfile_path}" "libnatpmp-dev"
  assert_file_contains "${dockerfile_path}" "AS transmission-build"
  assert_file_contains "${dockerfile_path}" "golang:1.27.3-trixie@sha256:"
  assert_file_contains "${dockerfile_path}" "AS control-api-test"
  assert_file_contains "${dockerfile_path}" "COPY --from=control-api-build"
  assert_file_contains "${dockerfile_path}" "COPY --from=transmission-build"
  assert_file_contains "${dockerfile_path}" "transmission-vpn-directory-controller"
  assert_file_contains "${dockerfile_path}" "-o /out/transmission-vpn-web-proxy"
  assert_file_contains \
    "${dockerfile_path}" \
    "COPY --from=control-api-build /out/transmission-vpn-web-proxy /usr/local/bin/transmission-vpn-web-proxy"
  assert_file_contains "${dockerfile_path}" "https://github.com/transmission/transmission/releases/download/"
  assert_file_contains "${dockerfile_path}" "openvpn"
  assert_file_contains "${dockerfile_path}" "wireguard-tools"
  assert_file_contains "${dockerfile_path}" "wireguard-go"
  assert_file_contains "${dockerfile_path}" "sha256sum -c"
  assert_file_contains "${dockerfile_path}" "ENTRYPOINT [\"/init\"]"
  assert_file_contains "${dockerfile_path}" "iptables"
  assert_file_contains "${dockerfile_path}" "util-linux"
  assert_file_contains "${dockerfile_path}" "PATH=\"/command:"
  assert_file_contains "${dockerfile_path}" "HEALTHCHECK"
  assert_file_contains "${dockerfile_path}" "EXPOSE 22605"

  if grep -Fq -- "alpine" "${dockerfile_path}"; then
    fail 'The container build must not depend on Alpine Linux.'
  fi

  if grep -Eq -- '^[[:space:]]*transmission-daemon([=[:space:]\\]|$)' "${dockerfile_path}"; then
    fail 'Transmission must be copied from its source-build stage, not installed as an OS package.'
  fi

  assert_file_contains \
    "${assembly_directory}/rootfs/etc/s6-overlay/s6-rc.d/control-api/run" \
    "/usr/local/bin/transmission-vpn-api"
  assert_file_contains \
    "${assembly_directory}/rootfs/etc/s6-overlay/s6-rc.d/directory-controller/run" \
    "/usr/local/bin/transmission-vpn-directory-controller"
  assert_file_contains \
    "${assembly_directory}/rootfs/usr/local/libexec/transmission-vpn/config-init.sh" \
    "--initialize-only"
  assert_file_contains \
    "${assembly_directory}/rootfs/etc/s6-overlay/s6-rc.d/vpn-controller/run" \
    "/usr/local/bin/transmission-vpn-vpn-controller"
  assert_file_contains \
    "${assembly_directory}/rootfs/etc/s6-overlay/s6-rc.d/transmission/run" \
    "/usr/local/bin/transmission-vpn-transmission-runner"
  assert_file_contains \
    "${assembly_directory}/rootfs/etc/s6-overlay/s6-rc.d/web-proxy/run" \
    "exec /command/s6-setuidgid webproxy /usr/local/bin/transmission-vpn-web-proxy"
  assert_file_contains \
    "${application_directory}/control-api/cmd/transmission-runner/main.go" \
    '"/usr/local/bin/transmission-daemon"'
  assert_file_contains \
    "${assembly_directory}/rootfs/usr/local/libexec/transmission-vpn/config-init.sh" \
    '"${runtime_directory}/transmission-config"'
  assert_file_contains \
    "${assembly_directory}/rootfs/usr/local/libexec/transmission-vpn/config-init.sh" \
    '"${runtime_directory}/transmission-state"'
  assert_file_contains \
    "${assembly_directory}/rootfs/usr/local/libexec/transmission-vpn/firewall-common.sh" \
    'firewall.interfaces'
  assert_file_contains \
    "${assembly_directory}/rootfs/usr/local/libexec/transmission-vpn/firewall-common.sh" \
    '-s "${local_address}/32" -o "${interface_name}" -j ACCEPT'
  assert_file_contains \
    "${assembly_directory}/rootfs/usr/local/libexec/transmission-vpn/firewall-common.sh" \
    '-j SNAT --to-source "${provider_address}"'
  assert_file_contains \
    "${assembly_directory}/rootfs/usr/local/libexec/transmission-vpn/firewall-common.sh" \
    'readonly source_backstop_firewall_chain="TVPN_SOURCE_BACKSTOP"'
  assert_file_contains \
    "${assembly_directory}/rootfs/usr/local/libexec/transmission-vpn/firewall-common.sh" \
    'readonly firewall_ipv6_path="/run/transmission-vpn/firewall.ipv6"'
  assert_file_contains \
    "${assembly_directory}/rootfs/usr/local/libexec/transmission-vpn/firewall-common.sh" \
    'flock -x 9'
  assert_file_contains \
    "${assembly_directory}/rootfs/usr/local/libexec/transmission-vpn/firewall-common.sh" \
    'mv -f "${temporary_path}" "${state_path}"'
  assert_file_contains \
    "${application_directory}/control-api/cmd/transmission-runner/runner.go" \
    'transmissionconfig.SlotBindAddressIPv4(entry.Slot)'
  assert_file_not_contains \
    "${application_directory}/control-api/cmd/transmission-runner/runner.go" \
    'desiredBindAddress'
  assert_file_contains \
    "${application_directory}/control-api/cmd/transmission-runner/settings.go" \
    'filepath.Join(runner.options.ConfigDirectory, entry.ConnectionID)'
  assert_file_contains \
    "${assembly_directory}/rootfs/usr/local/libexec/transmission-vpn/healthcheck.sh" \
    'transmission-state/${default_connection_id}.json'
  assert_file_contains \
    "${assembly_directory}/rootfs/usr/local/libexec/transmission-vpn/healthcheck.sh" \
    '127.0.0.1 "${rpc_port}"'
  assert_file_contains \
    "${assembly_directory}/rootfs/usr/local/libexec/transmission-vpn/healthcheck.sh" \
    '"${transmission_phase}" == "no-connections"'
}

verify_runtime_directory_ownership() {
  local config_init_path="${assembly_directory}/rootfs/usr/local/libexec/transmission-vpn/config-init.sh"
  local controller_path="${application_directory}/control-api/internal/controller/daemon.go"

  assert_file_contains \
    "${config_init_path}" \
    'install -d -m 1777 -o root -g root "${runtime_directory}/services"'

  local prepare_runtime_directory
  prepare_runtime_directory="$(sed -n \
    '/func (daemon \*Daemon) prepareRuntimeDirectory()/,/^}/p' \
    "${controller_path}")"
  if [[ "${prepare_runtime_directory}" == *'"services"'* ]]; then
    fail 'The VPN controller must not create or chmod the shared services directory.'
  fi
}

verify_firewall_variable_scopes() {
  local firewall_directory="${assembly_directory}/rootfs/usr/local/libexec/transmission-vpn"
  local firewall_scripts=(
    "${firewall_directory}/firewall-common.sh"
    "${firewall_directory}/firewall-init.sh"
    "${firewall_directory}/firewall-protect.sh"
    "${firewall_directory}/firewall-block.sh"
    "${firewall_directory}/firewall-down.sh"
    "${firewall_directory}/healthcheck.sh"
  )
  local readonly_name
  local declaring_script
  local inspected_script

  for inspected_script in "${firewall_scripts[@]:1}"; do
    assert_file_contains "${inspected_script}" 'acquire_firewall_lock'
  done

  for declaring_script in "${firewall_scripts[@]}"; do
    while IFS= read -r readonly_name; do
      for inspected_script in "${firewall_scripts[@]}"; do
        if grep -Eq \
          "^[[:space:]]*local[[:space:]]+${readonly_name}([=[:space:]]|$)" \
          "${inspected_script}"; then
          fail "Readonly firewall variable ${readonly_name} from ${declaring_script} collides with a local in ${inspected_script}."
        fi
      done
    done < <(sed -nE \
      's/^[[:space:]]*readonly[[:space:]]+([A-Za-z_][A-Za-z0-9_]*).*/\1/p' \
      "${declaring_script}")
  done
}

verify_compose_contract() {
  local compose_path="${project_directory}/compose.yml"

  assert_file_contains "${compose_path}" "NET_ADMIN"
  assert_file_contains "${compose_path}" "/dev/net/tun:/dev/net/tun"
  assert_file_contains "${compose_path}" "config:/config"
  assert_file_contains "${compose_path}" "data:/data"
  assert_file_contains "${compose_path}" '${TRANSMISSION_VPN_PROXY_PORT:-22605}:22605'

  if grep -Fq -- "init: true" "${compose_path}"; then
    fail 'Compose must allow s6-overlay to remain PID 1.'
  fi

  docker compose --file "${compose_path}" config --quiet
}

verify_service_graph() {
  local service_root="${assembly_directory}/rootfs/etc/s6-overlay/s6-rc.d"
  local user_bundle_root="${assembly_directory}/rootfs/etc/s6-overlay/user-bundles.d/user/contents.d"

  local required_files=(
    "${service_root}/config-init/dependencies.d/base"
    "${service_root}/config-init/type"
    "${service_root}/config-init/up"
    "${service_root}/control-api/dependencies.d/config-init"
    "${service_root}/control-api/dependencies.d/directory-controller"
    "${service_root}/control-api/run"
    "${service_root}/control-api/type"
    "${service_root}/directory-controller/dependencies.d/config-init"
    "${service_root}/directory-controller/finish"
    "${service_root}/directory-controller/run"
    "${service_root}/directory-controller/type"
    "${service_root}/firewall-init/dependencies.d/config-init"
    "${service_root}/firewall-init/down"
    "${service_root}/firewall-init/type"
    "${service_root}/firewall-init/up"
    "${service_root}/transmission/dependencies.d/firewall-init"
    "${service_root}/transmission/run"
    "${service_root}/transmission/type"
    "${service_root}/vpn-controller/dependencies.d/firewall-init"
    "${service_root}/vpn-controller/run"
    "${service_root}/vpn-controller/type"
    "${service_root}/web-proxy/dependencies.d/firewall-init"
    "${service_root}/web-proxy/finish"
    "${service_root}/web-proxy/run"
    "${service_root}/web-proxy/type"
    "${user_bundle_root}/control-api"
    "${user_bundle_root}/config-init"
    "${user_bundle_root}/directory-controller"
    "${user_bundle_root}/firewall-init"
    "${user_bundle_root}/transmission"
    "${user_bundle_root}/vpn-controller"
    "${user_bundle_root}/web-proxy"
  )

  local required_file

  for required_file in "${required_files[@]}"; do
    assert_file_exists "${required_file}"
  done

  assert_file_contains "${service_root}/config-init/type" "oneshot"
  assert_file_contains "${service_root}/firewall-init/type" "oneshot"
  assert_file_contains "${service_root}/control-api/type" "longrun"
  assert_file_contains "${service_root}/directory-controller/type" "longrun"
  assert_file_contains "${service_root}/transmission/type" "longrun"
  assert_file_contains "${service_root}/vpn-controller/type" "longrun"
  assert_file_contains "${service_root}/web-proxy/type" "longrun"
  assert_file_contains \
    "${service_root}/web-proxy/finish" \
    "foundation-service-finish.sh web-proxy"

  if [[ -d "${service_root}/user" ]]; then
    fail 'Deprecated s6-rc.d/user compatibility content must not be present.'
  fi
}

verify_shell_syntax() {
  local rootfs_directory="${assembly_directory}/rootfs"
  local shell_scripts=()

  while IFS= read -r -d '' shell_script; do
    shell_scripts+=("${shell_script}")
  done < <(find "${rootfs_directory}" -type f \
    \( -name '*.sh' -o -name 'run' -o -name 'finish' \) -print0)

  local shell_script

  for shell_script in "${shell_scripts[@]}"; do
    bash -n "${shell_script}"
  done
}

main() {
  verify_dockerfile
  verify_compose_contract
  verify_service_graph
  verify_runtime_directory_ownership
  verify_firewall_variable_scopes
  verify_shell_syntax

  printf 'foundation.test: container contract and s6 service graph passed.\n'
}

main "$@"
