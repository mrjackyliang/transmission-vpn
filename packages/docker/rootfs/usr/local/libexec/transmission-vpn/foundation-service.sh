#!/command/with-contenv bash
set -euo pipefail

readonly service_name="${1}"

case "${service_name}" in
  "control-api" | "transmission" | "vpn-controller")
    ;;

  *)
    printf 'foundation-service: unsupported service name: %s\n' "${service_name}" >&2

    exit 1
    ;;
esac

readonly marker_path="/run/transmission-vpn/services/${service_name}.ready"

printf '{"service":"%s","phase":"foundation"}\n' "${service_name}" > "${marker_path}"
printf '%s: foundation supervisor is active; product implementation is pending.\n' \
  "${service_name}"

exec /command/s6-pause
