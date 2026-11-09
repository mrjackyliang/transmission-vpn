# Picks the newest stable release of the Transmission series in $series from GitHub's
# release list, and prints it as shell assignments with the SHA-256 digest GitHub
# publishes for its source archive. The Transmission build stage reads them.

def version_numbers: split(".") | map(tonumber);

if ($series | test("^[0-9]+[.][0-9]+$") | not) then
  error("The Transmission series must look like 4.1, not \($series).")
elif ($series | version_numbers) < [4, 1] then
  error("Transmission \($series) is too old. Trackers ban 4.0.6 for its bugs and ask for 4.1.0 or newer.")
else
  [
    .[]
    | select(.draft == false and .prerelease == false)
    | select(.tag_name | test("^" + ($series | gsub("[.]"; "[.]")) + "[.][0-9]+$"))
  ]
  | max_by(.tag_name | version_numbers)
  | if . == null then error("No Transmission \($series) release was found.") else . end
  | .tag_name as $version
  | [.assets[] | select(.name == "transmission-\($version).tar.xz") | .digest // ""][0] // ""
  | if (test("^sha256:[0-9a-f]{64}$") | not) then
      error("Transmission \($version) has no SHA-256 digest for its source archive.")
    else
      "TRANSMISSION_VERSION=\($version)", "TRANSMISSION_SHA256=\(ltrimstr("sha256:"))"
    end
end
