package api

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

const (
	maximumTransmissionSettingsBytes = 1 * 1024 * 1024
	maximumTransmissionTorrentBytes  = 16 * 1024 * 1024
	maximumTransmissionResumeBytes   = 4 * 1024 * 1024
	maximumTransmissionSourceFolders = 100
	backupAnotherTransmissionSource  = "another-transmission"
)

type anotherTransmissionInspection struct {
	Version                    int
	Settings                   map[string]any
	Torrents                   []anotherTransmissionTorrent
	Folders                    []anotherTransmissionFolder
	DefaultDownloadDirectory   string
	IncompleteDirectory        string
	IncompleteDirectoryEnabled bool
	DefaultOptions             storage.TorrentProfileOptions
	DefaultStartPaused         bool
	MappedSettings             []backupSetting
	SettingPreview             []backupImportSettingPreview
	TotalSizeBytes             int64
	// OutOfRange holds the reason for each preview row whose old value this app cannot store.
	OutOfRange map[string]string
}

type anotherTransmissionTorrent struct {
	Hash                string
	Name                string
	TopLevelName        string
	Metainfo            []byte
	DownloadDirectory   string
	IncompleteDirectory string
	Paused              bool
	Labels              []string
	Limits              backupTorrentLimits
	AddedDate           int64
	Complete            bool
	HasResume           bool
	SizeBytes           int64
}

type anotherTransmissionFolder struct {
	Path         string
	Kind         string
	Description  string
	TorrentCount int
	Empty        bool
}

type anotherTransmissionResume struct {
	Destination         string
	IncompleteDirectory string
	Paused              bool
	Labels              []string
	Limits              backupTorrentLimits
	AddedDate           int64
	Complete            bool
}

type importSourceDirectoryEntry struct {
	Name          string `json:"name"`
	Path          string `json:"path"`
	HasSubfolders bool   `json:"hasSubfolders"`
}

type importSourceDirectoryResponse struct {
	Path        string                       `json:"path"`
	ParentPath  string                       `json:"parentPath,omitempty"`
	Directories []importSourceDirectoryEntry `json:"directories"`
}

// inspectAnotherTransmission reads a mounted Transmission config without modifying it.
func (server *Server) inspectAnotherTransmission(
	ctx context.Context,
	configPath string,
) (anotherTransmissionInspection, error) {
	root, _, err := openTransmissionImportRoot(configPath)
	if err != nil {
		return anotherTransmissionInspection{}, err
	}
	defer root.Close()

	settingsContent, err := readTransmissionImportFile(
		root,
		"settings.json",
		maximumTransmissionSettingsBytes,
	)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return anotherTransmissionInspection{}, errors.New("No settings.json was found in that folder.")
		}

		return anotherTransmissionInspection{}, fmt.Errorf("settings.json could not be read: %w", err)
	}
	settingsValues, err := decodeTransmissionSettings(settingsContent)
	if err != nil {
		return anotherTransmissionInspection{}, fmt.Errorf("settings.json is not valid: %w", err)
	}

	inspection := anotherTransmissionInspection{Settings: settingsValues}
	inspection.DefaultDownloadDirectory = transmissionSettingPath(
		settingsValues,
		"download-dir",
		"/data/downloads",
	)
	inspection.IncompleteDirectory = transmissionSettingPath(
		settingsValues,
		"incomplete-dir",
		"/data/incomplete",
	)
	inspection.IncompleteDirectoryEnabled = transmissionBooleanSetting(
		settingsValues,
		"incomplete-dir-enabled",
		false,
	)

	inspection.Torrents, inspection.Version, err = readAnotherTransmissionTorrents(root, inspection)
	if err != nil {
		return anotherTransmissionInspection{}, err
	}
	for _, torrent := range inspection.Torrents {
		inspection.TotalSizeBytes += torrent.SizeBytes
	}
	inspection.DefaultOptions, inspection.DefaultStartPaused = anotherTransmissionDefaultProfile(settingsValues)
	inspection.MappedSettings = anotherTransmissionMappedSettings(settingsValues)
	if err := server.dropOutOfRangeAnotherTransmissionValues(ctx, &inspection); err != nil {
		return anotherTransmissionInspection{}, err
	}
	inspection.Folders = discoverAnotherTransmissionFolders(inspection)
	if err := server.dropOwnedAnotherTransmissionSiblings(ctx, &inspection); err != nil {
		return anotherTransmissionInspection{}, err
	}
	inspection.SettingPreview, err = server.anotherTransmissionSettingPreview(ctx, inspection)
	if err != nil {
		return anotherTransmissionInspection{}, err
	}

	return inspection, nil
}

// dropOwnedAnotherTransmissionSiblings removes empty siblings this installation already uses.
//
// A folder that a profile here owns, or this installation's incomplete folder, is not a
// new folder from the old setup and is never offered as a new profile.
func (server *Server) dropOwnedAnotherTransmissionSiblings(
	ctx context.Context,
	inspection *anotherTransmissionInspection,
) error {
	owned, err := server.ownedTorrentProfileFolders(ctx)
	if err != nil {
		return err
	}
	if policy, policyError := server.effectiveDownloadPathPolicy(ctx); policyError == nil && policy.incompleteDirectory != "" {
		owned[strings.ToLower(filepath.Clean(policy.incompleteDirectory))] = ""
	}
	kept := make([]anotherTransmissionFolder, 0, len(inspection.Folders))
	for _, folder := range inspection.Folders {
		if folder.Empty {
			if _, taken := owned[strings.ToLower(filepath.Clean(folder.Path))]; taken {
				continue
			}
		}
		kept = append(kept, folder)
	}
	inspection.Folders = kept

	return nil
}

// ownedTorrentProfileFolders maps each named profile folder here, lowercased, to its name.
//
// The Default profile's folder is listed with an empty name, so it is treated as taken
// but never suggested as the name of a named profile.
func (server *Server) ownedTorrentProfileFolders(ctx context.Context) (map[string]string, error) {
	owned := map[string]string{}
	if policy, err := server.effectiveDownloadPathPolicy(ctx); err == nil && policy.downloadDirectory != "" {
		owned[strings.ToLower(filepath.Clean(policy.downloadDirectory))] = ""
	}
	currentProfiles, err := server.store.ListTorrentProfiles(ctx)
	if err != nil {
		return nil, err
	}
	for _, profile := range currentProfiles {
		if profile.DownloadDirectory != "" {
			owned[strings.ToLower(filepath.Clean(profile.DownloadDirectory))] = profile.Name
		}
	}

	return owned, nil
}

// anotherTransmissionProfileName suggests a profile name for one old folder.
//
// When the mapped folder already belongs to a profile here, that profile's name is used,
// so the import updates it instead of creating a second profile for the same folder.
func anotherTransmissionProfileName(
	folderPath string,
	mappedPath string,
	owned map[string]string,
	usedNames map[string]int,
) string {
	if mappedPath != "" {
		if owner, found := owned[strings.ToLower(filepath.Clean(mappedPath))]; found && owner != "" {
			usedNames[strings.ToLower(owner)]++

			return owner
		}
	}

	return uniqueAnotherTransmissionProfileName(suggestedProfileName(folderPath), usedNames)
}

// mapAnotherTransmissionIncompleteFolder shows the incomplete folder the import will use.
//
// The old path is replaced by its mapped folder here, so the Settings row compares what
// is applied rather than a path that only existed in the old setup.
func mapAnotherTransmissionIncompleteFolder(
	settingsPreview []backupImportSettingPreview,
	inspection anotherTransmissionInspection,
	mappings map[string]string,
) {
	mappedPath := strings.TrimSpace(mappings[inspection.IncompleteDirectory])
	if mappedPath == "" {
		return
	}
	for index := range settingsPreview {
		if settingsPreview[index].Key != "transmission.incompleteFolder" {
			continue
		}
		encoded, err := json.Marshal(map[string]any{
			"enabled": inspection.IncompleteDirectoryEnabled,
			"path":    mappedPath,
		})
		if err == nil {
			settingsPreview[index].FileValue = encoded
		}
	}
}

// anotherTransmissionFolderConflicts explains mapped folders that would nest profiles.
//
// No profile folder, the Default profile's included, may sit inside another profile's
// folder or contain one. Old folders mapped to the same folder are reported by the
// duplicate check instead.
func anotherTransmissionFolderConflicts(
	inspection anotherTransmissionInspection,
	mappings map[string]string,
	included map[string]bool,
	existing []storage.TorrentProfile,
) map[string]string {
	conflicts := map[string]string{}
	type mappedFolder struct {
		source string
		target string
		kind   string
	}
	folders := []mappedFolder{}
	for _, folder := range inspection.Folders {
		if folder.Kind == "incomplete" {
			continue
		}
		if folder.Empty {
			if selected, found := included[folder.Path]; found && !selected {
				continue
			}
		}
		target := strings.TrimSpace(mappings[folder.Path])
		if target == "" {
			continue
		}
		folders = append(folders, mappedFolder{source: folder.Path, target: target, kind: folder.Kind})
	}
	for _, folder := range folders {
		for _, other := range folders {
			if other.source == folder.source {
				continue
			}
			relation := storage.TorrentProfileFolderRelation(folder.target, other.target)
			if relation == "inside" || relation == "contains" {
				conflicts[folder.source] = fmt.Sprintf("This folder would nest with the one for %s. Choose folders side by side.", other.source)
			}
		}
		if _, found := conflicts[folder.source]; found {
			continue
		}
		for _, profile := range existing {
			relation := storage.TorrentProfileFolderRelation(folder.target, profile.DownloadDirectory)
			if relation == "inside" {
				conflicts[folder.source] = fmt.Sprintf("This folder is inside the %s profile's folder.", profile.Name)

				break
			}
			if relation == "contains" {
				conflicts[folder.source] = fmt.Sprintf("This folder contains the %s profile's folder.", profile.Name)

				break
			}
		}
	}

	return conflicts
}

// anotherTransmissionPreviewRow maps a mapped setting key to the Settings step row that shows it.
func anotherTransmissionPreviewRow(settingKey string) string {
	switch settingKey {
	case "transmission.downloadQueueEnabled", "transmission.downloadQueueSize":
		return "transmission.downloadQueue"
	case "transmission.blocklistEnabled", "transmission.blocklistSources":
		return "transmission.blocklists"
	case "transmission.incompleteDirectory", "transmission.incompleteDirectoryEnabled":
		return "transmission.incompleteFolder"
	}

	return settingKey
}

// groupDigits writes an integer with thousands separators for messages.
func groupDigits(value int64) string {
	digits := strconv.FormatInt(value, 10)
	sign := ""
	if strings.HasPrefix(digits, "-") {
		sign = "-"
		digits = digits[1:]
	}
	var grouped strings.Builder
	for index, digit := range digits {
		if index > 0 && (len(digits)-index)%3 == 0 {
			grouped.WriteByte(',')
		}
		grouped.WriteRune(digit)
	}

	return sign + grouped.String()
}

// outOfRangeIntegerReason explains an old integer this app cannot store.
func outOfRangeIntegerReason(value int64, minimum int64, maximum int64) string {
	return fmt.Sprintf(
		"%s is outside what this app allows (%s to %s), so the value here stays.",
		groupDigits(value),
		groupDigits(minimum),
		groupDigits(maximum),
	)
}

// dropOutOfRangeAnotherTransmissionValues keeps values this app cannot store out of the import.
//
// Each dropped value is reported under Not brought over, and the value here stays.
func (server *Server) dropOutOfRangeAnotherTransmissionValues(
	ctx context.Context,
	inspection *anotherTransmissionInspection,
) error {
	inspection.OutOfRange = map[string]string{}
	keptSettings := make([]backupSetting, 0, len(inspection.MappedSettings))
	for _, setting := range inspection.MappedSettings {
		// Folder paths are replaced by the mapped folders when the import is applied.
		pathSetting := setting.Key == "transmission.downloadDirectory" || setting.Key == "transmission.incompleteDirectory"
		if _, err := server.registry.Validate(setting.Key, setting.Value); err != nil && !pathSetting {
			reason := "The old value is not accepted here, so the value here stays."
			var integerValue int64
			if json.Unmarshal(setting.Value, &integerValue) == nil {
				if minimum, maximum, bounded := server.registry.IntegerBounds(setting.Key); bounded {
					reason = outOfRangeIntegerReason(integerValue, minimum, maximum)
				}
			}
			inspection.OutOfRange[anotherTransmissionPreviewRow(setting.Key)] = reason

			continue
		}
		keptSettings = append(keptSettings, setting)
	}
	inspection.MappedSettings = keptSettings

	currentDefault, err := server.store.DefaultTorrentProfile(ctx)
	if err != nil {
		return err
	}
	options := &inspection.DefaultOptions
	if options.PeerLimit < 1 || options.PeerLimit > 10000 {
		inspection.OutOfRange["profile.default.peerLimit"] = outOfRangeIntegerReason(options.PeerLimit, 1, 10000)
		options.PeerLimit = currentDefault.Options.PeerLimit
	}
	speedOutOfRange := func(limit *int64) bool {
		return limit != nil && (*limit < 1 || *limit > 1_000_000_000)
	}
	if speedOutOfRange(options.DownloadLimitKBps) || speedOutOfRange(options.UploadLimitKBps) {
		inspection.OutOfRange["profile.default.speedLimits"] = "A speed limit of 0 or less is not accepted here, so the limits here stay."
		options.DownloadLimitKBps = currentDefault.Options.DownloadLimitKBps
		options.UploadLimitKBps = currentDefault.Options.UploadLimitKBps
	}
	seeding := options.Seeding
	if (seeding.Ratio != nil && (*seeding.Ratio < 0 || *seeding.Ratio > 10000)) ||
		(seeding.IdleMinutes != nil && (*seeding.IdleMinutes < 1 || *seeding.IdleMinutes > 525600)) {
		inspection.OutOfRange["profile.default.seeding"] = "The old seeding limit is outside what this app allows, so the seeding rule here stays."
		options.Seeding = currentDefault.Options.Seeding
	}

	return nil
}

// openTransmissionImportRoot creates an openat-style read-only boundary.
func openTransmissionImportRoot(configPath string) (*os.Root, string, error) {
	cleanPath := filepath.Clean(strings.TrimSpace(configPath))
	if cleanPath == "." || !filepath.IsAbs(cleanPath) {
		return nil, "", errors.New("Choose an absolute config folder path.")
	}
	if importPathForbidden(cleanPath) {
		return nil, "", errors.New("That system folder cannot be used as an import source.")
	}
	resolvedPath, err := filepath.EvalSymlinks(cleanPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, "", errors.New("That config folder was not found in this container.")
		}

		return nil, "", errors.New("That config folder cannot be read.")
	}
	resolvedPath = filepath.Clean(resolvedPath)
	if importPathForbidden(resolvedPath) {
		return nil, "", errors.New("That system folder cannot be used as an import source.")
	}
	info, err := os.Stat(resolvedPath)
	if err != nil || !info.IsDir() {
		return nil, "", errors.New("That config folder cannot be read.")
	}
	root, err := os.OpenRoot(resolvedPath)
	if err != nil {
		return nil, "", errors.New("That config folder cannot be read.")
	}

	return root, resolvedPath, nil
}

// importPathForbidden excludes virtual device and kernel trees from source browsing.
func importPathForbidden(path string) bool {
	cleanPath := filepath.Clean(path)
	for _, forbiddenPath := range []string{"/dev", "/proc", "/sys"} {
		if cleanPath == forbiddenPath || strings.HasPrefix(cleanPath, forbiddenPath+string(filepath.Separator)) {
			return true
		}
	}

	return false
}

// readTransmissionImportFile opens a regular source file read-only with a hard limit.
func readTransmissionImportFile(root *os.Root, name string, maximumBytes int64) ([]byte, error) {
	file, err := root.Open(name)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() {
		return nil, errors.New("source entry is not a regular file")
	}
	if info.Size() > maximumBytes {
		return nil, fmt.Errorf("source file exceeds %s", humanByteLimit(maximumBytes))
	}
	content, err := io.ReadAll(io.LimitReader(file, maximumBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(content)) > maximumBytes {
		return nil, fmt.Errorf("source file exceeds %s", humanByteLimit(maximumBytes))
	}

	return content, nil
}

func humanByteLimit(bytes int64) string {
	if bytes%(1024*1024) == 0 {
		return fmt.Sprintf("%d MiB", bytes/(1024*1024))
	}

	return fmt.Sprintf("%d bytes", bytes)
}

// decodeTransmissionSettings decodes one bounded settings object without coercion.
func decodeTransmissionSettings(content []byte) (map[string]any, error) {
	decoder := json.NewDecoder(strings.NewReader(string(content)))
	decoder.UseNumber()
	var values map[string]any
	if err := decoder.Decode(&values); err != nil {
		return nil, err
	}
	if values == nil {
		return nil, errors.New("the root value must be an object")
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return nil, errors.New("the file contains more than one JSON value")
	}

	return values, nil
}

// readAnotherTransmissionTorrents supports Transmission 3 and 4 filename layouts.
func readAnotherTransmissionTorrents(
	root *os.Root,
	inspection anotherTransmissionInspection,
) ([]anotherTransmissionTorrent, int, error) {
	torrentDirectory, err := root.Open("torrents")
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, 0, errors.New("No torrents folder was found in that config folder.")
		}

		return nil, 0, errors.New("The torrents folder cannot be read.")
	}
	defer torrentDirectory.Close()
	torrentEntries, err := torrentDirectory.ReadDir(-1)
	if err != nil {
		return nil, 0, errors.New("The torrents folder cannot be read.")
	}
	torrentNames := []string{}
	version := 4
	for _, entry := range torrentEntries {
		if entry.Type()&os.ModeSymlink != 0 || entry.IsDir() || !strings.EqualFold(filepath.Ext(entry.Name()), ".torrent") {
			continue
		}
		_, fullHash, recognized := transmissionSourceFilenameHash(entry.Name(), ".torrent")
		if !recognized {
			continue
		}
		if !fullHash {
			version = 3
		}
		torrentNames = append(torrentNames, entry.Name())
	}
	if len(torrentNames) > maximumBackupTorrents {
		return nil, 0, fmt.Errorf("The config contains more than %d torrents.", maximumBackupTorrents)
	}
	sort.Slice(torrentNames, func(left int, right int) bool {
		return strings.ToLower(torrentNames[left]) < strings.ToLower(torrentNames[right])
	})

	resumeFiles, err := indexAnotherTransmissionResumeFiles(root)
	if err != nil {
		return nil, 0, err
	}
	torrents := make([]anotherTransmissionTorrent, 0, len(torrentNames))
	seenHashes := map[string]struct{}{}
	for _, torrentName := range torrentNames {
		metainfo, err := readTransmissionImportFile(
			root,
			filepath.Join("torrents", torrentName),
			maximumTransmissionTorrentBytes,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("%s could not be read: %w", torrentName, err)
		}
		hash, err := torrentMetainfoHash(metainfo)
		if err != nil {
			return nil, 0, fmt.Errorf("%s is not a valid torrent: %w", torrentName, err)
		}
		filenameHash, fullHash, _ := transmissionSourceFilenameHash(torrentName, ".torrent")
		if (fullHash && !strings.EqualFold(filenameHash, hash)) ||
			(!fullHash && !strings.HasPrefix(strings.ToLower(hash), filenameHash)) {
			return nil, 0, fmt.Errorf("%s does not match its torrent info hash", torrentName)
		}
		if _, found := seenHashes[hash]; found {
			return nil, 0, fmt.Errorf("The torrents folder contains the same torrent more than once.")
		}
		seenHashes[hash] = struct{}{}
		name, topLevelName, sizeBytes, err := anotherTransmissionMetainfoDetails(metainfo)
		if err != nil {
			return nil, 0, fmt.Errorf("%s is not a valid torrent: %w", torrentName, err)
		}
		resume := defaultAnotherTransmissionResume(inspection)
		resumeName := resumeFiles[strings.ToLower(hash)]
		if resumeName == "" {
			resumeName = resumeFiles[strings.ToLower(hash[:16])]
		}
		hasResume := resumeName != ""
		if hasResume {
			resumeContent, readError := readTransmissionImportFile(
				root,
				filepath.Join("resume", resumeName),
				maximumTransmissionResumeBytes,
			)
			if readError != nil {
				return nil, 0, fmt.Errorf("%s could not be read: %w", resumeName, readError)
			}
			resume, err = decodeAnotherTransmissionResume(resumeContent, inspection)
			if err != nil {
				return nil, 0, fmt.Errorf("%s is not valid: %w", resumeName, err)
			}
		}
		torrents = append(torrents, anotherTransmissionTorrent{
			Hash:                hash,
			Name:                name,
			TopLevelName:        topLevelName,
			Metainfo:            metainfo,
			DownloadDirectory:   resume.Destination,
			IncompleteDirectory: resume.IncompleteDirectory,
			Paused:              resume.Paused,
			Labels:              resume.Labels,
			Limits:              resume.Limits,
			AddedDate:           resume.AddedDate,
			Complete:            resume.Complete,
			HasResume:           hasResume,
			SizeBytes:           sizeBytes,
		})
	}

	return torrents, version, nil
}

// transmissionSourceFilenameHash recognizes full-hash and legacy hash16 names.
func transmissionSourceFilenameHash(name string, extension string) (string, bool, bool) {
	if !strings.EqualFold(filepath.Ext(name), extension) {
		return "", false, false
	}
	stem := strings.TrimSuffix(name, filepath.Ext(name))
	lowerStem := strings.ToLower(stem)
	if (len(lowerStem) == 40 || len(lowerStem) == 64) && hexadecimalString(lowerStem) {
		return lowerStem, true, true
	}
	separator := strings.LastIndexByte(lowerStem, '.')
	if separator < 0 || len(lowerStem)-separator-1 != 16 {
		return "", false, false
	}
	hash16 := lowerStem[separator+1:]
	if !hexadecimalString(hash16) {
		return "", false, false
	}

	return hash16, false, true
}

func hexadecimalString(value string) bool {
	_, err := hex.DecodeString(value)

	return err == nil
}

// indexAnotherTransmissionResumeFiles indexes resume names by full or legacy hash.
func indexAnotherTransmissionResumeFiles(root *os.Root) (map[string]string, error) {
	resumeDirectory, err := root.Open("resume")
	if errors.Is(err, os.ErrNotExist) {
		return map[string]string{}, nil
	}
	if err != nil {
		return nil, errors.New("The resume folder cannot be read.")
	}
	defer resumeDirectory.Close()
	entries, err := resumeDirectory.ReadDir(-1)
	if err != nil {
		return nil, errors.New("The resume folder cannot be read.")
	}
	indexed := map[string]string{}
	for _, entry := range entries {
		if entry.Type()&os.ModeSymlink != 0 || entry.IsDir() {
			continue
		}
		hash, _, recognized := transmissionSourceFilenameHash(entry.Name(), ".resume")
		if !recognized {
			continue
		}
		if _, duplicate := indexed[hash]; duplicate {
			return nil, fmt.Errorf("The resume folder contains more than one file for hash %s.", hash)
		}
		indexed[hash] = entry.Name()
	}

	return indexed, nil
}

// anotherTransmissionMetainfoDetails extracts safe display and data-check fields.
func anotherTransmissionMetainfoDetails(content []byte) (string, string, int64, error) {
	decoded, err := parseBoundedBencode(content, maximumTransmissionTorrentBytes)
	if err != nil {
		return "", "", 0, err
	}
	root, ok := bencodeDictionary(decoded)
	if !ok {
		return "", "", 0, errors.New("the root value is not a dictionary")
	}
	info, ok := bencodeDictionary(root["info"])
	if !ok {
		return "", "", 0, errors.New("the info dictionary is missing")
	}
	name, found := bencodeStringValue(info, "name.utf-8", "name")
	if !found || strings.TrimSpace(name) == "" {
		return "", "", 0, errors.New("info.name is missing")
	}
	name = strings.ToValidUTF8(name, "�")
	if filepath.Base(name) != name || name == "." || name == ".." {
		return "", "", 0, errors.New("info.name is not a safe top-level name")
	}
	var totalSize int64
	if length, found := bencodeIntegerValue(info, "length"); found {
		if length < 0 {
			return "", "", 0, errors.New("info.length is invalid")
		}
		totalSize = length
	} else if files, ok := info["files"].([]any); ok {
		for _, fileValue := range files {
			file, dictionary := bencodeDictionary(fileValue)
			if !dictionary {
				return "", "", 0, errors.New("info.files contains an invalid entry")
			}
			length, found := bencodeIntegerValue(file, "length")
			if !found || length < 0 || totalSize > (1<<63-1)-length {
				return "", "", 0, errors.New("info.files contains an invalid length")
			}
			totalSize += length
		}
	} else {
		return "", "", 0, errors.New("info does not contain file sizes")
	}

	return name, name, totalSize, nil
}

// defaultAnotherTransmissionResume supplies safe values when no resume exists.
func defaultAnotherTransmissionResume(inspection anotherTransmissionInspection) anotherTransmissionResume {
	return anotherTransmissionResume{
		Destination:         inspection.DefaultDownloadDirectory,
		IncompleteDirectory: inspection.IncompleteDirectory,
		Paused:              true,
		Labels:              []string{},
		Limits: backupTorrentLimits{
			BandwidthPriority:   0,
			HonorsSessionLimits: true,
			PeerLimit:           inspection.DefaultOptions.PeerLimit,
		},
	}
}

// decodeAnotherTransmissionResume maps the portable fields used by this app.
func decodeAnotherTransmissionResume(
	content []byte,
	inspection anotherTransmissionInspection,
) (anotherTransmissionResume, error) {
	decoded, err := parseBoundedBencode(content, maximumTransmissionResumeBytes)
	if err != nil {
		return anotherTransmissionResume{}, err
	}
	dictionary, ok := bencodeDictionary(decoded)
	if !ok {
		return anotherTransmissionResume{}, errors.New("the root value is not a dictionary")
	}
	resume := defaultAnotherTransmissionResume(inspection)
	if destination, found := bencodeStringValue(dictionary, "destination"); found && filepath.IsAbs(destination) {
		resume.Destination = filepath.Clean(destination)
	}
	if incomplete, found := bencodeStringValue(dictionary, "incomplete-dir"); found && filepath.IsAbs(incomplete) {
		resume.IncompleteDirectory = filepath.Clean(incomplete)
	}
	if paused, found := bencodeIntegerValue(dictionary, "paused"); found {
		resume.Paused = paused != 0
	}
	resume.Labels = anotherTransmissionResumeLabels(dictionary)
	if err := validateLabels(resume.Labels); err != nil {
		return anotherTransmissionResume{}, fmt.Errorf("labels: %w", err)
	}
	resume.Limits = anotherTransmissionResumeLimits(dictionary, resume.Limits)
	resume.AddedDate, _ = bencodeIntegerValue(dictionary, "added-date")
	doneDate, _ := bencodeIntegerValue(dictionary, "done-date")
	resume.Complete = doneDate > 0

	return resume, nil
}

func anotherTransmissionResumeLabels(dictionary map[string]any) []string {
	value, found := dictionary["labels"]
	if !found {
		return []string{}
	}
	labels := []string{}
	switch typedValue := value.(type) {
	case []byte:
		if label := strings.TrimSpace(strings.ToValidUTF8(string(typedValue), "�")); label != "" {
			labels = append(labels, label)
		}
	case []any:
		for _, item := range typedValue {
			bytesValue, ok := item.([]byte)
			if !ok {
				continue
			}
			if label := strings.TrimSpace(strings.ToValidUTF8(string(bytesValue), "�")); label != "" {
				labels = append(labels, label)
			}
		}
	}

	return labels
}

func anotherTransmissionResumeLimits(
	dictionary map[string]any,
	limits backupTorrentLimits,
) backupTorrentLimits {
	limits.BandwidthPriority = bencodeIntegerOr(dictionary, limits.BandwidthPriority, "bandwidth-priority")
	limits.DownloadLimit = bencodeIntegerOr(dictionary, limits.DownloadLimit, "speed-limit-down")
	limits.DownloadLimited = bencodeIntegerOr(dictionary, 0, "speed-limit-down-enabled") != 0
	limits.UploadLimit = bencodeIntegerOr(dictionary, limits.UploadLimit, "speed-limit-up")
	limits.UploadLimited = bencodeIntegerOr(dictionary, 0, "speed-limit-up-enabled") != 0
	limits.HonorsSessionLimits = bencodeIntegerOr(dictionary, 1, "honors-session-limits") != 0
	limits.PeerLimit = bencodeIntegerOr(dictionary, limits.PeerLimit, "max-peers", "peer-limit")
	limits.SeedIdleLimit = bencodeIntegerOr(dictionary, 0, "idle-limit", "seed-idle-limit")
	limits.SeedIdleMode = bencodeIntegerOr(dictionary, 0, "idle-mode", "seed-idle-mode")
	limits.SeedRatioMode = bencodeIntegerOr(dictionary, 0, "ratio-mode", "seed-ratio-mode")
	if ratioString, found := bencodeStringValue(dictionary, "ratio-limit", "seed-ratio-limit"); found {
		_, _ = fmt.Sscan(ratioString, &limits.SeedRatioLimit)
	} else if ratio, found := bencodeIntegerValue(dictionary, "ratio-limit", "seed-ratio-limit"); found {
		limits.SeedRatioLimit = float64(ratio)
	}

	return limits
}

func bencodeIntegerOr(dictionary map[string]any, fallback int64, keys ...string) int64 {
	if value, found := bencodeIntegerValue(dictionary, keys...); found {
		return value
	}

	return fallback
}

func transmissionSettingPath(values map[string]any, key string, fallback string) string {
	value, found := values[key].(string)
	if !found || !filepath.IsAbs(value) {
		return fallback
	}
	cleanValue := filepath.Clean(value)
	if importPathForbidden(cleanValue) {
		return fallback
	}

	return cleanValue
}

func transmissionBooleanSetting(values map[string]any, key string, fallback bool) bool {
	value, found := values[key]
	if !found {
		return fallback
	}
	switch typedValue := value.(type) {
	case bool:
		return typedValue
	case json.Number:
		integer, err := typedValue.Int64()
		if err == nil {
			return integer != 0
		}
	}

	return fallback
}

func transmissionIntegerSetting(values map[string]any, key string, fallback int64) int64 {
	value, found := values[key]
	if !found {
		return fallback
	}
	switch typedValue := value.(type) {
	case json.Number:
		integer, err := typedValue.Int64()
		if err == nil {
			return integer
		}
	case float64:
		return int64(typedValue)
	}

	return fallback
}

func transmissionNumberSetting(values map[string]any, key string, fallback float64) float64 {
	value, found := values[key]
	if !found {
		return fallback
	}
	switch typedValue := value.(type) {
	case json.Number:
		number, err := typedValue.Float64()
		if err == nil {
			return number
		}
	case float64:
		return typedValue
	}

	return fallback
}

// anotherTransmissionDefaultProfile maps global torrent behavior to the Default profile.
func anotherTransmissionDefaultProfile(
	values map[string]any,
) (storage.TorrentProfileOptions, bool) {
	options := storage.TorrentProfileOptions{
		Seeding:           storage.TorrentProfileSeeding{Mode: "never"},
		BandwidthPriority: 0,
		PeerLimit:         transmissionIntegerSetting(values, "peer-limit-per-torrent", 50),
		Queue:             "normal",
	}
	ratioEnabled := transmissionBooleanSetting(values, "ratio-limit-enabled", false)
	idleEnabled := transmissionBooleanSetting(values, "idle-seeding-limit-enabled", false)
	if ratioEnabled || idleEnabled {
		options.Seeding.Mode = "limit"
		if ratioEnabled {
			ratio := transmissionNumberSetting(values, "ratio-limit", 2)
			options.Seeding.Ratio = &ratio
		}
		if idleEnabled {
			idleMinutes := transmissionIntegerSetting(values, "idle-seeding-limit", 30)
			options.Seeding.IdleMinutes = &idleMinutes
		}
	}
	if transmissionBooleanSetting(values, "speed-limit-down-enabled", false) {
		limit := transmissionIntegerSetting(values, "speed-limit-down", 100)
		options.DownloadLimitKBps = &limit
	}
	if transmissionBooleanSetting(values, "speed-limit-up-enabled", false) {
		limit := transmissionIntegerSetting(values, "speed-limit-up", 100)
		options.UploadLimitKBps = &limit
	}
	startPaused := !transmissionBooleanSetting(values, "start-added-torrents", true)

	return options, startPaused
}

// anotherTransmissionMappedSettings converts supported session settings.
func anotherTransmissionMappedSettings(values map[string]any) []backupSetting {
	settingsToImport := []backupSetting{}
	appendSetting := func(key string, value any) {
		encoded, err := json.Marshal(value)
		if err == nil {
			settingsToImport = append(settingsToImport, backupSetting{Key: key, Value: encoded})
		}
	}
	appendSetting(
		"transmission.downloadDirectory",
		transmissionSettingPath(values, "download-dir", "/data/downloads"),
	)
	appendSetting(
		"transmission.incompleteDirectory",
		transmissionSettingPath(values, "incomplete-dir", "/data/incomplete"),
	)
	appendSetting(
		"transmission.incompleteDirectoryEnabled",
		transmissionBooleanSetting(values, "incomplete-dir-enabled", false),
	)
	if _, found := values["download-queue-enabled"]; found {
		appendSetting(
			"transmission.downloadQueueEnabled",
			transmissionBooleanSetting(values, "download-queue-enabled", true),
		)
	}
	if _, found := values["download-queue-size"]; found {
		appendSetting(
			"transmission.downloadQueueSize",
			transmissionIntegerSetting(values, "download-queue-size", 5),
		)
	}
	if _, found := values["peer-limit-global"]; found {
		appendSetting(
			"transmission.peerLimitGlobal",
			transmissionIntegerSetting(values, "peer-limit-global", 200),
		)
	}
	if _, found := values["blocklist-enabled"]; found {
		appendSetting(
			"transmission.blocklistEnabled",
			transmissionBooleanSetting(values, "blocklist-enabled", false),
		)
	}
	if source, found := values["blocklist-url"].(string); found && validImportBlocklistSource(source) {
		appendSetting("transmission.blocklistSources", []string{source})
	}

	return settingsToImport
}

// anotherTransmissionBlocklistSources lists the old blocklist URL in the shape Settings stores.
func anotherTransmissionBlocklistSources(values map[string]any) []string {
	source := strings.TrimSpace(transmissionStringSetting(values, "blocklist-url", ""))
	if source == "" {
		return []string{}
	}

	return []string{source}
}

func validImportBlocklistSource(value string) bool {
	parsedURL, err := url.Parse(strings.TrimSpace(value))

	return err == nil && parsedURL.Scheme == "https" && parsedURL.Host != ""
}

// anotherTransmissionSettingPreview describes supported mappings and every skipped key.
func (server *Server) anotherTransmissionSettingPreview(
	ctx context.Context,
	inspection anotherTransmissionInspection,
) ([]backupImportSettingPreview, error) {
	snapshot, err := server.store.EffectiveConfiguration(ctx, server.registry)
	if err != nil {
		return nil, err
	}
	currentSettings := map[string]json.RawMessage{}
	for _, setting := range snapshot.Settings {
		currentSettings[setting.Key] = setting.Value
	}
	currentDefault, err := server.store.DefaultTorrentProfile(ctx)
	if err != nil {
		return nil, err
	}
	raw := func(value any) json.RawMessage {
		encoded, _ := json.Marshal(value)

		return encoded
	}
	preview := []backupImportSettingPreview{
		{
			Key:   "transmission.downloadQueue",
			Title: "Download queue",
			FileValue: raw(map[string]any{
				"enabled": transmissionBooleanSetting(inspection.Settings, "download-queue-enabled", true),
				"size":    transmissionIntegerSetting(inspection.Settings, "download-queue-size", 5),
			}),
			HereValue: raw(map[string]any{
				"enabled": backupDecodeRawBoolean(currentSettings["transmission.downloadQueueEnabled"], true),
				"size":    backupDecodeRawIntegerValue(currentSettings["transmission.downloadQueueSize"], 5),
			}),
			WillImport: true,
		},
		{
			Key:        "profile.default.seeding",
			Title:      "Seeding",
			FileValue:  raw(inspection.DefaultOptions.Seeding),
			HereValue:  raw(currentDefault.Options.Seeding),
			WillImport: true,
		},
		{
			Key:   "profile.default.speedLimits",
			Title: "Speed limits",
			FileValue: raw(map[string]any{
				"download": inspection.DefaultOptions.DownloadLimitKBps,
				"upload":   inspection.DefaultOptions.UploadLimitKBps,
			}),
			HereValue: raw(map[string]any{
				"download": currentDefault.Options.DownloadLimitKBps,
				"upload":   currentDefault.Options.UploadLimitKBps,
			}),
			WillImport: true,
		},
		{
			Key:   "transmission.blocklists",
			Title: "Blocklists",
			FileValue: raw(map[string]any{
				"enabled": transmissionBooleanSetting(inspection.Settings, "blocklist-enabled", false),
				"sources": anotherTransmissionBlocklistSources(inspection.Settings),
			}),
			HereValue: raw(map[string]any{
				"enabled": backupDecodeRawBoolean(currentSettings["transmission.blocklistEnabled"], false),
				"sources": backupDecodeRawStringList(currentSettings["transmission.blocklistSources"]),
			}),
			WillImport: true,
		},
		{
			Key:        "transmission.peerLimitGlobal",
			Title:      "Global peer limit",
			FileValue:  raw(transmissionIntegerSetting(inspection.Settings, "peer-limit-global", 200)),
			HereValue:  currentSettings["transmission.peerLimitGlobal"],
			WillImport: true,
		},
		{
			Key:        "profile.default.peerLimit",
			Title:      "Peers per torrent",
			FileValue:  raw(inspection.DefaultOptions.PeerLimit),
			HereValue:  raw(currentDefault.Options.PeerLimit),
			WillImport: true,
		},
		{
			Key:   "transmission.incompleteFolder",
			Title: "Incomplete folder",
			FileValue: raw(map[string]any{
				"enabled": inspection.IncompleteDirectoryEnabled,
				"path":    inspection.IncompleteDirectory,
			}),
			HereValue: raw(map[string]any{
				"enabled": backupDecodeRawBoolean(currentSettings["transmission.incompleteDirectoryEnabled"], true),
				"path":    backupDecodeRawString(currentSettings["transmission.incompleteDirectory"], "/data/incomplete"),
			}),
			WillImport: true,
		},
		{
			Key:        "profile.default.startAddedTorrents",
			Title:      "Start added torrents",
			FileValue:  raw(!inspection.DefaultStartPaused),
			HereValue:  raw(!currentDefault.StartPaused),
			WillImport: true,
		},
	}

	for index := range preview {
		if reason, found := inspection.OutOfRange[preview[index].Key]; found {
			preview[index].WillImport = false
			preview[index].Reason = reason
		}
	}

	consumedKeys := map[string]struct{}{
		"blocklist-enabled": {}, "blocklist-url": {}, "download-dir": {},
		"download-queue-enabled": {}, "download-queue-size": {},
		"idle-seeding-limit": {}, "idle-seeding-limit-enabled": {},
		"incomplete-dir": {}, "incomplete-dir-enabled": {},
		"peer-limit-global": {}, "peer-limit-per-torrent": {},
		"ratio-limit": {}, "ratio-limit-enabled": {},
		"speed-limit-down": {}, "speed-limit-down-enabled": {},
		"speed-limit-up": {}, "speed-limit-up-enabled": {},
		"start-added-torrents": {},
	}
	skipReasons := anotherTransmissionSkipReasons()
	keys := make([]string, 0, len(inspection.Settings))
	for key := range inspection.Settings {
		if _, consumed := consumedKeys[key]; !consumed {
			keys = append(keys, key)
		}
	}
	sort.Strings(keys)
	for _, key := range keys {
		reason := skipReasons[key]
		if reason == "" {
			reason = "This app does not have an equivalent setting."
		}
		value := inspection.Settings[key]
		if strings.Contains(strings.ToLower(key), "password") || strings.Contains(strings.ToLower(key), "secret") {
			value = "Saved value hidden"
		}
		preview = append(preview, backupImportSettingPreview{
			Key:        "old." + key,
			Title:      key,
			FileValue:  raw(value),
			WillImport: false,
			Reason:     reason,
		})
	}
	if source, found := inspection.Settings["blocklist-url"].(string); found && source != "" && !validImportBlocklistSource(source) {
		preview = append(preview, backupImportSettingPreview{
			Key:        "old.blocklist-url",
			Title:      "blocklist-url",
			FileValue:  raw(source),
			WillImport: false,
			Reason:     "Blocklist sources here must use HTTPS.",
		})
	}

	return preview, nil
}

func transmissionStringSetting(values map[string]any, key string, fallback string) string {
	value, found := values[key].(string)
	if !found {
		return fallback
	}

	return value
}

func backupDecodeRawBoolean(value json.RawMessage, fallback bool) bool {
	var decoded bool
	if len(value) == 0 || json.Unmarshal(value, &decoded) != nil {
		return fallback
	}

	return decoded
}

func backupDecodeRawIntegerValue(value json.RawMessage, fallback int64) int64 {
	var decoded int64
	if len(value) == 0 || json.Unmarshal(value, &decoded) != nil {
		return fallback
	}

	return decoded
}

func backupDecodeRawString(value json.RawMessage, fallback string) string {
	var decoded string
	if len(value) == 0 || json.Unmarshal(value, &decoded) != nil {
		return fallback
	}

	return decoded
}

func backupDecodeRawStringList(value json.RawMessage) []string {
	decoded := []string{}
	_ = json.Unmarshal(value, &decoded)

	return decoded
}

func anotherTransmissionSkipReasons() map[string]string {
	return map[string]string{
		"rpc-bind-address":                     "Remote apps sign in with RPC logins here.",
		"rpc-enabled":                          "Remote apps sign in with RPC logins here.",
		"rpc-password":                         "Remote apps sign in with RPC logins here.",
		"rpc-port":                             "Remote apps sign in with RPC logins here.",
		"rpc-url":                              "Remote apps sign in with RPC logins here.",
		"rpc-username":                         "Remote apps sign in with RPC logins here.",
		"rpc-whitelist":                        "Remote apps sign in with RPC logins here.",
		"rpc-whitelist-enabled":                "Remote apps sign in with RPC logins here.",
		"rpc-authentication-required":          "Remote apps sign in with RPC logins here.",
		"rpc-host-whitelist":                   "Remote apps sign in with RPC logins here.",
		"rpc-host-whitelist-enabled":           "Remote apps sign in with RPC logins here.",
		"rpc-socket-mode":                      "Remote apps sign in with RPC logins here.",
		"peer-port":                            "Each VPN connection has its own peer port.",
		"peer-port-random-on-start":            "Each VPN connection has its own peer port.",
		"peer-port-random-low":                 "Each VPN connection has its own peer port.",
		"peer-port-random-high":                "Each VPN connection has its own peer port.",
		"bind-address-ipv4":                    "Traffic always leaves through the VPN.",
		"bind-address-ipv6":                    "Traffic always leaves through the VPN.",
		"watch-dir":                            "Watch folders are not supported.",
		"watch-dir-enabled":                    "Watch folders are not supported.",
		"watch-dir-force-generic":              "Watch folders are not supported.",
		"script-torrent-added-enabled":         "Scripts are not supported.",
		"script-torrent-added-filename":        "Scripts are not supported.",
		"script-torrent-done-enabled":          "Scripts are not supported.",
		"script-torrent-done-filename":         "Scripts are not supported.",
		"script-torrent-done-seeding-enabled":  "Scripts are not supported.",
		"script-torrent-done-seeding-filename": "Scripts are not supported.",
		"alt-speed-enabled":                    "Alternative speed schedules are not supported.",
		"alt-speed-down":                       "Alternative speed schedules are not supported.",
		"alt-speed-up":                         "Alternative speed schedules are not supported.",
		"alt-speed-time-begin":                 "Alternative speed schedules are not supported.",
		"alt-speed-time-end":                   "Alternative speed schedules are not supported.",
		"alt-speed-time-day":                   "Alternative speed schedules are not supported.",
		"alt-speed-time-enabled":               "Alternative speed schedules are not supported.",
		"encryption":                           "Encryption policy is managed by this app.",
		"dht-enabled":                          "Peer discovery is managed by this app.",
		"pex-enabled":                          "Peer discovery is managed by this app.",
		"lpd-enabled":                          "Peer discovery is managed by this app.",
		"utp-enabled":                          "Transport behavior is managed by this app.",
		"rename-partial-files":                 "Renaming partial files is not supported.",
		"port-forwarding-enabled":              "Each VPN connection manages its own incoming port.",
	}
}

// discoverAnotherTransmissionFolders finds used, default, incomplete, and empty sibling folders.
func discoverAnotherTransmissionFolders(
	inspection anotherTransmissionInspection,
) []anotherTransmissionFolder {
	counts := map[string]int{}
	for _, torrent := range inspection.Torrents {
		counts[torrent.DownloadDirectory]++
	}
	foldersByPath := map[string]anotherTransmissionFolder{}
	defaultPath := inspection.DefaultDownloadDirectory
	foldersByPath[defaultPath] = anotherTransmissionFolder{
		Path:         defaultPath,
		Kind:         "default",
		Description:  "Old default folder",
		TorrentCount: counts[defaultPath],
	}
	for path, count := range counts {
		if path == defaultPath {
			continue
		}
		foldersByPath[path] = anotherTransmissionFolder{
			Path:         path,
			Kind:         "download",
			TorrentCount: count,
		}
	}
	if inspection.IncompleteDirectory != "" {
		incompleteCount := 0
		for _, torrent := range inspection.Torrents {
			if torrent.HasResume && !torrent.Complete {
				incompleteCount++
			}
		}
		if existing, found := foldersByPath[inspection.IncompleteDirectory]; found {
			existing.Description = strings.Trim(strings.Join([]string{
				existing.Description,
				"Unfinished downloads",
			}, " · "), " ·")
			if incompleteCount > existing.TorrentCount {
				existing.TorrentCount = incompleteCount
			}
			foldersByPath[inspection.IncompleteDirectory] = existing
		} else {
			foldersByPath[inspection.IncompleteDirectory] = anotherTransmissionFolder{
				Path:         inspection.IncompleteDirectory,
				Kind:         "incomplete",
				Description:  "Unfinished downloads",
				TorrentCount: incompleteCount,
			}
		}
	}

	usedPaths := map[string]struct{}{}
	for path := range foldersByPath {
		usedPaths[filepath.Clean(path)] = struct{}{}
	}
	// Siblings are read from this container, so a parent is scanned only when one of the
	// old download folders exists here at the same path. That keeps folders that merely
	// share a path with this installation, and the filesystem root, out of the list.
	parents := map[string]struct{}{}
	for _, folder := range foldersByPath {
		if folder.Kind == "incomplete" {
			continue
		}
		parent := filepath.Dir(folder.Path)
		if parent == string(filepath.Separator) {
			continue
		}
		if info, err := os.Stat(folder.Path); err != nil || !info.IsDir() {
			continue
		}
		parents[parent] = struct{}{}
	}
	parentPaths := make([]string, 0, len(parents))
	for parent := range parents {
		parentPaths = append(parentPaths, parent)
	}
	sort.Strings(parentPaths)
	for _, parent := range parentPaths {
		if importPathForbidden(parent) {
			continue
		}
		entries, err := os.ReadDir(parent)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			if entry.Type()&os.ModeSymlink != 0 || !entry.IsDir() {
				continue
			}
			path := filepath.Join(parent, entry.Name())
			if _, used := usedPaths[path]; used {
				continue
			}
			if len(foldersByPath) >= maximumTransmissionSourceFolders {
				break
			}
			foldersByPath[path] = anotherTransmissionFolder{
				Path:        path,
				Kind:        "empty",
				Description: "No torrents",
				Empty:       true,
			}
		}
	}

	folders := make([]anotherTransmissionFolder, 0, len(foldersByPath))
	for _, folder := range foldersByPath {
		folders = append(folders, folder)
	}
	kindOrder := map[string]int{"default": 0, "download": 1, "incomplete": 2, "empty": 3}
	sort.SliceStable(folders, func(left int, right int) bool {
		if kindOrder[folders[left].Kind] != kindOrder[folders[right].Kind] {
			return kindOrder[folders[left].Kind] < kindOrder[folders[right].Kind]
		}

		return strings.ToLower(folders[left].Path) < strings.ToLower(folders[right].Path)
	})

	return folders
}

// buildAnotherTransmissionPreview produces the wizard model from one inspection.
func (server *Server) buildAnotherTransmissionPreview(
	ctx context.Context,
	inspection anotherTransmissionInspection,
	folderMappings map[string]string,
) (backupImportPreview, error) {
	currentProfiles, err := server.store.ListTorrentProfiles(ctx)
	if err != nil {
		return backupImportPreview{}, err
	}
	currentDefault, err := server.store.DefaultTorrentProfile(ctx)
	if err != nil {
		return backupImportPreview{}, err
	}
	connections, err := server.store.ListVPNConnections(ctx)
	if err != nil {
		return backupImportPreview{}, err
	}
	preview := backupImportPreview{
		ExportedAt:      server.backupClock().UTC(),
		AppVersion:      fmt.Sprintf("Transmission %d", inspection.Version),
		Folders:         []backupImportFolderPreview{},
		Profiles:        []backupImportProfilePreview{},
		Settings:        append([]backupImportSettingPreview{}, inspection.SettingPreview...),
		Sections:        []string{"Settings and profiles", "Labels", "Torrent list"},
		TorrentCount:    len(inspection.Torrents),
		HasRemoteLogins: false,
		TotalSizeBytes:  inspection.TotalSizeBytes,
		Connections:     []backupImportConnectionPreview{},
		SourceDetails: &backupImportSourcePreview{
			Version:       inspection.Version,
			SettingsFile:  "settings.json",
			TorrentCount:  len(inspection.Torrents),
			ReadOnly:      true,
			IncompleteDir: inspection.IncompleteDirectory,
		},
	}
	for _, connection := range connections {
		preview.Connections = append(preview.Connections, backupImportConnectionPreview{
			ID:      connection.ID,
			Name:    connection.Name,
			Default: connection.IsDefault,
		})
	}

	explicitMappings := folderMappings
	if explicitMappings == nil {
		explicitMappings = map[string]string{}
	}
	resolvedMappings := map[string]string{}
	for _, folder := range inspection.Folders {
		mappedPath := strings.TrimSpace(explicitMappings[folder.Path])
		if mappedPath == "" {
			mappedPath = server.existingTransmissionTargetPath(ctx, folder.Path)
		}
		resolvedMappings[folder.Path] = mappedPath
	}
	mapAnotherTransmissionIncompleteFolder(preview.Settings, inspection, resolvedMappings)
	dataCounts := anotherTransmissionDataCounts(inspection, resolvedMappings)
	folderConflicts := anotherTransmissionFolderConflicts(inspection, resolvedMappings, nil, currentProfiles)
	for _, folder := range inspection.Folders {
		count := dataCounts[folder.Path]
		status := "not-found"
		dataFound := false
		if folder.Empty || count.Total == 0 {
			status = "empty"
		} else if count.Found == count.Total {
			status = "found"
			dataFound = true
		} else if count.Found > 0 {
			status = "partial"
		}
		preview.Folders = append(preview.Folders, backupImportFolderPreview{
			SourcePath:      folder.Path,
			Kind:            folder.Kind,
			Description:     folder.Description,
			MappedPath:      resolvedMappings[folder.Path],
			TorrentCount:    folder.TorrentCount,
			DataFound:       dataFound,
			DataFoundCount:  count.Found,
			DataTotal:       count.Total,
			DataFoundStatus: status,
			Conflict:        folderConflicts[folder.Path],
		})
	}
	presentTorrents, _ := server.refreshTorrentHashIndex(ctx)
	for _, torrent := range inspection.Torrents {
		if _, present := presentTorrents[strings.ToLower(torrent.Hash)]; present {
			preview.AlreadyPresent++

			continue
		}
		if anotherTransmissionTorrentDataFound(inspection, torrent, resolvedMappings) {
			preview.DataFoundBytes += torrent.SizeBytes
		} else {
			preview.DataMissing++
		}
		if !torrent.Paused {
			preview.RunningCount++
		}
	}

	ownedFolders, err := server.ownedTorrentProfileFolders(ctx)
	if err != nil {
		return backupImportPreview{}, err
	}
	usedNames := map[string]int{}
	for _, folder := range inspection.Folders {
		if folder.Kind == "incomplete" {
			continue
		}
		name := currentDefault.Name
		defaultProfile := folder.Kind == "default"
		if !defaultProfile {
			name = anotherTransmissionProfileName(folder.Path, resolvedMappings[folder.Path], ownedFolders, usedNames)
		}
		profilePreview := backupImportProfilePreview{
			ID:              anotherTransmissionProfileID(folder.Path),
			Name:            name,
			Default:         defaultProfile,
			SuggestedAction: "replace",
			SourcePath:      folder.Path,
			Empty:           folder.Empty,
			Included:        true,
		}
		if folder.Empty {
			profilePreview.Note = "No torrents · an app may send here"
		}
		if defaultProfile {
			defaultID := "default"
			existingName := currentDefault.Name
			profilePreview.ID = "default"
			profilePreview.ExistingID = &defaultID
			profilePreview.ExistingName = &existingName
		} else {
			for _, currentProfile := range currentProfiles {
				if strings.EqualFold(currentProfile.Name, name) {
					existingID := currentProfile.ID
					existingName := currentProfile.Name
					profilePreview.ExistingID = &existingID
					profilePreview.ExistingName = &existingName
					break
				}
			}
		}
		preview.Profiles = append(preview.Profiles, profilePreview)
	}

	return preview, nil
}

type anotherTransmissionDataCount struct {
	Found      int
	Total      int
	FoundBytes int64
}

func anotherTransmissionDataCounts(
	inspection anotherTransmissionInspection,
	mappings map[string]string,
) map[string]anotherTransmissionDataCount {
	counts := map[string]anotherTransmissionDataCount{}
	for _, folder := range inspection.Folders {
		counts[folder.Path] = anotherTransmissionDataCount{}
	}
	for _, torrent := range inspection.Torrents {
		sourcePath := anotherTransmissionTorrentSourcePath(inspection, torrent)
		count := counts[sourcePath]
		count.Total++
		if anotherTransmissionTorrentDataFound(inspection, torrent, mappings) {
			count.Found++
			count.FoundBytes += torrent.SizeBytes
		}
		counts[sourcePath] = count
	}

	return counts
}

// anotherTransmissionTorrentSourcePath returns the old folder that holds a torrent's data now.
func anotherTransmissionTorrentSourcePath(
	inspection anotherTransmissionInspection,
	torrent anotherTransmissionTorrent,
) string {
	if inspection.IncompleteDirectoryEnabled && torrent.HasResume && !torrent.Complete {
		return inspection.IncompleteDirectory
	}

	return torrent.DownloadDirectory
}

// anotherTransmissionTorrentDataFound looks for a torrent's top-level entry in its mapped folders.
//
// The mapped download and incomplete folders are both checked, including Transmission's
// .part name, because a check here can move an unfinished file between them.
func anotherTransmissionTorrentDataFound(
	inspection anotherTransmissionInspection,
	torrent anotherTransmissionTorrent,
	mappings map[string]string,
) bool {
	folders := []string{strings.TrimSpace(mappings[torrent.DownloadDirectory])}
	if inspection.IncompleteDirectoryEnabled {
		folders = append(folders, strings.TrimSpace(mappings[inspection.IncompleteDirectory]))
	}
	for _, folder := range folders {
		if folder == "" {
			continue
		}
		if safeTopLevelEntryExists(folder, torrent.TopLevelName) ||
			safeTopLevelEntryExists(folder, torrent.TopLevelName+".part") {
			return true
		}
	}

	return false
}

func safeTopLevelEntryExists(folder string, name string) bool {
	if filepath.Base(name) != name || name == "." || name == ".." {
		return false
	}
	info, err := os.Lstat(filepath.Join(folder, name))

	return err == nil && info.Mode()&os.ModeSymlink == 0
}

func (server *Server) existingTransmissionTargetPath(ctx context.Context, path string) string {
	normalized, err := settings.NormalizeDataPath(path)
	if err != nil || normalized != path {
		return ""
	}
	if server.directoryBrowser != nil {
		if _, err := server.directoryBrowser.List(ctx, path); err == nil {
			return path
		}

		return ""
	}
	info, err := os.Stat(path)
	if err == nil && info.IsDir() {
		return path
	}

	return ""
}

func suggestedProfileName(path string) string {
	name := strings.TrimSpace(filepath.Base(filepath.Clean(path)))
	if name == "" || name == "." || name == string(filepath.Separator) {
		return "Imported"
	}
	runes := []rune(strings.ReplaceAll(name, "-", " "))
	if len(runes) <= 2 {
		// Two-letter folder names are usually abbreviations, such as tv or pc.
		return strings.ToUpper(string(runes))
	}
	if len(runes) > 0 {
		runes[0] = unicode.ToUpper(runes[0])
	}

	return string(runes)
}

func uniqueAnotherTransmissionProfileName(name string, used map[string]int) string {
	key := strings.ToLower(name)
	used[key]++
	if used[key] == 1 {
		return name
	}

	return fmt.Sprintf("%s %d", name, used[key])
}

func anotherTransmissionProfileID(path string) string {
	digest := sha256.Sum256([]byte(filepath.Clean(path)))

	return "tpr-" + hex.EncodeToString(digest[:8])
}

// buildAnotherTransmissionDocument converts an inspection and user choices to a durable job payload.
func (server *Server) buildAnotherTransmissionDocument(
	ctx context.Context,
	inspection anotherTransmissionInspection,
	input backupImportRequest,
) (backupDocument, error) {
	if input.FolderMappings == nil {
		input.FolderMappings = map[string]string{}
	}
	for _, folder := range inspection.Folders {
		targetPath := strings.TrimSpace(input.FolderMappings[folder.Path])
		if targetPath == "" {
			targetPath = server.existingTransmissionTargetPath(ctx, folder.Path)
			input.FolderMappings[folder.Path] = targetPath
		}
		if err := server.validateAnotherTransmissionTarget(ctx, folder.Path, targetPath); err != nil {
			return backupDocument{}, err
		}
	}
	// Each profile owns one folder, so two old download folders cannot share a target.
	targetOwners := map[string]string{}
	for _, folder := range inspection.Folders {
		if folder.Kind == "incomplete" {
			continue
		}
		if folder.Empty {
			if selected, found := input.ProfileIncluded[folder.Path]; found && !selected {
				continue
			}
		}
		targetKey := strings.ToLower(filepath.Clean(input.FolderMappings[folder.Path]))
		if owner, duplicate := targetOwners[targetKey]; duplicate {
			return backupDocument{}, fmt.Errorf(
				"%s and %s are both mapped to %s. Map each folder to its own folder.",
				owner,
				folder.Path,
				input.FolderMappings[folder.Path],
			)
		}
		targetOwners[targetKey] = folder.Path
	}
	existingProfiles, err := server.store.ListTorrentProfiles(ctx)
	if err != nil {
		return backupDocument{}, err
	}
	nestingConflicts := anotherTransmissionFolderConflicts(inspection, input.FolderMappings, input.ProfileIncluded, existingProfiles)
	for _, folder := range inspection.Folders {
		if message, found := nestingConflicts[folder.Path]; found {
			return backupDocument{}, fmt.Errorf("%s: %s", folder.Path, message)
		}
	}

	currentDefault, err := server.store.DefaultTorrentProfile(ctx)
	if err != nil {
		return backupDocument{}, err
	}
	defaultConnection, err := server.store.DefaultVPNConnection(ctx)
	if err != nil {
		return backupDocument{}, errors.New("A default VPN connection is required before importing torrents.")
	}
	now := server.backupClock().UTC()
	settingsToImport := make([]backupSetting, 0, len(inspection.MappedSettings))
	for _, importedSetting := range inspection.MappedSettings {
		setting := importedSetting
		switch setting.Key {
		case "transmission.downloadDirectory":
			setting.Value, _ = json.Marshal(input.FolderMappings[inspection.DefaultDownloadDirectory])
		case "transmission.incompleteDirectory":
			setting.Value, _ = json.Marshal(input.FolderMappings[inspection.IncompleteDirectory])
		}
		settingsToImport = append(settingsToImport, setting)
	}

	ownedFolders, err := server.ownedTorrentProfileFolders(ctx)
	if err != nil {
		return backupDocument{}, err
	}
	usedNames := map[string]int{}
	profiles := []storage.TorrentProfile{}
	profileNames := map[string]string{}
	profileIDs := map[string]string{}
	seenNames := map[string]string{strings.ToLower(currentDefault.Name): "Default"}
	for _, folder := range inspection.Folders {
		if folder.Kind == "incomplete" || folder.Kind == "default" {
			continue
		}
		included := true
		if folder.Empty {
			if selected, found := input.ProfileIncluded[folder.Path]; found {
				included = selected
			}
		}
		if !included {
			continue
		}
		suggestedName := anotherTransmissionProfileName(folder.Path, input.FolderMappings[folder.Path], ownedFolders, usedNames)
		name := strings.TrimSpace(input.ProfileNames[folder.Path])
		if name == "" {
			name = suggestedName
		}
		if utf8.RuneCountInString(name) > 64 {
			return backupDocument{}, fmt.Errorf("The profile name for %s is too long.", folder.Path)
		}
		if owner, duplicate := seenNames[strings.ToLower(name)]; duplicate {
			return backupDocument{}, fmt.Errorf("The profile name %q is also used by %s.", name, owner)
		}
		seenNames[strings.ToLower(name)] = folder.Path
		profileID := anotherTransmissionProfileID(folder.Path)
		connectionID := selectedAnotherTransmissionConnection(input.ProfileConnections[folder.Path])
		if connectionID != nil {
			if _, err := server.store.VPNConnectionByID(ctx, *connectionID); err != nil {
				return backupDocument{}, fmt.Errorf("The selected VPN connection for %s is unavailable.", name)
			}
		}
		profiles = append(profiles, storage.TorrentProfile{
			ID:                profileID,
			Name:              name,
			DownloadDirectory: input.FolderMappings[folder.Path],
			Labels:            []string{},
			StartPaused:       inspection.DefaultStartPaused,
			Options:           inspection.DefaultOptions,
			MatchPatterns:     []string{},
			ConnectionID:      connectionID,
			CreatedAt:         now,
			UpdatedAt:         now,
		})
		profileNames[folder.Path] = name
		profileIDs[folder.Path] = profileID
	}

	torrents := make([]backupTorrent, 0, len(inspection.Torrents))
	labelSet := map[string]struct{}{}
	for _, sourceTorrent := range inspection.Torrents {
		profileName := currentDefault.Name
		var profileID *string
		if sourceTorrent.DownloadDirectory != inspection.DefaultDownloadDirectory {
			mappedID := profileIDs[sourceTorrent.DownloadDirectory]
			if mappedID == "" {
				return backupDocument{}, fmt.Errorf("Create a profile for %s before importing its torrents.", sourceTorrent.DownloadDirectory)
			}
			profileName = profileNames[sourceTorrent.DownloadDirectory]
			profileID = &mappedID
		}
		labels := append([]string{}, sourceTorrent.Labels...)
		for _, label := range labels {
			labelSet[label] = struct{}{}
		}
		torrents = append(torrents, backupTorrent{
			Hash:              sourceTorrent.Hash,
			Name:              sourceTorrent.Name,
			Metainfo:          base64.StdEncoding.EncodeToString(sourceTorrent.Metainfo),
			ProfileID:         profileID,
			ProfileName:       profileName,
			DownloadDirectory: input.FolderMappings[sourceTorrent.DownloadDirectory],
			ConnectionID:      defaultConnection.ID,
			Labels:            labels,
			Paused:            sourceTorrent.Paused,
			PercentDone:       0,
			AddedDate:         sourceTorrent.AddedDate,
			Limits:            sourceTorrent.Limits,
		})
	}
	labels := make([]string, 0, len(labelSet))
	for label := range labelSet {
		labels = append(labels, label)
	}
	sort.Slice(labels, func(left int, right int) bool {
		return strings.ToLower(labels[left]) < strings.ToLower(labels[right])
	})
	document := backupDocument{
		Format:     backupFormatName,
		Version:    backupFormatVersion,
		ExportedAt: now,
		AppVersion: fmt.Sprintf("Transmission %d", inspection.Version),
		SettingsAndProfiles: &backupSettingsAndProfilesSection{
			Settings: settingsToImport,
			DefaultProfile: backupDefaultProfile{
				Name:              currentDefault.Name,
				DownloadDirectory: input.FolderMappings[inspection.DefaultDownloadDirectory],
				Labels:            []string{},
				StartPaused:       inspection.DefaultStartPaused,
				Options:           inspection.DefaultOptions,
			},
			Profiles: profiles,
		},
		Labels:   &labels,
		Torrents: &torrents,
	}
	if err := validateBackupDocument(document); err != nil {
		return backupDocument{}, fmt.Errorf("prepare another Transmission import: %w", err)
	}

	return document, nil
}

func selectedAnotherTransmissionConnection(value *string) *string {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil
	}
	connectionID := strings.TrimSpace(*value)

	return &connectionID
}

func (server *Server) validateAnotherTransmissionTarget(
	ctx context.Context,
	sourcePath string,
	targetPath string,
) error {
	normalizedPath, err := settings.NormalizeDataPath(targetPath)
	if err != nil || normalizedPath != targetPath {
		return fmt.Errorf("Choose an existing folder under /data for %s.", sourcePath)
	}
	if server.directoryBrowser != nil {
		if _, err := server.directoryBrowser.List(ctx, targetPath); err != nil {
			return fmt.Errorf("The mapped folder for %s does not exist.", sourcePath)
		}

		return nil
	}
	info, err := os.Stat(targetPath)
	if err != nil || !info.IsDir() {
		return fmt.Errorf("The mapped folder for %s does not exist.", sourcePath)
	}

	return nil
}

// handleListImportSourceDirectories exposes a read-only folder picker to administrators.
func (server *Server) handleListImportSourceDirectories(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	directory, err := listImportSourceDirectory(request.URL.Query().Get("path"))
	if err != nil {
		writeFieldError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"source_directory_invalid",
			"path",
			err.Error(),
		)

		return
	}
	writeJSON(responseWriter, http.StatusOK, map[string]any{"directory": directory})
}

func listImportSourceDirectory(path string) (importSourceDirectoryResponse, error) {
	cleanPath := filepath.Clean(strings.TrimSpace(path))
	if cleanPath == "." || cleanPath == "" {
		cleanPath = "/"
	}
	if !filepath.IsAbs(cleanPath) || importPathForbidden(cleanPath) {
		return importSourceDirectoryResponse{}, errors.New("That system folder cannot be browsed.")
	}
	resolvedPath, err := filepath.EvalSymlinks(cleanPath)
	if err != nil || importPathForbidden(resolvedPath) {
		return importSourceDirectoryResponse{}, errors.New("That folder cannot be read.")
	}
	directory, err := os.Open(resolvedPath)
	if err != nil {
		return importSourceDirectoryResponse{}, errors.New("That folder cannot be read.")
	}
	defer directory.Close()
	entries, err := directory.ReadDir(-1)
	if err != nil {
		return importSourceDirectoryResponse{}, errors.New("That folder cannot be read.")
	}
	response := importSourceDirectoryResponse{
		Path:        cleanPath,
		Directories: []importSourceDirectoryEntry{},
	}
	if cleanPath != "/" {
		response.ParentPath = filepath.Dir(cleanPath)
	}
	for _, entry := range entries {
		if entry.Type()&os.ModeSymlink != 0 || !entry.IsDir() {
			continue
		}
		childPath := filepath.Join(cleanPath, entry.Name())
		if importPathForbidden(childPath) {
			continue
		}
		response.Directories = append(response.Directories, importSourceDirectoryEntry{
			Name:          entry.Name(),
			Path:          childPath,
			HasSubfolders: importSourceDirectoryHasChildren(childPath),
		})
	}
	sort.Slice(response.Directories, func(left int, right int) bool {
		return strings.ToLower(response.Directories[left].Name) < strings.ToLower(response.Directories[right].Name)
	})

	return response, nil
}

func importSourceDirectoryHasChildren(path string) bool {
	directory, err := os.Open(path)
	if err != nil {
		return false
	}
	defer directory.Close()
	entries, err := directory.ReadDir(-1)
	if err != nil {
		return false
	}
	for _, entry := range entries {
		if entry.Type()&os.ModeSymlink == 0 && entry.IsDir() &&
			!importPathForbidden(filepath.Join(path, entry.Name())) {
			return true
		}
	}

	return false
}
