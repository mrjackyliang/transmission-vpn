#!/command/with-contenv bash
set -euo pipefail

readonly service_name="${1}"
readonly marker_path="/run/transmission-vpn/services/${service_name}.ready"

rm -f "${marker_path}"
