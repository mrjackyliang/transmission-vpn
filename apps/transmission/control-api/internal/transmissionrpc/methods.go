package transmissionrpc

import (
	"context"
	"encoding/json"
	"strings"
	"unicode"
)

// Method identifies one native Transmission RPC operation.
//
// The compatible facade references these values while typed Adapter methods keep
// native method names out of the rest of the control plane.
//
// Since: 2.4.1
type Method string

const (
	MethodTorrentGet         Method = "torrent-get"
	MethodTorrentAdd         Method = "torrent-add"
	MethodTorrentSet         Method = "torrent-set"
	MethodTorrentRemove      Method = "torrent-remove"
	MethodTorrentStart       Method = "torrent-start"
	MethodTorrentStartNow    Method = "torrent-start-now"
	MethodTorrentStop        Method = "torrent-stop"
	MethodTorrentVerify      Method = "torrent-verify"
	MethodTorrentReannounce  Method = "torrent-reannounce"
	MethodTorrentRenamePath  Method = "torrent-rename-path"
	MethodTorrentSetLocation Method = "torrent-set-location"
	MethodQueueMoveTop       Method = "queue-move-top"
	MethodQueueMoveUp        Method = "queue-move-up"
	MethodQueueMoveDown      Method = "queue-move-down"
	MethodQueueMoveBottom    Method = "queue-move-bottom"
	MethodSessionGet         Method = "session-get"
	MethodSessionSet         Method = "session-set"
	MethodSessionStatistics  Method = "session-stats"
	MethodSessionClose       Method = "session-close"
	MethodFreeSpace          Method = "free-space"
	MethodPortTest           Method = "port-test"
	MethodGroupGet           Method = "group-get"
	MethodGroupSet           Method = "group-set"
	MethodBlocklistUpdate    Method = "blocklist-update"
)

// String returns the native spelling required by Transmission.
//
// Logging and the deliberate compatibility pass-through use this conversion
// without repeating upstream method literals outside this package.
//
// Since: 2.4.1
func (method Method) String() string {
	return string(method)
}

// TorrentField names one property requested from a torrent-get response.
//
// Field values stay centralized here so upstream schema changes do not spread
// through handlers, notification polling, backup restore, or move logic.
//
// Since: 2.4.1
type TorrentField string

const (
	TorrentFieldActivityDate            TorrentField = "activityDate"
	TorrentFieldAddedDate               TorrentField = "addedDate"
	TorrentFieldAvailability            TorrentField = "availability"
	TorrentFieldBandwidthPriority       TorrentField = "bandwidthPriority"
	TorrentFieldComment                 TorrentField = "comment"
	TorrentFieldCreator                 TorrentField = "creator"
	TorrentFieldDateCreated             TorrentField = "dateCreated"
	TorrentFieldDoneDate                TorrentField = "doneDate"
	TorrentFieldDownloadDirectory       TorrentField = "downloadDir"
	TorrentFieldDownloadedEver          TorrentField = "downloadedEver"
	TorrentFieldDownloadLimit           TorrentField = "downloadLimit"
	TorrentFieldDownloadLimited         TorrentField = "downloadLimited"
	TorrentFieldError                   TorrentField = "error"
	TorrentFieldErrorString             TorrentField = "errorString"
	TorrentFieldETA                     TorrentField = "eta"
	TorrentFieldFiles                   TorrentField = "files"
	TorrentFieldFileStats               TorrentField = "fileStats"
	TorrentFieldGroup                   TorrentField = "group"
	TorrentFieldHashString              TorrentField = "hashString"
	TorrentFieldHonorsSessionLimits     TorrentField = "honorsSessionLimits"
	TorrentFieldID                      TorrentField = "id"
	TorrentFieldIsFinished              TorrentField = "isFinished"
	TorrentFieldIsPrivate               TorrentField = "isPrivate"
	TorrentFieldIsStalled               TorrentField = "isStalled"
	TorrentFieldLabels                  TorrentField = "labels"
	TorrentFieldLeftUntilDone           TorrentField = "leftUntilDone"
	TorrentFieldMagnetLink              TorrentField = "magnetLink"
	TorrentFieldManualAnnounceTime      TorrentField = "manualAnnounceTime"
	TorrentFieldMaxConnectedPeers       TorrentField = "maxConnectedPeers"
	TorrentFieldMetadataPercentComplete TorrentField = "metadataPercentComplete"
	TorrentFieldName                    TorrentField = "name"
	TorrentFieldPeerLimit               TorrentField = "peer-limit"
	TorrentFieldPeers                   TorrentField = "peers"
	TorrentFieldPeersConnected          TorrentField = "peersConnected"
	TorrentFieldPeersFrom               TorrentField = "peersFrom"
	TorrentFieldPeersGettingFromUs      TorrentField = "peersGettingFromUs"
	TorrentFieldPeersSendingToUs        TorrentField = "peersSendingToUs"
	TorrentFieldPercentDone             TorrentField = "percentDone"
	TorrentFieldPieceCount              TorrentField = "pieceCount"
	TorrentFieldPieces                  TorrentField = "pieces"
	TorrentFieldPieceSize               TorrentField = "pieceSize"
	TorrentFieldPriorities              TorrentField = "priorities"
	TorrentFieldQueuePosition           TorrentField = "queuePosition"
	TorrentFieldRateDownload            TorrentField = "rateDownload"
	TorrentFieldRateUpload              TorrentField = "rateUpload"
	TorrentFieldRecheckProgress         TorrentField = "recheckProgress"
	TorrentFieldSecondsDownloading      TorrentField = "secondsDownloading"
	TorrentFieldSecondsSeeding          TorrentField = "secondsSeeding"
	TorrentFieldSeedIdleLimit           TorrentField = "seedIdleLimit"
	TorrentFieldSeedIdleMode            TorrentField = "seedIdleMode"
	TorrentFieldSeedRatioLimit          TorrentField = "seedRatioLimit"
	TorrentFieldSeedRatioMode           TorrentField = "seedRatioMode"
	TorrentFieldSizeWhenDone            TorrentField = "sizeWhenDone"
	TorrentFieldStartDate               TorrentField = "startDate"
	TorrentFieldStatus                  TorrentField = "status"
	TorrentFieldTotalSize               TorrentField = "totalSize"
	TorrentFieldTrackerList             TorrentField = "trackerList"
	TorrentFieldTrackers                TorrentField = "trackers"
	TorrentFieldTrackerStats            TorrentField = "trackerStats"
	TorrentFieldUploadedEver            TorrentField = "uploadedEver"
	TorrentFieldUploadLimit             TorrentField = "uploadLimit"
	TorrentFieldUploadLimited           TorrentField = "uploadLimited"
	TorrentFieldUploadRatio             TorrentField = "uploadRatio"
	TorrentFieldWanted                  TorrentField = "wanted"
	TorrentFieldWebseeds                TorrentField = "webseeds"
)

// TorrentArgument names one property sent to a torrent mutation.
//
// Typed mutation requests use these keys for the fields whose set of values is
// intentionally dynamic after application validation.
//
// Since: 2.4.1
type TorrentArgument string

const (
	TorrentArgumentAddedDate           TorrentArgument = "addedDate"
	TorrentArgumentBandwidthPriority   TorrentArgument = "bandwidthPriority"
	TorrentArgumentDownloadLimit       TorrentArgument = "downloadLimit"
	TorrentArgumentDownloadLimited     TorrentArgument = "downloadLimited"
	TorrentArgumentFilesUnwanted       TorrentArgument = "files-unwanted"
	TorrentArgumentFilesWanted         TorrentArgument = "files-wanted"
	TorrentArgumentGroup               TorrentArgument = "group"
	TorrentArgumentHonorsSessionLimits TorrentArgument = "honorsSessionLimits"
	TorrentArgumentLabels              TorrentArgument = "labels"
	TorrentArgumentPeerLimit           TorrentArgument = "peer-limit"
	TorrentArgumentPriorityHigh        TorrentArgument = "priority-high"
	TorrentArgumentPriorityLow         TorrentArgument = "priority-low"
	TorrentArgumentPriorityNormal      TorrentArgument = "priority-normal"
	TorrentArgumentQueuePosition       TorrentArgument = "queuePosition"
	TorrentArgumentSeedIdleLimit       TorrentArgument = "seedIdleLimit"
	TorrentArgumentSeedIdleMode        TorrentArgument = "seedIdleMode"
	TorrentArgumentSeedRatioLimit      TorrentArgument = "seedRatioLimit"
	TorrentArgumentSeedRatioMode       TorrentArgument = "seedRatioMode"
	TorrentArgumentTrackerList         TorrentArgument = "trackerList"
	TorrentArgumentUploadLimit         TorrentArgument = "uploadLimit"
	TorrentArgumentUploadLimited       TorrentArgument = "uploadLimited"
)

// TorrentFileField names one property inside a torrent files response.
//
// Content downloads use these tokens to inspect nested file completion state
// without importing native JSON names into handlers.
//
// Since: 2.4.1
type TorrentFileField string

const (
	TorrentFileFieldBytesCompleted TorrentFileField = "bytesCompleted"
	TorrentFileFieldLength         TorrentFileField = "length"
	TorrentFileFieldName           TorrentFileField = "name"
)

// SessionField names one property requested from session-get.
//
// The runner and API use these constants when they need only a bounded subset of
// the daemon session instead of its complete public response.
//
// Since: 2.4.1
type SessionField string

const (
	SessionFieldAlternateSpeedDown         SessionField = "alt-speed-down"
	SessionFieldAlternateSpeedEnabled      SessionField = "alt-speed-enabled"
	SessionFieldAlternateSpeedTimeBegin    SessionField = "alt-speed-time-begin"
	SessionFieldAlternateSpeedTimeDay      SessionField = "alt-speed-time-day"
	SessionFieldAlternateSpeedTimeEnabled  SessionField = "alt-speed-time-enabled"
	SessionFieldAlternateSpeedTimeEnd      SessionField = "alt-speed-time-end"
	SessionFieldAlternateSpeedUp           SessionField = "alt-speed-up"
	SessionFieldBlocklistEnabled           SessionField = "blocklist-enabled"
	SessionFieldCacheSizeMB                SessionField = "cache-size-mb"
	SessionFieldDHTEnabled                 SessionField = "dht-enabled"
	SessionFieldDownloadDirectory          SessionField = "download-dir"
	SessionFieldDownloadQueueEnabled       SessionField = "download-queue-enabled"
	SessionFieldDownloadQueueSize          SessionField = "download-queue-size"
	SessionFieldEncryption                 SessionField = "encryption"
	SessionFieldIdleSeedingLimit           SessionField = "idle-seeding-limit"
	SessionFieldIdleSeedingLimitEnabled    SessionField = "idle-seeding-limit-enabled"
	SessionFieldIncompleteDirectory        SessionField = "incomplete-dir"
	SessionFieldIncompleteDirectoryEnabled SessionField = "incomplete-dir-enabled"
	SessionFieldLPDEnabled                 SessionField = "lpd-enabled"
	SessionFieldPeerLimitGlobal            SessionField = "peer-limit-global"
	SessionFieldPEXEnabled                 SessionField = "pex-enabled"
	SessionFieldQueueStalledEnabled        SessionField = "queue-stalled-enabled"
	SessionFieldQueueStalledMinutes        SessionField = "queue-stalled-minutes"
	SessionFieldRenamePartialFiles         SessionField = "rename-partial-files"
	SessionFieldRPCVersion                 SessionField = "rpc-version"
	SessionFieldRPCVersionSemantic         SessionField = "rpc-version-semver"
	SessionFieldSeedQueueEnabled           SessionField = "seed-queue-enabled"
	SessionFieldSeedQueueSize              SessionField = "seed-queue-size"
	SessionFieldSpeedLimitDown             SessionField = "speed-limit-down"
	SessionFieldSpeedLimitDownEnabled      SessionField = "speed-limit-down-enabled"
	SessionFieldSpeedLimitUp               SessionField = "speed-limit-up"
	SessionFieldSpeedLimitUpEnabled        SessionField = "speed-limit-up-enabled"
	SessionFieldStartAddedTorrents         SessionField = "start-added-torrents"
	SessionFieldTrashOriginalTorrentFiles  SessionField = "trash-original-torrent-files"
	SessionFieldUTPEnabled                 SessionField = "utp-enabled"
	SessionFieldVersion                    SessionField = "version"
)

const (
	ArgumentDeleteLocalData     = "delete-local-data"
	ArgumentDownloadDirectory   = "download-dir"
	ArgumentFields              = "fields"
	ArgumentFilename            = "filename"
	ArgumentFormat              = "format"
	ArgumentIDs                 = "ids"
	ArgumentIncompleteDirectory = "incomplete-dir"
	ArgumentLabels              = "labels"
	ArgumentLocation            = "location"
	ArgumentMetainfo            = "metainfo"
	ArgumentMove                = "move"
	ArgumentName                = "name"
	ArgumentPath                = "path"
	ArgumentPaused              = "paused"
	ResponseArguments           = "arguments"
	ResponseBlocklistSize       = "blocklist-size"
	ResponseRemoved             = "removed"
	ResponseResult              = "result"
	ResponseTag                 = "tag"
	ResponseTorrentAdded        = "torrent-added"
	ResponseTorrentDuplicate    = "torrent-duplicate"
	ResponseTorrents            = "torrents"
	RequestJSONRPC              = "jsonrpc"
	RequestMethod               = "method"
)

// LegacyRequest is the compatible Transmission request envelope.
//
// The web UI facade deliberately accepts this native shape, while keeping its
// upstream JSON field names owned by the adapter package.
//
// Since: 2.4.1
type LegacyRequest struct {
	Method    string          `json:"method"`
	Arguments json.RawMessage `json:"arguments"`
	Tag       json.RawMessage `json:"tag"`
	JSONRPC   json.RawMessage `json:"jsonrpc"`
}

var summaryTorrentFields = []TorrentField{
	TorrentFieldActivityDate,
	TorrentFieldAddedDate,
	TorrentFieldDownloadDirectory,
	TorrentFieldDownloadedEver,
	TorrentFieldError,
	TorrentFieldErrorString,
	TorrentFieldETA,
	TorrentFieldHashString,
	TorrentFieldID,
	TorrentFieldIsFinished,
	TorrentFieldIsPrivate,
	TorrentFieldIsStalled,
	TorrentFieldLabels,
	TorrentFieldLeftUntilDone,
	TorrentFieldMetadataPercentComplete,
	TorrentFieldName,
	TorrentFieldPeersConnected,
	TorrentFieldPeersGettingFromUs,
	TorrentFieldPeersSendingToUs,
	TorrentFieldPercentDone,
	TorrentFieldQueuePosition,
	TorrentFieldRateDownload,
	TorrentFieldRateUpload,
	TorrentFieldRecheckProgress,
	TorrentFieldSizeWhenDone,
	TorrentFieldStatus,
	TorrentFieldTotalSize,
	TorrentFieldUploadedEver,
	TorrentFieldUploadRatio,
}

var detailTorrentFields = append(append([]TorrentField{}, summaryTorrentFields...),
	TorrentFieldAvailability,
	TorrentFieldBandwidthPriority,
	TorrentFieldComment,
	TorrentFieldCreator,
	TorrentFieldDateCreated,
	TorrentFieldDoneDate,
	TorrentFieldDownloadLimit,
	TorrentFieldDownloadLimited,
	TorrentFieldFileStats,
	TorrentFieldFiles,
	TorrentFieldHonorsSessionLimits,
	TorrentFieldMagnetLink,
	TorrentFieldManualAnnounceTime,
	TorrentFieldMaxConnectedPeers,
	TorrentFieldPeerLimit,
	TorrentFieldPeers,
	TorrentFieldPeersFrom,
	TorrentFieldPieceCount,
	TorrentFieldPieceSize,
	TorrentFieldPieces,
	TorrentFieldPriorities,
	TorrentFieldSecondsDownloading,
	TorrentFieldSecondsSeeding,
	TorrentFieldSeedIdleLimit,
	TorrentFieldSeedIdleMode,
	TorrentFieldSeedRatioLimit,
	TorrentFieldSeedRatioMode,
	TorrentFieldStartDate,
	TorrentFieldTrackerList,
	TorrentFieldTrackers,
	TorrentFieldTrackerStats,
	TorrentFieldUploadLimit,
	TorrentFieldUploadLimited,
	TorrentFieldWanted,
	TorrentFieldWebseeds,
)

// SummaryTorrentFields returns the stable torrent overview field order.
//
// The returned copy prevents a handler from changing later requests made by
// another goroutine.
//
// Since: 2.4.1
func SummaryTorrentFields() []TorrentField {
	return append([]TorrentField(nil), summaryTorrentFields...)
}

// DetailTorrentFields returns the stable complete torrent detail field order.
//
// Detail requests extend the summary order exactly as the existing API contract
// expects while keeping upstream names inside this package.
//
// Since: 2.4.1
func DetailTorrentFields() []TorrentField {
	return append([]TorrentField(nil), detailTorrentFields...)
}

// TorrentFields converts compatible-facade field names without changing order.
//
// Remote applications may request fields introduced by a newer Transmission, so
// the deliberate pass-through cannot restrict them to this package's known tokens.
//
// Since: 2.4.1
func TorrentFields(names []string) []TorrentField {
	fields := make([]TorrentField, len(names))
	for index, name := range names {
		fields[index] = TorrentField(name)
	}

	return fields
}

// Adapter exposes project-owned Transmission operations over a raw Caller.
//
// First-party code depends on these typed requests and responses; only the
// compatibility facade uses Call for its deliberate native pass-through.
//
// Since: 2.4.1
type Adapter struct {
	caller Caller
}

// NewAdapter wraps one validated native caller with the project-owned API.
//
// A nil caller returns nil so optional daemon dependencies retain their existing
// unavailable-state behavior without a placeholder implementation.
//
// Since: 2.4.1
func NewAdapter(caller Caller) *Adapter {
	if caller == nil {
		return nil
	}

	return &Adapter{caller: caller}
}

// Call forwards one native request for the compatibility RPC facade.
//
// First-party handlers use the typed methods below. This escape hatch exists only
// because the facade intentionally preserves arbitrary Transmission payloads.
//
// Since: 2.4.1
func (adapter *Adapter) Call(ctx context.Context, method string, arguments any, result any) error {
	return adapter.caller.Call(ctx, method, arguments, result)
}

// Torrent is one project-owned decoded torrent-get object.
//
// Values remain dynamic because callers choose the field list, while typed field
// constants and accessors keep upstream JSON names centralized.
//
// Since: 2.4.1
type Torrent map[string]any

// Value returns one requested torrent value.
//
// Consumers use the typed field token rather than repeating an upstream JSON key.
//
// Since: 2.4.1
func (torrent Torrent) Value(field TorrentField) any {
	return torrent[string(field)]
}

// SetValue replaces one requested torrent value.
//
// Multi-daemon merging uses this to replace daemon-local identifiers with facade
// identifiers before returning a torrent to application callers.
//
// Since: 2.4.1
func (torrent Torrent) SetValue(field TorrentField, value any) {
	torrent[string(field)] = value
}

// DeleteValue removes one upstream torrent field.
//
// The compatibility facade uses this when it added routing fields that the remote
// application did not request.
//
// Since: 2.4.1
func (torrent Torrent) DeleteValue(field TorrentField) {
	delete(torrent, string(field))
}

// DecodeValue decodes one nested or strongly typed torrent value.
//
// This keeps nested Transmission JSON tags and conversion behavior inside the
// adapter while callers work with their own domain structures.
//
// Since: 2.4.1
func (torrent Torrent) DecodeValue(field TorrentField, target any) error {
	encoded, err := json.Marshal(torrent.Value(field))
	if err != nil {
		return err
	}

	return json.Unmarshal(encoded, target)
}

// ListTorrentsRequest selects fields and an optional native ID or hash selection.
//
// IDs may contain daemon-local integers, hashes, or recently-active for the
// compatibility facade's native selection semantics.
//
// Since: 2.4.1
type ListTorrentsRequest struct {
	Fields []TorrentField
	IDs    any
}

// ListTorrentsResponse contains the selected torrents and recently removed IDs.
//
// Removed is populated only when Transmission receives the recently-active
// selection, matching the native response contract.
//
// Since: 2.4.1
type ListTorrentsResponse struct {
	Torrents []Torrent `json:"torrents"`
	Removed  []int64   `json:"removed"`
}

// ListTorrents runs torrent-get with the exact requested field order.
//
// An absent selection omits ids on the wire, preserving full-list behavior.
//
// Since: 2.4.1
func (adapter *Adapter) ListTorrents(
	ctx context.Context,
	request ListTorrentsRequest,
) (ListTorrentsResponse, error) {
	arguments := map[string]any{
		ArgumentFields: request.Fields,
	}
	if request.IDs != nil {
		arguments[ArgumentIDs] = request.IDs
	}

	var response ListTorrentsResponse
	err := adapter.caller.Call(ctx, MethodTorrentGet.String(), arguments, &response)

	return response, err
}

// Session is one project-owned session-get response.
//
// Raw messages preserve native numbers and objects for the runner's settings merge
// while callers can decode only the fields they need.
//
// Since: 2.4.1
type Session map[string]json.RawMessage

// DecodeValue decodes one requested session field.
//
// A missing field returns nil after decoding a nil raw message, matching ordinary
// JSON zero-value behavior used by existing readiness checks.
//
// Since: 2.4.1
func (session Session) DecodeValue(field SessionField, target any) error {
	value := session[string(field)]
	if len(value) == 0 {
		return nil
	}

	return json.Unmarshal(value, target)
}

// GetSessionRequest identifies one session read and its optional field subset.
//
// A nil Fields slice omits arguments on the wire and reads the complete session;
// a non-nil slice sends exactly those fields in the given order.
//
// Since: 2.4.1
type GetSessionRequest struct {
	Fields []SessionField
}

// GetSession reads the native session, limited to the requested fields when given.
//
// The response keeps raw values for both direct API forwarding and runner merges.
//
// Since: 2.4.1
func (adapter *Adapter) GetSession(
	ctx context.Context,
	request GetSessionRequest,
) (Session, error) {
	var arguments any
	if request.Fields != nil {
		arguments = map[string]any{ArgumentFields: request.Fields}
	}

	var response Session
	err := adapter.caller.Call(ctx, MethodSessionGet.String(), arguments, &response)

	return response, err
}

// SetSessionRequest carries validated native session values.
//
// Settings mapping remains application-owned, while this request owns the typed
// operation boundary and prevents handlers from selecting a raw method.
//
// Since: 2.4.1
type SetSessionRequest struct {
	Values SessionValues
}

// SessionValues contains validated session-set properties keyed by adapter tokens.
//
// Configuration code converts its native map once before the adapter serializes it.
//
// Since: 2.4.1
type SessionValues map[SessionField]any

// SessionValuesFromNative converts a configuration mapper's native keys once at the
// adapter boundary.
//
// Since: 2.4.1
func SessionValuesFromNative(values map[string]any) SessionValues {
	if values == nil {
		return nil
	}
	converted := make(SessionValues, len(values))
	for key, value := range values {
		converted[SessionField(key)] = value
	}

	return converted
}

// SetSession applies validated session values to one daemon.
//
// Values are sent unchanged so existing setting key spelling and omission behavior
// remain identical.
//
// Since: 2.4.1
func (adapter *Adapter) SetSession(ctx context.Context, request SetSessionRequest) error {
	var values map[string]any
	if request.Values != nil {
		values = make(map[string]any, len(request.Values))
		for field, value := range request.Values {
			values[string(field)] = value
		}
	}

	return adapter.caller.Call(ctx, MethodSessionSet.String(), values, nil)
}

// CloseSession asks one daemon to exit its RPC session.
//
// The runner uses this after applying a restart snapshot so s6 can replace the
// daemon without changing tunnel state.
//
// Since: 2.4.1
func (adapter *Adapter) CloseSession(ctx context.Context) error {
	return adapter.caller.Call(ctx, MethodSessionClose.String(), nil, nil)
}

// FreeSpaceRequest identifies one validated data path.
//
// Path validation remains in the control API before this native request is sent.
//
// Since: 2.4.1
type FreeSpaceRequest struct {
	Path string
}

// FreeSpace is one native free-space response.
//
// Transmission versions may add result fields, so the adapter preserves the full
// decoded object for the application response.
//
// Since: 2.4.1
type FreeSpace map[string]any

// GetFreeSpace reads capacity for one validated path.
//
// The request always includes path exactly as the previous handler call did.
//
// Since: 2.4.1
func (adapter *Adapter) GetFreeSpace(
	ctx context.Context,
	request FreeSpaceRequest,
) (FreeSpace, error) {
	var response FreeSpace
	err := adapter.caller.Call(
		ctx,
		MethodFreeSpace.String(),
		map[string]any{ArgumentPath: request.Path},
		&response,
	)

	return response, err
}

// AddTorrentRequest describes one URL, magnet, or metainfo addition.
//
// Pointer fields preserve the distinction between omitted values and explicit
// false or empty values in the native request.
//
// Since: 2.4.1
type AddTorrentRequest struct {
	DownloadDirectory *string
	Filename          *string
	Labels            *[]string
	Metainfo          *string
	Paused            *bool
}

// AddedTorrent identifies the torrent returned by torrent-add.
//
// Both added and duplicate variants share this native summary shape.
//
// Since: 2.4.1
type AddedTorrent struct {
	ID         int64  `json:"id"`
	HashString string `json:"hashString"`
	Name       string `json:"name"`
}

// AddTorrentResponse distinguishes a new torrent from a duplicate.
//
// Exactly one pointer should be present in a valid Transmission response.
//
// Since: 2.4.1
type AddTorrentResponse struct {
	Added     *AddedTorrent `json:"torrent-added"`
	Duplicate *AddedTorrent `json:"torrent-duplicate"`
}

// AddTorrent sends one typed torrent-add request.
//
// Optional fields are inserted only when their pointers are present, preserving the
// exact omission behavior of the former argument maps.
//
// Since: 2.4.1
func (adapter *Adapter) AddTorrent(
	ctx context.Context,
	request AddTorrentRequest,
) (AddTorrentResponse, error) {
	arguments := map[string]any{}
	if request.DownloadDirectory != nil {
		arguments[ArgumentDownloadDirectory] = *request.DownloadDirectory
	}
	if request.Filename != nil {
		arguments[ArgumentFilename] = *request.Filename
	}
	if request.Labels != nil {
		arguments[ArgumentLabels] = *request.Labels
	}
	if request.Metainfo != nil {
		arguments[ArgumentMetainfo] = *request.Metainfo
	}
	if request.Paused != nil {
		arguments[ArgumentPaused] = *request.Paused
	}

	var response AddTorrentResponse
	err := adapter.caller.Call(ctx, MethodTorrentAdd.String(), arguments, &response)

	return response, err
}

// SetTorrentsRequest applies validated changes to one native selection.
//
// Changes use typed argument tokens while IDs may contain integers or hashes,
// matching Transmission's supported selection forms.
//
// Since: 2.4.1
type SetTorrentsRequest struct {
	IDs     any
	Changes map[TorrentArgument]any
}

// SetTorrents applies one typed torrent-set request.
//
// IDs is always included because every first-party mutation is explicitly routed to
// a known daemon selection.
//
// Since: 2.4.1
func (adapter *Adapter) SetTorrents(ctx context.Context, request SetTorrentsRequest) error {
	arguments := torrentMutationArguments(request.IDs, request.Changes)

	return adapter.caller.Call(ctx, MethodTorrentSet.String(), arguments, nil)
}

// SetTorrentLabelsRequest identifies one selection and its complete label list.
//
// Organization and profile operations use this narrower request when no other
// torrent property may change.
//
// Since: 2.4.1
type SetTorrentLabelsRequest struct {
	IDs    any
	Labels []string
}

// SetTorrentLabels applies only the labels field to one native selection.
//
// Label maintenance uses this narrow operation so no unrelated torrent option can
// enter the request.
//
// Since: 2.4.1
func (adapter *Adapter) SetTorrentLabels(ctx context.Context, request SetTorrentLabelsRequest) error {
	return adapter.SetTorrents(ctx, SetTorrentsRequest{
		IDs: request.IDs,
		Changes: map[TorrentArgument]any{
			TorrentArgumentLabels: request.Labels,
		},
	})
}

// RemoveTorrentsRequest identifies torrents and local-data deletion intent.
//
// DeleteLocalData is always emitted so cleanup and move rollback retain their
// existing explicit false behavior.
//
// Since: 2.4.1
type RemoveTorrentsRequest struct {
	IDs             any
	DeleteLocalData bool
}

// RemoveTorrents removes one typed native selection.
//
// The operation returns native validation errors unchanged for existing handler
// translation and rollback decisions.
//
// Since: 2.4.1
func (adapter *Adapter) RemoveTorrents(ctx context.Context, request RemoveTorrentsRequest) error {
	return adapter.caller.Call(ctx, MethodTorrentRemove.String(), map[string]any{
		ArgumentDeleteLocalData: request.DeleteLocalData,
		ArgumentIDs:             request.IDs,
	}, nil)
}

// SetLocationRequest moves one selection to a validated data path.
//
// Move controls whether Transmission moves existing data or only changes its
// configured location.
//
// Since: 2.4.1
type SetLocationRequest struct {
	IDs      any
	Location string
	Move     bool
}

// SetLocation applies one typed torrent-set-location request.
//
// The compatible facade continues to reject this method before reaching the
// adapter, while first-party profile moves use it directly.
//
// Since: 2.4.1
func (adapter *Adapter) SetLocation(ctx context.Context, request SetLocationRequest) error {
	return adapter.caller.Call(ctx, MethodTorrentSetLocation.String(), map[string]any{
		ArgumentIDs:      request.IDs,
		ArgumentLocation: request.Location,
		ArgumentMove:     request.Move,
	}, nil)
}

// RenameTorrentPathRequest identifies one relative path rename.
//
// Path and name validation remains in the application before this request reaches
// Transmission.
//
// Since: 2.4.1
type RenameTorrentPathRequest struct {
	IDs  any
	Name string
	Path string
}

// RenameTorrentPathResponse preserves native rename result fields.
//
// The facade may need to rewrite a returned daemon-local ID before forwarding it.
//
// Since: 2.4.1
type RenameTorrentPathResponse map[string]any

// RenameTorrentPath applies one typed torrent-rename-path request.
//
// Native response fields are returned unchanged for the console and facade.
//
// Since: 2.4.1
func (adapter *Adapter) RenameTorrentPath(
	ctx context.Context,
	request RenameTorrentPathRequest,
) (RenameTorrentPathResponse, error) {
	var response RenameTorrentPathResponse
	err := adapter.caller.Call(ctx, MethodTorrentRenamePath.String(), map[string]any{
		ArgumentIDs:  request.IDs,
		ArgumentName: request.Name,
		ArgumentPath: request.Path,
	}, &response)

	return response, err
}

// TorrentSelectionRequest identifies one typed torrent operation's native selection.
//
// Routed callers may provide daemon-local IDs or hashes after resolving the owning
// connection.
//
// Since: 2.4.1
type TorrentSelectionRequest struct {
	IDs any
}

// StartTorrents starts one native selection.
//
// This typed wrapper keeps method selection inside the adapter.
//
// Since: 2.4.1
func (adapter *Adapter) StartTorrents(ctx context.Context, request TorrentSelectionRequest) error {
	return adapter.callTorrentSelection(ctx, MethodTorrentStart, request)
}

// StartTorrentsNow starts one native selection ahead of queue order.
//
// This typed wrapper keeps method selection inside the adapter.
//
// Since: 2.4.1
func (adapter *Adapter) StartTorrentsNow(ctx context.Context, request TorrentSelectionRequest) error {
	return adapter.callTorrentSelection(ctx, MethodTorrentStartNow, request)
}

// StopTorrents pauses one native selection.
//
// This typed wrapper keeps method selection inside the adapter.
//
// Since: 2.4.1
func (adapter *Adapter) StopTorrents(ctx context.Context, request TorrentSelectionRequest) error {
	return adapter.callTorrentSelection(ctx, MethodTorrentStop, request)
}

// VerifyTorrents starts data verification for one native selection.
//
// This typed wrapper keeps method selection inside the adapter.
//
// Since: 2.4.1
func (adapter *Adapter) VerifyTorrents(ctx context.Context, request TorrentSelectionRequest) error {
	return adapter.callTorrentSelection(ctx, MethodTorrentVerify, request)
}

// ReannounceTorrents asks trackers to reannounce one native selection.
//
// This typed wrapper keeps method selection inside the adapter.
//
// Since: 2.4.1
func (adapter *Adapter) ReannounceTorrents(ctx context.Context, request TorrentSelectionRequest) error {
	return adapter.callTorrentSelection(ctx, MethodTorrentReannounce, request)
}

// MoveTorrentsToQueueTop moves one native selection to the queue front.
//
// This typed wrapper keeps method selection inside the adapter.
//
// Since: 2.4.1
func (adapter *Adapter) MoveTorrentsToQueueTop(ctx context.Context, request TorrentSelectionRequest) error {
	return adapter.callTorrentSelection(ctx, MethodQueueMoveTop, request)
}

// MoveTorrentsUp moves one native selection up by one queue position.
//
// This typed wrapper keeps method selection inside the adapter.
//
// Since: 2.4.1
func (adapter *Adapter) MoveTorrentsUp(ctx context.Context, request TorrentSelectionRequest) error {
	return adapter.callTorrentSelection(ctx, MethodQueueMoveUp, request)
}

// MoveTorrentsDown moves one native selection down by one queue position.
//
// This typed wrapper keeps method selection inside the adapter.
//
// Since: 2.4.1
func (adapter *Adapter) MoveTorrentsDown(ctx context.Context, request TorrentSelectionRequest) error {
	return adapter.callTorrentSelection(ctx, MethodQueueMoveDown, request)
}

// MoveTorrentsToQueueBottom moves one native selection to the queue end.
//
// This typed wrapper keeps method selection inside the adapter.
//
// Since: 2.4.1
func (adapter *Adapter) MoveTorrentsToQueueBottom(ctx context.Context, request TorrentSelectionRequest) error {
	return adapter.callTorrentSelection(ctx, MethodQueueMoveBottom, request)
}

// SessionStatistics is one native session-stats response.
//
// The multi-daemon API merges every numeric field and retains unknown values for
// compatibility with future Transmission versions.
//
// Since: 2.4.1
type SessionStatistics map[string]any

// GetSessionStatistics reads one daemon's transfer statistics.
//
// The native request has no arguments, matching the previous raw call.
//
// Since: 2.4.1
func (adapter *Adapter) GetSessionStatistics(ctx context.Context) (SessionStatistics, error) {
	var response SessionStatistics
	err := adapter.caller.Call(ctx, MethodSessionStatistics.String(), nil, &response)

	return response, err
}

func (adapter *Adapter) callTorrentSelection(
	ctx context.Context,
	method Method,
	request TorrentSelectionRequest,
) error {
	return adapter.caller.Call(ctx, method.String(), map[string]any{ArgumentIDs: request.IDs}, nil)
}

func torrentMutationArguments(ids any, changes map[TorrentArgument]any) map[string]any {
	arguments := make(map[string]any, len(changes)+1)
	arguments[ArgumentIDs] = ids
	for key, value := range changes {
		arguments[string(key)] = value
	}

	return arguments
}

// CanonicalArgumentKey normalizes legacy compatible-facade argument aliases.
//
// Keeping upstream spelling rules here prevents method-specific validation from
// duplicating Transmission field names in the HTTP proxy.
//
// Since: 2.4.1
func CanonicalArgumentKey(key string) string {
	var canonical strings.Builder
	canonical.Grow(len(key))
	var previous rune
	for index, character := range key {
		originalCharacter := character
		if character == '_' {
			character = '-'
		}
		if unicode.IsUpper(character) {
			if index > 0 && previous != '-' && previous != '_' && !unicode.IsUpper(previous) {
				canonical.WriteByte('-')
			}
			character = unicode.ToLower(character)
		}
		canonical.WriteRune(character)
		previous = originalCharacter
	}

	switch canonical.String() {
	case "cache-size-mib":
		return "cache-size-mb"
	case "peer-socket-tos":
		return "peer-socket-diffserv"
	case "remote-session-requres-authentication":
		return "remote-session-requires-authentication"
	default:
		return strings.ToLower(canonical.String())
	}
}

// SessionSetArgumentKey returns one safe native session-set field name.
//
// The compatibility facade allows only user-owned tuning values; scripting,
// listeners, and appliance-owned port controls remain excluded.
//
// Since: 2.4.1
func SessionSetArgumentKey(canonicalKey string) (string, bool) {
	switch canonicalKey {
	case "alt-speed-down", "alt-speed-enabled", "alt-speed-time-begin",
		"alt-speed-time-day", "alt-speed-time-enabled", "alt-speed-time-end",
		"alt-speed-up", "blocklist-enabled", "cache-size-mb", "dht-enabled",
		"download-dir", "download-queue-enabled", "download-queue-size",
		"encryption", "idle-seeding-limit", "idle-seeding-limit-enabled",
		"incomplete-dir", "incomplete-dir-enabled", "lpd-enabled",
		"peer-limit-global", "peer-limit-per-torrent", "pex-enabled",
		"queue-stalled-enabled", "queue-stalled-minutes", "rename-partial-files",
		"seed-queue-enabled", "seed-queue-size", "speed-limit-down",
		"speed-limit-down-enabled", "speed-limit-up", "speed-limit-up-enabled",
		"start-added-torrents", "trash-original-torrent-files", "utp-enabled":
		return canonicalKey, true
	case "seed-ratio-limit":
		return "seed_ratio_limit", true
	case "seed-ratio-limited":
		return "seed_ratio_limited", true
	default:
		return "", false
	}
}
