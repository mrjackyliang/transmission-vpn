/**
 * Regex - Administrator Username Pattern.
 *
 * Matches the 3 to 64 character username the mock console accepts for a new
 * administrator, starting with a letter or number.
 *
 * @since 2.4.1
 */
export const administratorUsernamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/;

/**
 * Regex - Backup Import Path Pattern.
 *
 * Captures the import ID from a mock backup import route.
 * The ID stops at the next slash.
 *
 * @since 2.4.1
 */
export const backupImportPathPattern = /^\/api\/v1\/backup\/imports\/([^/]+)$/;

/**
 * Regex - Backup Info Hash Pattern.
 *
 * Matches a 40 or 64 character hexadecimal torrent info hash inside a backup
 * file.
 *
 * @since 2.4.1
 */
export const backupInfoHashPattern = /^(?:[a-f\d]{40}|[a-f\d]{64})$/;

/**
 * Regex - Bare Filename Pattern.
 *
 * Captures an unquoted filename from a download response header when the
 * server sends no quoted or encoded name.
 *
 * @since 2.4.1
 */
export const bareFilenamePattern = /filename=([^;]+)/;

/**
 * Regex - Base64 Padding Pattern.
 *
 * Matches the trailing padding that Base64URL encoding drops from WebAuthn
 * credential fields.
 *
 * @since 2.4.1
 */
export const base64PaddingPattern = /=+$/;

/**
 * Regex - Connection Refused Pattern.
 *
 * Matches a refused connection in a raw network error, so the mock console
 * can describe the failure in plain words.
 *
 * @since 2.4.1
 */
export const connectionRefusedPattern = /connection refused/;

/**
 * Regex - Content Disposition Filename Pattern.
 *
 * Captures the quoted filename from a download response header, so a saved
 * export keeps the name the server chose.
 *
 * @since 2.4.1
 */
export const contentDispositionFilenamePattern = /filename="([^"]+)"/;

/**
 * Regex - Content Download Path Pattern.
 *
 * Captures the download token from a mock torrent contents route.
 * Tokens start with a fixed prefix.
 *
 * @since 2.4.1
 */
export const contentDownloadPathPattern = /^\/api\/v1\/torrents\/contents\/(tvdl_[\w-]+)$/;

/**
 * Regex - Custom Profile Reference Pattern.
 *
 * Matches a custom VPN profile reference inside an error message, which is
 * replaced with plain words before the message is shown.
 *
 * @since 2.4.1
 */
export const customProfileReferencePattern = /\bcustom:[A-Za-z0-9._:-]+\b/;

/**
 * Regex - Digit Pattern.
 *
 * Matches one digit when the password meter checks which character groups a
 * password uses.
 *
 * @since 2.4.1
 */
export const digitPattern = /\d/;

/**
 * Regex - Dotted Hostname Pattern.
 *
 * Matches a hostname made only of digits and dots, which marks an IPv4
 * address that passkeys cannot use as a relying party.
 *
 * @since 2.4.1
 */
export const dottedHostnamePattern = /^[\d.]+$/;

/**
 * Regex - Edge Hyphens Pattern.
 *
 * Matches a hyphen at the start or end of a slug, so generated endpoint names
 * never begin or end with one.
 *
 * @since 2.4.1
 */
export const edgeHyphensPattern = /^-|-$/;

/**
 * Regex - Edge Spaces And Dots Pattern.
 *
 * Matches spaces and dots at the start or end of a file name, which are
 * trimmed before the name is used in a download.
 *
 * @since 2.4.1
 */
export const edgeSpacesAndDotsPattern = /^[ .]+|[ .]+$/;

/**
 * Regex - Encoded Filename Pattern.
 *
 * Captures the percent-encoded UTF-8 filename from a download response header.
 * It takes priority over the plain filename.
 *
 * @since 2.4.1
 */
export const encodedFilenamePattern = /filename\*=utf-8''([^;]+)/;

/**
 * Regex - Escaped Character Pattern.
 *
 * Captures the character after a backslash, so escaped characters in a quoted
 * filename can be restored.
 *
 * @since 2.4.1
 */
export const escapedCharacterPattern = /\\(.)/;

/**
 * Regex - Exit Status Pattern.
 *
 * Matches a process exit status inside an error message, which is replaced
 * with plain words before the message is shown.
 *
 * @since 2.4.1
 */
export const exitStatusPattern = /\bexit status \d+\b/;

/**
 * Regex - File Extension Pattern.
 *
 * Matches a short file extension at the end of an uploaded file name, so the
 * mock console can keep it on the stored copy.
 *
 * @since 2.4.1
 */
export const fileExtensionPattern = /\.[^./]{1,16}$/;

/**
 * Regex - Header Quote Characters Pattern.
 *
 * Matches a double quote or backslash in a file name, which must be escaped
 * inside a quoted header value.
 *
 * @since 2.4.1
 */
export const headerQuoteCharactersPattern = /["\\]/;

/**
 * Regex - Info Hash Pattern.
 *
 * Matches a 40 character lowercase hexadecimal torrent info hash returned by
 * the API.
 *
 * @since 2.4.1
 */
export const infoHashPattern = /^[0-9a-f]{40}$/;

/**
 * Regex - Invalid Number Pattern.
 *
 * Matches the validator's message for a value that is not a number, which is
 * replaced with a shorter hint.
 *
 * @since 2.4.1
 */
export const invalidNumberPattern = /^Invalid input: expected number, received .+$/;

/**
 * Regex - Iso Timestamp Pattern.
 *
 * Matches an ISO 8601 date and time with seconds, optional fractions, and a
 * required UTC or offset zone.
 *
 * @since 2.4.1
 */
export const isoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Regex - Line Break Pattern.
 *
 * Matches a line break with or without a carriage return, so pasted links can
 * be split one per line.
 *
 * @since 2.4.1
 */
export const lineBreakPattern = /\r?\n/;

/**
 * Regex - Login Username Pattern.
 *
 * Matches the 1 to 64 character username the mock console accepts for an RPC
 * or proxy login.
 *
 * @since 2.4.1
 */
export const loginUsernamePattern = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Regex - Lookup Host Pattern.
 *
 * Captures the host name from a failed DNS lookup in a raw network error.
 * The mock console names that host in its message.
 *
 * @since 2.4.1
 */
export const lookupHostPattern = /lookup\s+([^\s:]+)/;

/**
 * Regex - Lowercase Letter Pattern.
 *
 * Matches one lowercase letter when the password meter checks which character
 * groups a password uses.
 *
 * @since 2.4.1
 */
export const lowercaseLetterPattern = /[a-z]/;

/**
 * Regex - Magnet Info Hash Pattern.
 *
 * Matches the BitTorrent info hash part of a magnet link.
 * The mock console reads it from the link's exact topic.
 *
 * @since 2.4.1
 */
export const magnetInfoHashPattern = /^urn:btih:[0-9a-f]{40}$/;

/**
 * Regex - Non Digit Pattern.
 *
 * Matches one character that is not a digit, so code fields can strip
 * everything except the numbers a person typed or pasted.
 *
 * @since 2.4.1
 */
export const nonDigitPattern = /\D/;

/**
 * Regex - Non Slug Characters Pattern.
 *
 * Matches a run of characters that are not lowercase letters or digits, which
 * become one hyphen in a generated slug.
 *
 * @since 2.4.1
 */
export const nonSlugCharactersPattern = /[^a-z0-9]+/;

/**
 * Regex - Notification Path Pattern.
 *
 * Captures the notification ID and the optional test suffix from a mock
 * notification route.
 *
 * @since 2.4.1
 */
export const notificationPathPattern = /^\/api\/v1\/notifications\/(ntf-[0-9a-f]{16})(\/test)?$/;

/**
 * Regex - Open Vpn Remote Pattern.
 *
 * Captures the host, optional port, and optional protocol from each remote
 * line of an OpenVPN profile.
 *
 * @since 2.4.1
 */
export const openVpnRemotePattern = /^\s*remote\s+(\S+)(?:\s+(\d+))?(?:\s+(\S+))?\s*$/;

/**
 * Regex - Open Vpn TCP Pattern.
 *
 * Matches a proto line that selects TCP in an OpenVPN profile.
 * Profiles without one use UDP.
 *
 * @since 2.4.1
 */
export const openVpnTcpPattern = /^\s*proto\s+tcp/;

/**
 * Regex - Printable Ascii Pattern.
 *
 * Matches a file name made only of printable ASCII characters, which can be
 * sent in a plain quoted header value.
 *
 * @since 2.4.1
 */
export const printableAsciiPattern = /^[ -~]*$/;

/**
 * Regex - Profile Extension Pattern.
 *
 * Captures a .conf or .ovpn extension at the end of a VPN profile name.
 * The extension is dropped from the display name.
 *
 * @since 2.4.1
 */
export const profileExtensionPattern = /\.(conf|ovpn)$/;

/**
 * Regex - Proxy Logins Hint Pattern.
 *
 * Matches the empty-state hint for web proxy logins, so tests can count how
 * often it renders.
 *
 * @since 2.4.1
 */
export const proxyLoginsHintPattern = /Add a login before anyone can use the proxy\./;

/**
 * Regex - Quoted Filename Pattern.
 *
 * Captures a quoted filename that may contain escaped characters from a
 * download response header.
 *
 * @since 2.4.1
 */
export const quotedFilenamePattern = /filename="((?:[^"\\]|\\.)*)"/;

/**
 * Regex - Rpc Login Path Pattern.
 *
 * Captures the login ID from a mock RPC login route.
 * The ID stops at the next slash.
 *
 * @since 2.4.1
 */
export const rpcLoginPathPattern = /^\/api\/v1\/rpc\/logins\/([^/]+)$/;

/**
 * Regex - Rpc Logins Hint Pattern.
 *
 * Matches the empty-state hint for RPC logins, so tests can count how often it
 * renders.
 *
 * @since 2.4.1
 */
export const rpcLoginsHintPattern = /Add a login before remote apps can sign in\./;

/**
 * Regex - Safe Name Pattern.
 *
 * Matches a name made only of letters, numbers, periods, underscores, and
 * hyphens.
 *
 * @since 2.4.1
 */
export const safeNamePattern = /^[A-Za-z0-9._-]+$/;

/**
 * Regex - Separators Pattern.
 *
 * Matches one whitespace character or hyphen, so a typed code can be compared
 * without its grouping.
 *
 * @since 2.4.1
 */
export const separatorsPattern = /[\s-]/;

/**
 * Regex - Setting Key Pattern.
 *
 * Matches an internal setting key inside an error message, which is replaced
 * with plain words before the message is shown.
 *
 * @since 2.4.1
 */
export const settingKeyPattern = /\b(?:rpc|transmission|vpn)\.[A-Za-z0-9.]+\b/;

/**
 * Regex - Six Digit Code Pattern.
 *
 * Matches the six digit code an authenticator app shows.
 * The mock console checks typed codes against it.
 *
 * @since 2.4.1
 */
export const sixDigitCodePattern = /^\d{6}$/;

/**
 * Regex - Symbol Pattern.
 *
 * Matches one character that is neither a letter nor a digit when the password
 * meter checks which character groups a password uses.
 *
 * @since 2.4.1
 */
export const symbolPattern = /[^a-zA-Z\d]/;

/**
 * Regex - Timeout Pattern.
 *
 * Matches a timed-out request in a raw network error, so the mock console can
 * describe the failure in plain words.
 *
 * @since 2.4.1
 */
export const timeoutPattern = /context deadline exceeded|i\/o timeout|timed out/;

/**
 * Regex - TLS Error Pattern.
 *
 * Matches a TLS or certificate problem in a raw network error, so the mock
 * console can describe the failure in plain words.
 *
 * @since 2.4.1
 */
export const tlsErrorPattern = /tls:|x509:|certificate/;

/**
 * Regex - Too Big Number Pattern.
 *
 * Captures the maximum from the validator's message for a number that is too
 * big, which is replaced with a shorter hint.
 *
 * @since 2.4.1
 */
export const tooBigNumberPattern = /^Too big: expected number to be <=\s*([\d.]+)$/;

/**
 * Regex - Too Small Number Pattern.
 *
 * Captures the minimum from the validator's message for a number that is too
 * small, which is replaced with a shorter hint.
 *
 * @since 2.4.1
 */
export const tooSmallNumberPattern = /^Too small: expected number to be >=\s*([\d.]+)$/;

/**
 * Regex - Torrent Detail Path Pattern.
 *
 * Captures the numeric torrent ID from a mock torrent detail route.
 * Other torrent routes do not match.
 *
 * @since 2.4.1
 */
export const torrentDetailPathPattern = /^\/api\/v1\/torrents\/(\d+)$/;

/**
 * Regex - Torrent Extension Pattern.
 *
 * Matches the .torrent extension at the end of a file name, which is dropped
 * when the name is shown or reused.
 *
 * @since 2.4.1
 */
export const torrentExtensionPattern = /\.torrent$/;

/**
 * Regex - Torrent Profile ID Pattern.
 *
 * Matches the fixed prefix and hexadecimal body of a torrent profile ID.
 * Anything else is rejected.
 *
 * @since 2.4.1
 */
export const torrentProfileIdPattern = /^tpr-[0-9a-f]{16}$/;

/**
 * Regex - Torrent Profile Path Pattern.
 *
 * Captures the profile ID from a mock torrent profile route.
 * The ID stops at the next slash.
 *
 * @since 2.4.1
 */
export const torrentProfilePathPattern = /^\/api\/v1\/torrent-profiles\/([^/]+)$/;

/**
 * Regex - Trailing Slashes Pattern.
 *
 * Matches one or more slashes at the end of a path, so folder paths can be
 * compared without them.
 *
 * @since 2.4.1
 */
export const trailingSlashesPattern = /\/+$/;

/**
 * Regex - Transport Host Pattern.
 *
 * Captures the host from a failed TCP dial or read in a raw network error.
 * The mock console names that host in its message.
 *
 * @since 2.4.1
 */
export const transportHostPattern = /(?:dial|read) tcp\s+\[?([^\]\s:]+)\]?(?::\d+)?/;

/**
 * Regex - Unknown Host Pattern.
 *
 * Matches a failed name lookup in a raw network error, so the mock console can
 * describe the failure in plain words.
 *
 * @since 2.4.1
 */
export const unknownHostPattern = /no such host|name or service not known|temporary failure in name resolution/;

/**
 * Regex - Uppercase Letter Pattern.
 *
 * Matches one uppercase letter when the password meter checks which character
 * groups a password uses.
 *
 * @since 2.4.1
 */
export const uppercaseLetterPattern = /[A-Z]/;

/**
 * Regex - Vpn Catalog Refresh Path Pattern.
 *
 * Captures the provider and tunnel type from a mock route that refreshes a
 * VPN provider's server catalog.
 *
 * @since 2.4.1
 */
export const vpnCatalogRefreshPathPattern = /^\/api\/v1\/vpn\/providers\/([^/]+)\/tunnels\/(openvpn|wireguard)\/catalog\/refresh$/;

/**
 * Regex - Vpn Connection Path Pattern.
 *
 * Captures the connection ID and the optional reconnect or disconnect action
 * from a mock VPN connection route.
 *
 * @since 2.4.1
 */
export const vpnConnectionPathPattern = /^\/api\/v1\/vpn\/connections\/([^/]+)(?:\/(reconnect|disconnect))?$/;

/**
 * Regex - Web Proxy Login Path Pattern.
 *
 * Captures the login ID from a mock web proxy login route.
 * The ID stops at the next slash.
 *
 * @since 2.4.1
 */
export const webProxyLoginPathPattern = /^\/api\/v1\/web-proxy\/logins\/([^/]+)$/;

/**
 * Regex - Whitespace Pattern.
 *
 * Matches a run of whitespace, so a copied setup key can be compared without
 * the spaces that group it on screen.
 *
 * @since 2.4.1
 */
export const whitespacePattern = /\s+/;

/**
 * Regex - Wire Guard Endpoint Pattern.
 *
 * Captures the host and port from the Endpoint line of a WireGuard profile.
 * Only the first such line is read.
 *
 * @since 2.4.1
 */
export const wireGuardEndpointPattern = /^\s*endpoint\s*=\s*([^\s:]+):(\d+)/;

/**
 * Regex - Wire Guard Interface Pattern.
 *
 * Matches the [Interface] section header that marks a profile as WireGuard
 * rather than OpenVPN.
 *
 * @since 2.4.1
 */
export const wireGuardInterfacePattern = /^\s*\[interface\]\s*$/;

/**
 * Regex - Wire Guard Public Key Pattern.
 *
 * Matches a 44 character Base64 WireGuard key ending in one padding sign.
 * Anything else is rejected by the form.
 *
 * @since 2.4.1
 */
export const wireGuardPublicKeyPattern = /^[A-Za-z0-9+/]{43}=$/;

/**
 * Regex - Year Pattern.
 *
 * Matches a four digit year from 1900 to 2099, which the password meter treats
 * as a guessable pattern.
 *
 * @since 2.4.1
 */
export const yearPattern = /(?:19|20)\d\d/;
