package storage

import (
	"bytes"
	"context"
	"fmt"
	"path/filepath"
	"testing"
	"time"
)

// TestBackupRestoreMergesNotificationsAndRemoteAccess verifies that selected backup
// sections replace matching records, add new records, and preserve unlisted records.
func TestBackupRestoreMergesNotificationsAndRemoteAccess(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	now := time.Date(2026, time.November, 9, 12, 0, 0, 0, time.UTC)
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		"INSERT INTO administrators (id, username, password_hash, created_at, updated_at) VALUES (1, ?, ?, ?, ?)",
		"administrator",
		"unused",
		formatTime(now),
		formatTime(now),
	); err != nil {
		testingObject.Fatalf("create administrator: %v", err)
	}

	for _, target := range []NotificationTarget{
		{
			ID:       "notification-replaced",
			Name:     "Alerts",
			Service:  "ntfy",
			Events:   []string{"vpn.disconnected"},
			Settings: map[string]string{"url": "https://old.example.test"},
		},
		{
			ID:       "notification-kept",
			Name:     "Keep this destination",
			Service:  "gotify",
			Events:   []string{"vpn.connected"},
			Settings: map[string]string{"url": "https://keep.example.test"},
		},
	} {
		if _, err := store.CreateNotificationTarget(ctx, target); err != nil {
			testingObject.Fatalf("create notification %s: %v", target.Name, err)
		}
	}

	notificationResult, err := store.MergeBackupNotifications(ctx, []NotificationTarget{
		{
			ID:       "notification-imported-replacement",
			Name:     "ALERTS",
			Service:  "webhook",
			Events:   []string{"torrent.completed"},
			Settings: map[string]string{"url": "https://new.example.test"},
		},
		{
			ID:       "notification-added",
			Name:     "Added destination",
			Service:  "ntfy",
			Events:   []string{"torrent.added"},
			Settings: map[string]string{"url": "https://added.example.test"},
		},
	})
	if err != nil {
		testingObject.Fatalf("merge notifications: %v", err)
	}
	if notificationResult.NotificationReplacements != 1 ||
		notificationResult.NotificationAdditions != 1 ||
		notificationResult.NotificationMaximumSkips != 0 {
		testingObject.Fatalf("notification merge result = %+v", notificationResult)
	}

	targets, err := store.ListNotificationTargets(ctx)
	if err != nil {
		testingObject.Fatalf("list notifications: %v", err)
	}
	if len(targets) != 3 {
		testingObject.Fatalf("notification count = %d, want 3", len(targets))
	}
	if target := notificationTargetByName(targets, "alerts"); target.ID != "notification-imported-replacement" ||
		target.Service != "webhook" ||
		target.Settings["url"] != "https://new.example.test" {
		testingObject.Fatalf("replaced notification = %+v", target)
	}
	if target := notificationTargetByName(targets, "Keep this destination"); target.ID != "notification-kept" {
		testingObject.Fatalf("unlisted notification = %+v", target)
	}
	if target := notificationTargetByName(targets, "Added destination"); target.ID != "notification-added" {
		testingObject.Fatalf("added notification = %+v", target)
	}

	for _, login := range []RPCLogin{
		{
			ID:           "rpl-replaced",
			Username:     "desktop",
			SecretDigest: []byte("old-desktop-digest"),
		},
		{
			ID:           "rpl-kept",
			Username:     "keep-client",
			SecretDigest: []byte("keep-client-digest"),
		},
	} {
		if _, err := store.CreateRPCLogin(ctx, login); err != nil {
			testingObject.Fatalf("create RPC login %s: %v", login.Username, err)
		}
	}

	currentTokens := []BackupAPIToken{
		backupRestoreTestToken("token-matched-id", "Matched ID", "digest-id", now),
		backupRestoreTestToken("token-matched-name", "Matched Name", "digest-name", now),
		backupRestoreTestToken("token-matched-hash", "Matched Hash", "digest-hash", now),
		backupRestoreTestToken("token-kept", "Keep token", "digest-keep", now),
	}
	for _, token := range currentTokens {
		if _, err := store.CreateAPIToken(
			ctx,
			token.ID,
			1,
			token.Name,
			token.Digest,
			token.Scopes,
			token.ExpiresAt,
		); err != nil {
			testingObject.Fatalf("create API token %s: %v", token.Name, err)
		}
	}

	remoteResult, err := store.MergeBackupRemoteAccess(ctx, 1, BackupRemoteAccess{
		RPCLogins: []RPCLogin{
			{
				ID:           "rpl-imported-replacement",
				Username:     "DESKTOP",
				SecretDigest: []byte("new-desktop-digest"),
				CreatedAt:    now,
				UpdatedAt:    now,
			},
			{
				ID:           "rpl-added",
				Username:     "phone",
				SecretDigest: []byte("phone-digest"),
				CreatedAt:    now,
				UpdatedAt:    now,
			},
		},
		APITokens: []BackupAPIToken{
			backupRestoreTestToken("token-matched-id", "Different name", "new-id-digest", now),
			backupRestoreTestToken("token-new-name", "MATCHED NAME", "new-name-digest", now),
			backupRestoreTestToken("token-new-hash", "Different hash name", "digest-hash", now),
			backupRestoreTestToken("token-added", "Added token", "digest-added", now),
		},
	})
	if err != nil {
		testingObject.Fatalf("merge remote access: %v", err)
	}
	if remoteResult.RPCLoginReplacements != 1 || remoteResult.RPCLoginAdditions != 1 ||
		remoteResult.RPCLoginMaximumSkips != 0 || remoteResult.APITokenAdditions != 1 ||
		remoteResult.APITokenDuplicateSkips != 3 || remoteResult.APITokenMaximumSkips != 0 {
		testingObject.Fatalf("remote-access merge result = %+v", remoteResult)
	}

	logins, err := store.ListRPCLogins(ctx)
	if err != nil {
		testingObject.Fatalf("list RPC logins: %v", err)
	}
	if len(logins) != 3 {
		testingObject.Fatalf("RPC login count = %d, want 3", len(logins))
	}
	if login := rpcLoginByUsername(logins, "desktop"); login.ID != "rpl-imported-replacement" ||
		!bytes.Equal(login.SecretDigest, []byte("new-desktop-digest")) {
		testingObject.Fatalf("replaced RPC login = %+v", login)
	}
	if login := rpcLoginByUsername(logins, "keep-client"); login.ID != "rpl-kept" {
		testingObject.Fatalf("unlisted RPC login = %+v", login)
	}
	if login := rpcLoginByUsername(logins, "phone"); login.ID != "rpl-added" {
		testingObject.Fatalf("added RPC login = %+v", login)
	}

	tokens, err := store.ListAPITokensForBackup(ctx)
	if err != nil {
		testingObject.Fatalf("list API tokens: %v", err)
	}
	if len(tokens) != 5 {
		testingObject.Fatalf("API token count = %d, want 5", len(tokens))
	}
	for _, expectedID := range []string{
		"token-matched-id",
		"token-matched-name",
		"token-matched-hash",
		"token-kept",
		"token-added",
	} {
		if token := backupAPITokenByID(tokens, expectedID); token.ID == "" {
			testingObject.Fatalf("API token %s was not kept or added: %+v", expectedID, tokens)
		}
	}
	for _, skippedID := range []string{"token-new-name", "token-new-hash"} {
		if token := backupAPITokenByID(tokens, skippedID); token.ID != "" {
			testingObject.Fatalf("duplicate API token %s was added: %+v", skippedID, token)
		}
	}
}

// TestBackupRestorePlansCapacitySkips verifies that replacements and duplicate skips
// take precedence over the three retained-record caps.
func TestBackupRestorePlansCapacitySkips(testingObject *testing.T) {
	now := time.Date(2026, time.November, 9, 12, 0, 0, 0, time.UTC)
	targets := make([]NotificationTarget, 0, MaximumBackupNotificationDestinations)
	for index := 0; index < MaximumBackupNotificationDestinations; index++ {
		targets = append(targets, NotificationTarget{
			ID:   fmt.Sprintf("notification-%03d", index),
			Name: fmt.Sprintf("Destination %03d", index),
		})
	}
	notificationPlan := planBackupNotifications(targets, []NotificationTarget{
		{ID: "replacement", Name: "DESTINATION 000"},
		{ID: "addition", Name: "Over capacity"},
	})
	if notificationPlan.Result.NotificationReplacements != 1 ||
		notificationPlan.Result.NotificationAdditions != 0 ||
		notificationPlan.Result.NotificationMaximumSkips != 1 {
		testingObject.Fatalf("notification capacity plan = %+v", notificationPlan.Result)
	}

	logins := make([]RPCLogin, 0, MaximumBackupRPCLogins)
	for index := 0; index < MaximumBackupRPCLogins; index++ {
		logins = append(logins, RPCLogin{
			ID:       fmt.Sprintf("rpl-%03d", index),
			Username: fmt.Sprintf("client-%03d", index),
		})
	}
	tokens := make([]BackupAPIToken, 0, MaximumBackupAPITokens)
	for index := 0; index < MaximumBackupAPITokens; index++ {
		tokens = append(tokens, backupRestoreTestToken(
			fmt.Sprintf("token-%03d", index),
			fmt.Sprintf("Token %03d", index),
			fmt.Sprintf("digest-%03d", index),
			now,
		))
	}
	remotePlan := planBackupRemoteAccess(logins, tokens, BackupRemoteAccess{
		RPCLogins: []RPCLogin{
			{ID: "rpl-replacement", Username: "CLIENT-000"},
			{ID: "rpl-addition", Username: "over-capacity"},
		},
		APITokens: []BackupAPIToken{
			backupRestoreTestToken("token-000", "Different name", "different-digest", now),
			backupRestoreTestToken("token-addition", "Over capacity", "addition-digest", now),
		},
	})
	if remotePlan.Result.RPCLoginReplacements != 1 ||
		remotePlan.Result.RPCLoginAdditions != 0 ||
		remotePlan.Result.RPCLoginMaximumSkips != 1 ||
		remotePlan.Result.APITokenAdditions != 0 ||
		remotePlan.Result.APITokenDuplicateSkips != 1 ||
		remotePlan.Result.APITokenMaximumSkips != 1 {
		testingObject.Fatalf("remote-access capacity plan = %+v", remotePlan.Result)
	}
}

func backupRestoreTestToken(
	id string,
	name string,
	digest string,
	createdAt time.Time,
) BackupAPIToken {
	return BackupAPIToken{
		APIToken: APIToken{
			ID:        id,
			Name:      name,
			Scopes:    []string{"vpn:read"},
			CreatedAt: createdAt,
		},
		Digest: []byte(digest),
	}
}

func notificationTargetByName(targets []NotificationTarget, name string) NotificationTarget {
	for _, target := range targets {
		if target.Name == name || len(target.Name) == len(name) &&
			bytes.EqualFold([]byte(target.Name), []byte(name)) {
			return target
		}
	}

	return NotificationTarget{}
}

func rpcLoginByUsername(logins []RPCLogin, username string) RPCLogin {
	for _, login := range logins {
		if login.Username == username || len(login.Username) == len(username) &&
			bytes.EqualFold([]byte(login.Username), []byte(username)) {
			return login
		}
	}

	return RPCLogin{}
}

func backupAPITokenByID(tokens []BackupAPIToken, id string) BackupAPIToken {
	for _, token := range tokens {
		if token.ID == id {
			return token
		}
	}

	return BackupAPIToken{}
}
