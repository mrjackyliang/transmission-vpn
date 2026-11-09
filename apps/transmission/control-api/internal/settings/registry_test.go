package settings

import (
	"encoding/json"
	"os"
	"slices"
	"testing"
)

// TestRegistryDefaultsValidate verifies every shipped default against its own contract.
//
// A default rejected by the running registry would make a fresh installation
// impossible to represent before any user setting exists.
func TestRegistryDefaultsValidate(testingObject *testing.T) {
	registry := NewRegistry()

	for _, definition := range registry.Definitions() {
		testingObject.Run(definition.Key, func(testingObject *testing.T) {
			validatedValue, err := registry.Validate(definition.Key, definition.DefaultValue)
			if err != nil {
				testingObject.Fatalf("default was rejected: %v", err)
			}

			if !json.Valid(validatedValue) {
				testingObject.Fatalf("validated value is not JSON: %s", validatedValue)
			}
		})
	}
}

// TestRegistryRetiresPerTorrentSessionDefaults keeps profiles authoritative.
func TestRegistryRetiresPerTorrentSessionDefaults(testingObject *testing.T) {
	registry := NewRegistry()
	for _, key := range []string{
		"transmission.ratioLimitEnabled",
		"transmission.ratioLimit",
		"transmission.peerLimitPerTorrent",
	} {
		if _, found := registry.Definition(key); found {
			testingObject.Fatalf("retired setting %s is still registered", key)
		}
		if _, err := registry.Validate(key, json.RawMessage(`1`)); err == nil {
			testingObject.Fatalf("retired setting %s was accepted", key)
		}
	}
}

// TestBlocklistIntervalMetadata verifies the runner-owned scheduling contract.
//
// The setting is live, defaults to one day, and is presented with the exact source
// descriptions used by API and mock clients.
//
// Since: UNRELEASED
func TestBlocklistIntervalMetadata(testingObject *testing.T) {
	registry := NewRegistry()
	interval, found := registry.Definition("transmission.blocklistUpdateIntervalHours")
	if !found || string(interval.DefaultValue) != "24" || interval.ApplyImpact != ApplyImpactLive ||
		interval.Title != "Update every" ||
		interval.Description != "How often each source is downloaded again." {
		testingObject.Fatalf("blocklist interval definition = %#v, found %t", interval, found)
	}
	enabled, _ := registry.Definition("transmission.blocklistEnabled")
	sources, _ := registry.Definition("transmission.blocklistSources")
	if enabled.Description != "Transmission rejects peers listed in any blocklist source." ||
		sources.Description != "Each HTTPS source is downloaded through the VPN and combined into Transmission's blocklist." {
		testingObject.Fatalf("blocklist descriptions = %q / %q", enabled.Description, sources.Description)
	}
}

// TestRegistryRejectsUnsafeValues exercises high-risk path and network settings.
//
// These cases ensure UI configuration cannot escape the data mount or add an
// insecure blocklist source, and that merger intervals remain within their bounds.
//
// Since: UNRELEASED
func TestRegistryRejectsUnsafeValues(testingObject *testing.T) {
	registry := NewRegistry()
	testCases := []struct {
		Name  string
		Key   string
		Value string
	}{
		{
			Name:  "storage traversal",
			Key:   "transmission.downloadDirectory",
			Value: `"/data/../config"`,
		},
		{
			Name:  "insecure blocklist",
			Key:   "transmission.blocklistSources",
			Value: `["http://example.invalid/list"]`,
		},
		{
			Name:  "short blocklist interval",
			Key:   "transmission.blocklistUpdateIntervalHours",
			Value: `0`,
		},
		{
			Name:  "long blocklist interval",
			Key:   "transmission.blocklistUpdateIntervalHours",
			Value: `169`,
		},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.Name, func(testingObject *testing.T) {
			if _, err := registry.Validate(testCase.Key, json.RawMessage(testCase.Value)); err == nil {
				testingObject.Fatal("unsafe value was accepted")
			}
		})
	}
}

// TestDownloadDataPathRequiresAChildFolder preserves the browsing boundary.
//
// The mount root remains valid for lenient operations and persisted reads while
// destination writes reject it with the shared client-facing message.
//
// Since: UNRELEASED
func TestDownloadDataPathRequiresAChildFolder(testingObject *testing.T) {
	if err := ValidateDataPath("/data"); err != nil {
		testingObject.Fatalf("lenient /data validation error = %v", err)
	}

	err := ValidateDownloadDataPath("/data")
	if err == nil || err.Error() != "Choose a folder inside /data, not /data itself." {
		testingObject.Fatalf("strict /data validation error = %v", err)
	}

	registry := NewRegistry()
	for _, key := range []string{
		"transmission.downloadDirectory",
		"transmission.incompleteDirectory",
	} {
		if _, err := registry.Validate(key, json.RawMessage(`"/data"`)); err == nil ||
			err.Error() != "Choose a folder inside /data, not /data itself." {
			testingObject.Fatalf("%s write validation error = %v", key, err)
		}
		if value, err := registry.ValidateStored(key, json.RawMessage(`"/data"`)); err != nil ||
			string(value) != `"/data"` {
			testingObject.Fatalf("%s stored validation = %s, %v", key, value, err)
		}
	}
}

// TestIncompleteDirectoryPathRelationships preserves segment-aware storage boundaries.
//
// Descendants of the incomplete folder are reserved, similarly prefixed siblings
// remain valid, and an incomplete folder may sit beneath a download folder.
//
// Since: UNRELEASED
func TestIncompleteDirectoryPathRelationships(testingObject *testing.T) {
	incompleteDirectory := "/data/incomplete"
	for _, rejectedPath := range []string{
		"/data/incomplete",
		"/data/incomplete/child",
	} {
		err := ValidateDownloadDataPathOutsideIncomplete(rejectedPath, incompleteDirectory)
		if err == nil || err.Error() != "Choose a folder outside the incomplete folder, /data/incomplete." {
			testingObject.Fatalf("download path %s validation error = %v", rejectedPath, err)
		}
	}

	if err := ValidateDownloadDataPathOutsideIncomplete(
		"/data/incomplete-old",
		incompleteDirectory,
	); err != nil {
		testingObject.Fatalf("similarly prefixed sibling validation error = %v", err)
	}

	if err := ValidateIncompleteDataPath(
		"/data/downloads/incomplete",
		[]IncompleteDirectoryDestination{{Path: "/data/downloads", ProfileName: "Default profile"}},
	); err != nil {
		testingObject.Fatalf("nested incomplete folder validation error = %v", err)
	}

	err := ValidateIncompleteDataPath(
		"/data/media",
		[]IncompleteDirectoryDestination{
			{Path: "/data/media/films", ProfileName: "Films profile"},
			{Path: "/data/media/shows", ProfileName: "Shows profile"},
		},
	)
	if err == nil || err.Error() != "Use a folder outside /data/media/films. Torrents in the Films profile finish there." {
		testingObject.Fatalf("incomplete folder clash error = %v", err)
	}
}

// TestDownloadDirectoryAlwaysHasAValue covers interactive, reset, and managed input.
//
// Empty writes and both managed modes use the registry's path contract, while the
// setting default remains the concrete folder restored by a reset.
//
// Since: UNRELEASED
func TestDownloadDirectoryAlwaysHasAValue(testingObject *testing.T) {
	registry := NewRegistry()
	if _, err := registry.Validate(
		"transmission.downloadDirectory",
		json.RawMessage(`""`),
	); err == nil {
		testingObject.Fatal("empty Download directory was accepted")
	}

	definition, found := registry.Definition("transmission.downloadDirectory")
	if !found || string(definition.DefaultValue) != `"/data/downloads"` ||
		definition.ApplyImpact != ApplyImpactLive {
		testingObject.Fatalf("Download directory default = %s, found %t", definition.DefaultValue, found)
	}

	for _, mode := range []ManagedMode{ManagedModeSeed, ManagedModeLock} {
		testingObject.Run(string(mode), func(testingObject *testing.T) {
			path := testingObject.TempDir() + "/managed.json"
			content := `{"version":1,"settings":{"transmission.downloadDirectory":{"mode":"` +
				string(mode) + `","value":""}}}`
			if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
				testingObject.Fatalf("write managed document: %v", err)
			}
			if _, err := ReadManagedDocument(path, registry); err == nil {
				testingObject.Fatal("empty managed Download directory was accepted")
			}
		})
	}
}

// TestRegistryOrdersNetworkSettings preserves the Settings page's logical sequence.
//
// The three random-port controls override the registry's usual key order;
// other categories continue to use deterministic alphabetical ordering.
func TestRegistryOrdersNetworkSettings(testingObject *testing.T) {
	var keys []string
	for _, definition := range NewRegistry().Definitions() {
		if definition.Category == "transmission.network" {
			keys = append(keys, definition.Key)
		}
	}

	want := []string{
		"transmission.peerPortRandomOnStart",
		"transmission.peerPortRandomLow",
		"transmission.peerPortRandomHigh",
	}
	if !slices.Equal(keys, want) {
		testingObject.Fatalf("network setting order = %v, want %v", keys, want)
	}
}

// TestRegistryOmitsConnectionSettings keeps connection-owned values out of settings.
func TestRegistryOmitsConnectionSettings(testingObject *testing.T) {
	registry := NewRegistry()
	for _, key := range []string{
		"vpn.provider",
		"vpn.tunnel",
		"vpn.endpointStrategy",
		"vpn.endpointIdentifiers",
		"vpn.retryIntervalSeconds",
		"vpn.dnsMode",
		"vpn.customDNSServers",
		"transmission.peerPort",
	} {
		if _, found := registry.Definition(key); found {
			testingObject.Fatalf("retired setting %s is still registered", key)
		}
	}
}

// TestRegistryOmitsRetiredCompatibilitySetting keeps the unused legacy duplicate out of
// the settings API while retaining the canonical RPC compatibility setting.
func TestRegistryOmitsRetiredCompatibilitySetting(testingObject *testing.T) {
	registry := NewRegistry()

	if _, found := registry.Definition("access.compatibleRPCEnabled"); found {
		testingObject.Fatal("the retired compatibility setting is still registered")
	}

	if _, found := registry.Definition("rpc.compatibilityEnabled"); !found {
		testingObject.Fatal("the canonical RPC compatibility setting is missing")
	}
}

// TestManagedDocumentRejectsUnknownFields protects the declarative input boundary.
//
// Misspelled policy keys must fail startup instead of being silently ignored and
// leaving an operator with a false belief that a setting is managed.
func TestManagedDocumentRejectsUnknownFields(testingObject *testing.T) {
	directory := testingObject.TempDir()
	path := directory + "/managed.json"
	if err := os.WriteFile(
		path,
		[]byte(`{"version":1,"settings":{},"unexpected":true}`),
		0o600,
	); err != nil {
		testingObject.Fatalf("write managed document: %v", err)
	}

	if _, err := ReadManagedDocument(path, NewRegistry()); err == nil {
		testingObject.Fatal("unknown managed document field was accepted")
	}
}
