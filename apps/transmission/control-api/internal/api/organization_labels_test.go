package api

import (
	"context"
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"testing"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// TestTorrentOrganizationRenamesAndRemovesLabelsAcrossDaemons applies free-tag edits.
func TestTorrentOrganizationRenamesAndRemovesLabelsAcrossDaemons(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"id": 7, "hashString": firstTestHash, "labels": []string{"Old", "Keep"},
				}}}
			}

			return map[string]any{}
		},
		func(call recordedTransmissionCall) any {
			if call.Method == "torrent-get" {
				return map[string]any{"torrents": []map[string]any{{
					"id": 9, "hashString": secondTestHash, "labels": []string{"work", "New"},
				}}}
			}

			return map[string]any{}
		},
	)

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/torrent-organization",
		`{"expectedRevision":0,"labels":["Keep","New"],"removedLabels":["old"],"renamedLabels":[{"from":"WORK","to":"New"}]}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK ||
		!strings.Contains(response.Body.String(), `"changedTorrents":2`) {
		testingObject.Fatalf("organization label update = %d: %s", response.Code, response.Body.String())
	}

	firstSet := findTransmissionCall(
		testingObject,
		fixture.firstFake.recordedCalls(),
		"torrent-set",
	)
	if !reflect.DeepEqual(firstSet.Arguments["ids"], []any{firstTestHash}) ||
		!reflect.DeepEqual(firstSet.Arguments["labels"], []any{"Keep"}) {
		testingObject.Fatalf("first label mutation = %#v", firstSet.Arguments)
	}
	secondSet := findTransmissionCall(
		testingObject,
		fixture.secondFake.recordedCalls(),
		"torrent-set",
	)
	if !reflect.DeepEqual(secondSet.Arguments["ids"], []any{secondTestHash}) ||
		!reflect.DeepEqual(secondSet.Arguments["labels"], []any{"New"}) {
		testingObject.Fatalf("second label mutation = %#v", secondSet.Arguments)
	}

	organization, err := fixture.server.store.TorrentOrganization(context.Background())
	if err != nil || organization.Revision != 1 ||
		!reflect.DeepEqual(organization.Labels, []string{"Keep", "New"}) {
		testingObject.Fatalf("stored organization = %+v, %v", organization, err)
	}
}

// TestTorrentOrganizationEditsProfileLabels keeps deleted labels out of profiles.
//
// The Edit labels operation removes and renames profile labels in the same storage
// transaction that replaces the saved organization list.
func TestTorrentOrganizationEditsProfileLabels(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(call recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{}}
		},
		func(call recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{}}
		},
	)
	ctx := context.Background()
	profile, err := fixture.server.store.CreateTorrentProfile(ctx, storage.TorrentProfile{
		ID:                "tpr-0000000000000091",
		Name:              "Profile labels",
		DownloadDirectory: "/data/profile-labels",
		Labels:            []string{"Old", "RenameMe", "Keep"},
		Options: storage.TorrentProfileOptions{
			Seeding:   storage.TorrentProfileSeeding{Mode: "never"},
			PeerLimit: 50,
			Queue:     "normal",
		},
		MatchPatterns: []string{},
	})
	if err != nil {
		testingObject.Fatalf("create labeled profile: %v", err)
	}
	defaultProfile, err := fixture.server.store.DefaultTorrentProfile(ctx)
	if err != nil {
		testingObject.Fatalf("read Default profile: %v", err)
	}
	defaultProfile.Labels = []string{"Old", "RenameMe", "Keep"}
	if _, err := fixture.server.store.UpdateDefaultTorrentProfile(ctx, defaultProfile); err != nil {
		testingObject.Fatalf("label Default profile: %v", err)
	}
	organization, err := fixture.server.store.TorrentOrganization(ctx)
	if err != nil {
		testingObject.Fatalf("read seeded organization: %v", err)
	}

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/torrent-organization",
		`{"expectedRevision":`+strconv.FormatInt(organization.Revision, 10)+`,"labels":["Keep","Renamed"],"removedLabels":["old"],"renamedLabels":[{"from":"renameme","to":"Renamed"}]}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusOK {
		testingObject.Fatalf("organization profile label update = %d: %s", response.Code, response.Body.String())
	}

	updatedProfile, err := fixture.server.store.FindTorrentProfile(ctx, profile.ID)
	if err != nil {
		testingObject.Fatalf("read updated profile: %v", err)
	}
	if !reflect.DeepEqual(updatedProfile.Labels, []string{"Renamed", "Keep"}) {
		testingObject.Fatalf("named profile labels = %#v", updatedProfile.Labels)
	}
	updatedDefaultProfile, err := fixture.server.store.DefaultTorrentProfile(ctx)
	if err != nil {
		testingObject.Fatalf("read updated Default profile: %v", err)
	}
	if !reflect.DeepEqual(updatedDefaultProfile.Labels, []string{"Renamed", "Keep"}) {
		testingObject.Fatalf("Default profile labels = %#v", updatedDefaultProfile.Labels)
	}
}
