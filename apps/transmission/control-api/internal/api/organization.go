package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// Matches storage.MaximumTorrentLabels so automatically saved labels never exceed what the Edit dialog can send back.
const maximumTorrentOrganizationPresets = storage.MaximumTorrentLabels

// handleGetTorrentOrganization returns durable labels.
//
// The library loads this state independently from Transmission snapshots so empty
// presets remain usable and visible when no torrent currently references them.
func (server *Server) handleGetTorrentOrganization(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	organization, err := server.store.TorrentOrganization(request.Context())
	if err != nil {
		server.logInternalError("read torrent organization", err)
		writeError(
			responseWriter,
			http.StatusInternalServerError,
			"torrent_organization_unavailable",
			"Torrent organization is unavailable.",
		)

		return
	}

	writeJSON(responseWriter, http.StatusOK, organization)
}

// handleUpdateTorrentOrganization validates and replaces durable organization data.
//
// Label removals and renames reach every daemon before the saved list advances.
func (server *Server) handleUpdateTorrentOrganization(
	responseWriter http.ResponseWriter,
	request *http.Request,
) {
	var input struct {
		ExpectedRevision *int64                        `json:"expectedRevision"`
		Labels           *[]string                     `json:"labels"`
		RemovedLabels    *[]string                     `json:"removedLabels"`
		RenamedLabels    *[]storage.TorrentLabelRename `json:"renamedLabels"`
	}
	if err := decodeJSONBody(responseWriter, request, &input); err != nil {
		writeDecodeError(responseWriter, err)

		return
	}
	if input.ExpectedRevision == nil || *input.ExpectedRevision < 0 {
		writeFieldError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"invalid_request",
			"expectedRevision",
			"expectedRevision must be a non-negative integer.",
		)

		return
	}
	if input.Labels == nil || input.RemovedLabels == nil || input.RenamedLabels == nil {
		issues := []validationIssue{}
		if input.Labels == nil {
			issues = append(issues, newFieldIssue("labels", "labels must be an array."))
		}
		if input.RemovedLabels == nil {
			issues = append(issues, newFieldIssue("removedLabels", "removedLabels must be an array."))
		}
		if input.RenamedLabels == nil {
			issues = append(issues, newFieldIssue("renamedLabels", "renamedLabels must be an array."))
		}
		writeIssues(responseWriter, issues)

		return
	}

	labels, err := normalizeTorrentOrganizationLabels(*input.Labels)
	if err != nil {
		writeFieldError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"invalid_request",
			"labels",
			err.Error(),
		)

		return
	}
	removedLabels, err := normalizeTorrentOrganizationLabels(*input.RemovedLabels)
	if err != nil {
		writeFieldError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"invalid_request",
			"removedLabels",
			err.Error(),
		)

		return
	}
	if err := validateTorrentLabelRenames(*input.RenamedLabels); err != nil {
		writeFieldError(
			responseWriter,
			http.StatusUnprocessableEntity,
			"invalid_request",
			"renamedLabels",
			err.Error(),
		)

		return
	}

	current, err := server.store.TorrentOrganization(request.Context())
	if err != nil {
		server.logInternalError("read torrent organization before update", err)
		writeInternalError(responseWriter)

		return
	}
	if current.Revision != *input.ExpectedRevision {
		writeTorrentOrganizationRevisionConflict(responseWriter)

		return
	}
	changedTorrents, err := server.applyTorrentLabelOperations(
		request.Context(),
		removedLabels,
		*input.RenamedLabels,
	)
	if err != nil {
		server.logInternalError("apply torrent label operations", err)
		writeError(
			responseWriter,
			http.StatusServiceUnavailable,
			"torrent_organization_failed",
			"Torrent labels could not be updated on every connection.",
		)

		return
	}

	organization, err := server.store.UpdateTorrentOrganization(
		request.Context(),
		*input.ExpectedRevision,
		labels,
		removedLabels,
		*input.RenamedLabels,
	)
	if errors.Is(err, storage.ErrTorrentOrganizationRevisionConflict) {
		writeTorrentOrganizationRevisionConflict(responseWriter)

		return
	}
	if err != nil {
		server.logInternalError("update torrent organization", err)
		writeError(
			responseWriter,
			http.StatusInternalServerError,
			"torrent_organization_failed",
			"Torrent organization could not be saved.",
		)

		return
	}

	writeJSON(responseWriter, http.StatusOK, struct {
		storage.TorrentOrganization
		ChangedTorrents int `json:"changedTorrents"`
	}{
		TorrentOrganization: organization,
		ChangedTorrents:     changedTorrents,
	})
}

// normalizeTorrentOrganizationLabels validates, deduplicates, and sorts saved labels.
//
// Case-insensitive uniqueness matches the library's visual grouping while preserving
// the user's original capitalization for Transmission and display.
func normalizeTorrentOrganizationLabels(values []string) ([]string, error) {
	if len(values) > maximumTorrentOrganizationPresets {
		return nil, fmt.Errorf(
			"labels must contain no more than %d values",
			maximumTorrentOrganizationPresets,
		)
	}
	if err := validateLabels(values); err != nil {
		return nil, err
	}

	normalizedValues := make([]string, 0, len(values))
	seenValues := make(map[string]struct{}, len(values))
	for _, value := range values {
		normalizedValue := strings.ToLower(value)
		if _, found := seenValues[normalizedValue]; found {
			return nil, fmt.Errorf("label is duplicated: %s", value)
		}
		seenValues[normalizedValue] = struct{}{}
		normalizedValues = append(normalizedValues, value)
	}

	sort.Slice(normalizedValues, func(leftIndex int, rightIndex int) bool {
		leftValue := strings.ToLower(normalizedValues[leftIndex])
		rightValue := strings.ToLower(normalizedValues[rightIndex])
		if leftValue == rightValue {
			return normalizedValues[leftIndex] < normalizedValues[rightIndex]
		}

		return leftValue < rightValue
	})

	return normalizedValues, nil
}

func validateTorrentLabelRenames(renames []storage.TorrentLabelRename) error {
	if len(renames) > maximumTorrentOrganizationPresets {
		return fmt.Errorf(
			"renamedLabels must contain no more than %d values",
			maximumTorrentOrganizationPresets,
		)
	}
	seen := make(map[string]struct{}, len(renames))
	for _, rename := range renames {
		if err := validateLabels([]string{rename.From}); err != nil {
			return err
		}
		if err := validateLabels([]string{rename.To}); err != nil {
			return err
		}
		normalizedFrom := strings.ToLower(rename.From)
		if _, duplicate := seen[normalizedFrom]; duplicate {
			return fmt.Errorf("renamed label is duplicated: %s", rename.From)
		}
		seen[normalizedFrom] = struct{}{}
	}

	return nil
}

func (server *Server) applyTorrentLabelOperations(
	ctx context.Context,
	removedLabels []string,
	renamedLabels []storage.TorrentLabelRename,
) (int, error) {
	if len(removedLabels) == 0 && len(renamedLabels) == 0 {
		return 0, nil
	}

	result := server.mergedTorrents(ctx, []string{"hashString", "id", "labels"}, nil)
	if !result.Complete {
		return 0, errors.New("one or more Transmission daemons did not answer")
	}

	changed := 0
	for _, torrent := range result.Torrents {
		hash, _ := torrent["hashString"].(string)
		connectionID, _ := torrent["connectionId"].(string)
		currentLabels, valid := rpcStringList(torrent["labels"])
		if hash == "" || connectionID == "" || !valid {
			return changed, errors.New("Transmission omitted torrent label state")
		}
		updatedLabels := applyTorrentLabelChanges(
			currentLabels,
			removedLabels,
			renamedLabels,
		)
		if equalFoldedStringLists(currentLabels, updatedLabels) {
			continue
		}
		daemon, found := server.transmissionDaemonForConnection(ctx, connectionID)
		if !found {
			return changed, errors.New("a Transmission daemon is unavailable")
		}
		if err := daemon.Client.Call(ctx, "torrent-set", map[string]any{
			"ids":    []string{hash},
			"labels": updatedLabels,
		}, nil); err != nil {
			return changed, fmt.Errorf("set labels for torrent %s: %w", hash, err)
		}
		changed++
	}

	return changed, nil
}

func applyTorrentLabelChanges(
	labels []string,
	removedLabels []string,
	renamedLabels []storage.TorrentLabelRename,
) []string {
	removed := make(map[string]struct{}, len(removedLabels))
	for _, label := range removedLabels {
		removed[strings.ToLower(label)] = struct{}{}
	}
	renamed := make(map[string]string, len(renamedLabels))
	for _, rename := range renamedLabels {
		renamed[strings.ToLower(rename.From)] = rename.To
	}

	updated := make([]string, 0, len(labels))
	seen := make(map[string]struct{}, len(labels))
	for _, label := range labels {
		normalized := strings.ToLower(label)
		if _, remove := removed[normalized]; remove {
			continue
		}
		if replacement, rename := renamed[normalized]; rename {
			label = replacement
			normalized = strings.ToLower(label)
		}
		if _, duplicate := seen[normalized]; duplicate {
			continue
		}
		seen[normalized] = struct{}{}
		updated = append(updated, label)
	}

	return updated
}

func equalFoldedStringLists(left []string, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}

	return true
}

// saveTorrentLabels persists every label used by a successful write.
//
// The storage operation preserves the first case-insensitive spelling and advances
// the organization revision only when at least one label is new.
func (server *Server) saveTorrentLabels(
	ctx context.Context,
	labels []string,
) (storage.TorrentOrganization, error) {
	return server.store.EnsureTorrentLabels(ctx, labels)
}

// saveTorrentLabelsFromTorrents imports labels that predate saved organization data.
//
// The current snapshot avoids a write transaction when every observed label is
// already saved, which keeps periodic live refreshes read-only in steady state.
func (server *Server) saveTorrentLabelsFromTorrents(
	ctx context.Context,
	torrents []map[string]any,
) (storage.TorrentOrganization, error) {
	organization, err := server.store.TorrentOrganization(ctx)
	if err != nil {
		return storage.TorrentOrganization{}, err
	}
	known := make(map[string]struct{}, len(organization.Labels))
	for _, label := range organization.Labels {
		known[strings.ToLower(label)] = struct{}{}
	}
	missing := []string{}
	for _, torrent := range torrents {
		labels, valid := rpcStringList(torrent["labels"])
		if !valid {
			continue
		}
		for _, label := range labels {
			normalized := strings.ToLower(label)
			if label == "" {
				continue
			}
			if _, found := known[normalized]; found {
				continue
			}
			known[normalized] = struct{}{}
			missing = append(missing, label)
		}
	}
	if len(missing) == 0 {
		return organization, nil
	}

	return server.saveTorrentLabels(ctx, missing)
}

func writeTorrentOrganizationRevisionConflict(responseWriter http.ResponseWriter) {
	writeError(
		responseWriter,
		http.StatusConflict,
		"revision_conflict",
		"Torrent organization changed since this revision. Refresh and try again.",
	)
}
