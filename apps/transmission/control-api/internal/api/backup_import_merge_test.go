package api

import (
	"context"
	"encoding/base64"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// TestBackupImportPreviewReportsMergeActions verifies that preview counts come from
// destination state without changing any selected section.
func TestBackupImportPreviewReportsMergeActions(testingObject *testing.T) {
	server, _, _ := newClaimedTestServer(testingObject)
	ctx := context.Background()
	now := time.Date(2026, time.November, 9, 12, 0, 0, 0, time.UTC)

	if _, err := server.store.CreateNotificationTarget(ctx, storage.NotificationTarget{
		ID:       "notification-current",
		Name:     "Alerts",
		Service:  "ntfy",
		Events:   []string{"vpn.disconnected"},
		Settings: map[string]string{"url": "https://current.example.test"},
	}); err != nil {
		testingObject.Fatalf("create current notification: %v", err)
	}
	if _, err := server.store.CreateRPCLogin(ctx, storage.RPCLogin{
		ID:           "rpl-current",
		Username:     "desktop",
		SecretDigest: []byte("current-rpc-digest"),
	}); err != nil {
		testingObject.Fatalf("create current RPC login: %v", err)
	}
	if _, err := server.store.CreateAPIToken(
		ctx,
		"token-current",
		1,
		"Current token",
		[]byte("current-token-digest"),
		[]string{"vpn:read"},
		nil,
	); err != nil {
		testingObject.Fatalf("create current API token: %v", err)
	}

	notifications := []backupNotification{
		{
			ID:       "notification-replacement",
			Name:     "ALERTS",
			Service:  "webhook",
			Events:   []string{"torrent.completed"},
			Settings: map[string]string{"url": "https://replacement.example.test"},
			Secrets:  map[string]string{},
		},
		{
			ID:       "notification-added",
			Name:     "Added destination",
			Service:  "ntfy",
			Events:   []string{"torrent.added"},
			Settings: map[string]string{"url": "https://added.example.test"},
			Secrets:  map[string]string{},
		},
	}
	remoteAccess := backupRemoteAccessSection{
		RPCLogins: []backupRPCLogin{
			{
				ID:           "rpl-replacement",
				Username:     "DESKTOP",
				SecretDigest: base64.StdEncoding.EncodeToString([]byte("replacement-rpc-digest")),
				CreatedAt:    now,
				UpdatedAt:    now,
			},
			{
				ID:           "rpl-added",
				Username:     "phone",
				SecretDigest: base64.StdEncoding.EncodeToString([]byte("added-rpc-digest")),
				CreatedAt:    now,
				UpdatedAt:    now,
			},
		},
		APITokens: []backupAPIToken{
			{
				ID:          "token-duplicate-hash",
				Name:        "Duplicate hash",
				TokenDigest: base64.StdEncoding.EncodeToString([]byte("current-token-digest")),
				Scopes:      []string{"vpn:read"},
				CreatedAt:   now,
			},
			{
				ID:          "token-added",
				Name:        "Added token",
				TokenDigest: base64.StdEncoding.EncodeToString([]byte("added-token-digest")),
				Scopes:      []string{"vpn:read"},
				CreatedAt:   now,
			},
		},
	}
	preview, err := server.buildBackupImportPreview(ctx, backupDocument{
		Format:        backupFormatName,
		Version:       backupFormatVersion,
		ExportedAt:    now,
		AppVersion:    "test",
		Notifications: &notifications,
		RemoteAccess:  &remoteAccess,
	}, nil, nil)
	if err != nil {
		testingObject.Fatalf("build backup preview: %v", err)
	}
	want := []string{
		"Replace 1 notification destination with the same name",
		"Add 1 notification destination",
		"Replace 1 RPC login with the same username",
		"Add 1 RPC login",
		"Add 1 API token",
		"Skip 1 API token that is already here",
	}
	if !slices.Equal(preview.Actions, want) {
		testingObject.Fatalf("preview actions = %#v, want %#v", preview.Actions, want)
	}

	targets, err := server.store.ListNotificationTargets(ctx)
	if err != nil || len(targets) != 1 || targets[0].ID != "notification-current" {
		testingObject.Fatalf("notifications changed during preview = %+v, %v", targets, err)
	}
	logins, err := server.store.ListRPCLogins(ctx)
	if err != nil || len(logins) != 1 || logins[0].ID != "rpl-current" {
		testingObject.Fatalf("RPC logins changed during preview = %+v, %v", logins, err)
	}
	tokens, err := server.store.ListAPITokens(ctx)
	if err != nil || len(tokens) != 1 || tokens[0].ID != "token-current" {
		testingObject.Fatalf("API tokens changed during preview = %+v, %v", tokens, err)
	}
}

// TestBackupImportActionLines verifies the shared preview and progress copy, including
// singular, plural, duplicate, and capacity-skip wording.
func TestBackupImportActionLines(testingObject *testing.T) {
	result := storage.BackupMergeResult{
		NotificationReplacements: 2,
		NotificationAdditions:    1,
		NotificationMaximumSkips: 2,
		RPCLoginReplacements:     1,
		RPCLoginAdditions:        2,
		RPCLoginMaximumSkips:     1,
		APITokenAdditions:        1,
		APITokenDuplicateSkips:   1,
		APITokenMaximumSkips:     2,
	}
	want := []string{
		"Replace 2 notification destinations with the same name",
		"Add 1 notification destination",
		fmt.Sprintf(
			"Skip 2 notification destinations because this app allows at most %d notification destinations",
			storage.MaximumBackupNotificationDestinations,
		),
		"Replace 1 RPC login with the same username",
		"Add 2 RPC logins",
		fmt.Sprintf(
			"Skip 1 RPC login because this app allows at most %d RPC logins",
			storage.MaximumBackupRPCLogins,
		),
		"Add 1 API token",
		"Skip 1 API token that is already here",
		fmt.Sprintf(
			"Skip 2 API tokens because this app allows at most %d API tokens",
			storage.MaximumBackupAPITokens,
		),
	}
	if got := backupImportActionLines(result); !slices.Equal(got, want) {
		testingObject.Fatalf("action lines = %#v, want %#v", got, want)
	}

	if got := backupImportActionLines(storage.BackupMergeResult{
		APITokenDuplicateSkips: 2,
	}); !slices.Equal(got, []string{"Skip 2 API tokens that are already here"}) {
		testingObject.Fatalf("plural duplicate-token line = %#v", got)
	}
}
