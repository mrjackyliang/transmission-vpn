package settings

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"sort"
	"strings"
)

// ApplyImpact describes how a committed setting reaches the running appliance.
//
// API clients use this value to explain whether a change is immediate or needs
// an explicit service restart before it becomes active.
type ApplyImpact string

const (
	// ApplyImpactLive marks a setting that can be applied without a restart.
	//
	// The control plane may propagate these values directly to a running service.
	ApplyImpactLive ApplyImpact = "live"

	// ApplyImpactTransmissionRestart marks a Transmission-owned restart boundary.
	//
	// The API records these changes but waits for administrator confirmation before
	// restarting the daemon.
	ApplyImpactTransmissionRestart ApplyImpact = "transmission-restart"
)

// Definition describes one supported application setting.
//
// The registry is the single source of truth for defaults, validation, display
// metadata, and the runtime impact exposed through the versioned API.
type Definition struct {
	Key          string
	Category     string
	Title        string
	Description  string
	DefaultValue json.RawMessage
	ApplyImpact  ApplyImpact
	validate     func(json.RawMessage) (json.RawMessage, error)
	integerRange *[2]int64
}

// Registry contains every setting accepted by the control plane.
//
// Storage and HTTP layers share this registry so invalid or unknown values can
// never be committed through a different code path.
type Registry struct {
	definitions map[string]Definition
}

// NewRegistry creates the initial appliance setting contract.
//
// The first contract covers settings needed to replace the user's current
// environment-heavy deployment, including runner-owned blocklist scheduling.
//
// Since: UNRELEASED
func NewRegistry() Registry {
	definitions := []Definition{
		newStringDefinition(
			"transmission.downloadDirectory",
			"transmission.storage",
			"Download directory",
			"Completed downloads are written beneath the approved /data mount.",
			"/data/downloads",
			ApplyImpactLive,
			ValidateDownloadDataPath,
		),
		newStringDefinition(
			"transmission.incompleteDirectory",
			"transmission.storage",
			"Incomplete folder",
			"Partial downloads are kept separately beneath the /data mount.",
			"/data/incomplete",
			ApplyImpactTransmissionRestart,
			ValidateDownloadDataPath,
		),
		newBooleanDefinition(
			"transmission.incompleteDirectoryEnabled",
			"transmission.storage",
			"Use incomplete folder",
			"Transmission moves completed data out of the incomplete folder.",
			true,
			ApplyImpactLive,
		),
		newBooleanDefinition(
			"transmission.downloadQueueEnabled",
			"transmission.queue",
			"Enable download queue",
			"The daemon limits how many downloading torrents run at once.",
			true,
			ApplyImpactLive,
		),
		newIntegerDefinition(
			"transmission.downloadQueueSize",
			"transmission.queue",
			"Download queue size",
			"The maximum number of actively downloading torrents.",
			5,
			1,
			1000,
			ApplyImpactLive,
		),
		newIntegerDefinition(
			"transmission.peerLimitGlobal",
			"transmission.peers",
			"Global peer limit",
			"The maximum aggregate peer count across all torrents.",
			200,
			1,
			100000,
			ApplyImpactLive,
		),
		newBooleanDefinition(
			"transmission.peerPortRandomOnStart",
			"transmission.network",
			"Randomize peer port",
			"Transmission selects a new peer port when the daemon starts.",
			false,
			ApplyImpactTransmissionRestart,
		),
		newIntegerDefinition(
			"transmission.peerPortRandomLow",
			"transmission.network",
			"Random port low",
			"The lowest port Transmission may select when peer port randomization is enabled.",
			49152,
			1024,
			65535,
			ApplyImpactTransmissionRestart,
		),
		newIntegerDefinition(
			"transmission.peerPortRandomHigh",
			"transmission.network",
			"Random port high",
			"The highest port Transmission may select when peer port randomization is enabled.",
			65535,
			1024,
			65535,
			ApplyImpactTransmissionRestart,
		),
		newBooleanDefinition(
			"transmission.blocklistEnabled",
			"transmission.blocklists",
			"Enable blocklists",
			"Transmission rejects peers listed in any blocklist source.",
			false,
			ApplyImpactLive,
		),
		newStringListDefinition(
			"transmission.blocklistSources",
			"transmission.blocklists",
			"Blocklist sources",
			"Each HTTPS source is downloaded through the VPN and combined into Transmission's blocklist.",
			[]string{},
			ApplyImpactLive,
			validateHTTPSURLs,
		),
		newIntegerDefinition(
			"transmission.blocklistUpdateIntervalHours",
			"transmission.blocklists",
			"Update every",
			"How often each source is downloaded again.",
			24,
			1,
			168,
			ApplyImpactLive,
		),
		newBooleanDefinition(
			"rpc.compatibilityEnabled",
			"access.rpc",
			"Transmission-compatible RPC",
			"Allow third-party Transmission clients through the authenticated control port.",
			false,
			ApplyImpactLive,
		),
	}

	definitionMap := make(map[string]Definition, len(definitions))
	for _, definition := range definitions {
		definitionMap[definition.Key] = definition
	}

	return Registry{definitions: definitionMap}
}

// Definition returns metadata for one setting key.
//
// Callers use the boolean result to distinguish an unknown setting from a
// definition whose zero values happen to be valid.
func (registry Registry) Definition(key string) (Definition, bool) {
	definition, found := registry.definitions[key]

	return definition, found
}

// Definitions returns every setting in stable display order.
//
// Key order keeps most API output deterministic, while the related peer-port controls
// retain their task sequence on the Settings page.
func (registry Registry) Definitions() []Definition {
	definitions := make([]Definition, 0, len(registry.definitions))
	for _, definition := range registry.definitions {
		definitions = append(definitions, definition)
	}

	networkOrder := map[string]int{
		"transmission.peerPortRandomOnStart": 0,
		"transmission.peerPortRandomLow":     1,
		"transmission.peerPortRandomHigh":    2,
	}
	sort.Slice(definitions, func(leftIndex int, rightIndex int) bool {
		leftDefinition := definitions[leftIndex]
		rightDefinition := definitions[rightIndex]
		if leftDefinition.Category == "transmission.network" &&
			rightDefinition.Category == "transmission.network" {
			leftOrder, leftOrdered := networkOrder[leftDefinition.Key]
			rightOrder, rightOrdered := networkOrder[rightDefinition.Key]
			if leftOrdered && rightOrdered {
				return leftOrder < rightOrder
			}
			if leftOrdered != rightOrdered {
				return leftOrdered
			}
		}

		return definitions[leftIndex].Key < definitions[rightIndex].Key
	})

	return definitions
}

// Validate canonicalizes and validates one setting value.
//
// Canonical JSON makes equality checks and configuration history predictable
// while the definition-specific validator enforces the product contract.
func (registry Registry) Validate(key string, value json.RawMessage) (json.RawMessage, error) {
	definition, found := registry.Definition(key)
	if !found {
		return nil, fmt.Errorf("unknown setting: %s", key)
	}

	return definition.validate(value)
}

// IntegerBounds reports the accepted range of an integer setting.
//
// Since: UNRELEASED
func (registry Registry) IntegerBounds(key string) (int64, int64, bool) {
	definition, found := registry.Definition(key)
	if !found || definition.integerRange == nil {
		return 0, 0, false
	}

	return definition.integerRange[0], definition.integerRange[1], true
}

// ValidateStored canonicalizes a setting value under its persisted contract.
//
// Existing storage paths keep the original /data boundary during reads so a
// newly stricter write rule cannot prevent the appliance from starting.
//
// Since: UNRELEASED
func (registry Registry) ValidateStored(key string, value json.RawMessage) (json.RawMessage, error) {
	if key != "transmission.downloadDirectory" && key != "transmission.incompleteDirectory" {
		return registry.Validate(key, value)
	}

	var decodedValue string
	if err := decodeJSON(value, &decodedValue); err != nil {
		return nil, errors.New("must be a string")
	}
	if err := ValidateDataPath(decodedValue); err != nil {
		return nil, err
	}

	return json.Marshal(decodedValue)
}

// newStringDefinition constructs a validated string setting definition.
//
// The optional additional validator applies product-specific constraints after
// the JSON value has been decoded as a string.
func newStringDefinition(
	key string,
	category string,
	title string,
	description string,
	defaultValue string,
	applyImpact ApplyImpact,
	additionalValidator func(string) error,
) Definition {
	defaultJSON, _ := json.Marshal(defaultValue)

	return Definition{
		Key:          key,
		Category:     category,
		Title:        title,
		Description:  description,
		DefaultValue: defaultJSON,
		ApplyImpact:  applyImpact,
		validate: func(value json.RawMessage) (json.RawMessage, error) {
			var decodedValue string
			if err := decodeJSON(value, &decodedValue); err != nil {
				return nil, errors.New("must be a string")
			}

			if additionalValidator != nil {
				if err := additionalValidator(decodedValue); err != nil {
					return nil, err
				}
			}

			return json.Marshal(decodedValue)
		},
	}
}

// newBooleanDefinition constructs a boolean setting definition.
//
// Boolean values are decoded strictly so strings and numeric stand-ins are never
// silently accepted by managed documents or API clients.
func newBooleanDefinition(
	key string,
	category string,
	title string,
	description string,
	defaultValue bool,
	applyImpact ApplyImpact,
) Definition {
	defaultJSON, _ := json.Marshal(defaultValue)

	return Definition{
		Key:          key,
		Category:     category,
		Title:        title,
		Description:  description,
		DefaultValue: defaultJSON,
		ApplyImpact:  applyImpact,
		validate: func(value json.RawMessage) (json.RawMessage, error) {
			var decodedValue bool
			if err := decodeJSON(value, &decodedValue); err != nil {
				return nil, errors.New("must be a boolean")
			}

			return json.Marshal(decodedValue)
		},
	}
}

// newIntegerDefinition constructs a bounded integer setting definition.
//
// JSON numbers are retained as numbers and checked for an exact integer form
// before range validation is applied.
func newIntegerDefinition(
	key string,
	category string,
	title string,
	description string,
	defaultValue int64,
	minimumValue int64,
	maximumValue int64,
	applyImpact ApplyImpact,
) Definition {
	defaultJSON, _ := json.Marshal(defaultValue)

	return Definition{
		Key:          key,
		Category:     category,
		Title:        title,
		Description:  description,
		DefaultValue: defaultJSON,
		ApplyImpact:  applyImpact,
		integerRange: &[2]int64{minimumValue, maximumValue},
		validate: func(value json.RawMessage) (json.RawMessage, error) {
			var decodedValue json.Number
			if err := decodeJSONNumber(value, &decodedValue); err != nil {
				return nil, errors.New("must be an integer")
			}

			integerValue, err := decodedValue.Int64()
			if err != nil {
				return nil, errors.New("must be an integer")
			}

			if integerValue < minimumValue || integerValue > maximumValue {
				return nil, fmt.Errorf("must be between %d and %d", minimumValue, maximumValue)
			}

			return json.Marshal(integerValue)
		},
	}
}

// newNumberDefinition constructs a bounded numeric setting definition.
//
// The validator accepts integer and decimal JSON numbers while rejecting strings,
// infinities, and values outside the supported product range.
func newNumberDefinition(
	key string,
	category string,
	title string,
	description string,
	defaultValue float64,
	minimumValue float64,
	maximumValue float64,
	applyImpact ApplyImpact,
) Definition {
	defaultJSON, _ := json.Marshal(defaultValue)

	return Definition{
		Key:          key,
		Category:     category,
		Title:        title,
		Description:  description,
		DefaultValue: defaultJSON,
		ApplyImpact:  applyImpact,
		validate: func(value json.RawMessage) (json.RawMessage, error) {
			var decodedValue json.Number
			if err := decodeJSONNumber(value, &decodedValue); err != nil {
				return nil, errors.New("must be a number")
			}

			numberValue, err := decodedValue.Float64()
			if err != nil || numberValue < minimumValue || numberValue > maximumValue {
				return nil, fmt.Errorf("must be between %g and %g", minimumValue, maximumValue)
			}

			return json.Marshal(numberValue)
		},
	}
}

// newStringListDefinition constructs a validated list-of-strings definition.
//
// Values are normalized without reordering because endpoint preference and source
// ordering carry user intent.
func newStringListDefinition(
	key string,
	category string,
	title string,
	description string,
	defaultValue []string,
	applyImpact ApplyImpact,
	additionalValidator func([]string) error,
) Definition {
	defaultJSON, _ := json.Marshal(defaultValue)

	return Definition{
		Key:          key,
		Category:     category,
		Title:        title,
		Description:  description,
		DefaultValue: defaultJSON,
		ApplyImpact:  applyImpact,
		validate: func(value json.RawMessage) (json.RawMessage, error) {
			var decodedValue []string
			if err := decodeJSON(value, &decodedValue); err != nil || decodedValue == nil {
				return nil, errors.New("must be an array of strings")
			}

			if additionalValidator != nil {
				if err := additionalValidator(decodedValue); err != nil {
					return nil, err
				}
			}

			return json.Marshal(decodedValue)
		},
	}
}

// decodeJSON decodes exactly one strict JSON value into the requested target.
//
// Rejecting trailing values avoids accepting malformed configuration documents
// whose valid prefix would otherwise hide unexpected input.
func decodeJSON(value json.RawMessage, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(value))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}

	var trailingValue any
	if err := decoder.Decode(&trailingValue); !errors.Is(err, io.EOF) {
		return errors.New("contains trailing JSON data")
	}

	return nil
}

// decodeJSONNumber decodes exactly one JSON number without losing integer precision.
//
// A dedicated helper prevents the default interface decoder from converting all
// numbers to float64 before integer validation.
func decodeJSONNumber(value json.RawMessage, target *json.Number) error {
	decoder := json.NewDecoder(bytes.NewReader(value))
	decoder.UseNumber()
	if err := decoder.Decode(target); err != nil {
		return err
	}

	var trailingValue any
	if err := decoder.Decode(&trailingValue); !errors.Is(err, io.EOF) {
		return errors.New("contains trailing JSON data")
	}

	return nil
}

// ValidateDataPath confines UI-selectable storage to the approved data mount.
//
// Cleaning and prefix checks prevent path traversal into configuration, runtime,
// or operating-system locations inside the container.
func ValidateDataPath(value string) error {
	normalized, err := NormalizeDataPath(value)
	if err != nil || normalized != value {
		return errors.New("must be a normalized absolute path beneath /data")
	}

	return nil
}

// DownloadDataPathRootMessage explains why /data is not a torrent destination.
//
// API, RPC, and console validation use this wording so every client reports the
// same corrective action when the mount root is selected.
//
// Since: UNRELEASED
const DownloadDataPathRootMessage = "Choose a folder inside /data, not /data itself."

// IncompleteDownloadPathMessage explains why a torrent destination is reserved.
//
// The effective incomplete path is included because it may be renamed through
// Settings and must never be inferred from a conventional folder name.
//
// Since: UNRELEASED
func IncompleteDownloadPathMessage(incompleteDirectory string) string {
	return fmt.Sprintf(
		"Choose a folder outside the incomplete folder, %s.",
		filepath.Clean(incompleteDirectory),
	)
}

// IncompleteDirectoryDestination names one completed-download owner.
type IncompleteDirectoryDestination struct {
	Path        string
	ProfileName string
}

// IncompleteDirectoryClashMessage names the first download path a candidate contains.
//
// Settings and compatible RPC validation use this wording to point at the
// concrete folder that would become trapped beneath the incomplete directory.
//
// Since: UNRELEASED
func IncompleteDirectoryClashMessage(
	incompleteDirectory string,
	destination IncompleteDirectoryDestination,
) string {
	cleanedIncompleteDirectory := filepath.Clean(incompleteDirectory)
	cleanedDownloadDirectory := filepath.Clean(destination.Path)
	if strings.EqualFold(cleanedIncompleteDirectory, cleanedDownloadDirectory) {
		return fmt.Sprintf(
			"“%s” is the %s's folder, so it can't be the incomplete folder.",
			filepath.Base(cleanedDownloadDirectory),
			destination.ProfileName,
		)
	}

	return fmt.Sprintf(
		"Use a folder outside %s. Torrents in the %s finish there.",
		cleanedDownloadDirectory,
		destination.ProfileName,
	)
}

// ValidateDownloadDataPath requires a torrent destination below the data root.
//
// Browsing, folder creation, and free-space checks retain ValidateDataPath while
// every operation that writes torrent data uses this stricter boundary.
//
// Since: UNRELEASED
func ValidateDownloadDataPath(value string) error {
	if err := ValidateDataPath(value); err != nil {
		return err
	}
	if value == "/data" {
		return errors.New(DownloadDataPathRootMessage)
	}

	return nil
}

// DataPathContains reports whether one cleaned path contains another path.
//
// filepath.Rel compares path segments, so similarly prefixed siblings such as
// /data/incomplete and /data/incomplete-old remain distinct.
//
// Since: UNRELEASED
func DataPathContains(parentPath string, candidatePath string) bool {
	cleanedParentPath := filepath.Clean(parentPath)
	cleanedCandidatePath := filepath.Clean(candidatePath)
	relativePath, err := filepath.Rel(cleanedParentPath, cleanedCandidatePath)
	if err != nil {
		return false
	}

	return relativePath == "." ||
		(relativePath != ".." && !strings.HasPrefix(relativePath, ".."+string(filepath.Separator)))
}

// ValidateDownloadDataPathOutsideIncomplete reserves unfinished-download storage.
//
// Every torrent destination uses this check after the caller resolves the
// effective incomplete-directory setting.
//
// Since: UNRELEASED
func ValidateDownloadDataPathOutsideIncomplete(
	value string,
	incompleteDirectory string,
) error {
	if err := ValidateDownloadDataPath(value); err != nil {
		return err
	}
	if DataPathContains(incompleteDirectory, value) {
		return errors.New(IncompleteDownloadPathMessage(incompleteDirectory))
	}

	return nil
}

// ValidateIncompleteDataPath keeps completed-download folders outside a candidate.
//
// Callers order downloadPaths by precedence so the returned error consistently
// names the first Download setting, profile, or saved-location clash.
//
// Since: UNRELEASED
func ValidateIncompleteDataPath(
	value string,
	destinations []IncompleteDirectoryDestination,
) error {
	if err := ValidateDownloadDataPath(value); err != nil {
		return err
	}

	for _, destination := range destinations {
		if DataPathContains(value, destination.Path) {
			return errors.New(IncompleteDirectoryClashMessage(value, destination))
		}
	}

	return nil
}

// NormalizeDataPath removes harmless trailing slashes before enforcing /data.
//
// Interior traversal, relative paths, and every other filesystem root remain invalid.
func NormalizeDataPath(value string) (string, error) {
	if value != "/" {
		value = strings.TrimRight(value, "/")
	}
	cleanedValue := filepath.Clean(value)
	if cleanedValue != value || (value != "/data" && !strings.HasPrefix(value, "/data/")) {
		return "", errors.New("must be a normalized absolute path beneath /data")
	}

	return value, nil
}

// validateHTTPSURLs restricts blocklist sources to non-credentialed HTTPS URLs.
//
// The downloader performs additional response validation; this first boundary
// rejects unsafe schemes and obvious credential leakage before persistence.
func validateHTTPSURLs(values []string) error {
	if len(values) > 20 {
		return errors.New("must contain no more than 20 sources")
	}

	for _, value := range values {
		if !strings.HasPrefix(value, "https://") || strings.Contains(value, "@") {
			return errors.New("every source must be an HTTPS URL without embedded credentials")
		}
	}

	return nil
}
