package main

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionconfig"
)

// prepareDaemonSettings merges global, preserved, and connection-owned settings.
func (runner *runner) prepareDaemonSettings(
	entry daemonEntry,
	bindAddress string,
) (string, int, func(), error) {
	basePath := filepath.Join(
		runner.options.RuntimeDirectory,
		"transmission-config",
		"settings-base.json",
	)
	baseSettings, err := readNativeSettings(basePath, false)
	if err != nil {
		return "", 0, func() {}, err
	}

	configDirectory := filepath.Join(runner.options.ConfigDirectory, entry.ConnectionID)
	if err := os.MkdirAll(configDirectory, 0o750); err != nil {
		return "", 0, func() {}, fmt.Errorf("create Transmission config directory: %w", err)
	}
	settingsPath := filepath.Join(configDirectory, "settings.json")
	existingSettings, err := readNativeSettings(settingsPath, true)
	if err != nil {
		return "", 0, func() {}, err
	}

	mergedSettings := make(map[string]json.RawMessage, len(existingSettings)+len(baseSettings)+6)
	for key, value := range existingSettings {
		mergedSettings[key] = value
	}
	for key, value := range baseSettings {
		mergedSettings[key] = value
	}

	peerPort := entry.PeerPort
	releasePeerPort := func() {}
	randomOnStart, err := nativeBoolean(baseSettings, "peer-port-random-on-start")
	if err != nil {
		return "", 0, releasePeerPort, err
	}
	if randomOnStart {
		minimum, minimumError := nativeInteger(baseSettings, "peer-port-random-low")
		if minimumError != nil {
			return "", 0, releasePeerPort, minimumError
		}
		maximum, maximumError := nativeInteger(baseSettings, "peer-port-random-high")
		if maximumError != nil {
			return "", 0, releasePeerPort, maximumError
		}
		peerPort, releasePeerPort, err = runner.reserveRandomPeerPort(
			entry.ConnectionID,
			minimum,
			maximum,
		)
		if err != nil {
			return "", 0, func() {}, err
		}
	}

	setNativeValue(mergedSettings, "rpc-bind-address", "127.0.0.1")
	setNativeValue(mergedSettings, "rpc-port", firstDaemonRPCPort+entry.Slot)
	setNativeValue(mergedSettings, "rpc-host-whitelist", "127.0.0.1,localhost")
	setNativeValue(mergedSettings, "rpc-host-whitelist-enabled", true)
	setNativeValue(mergedSettings, "bind-address-ipv4", bindAddress)
	setNativeValue(mergedSettings, "peer-port", peerPort)
	setNativeValue(mergedSettings, "peer-port-random-on-start", false)

	content, err := json.MarshalIndent(mergedSettings, "", "  ")
	if err != nil {
		releasePeerPort()

		return "", 0, func() {}, fmt.Errorf("encode Transmission daemon settings: %w", err)
	}
	if err := transmissionconfig.Write(settingsPath, append(content, '\n')); err != nil {
		releasePeerPort()

		return "", 0, func() {}, err
	}

	directories, err := transmissionconfig.ReadDirectories(settingsPath)
	if err != nil {
		releasePeerPort()

		return "", 0, func() {}, err
	}
	if err := runner.makeDirectory(directories.Download, 0o775); err != nil {
		releasePeerPort()

		return "", 0, func() {}, fmt.Errorf("create download directory: %w", err)
	}
	if directories.IncompleteEnabled {
		if err := runner.makeDirectory(directories.Incomplete, 0o775); err != nil {
			releasePeerPort()

			return "", 0, func() {}, fmt.Errorf("create incomplete folder: %w", err)
		}
	}

	return configDirectory, peerPort, releasePeerPort, nil
}

// readNativeSettings reads one JSON object and optionally accepts a missing file.
func readNativeSettings(path string, allowMissing bool) (map[string]json.RawMessage, error) {
	content, err := os.ReadFile(path)
	if allowMissing && errors.Is(err, os.ErrNotExist) {
		return map[string]json.RawMessage{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read Transmission settings %q: %w", path, err)
	}

	settings := map[string]json.RawMessage{}
	if err := json.Unmarshal(content, &settings); err != nil {
		return nil, fmt.Errorf("decode Transmission settings %q: %w", path, err)
	}
	if settings == nil {
		return nil, fmt.Errorf("Transmission settings %q must be a JSON object", path)
	}

	return settings, nil
}

// nativeBoolean decodes one required boolean from base settings.
func nativeBoolean(settings map[string]json.RawMessage, key string) (bool, error) {
	value, found := settings[key]
	if !found {
		return false, fmt.Errorf("Transmission base setting %s is missing", key)
	}

	var decoded bool
	if err := json.Unmarshal(value, &decoded); err != nil {
		return false, fmt.Errorf("Transmission base setting %s must be a boolean", key)
	}

	return decoded, nil
}

// nativeInteger decodes one required bounded port from base settings.
func nativeInteger(settings map[string]json.RawMessage, key string) (int, error) {
	value, found := settings[key]
	if !found {
		return 0, fmt.Errorf("Transmission base setting %s is missing", key)
	}

	var decoded int
	if err := json.Unmarshal(value, &decoded); err != nil || decoded < 1024 || decoded > 65535 {
		return 0, fmt.Errorf("Transmission base setting %s must be a port", key)
	}

	return decoded, nil
}

// setNativeValue stores one already validated value as raw JSON.
func setNativeValue(settings map[string]json.RawMessage, key string, value any) {
	encoded, _ := json.Marshal(value)
	settings[key] = encoded
}

// reserveRandomPeerPort selects an unused port and returns an idempotent release.
func (runner *runner) reserveRandomPeerPort(
	connectionID string,
	minimum int,
	maximum int,
) (int, func(), error) {
	if minimum > maximum {
		return 0, func() {}, errors.New("Transmission random peer-port range is reversed")
	}

	runner.peerPortMutex.Lock()
	defer runner.peerPortMutex.Unlock()

	start, err := runner.randomPort(minimum, maximum)
	if err != nil {
		return 0, func() {}, err
	}
	rangeSize := maximum - minimum + 1
	selected := 0
	for offset := 0; offset < rangeSize; offset++ {
		candidate := minimum + (start-minimum+offset)%rangeSize
		if _, occupied := runner.peerPortOwner[candidate]; !occupied && !reservedTransmissionPort(candidate) {
			selected = candidate

			break
		}
	}
	if selected == 0 {
		return 0, func() {}, errors.New("Transmission random peer-port range has no free port")
	}
	runner.peerPortOwner[selected] = connectionID

	var releaseOnce sync.Once
	release := func() {
		releaseOnce.Do(func() {
			runner.peerPortMutex.Lock()
			if runner.peerPortOwner[selected] == connectionID {
				delete(runner.peerPortOwner, selected)
			}
			runner.peerPortMutex.Unlock()
		})
	}

	return selected, release, nil
}

// reservedTransmissionPort reports ports owned by this container's control plane.
func reservedTransmissionPort(port int) bool {
	return port >= 9091 && port <= 9155 || port == 22602 || port == 22605
}

// secureRandomPort chooses one inclusive value with crypto/rand.
func secureRandomPort(minimum int, maximum int) (int, error) {
	if minimum > maximum {
		return 0, errors.New("random port range is reversed")
	}

	value, err := rand.Int(rand.Reader, big.NewInt(int64(maximum-minimum+1)))
	if err != nil {
		return 0, fmt.Errorf("choose random Transmission peer port: %w", err)
	}

	return minimum + int(value.Int64()), nil
}

// migrateLegacyConfiguration moves the single-daemon home into slot zero once.
func migrateLegacyConfiguration(configRoot string, entries []daemonEntry) error {
	var slotZero *daemonEntry
	for index := range entries {
		if entries[index].Slot == 0 {
			slotZero = &entries[index]

			break
		}
	}
	if slotZero == nil {
		return nil
	}

	targetPath := filepath.Join(configRoot, slotZero.ConnectionID)
	if _, err := os.Stat(targetPath); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("inspect slot-zero Transmission config: %w", err)
	}
	rootEntries, err := os.ReadDir(configRoot)
	if err != nil {
		return fmt.Errorf("list legacy Transmission config: %w", err)
	}
	temporaryPath := ""
	for _, rootEntry := range rootEntries {
		if !strings.HasPrefix(rootEntry.Name(), ".slot-zero-migration-") {
			continue
		}
		if temporaryPath != "" {
			return errors.New("more than one slot-zero Transmission migration directory exists")
		}
		if !rootEntry.IsDir() {
			return fmt.Errorf("slot-zero Transmission migration path %q is not a directory", rootEntry.Name())
		}
		temporaryPath = filepath.Join(configRoot, rootEntry.Name())
	}

	if temporaryPath == "" {
		if _, err := os.Stat(filepath.Join(configRoot, "settings.json")); errors.Is(err, os.ErrNotExist) {
			return nil
		} else if err != nil {
			return fmt.Errorf("inspect legacy Transmission settings: %w", err)
		}

		temporaryPath, err = os.MkdirTemp(configRoot, ".slot-zero-migration-*")
		if err != nil {
			return fmt.Errorf("create legacy Transmission migration directory: %w", err)
		}
		rootEntries, err = os.ReadDir(configRoot)
		if err != nil {
			return fmt.Errorf("list legacy Transmission config: %w", err)
		}
	}
	if err := os.Chmod(temporaryPath, 0o750); err != nil {
		return fmt.Errorf("set slot-zero Transmission config permissions: %w", err)
	}

	temporaryName := filepath.Base(temporaryPath)
	names := make([]string, 0, len(rootEntries))
	for _, rootEntry := range rootEntries {
		name := rootEntry.Name()
		if name == temporaryName || strings.HasPrefix(name, ".slot-zero-migration-") ||
			connectionIDPattern.MatchString(name) {
			continue
		}
		names = append(names, name)
	}
	sort.SliceStable(names, func(left int, right int) bool {
		if names[left] == "settings.json" {
			return false
		}
		if names[right] == "settings.json" {
			return true
		}

		return names[left] < names[right]
	})

	for _, name := range names {
		if _, err := os.Lstat(filepath.Join(temporaryPath, name)); err == nil {
			return fmt.Errorf("legacy Transmission path %q exists in both migration locations", name)
		} else if !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("inspect staged Transmission path %q: %w", name, err)
		}
		if err := os.Rename(
			filepath.Join(configRoot, name),
			filepath.Join(temporaryPath, name),
		); err != nil {
			return fmt.Errorf("move legacy Transmission path %q: %w", name, err)
		}
	}
	if err := os.Rename(temporaryPath, targetPath); err != nil {
		return fmt.Errorf("publish slot-zero Transmission config: %w", err)
	}

	return nil
}
