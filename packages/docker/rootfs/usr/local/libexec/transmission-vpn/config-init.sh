#!/command/with-contenv bash
set -euo pipefail

readonly control_user="control"
readonly transmission_user="transmission"
readonly web_proxy_user="webproxy"
readonly runtime_directory="/run/transmission-vpn"

fail() {
  local message="${1}"

  printf 'config-init: %s\n' "${message}" >&2

  return 1
}

validate_identifier() {
  local variable_name="${1}"
  local variable_value="${2}"

  if [[ ! "${variable_value}" =~ ^[0-9]+$ ]]; then
    fail "${variable_name} must be an integer between 1000 and 60000."
  fi

  if [[ "${variable_value}" -lt 1000 || "${variable_value}" -gt 60000 ]]; then
    fail "${variable_name} must be between 1000 and 60000."
  fi
}

validate_identity_is_available() {
  local existing_user
  existing_user="$(awk -F: \
    -v requested_id="${PUID}" \
    -v transmission_user="${transmission_user}" \
    -v control_user="${control_user}" \
    '$3 == requested_id && $1 != transmission_user && $1 != control_user { print $1; exit }' \
    /etc/passwd)"

  if [[ -n "${existing_user}" ]]; then
    fail "PUID ${PUID} is already assigned to user ${existing_user}."
  fi

  local existing_group
  existing_group="$(awk -F: -v requested_id="${PGID}" '$3 == requested_id { print $1; exit }' /etc/group)"

  if [[ -n "${existing_group}" && "${existing_group}" != "${transmission_user}" ]]; then
    fail "PGID ${PGID} is already assigned to group ${existing_group}."
  fi
}

configure_identity() {
  local current_group_id
  current_group_id="$(id -g "${transmission_user}")"

  if [[ "${current_group_id}" != "${PGID}" ]]; then
    groupmod -g "${PGID}" "${transmission_user}"
  fi

  local current_user_id
  current_user_id="$(id -u "${transmission_user}")"

  if [[ "${current_user_id}" != "${PUID}" ]]; then
    usermod -u "${PUID}" "${transmission_user}"
  fi

  # The console runs as PUID too, so it owns its state like every other service. Hosts
  # such as Synology shared folders ignore group permissions, so only the owner can
  # always write. The console keeps its own group, which opens the VPN controller's
  # sockets to it and not to Transmission, and which stops Transmission from tracing it.
  local current_control_user_id
  current_control_user_id="$(id -u "${control_user}")"

  if [[ "${current_control_user_id}" != "${PUID}" ]]; then
    usermod -o -u "${PUID}" "${control_user}"
  fi
}

configure_timezone() {
  if [[ ! "${TZ}" =~ ^[A-Za-z0-9._+-]+(/[A-Za-z0-9._+-]+)*$ ]]; then
    fail "TZ contains unsupported characters."
  fi

  local zoneinfo_path="/usr/share/zoneinfo/${TZ}"

  if [[ ! -f "${zoneinfo_path}" ]]; then
    fail "TZ does not identify an installed timezone: ${TZ}."
  fi

  ln -snf "${zoneinfo_path}" /etc/localtime
  printf '%s\n' "${TZ}" > /etc/timezone
}

prepare_mount_root() {
  local mount_path="${1}"

  if [[ ! -d "${mount_path}" ]]; then
    fail "Required mount path is missing: ${mount_path}."
  fi

  local owner_user_id
  owner_user_id="$(stat -c '%u' "${mount_path}")"

  local owner_group_id
  owner_group_id="$(stat -c '%g' "${mount_path}")"

  if [[ "${owner_user_id}" == "0" && "${owner_group_id}" == "0" ]]; then
    chown "${transmission_user}:${transmission_user}" "${mount_path}"
  fi
}

assert_writable_by() {
  local user_name="${1}"
  local directory_path="${2}"

  if ! /command/s6-setuidgid "${user_name}" /bin/sh -c 'test -w "$1"' sh "${directory_path}"; then
    fail "${directory_path} is not writable by ${user_name}."
  fi
}

assert_searchable_by() {
  local user_name="${1}"
  local directory_path="${2}"

  if ! /command/s6-setuidgid "${user_name}" /bin/sh -c 'test -x "$1"' sh "${directory_path}"; then
    fail "${directory_path} is not searchable by ${user_name}."
  fi
}

prepare_persistent_state() {
  local directory_path="${1}"

  # Every persistent folder belongs to PUID:PGID, the account that every service writing
  # here runs as. The setgid bit keeps new files in PGID for host tools that use it.
  install -d -m 2770 -o "${transmission_user}" -g "${transmission_user}" "${directory_path}"

  chown -R -h "${transmission_user}:${transmission_user}" "${directory_path}"
  find "${directory_path}" -type d -exec chmod 2770 {} +
  find "${directory_path}" -type f -exec chmod 0660 {} +
}

prepare_directories() {
  prepare_mount_root "/config"
  prepare_mount_root "/data"

  prepare_persistent_state /config/app
  install -d -m 2770 -o "${transmission_user}" -g "${transmission_user}" /config/app/keys
  install -d -m 0750 -o "${transmission_user}" -g "${transmission_user}" /config/transmission
  prepare_persistent_state /config/vpn
  install -d -m 0755 -o root -g root "${runtime_directory}"
  install -d -m 2750 -o "${transmission_user}" -g "${control_user}" "${runtime_directory}/directories"
  install -d -m 1777 -o root -g root "${runtime_directory}/services"
  install -d -m 2750 -o "${control_user}" -g "${transmission_user}" "${runtime_directory}/transmission-config"
  install -d -m 2750 -o "${transmission_user}" -g "${control_user}" "${runtime_directory}/transmission-state"
  install -d -m 2750 -o "${control_user}" -g "${web_proxy_user}" "${runtime_directory}/web-proxy"
  install -d -m 2750 -o "${web_proxy_user}" -g "${control_user}" "${runtime_directory}/web-proxy-state"

  assert_writable_by "${control_user}" "/config/app"
  assert_writable_by "${control_user}" "/config/app/keys"
  assert_writable_by "${transmission_user}" "${runtime_directory}/directories"
  assert_searchable_by "${control_user}" "${runtime_directory}/directories"
  assert_writable_by "${control_user}" "${runtime_directory}/web-proxy"
  assert_searchable_by "${web_proxy_user}" "${runtime_directory}/web-proxy"
  assert_writable_by "${web_proxy_user}" "${runtime_directory}/web-proxy-state"
  assert_searchable_by "${control_user}" "${runtime_directory}/web-proxy-state"
  assert_writable_by "${control_user}" "${runtime_directory}/transmission-config"
  assert_searchable_by "${transmission_user}" "${runtime_directory}/transmission-config"
  assert_writable_by "${transmission_user}" "${runtime_directory}/transmission-state"
  assert_searchable_by "${control_user}" "${runtime_directory}/transmission-state"
  assert_writable_by "${transmission_user}" "/config/transmission"
  assert_writable_by "${transmission_user}" "/data"
}

initialize_control_state() {
  if ! /command/s6-setuidgid "${control_user}" \
    /usr/local/bin/transmission-vpn-api \
    --initialize-only; then
    fail 'The control-plane database or managed configuration could not be initialized.'
  fi
}

main() {
  validate_identifier "PUID" "${PUID}"
  validate_identifier "PGID" "${PGID}"
  validate_identity_is_available
  configure_identity
  configure_timezone

  if [[ ! -c /dev/net/tun ]]; then
    fail 'The TUN device is unavailable. Start the container with --device=/dev/net/tun.'
  fi

  prepare_directories
  initialize_control_state

  printf '{"puid":%s,"pgid":%s,"timezone":"%s"}\n' \
    "${PUID}" \
    "${PGID}" \
    "${TZ}" > "${runtime_directory}/config.ready"

  printf 'config-init: runtime identity %s:%s and persistent paths are ready.\n' \
    "${PUID}" \
    "${PGID}"
}

main "$@"
