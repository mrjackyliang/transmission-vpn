package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
)

// TestRPCLogins covers compatible-RPC credential CRUD and activity tracking.
//
// Usernames remain unique without regard to case, password digests stay internal, and
// successful use cannot rewrite last_used_at more than once a minute.
func TestRPCLogins(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	firstDigest := []byte("first-secret-digest")
	first, err := store.CreateRPCLogin(ctx, RPCLogin{
		ID:           "rpl-0000000000000001",
		Username:     "Desktop.Client",
		SecretDigest: firstDigest,
	})
	if err != nil || first.CreatedAt.IsZero() || first.UpdatedAt.IsZero() || first.LastUsedAt != nil {
		testingObject.Fatalf("create first RPC login = %+v, %v", first, err)
	}

	if _, err := store.CreateRPCLogin(ctx, RPCLogin{
		ID:           "rpl-0000000000000002",
		Username:     "desktop.client",
		SecretDigest: []byte("duplicate-secret-digest"),
	}); !errors.Is(err, ErrRPCLoginUsernameTaken) {
		testingObject.Fatalf("duplicate RPC username error = %v", err)
	}

	if _, err := store.databaseHandle().ExecContext(
		ctx,
		`INSERT INTO rpc_logins (
		   id, username, secret_digest, created_at, updated_at
		 ) VALUES (?, ?, ?, ?, ?)`,
		"rpl-0000000000000003",
		"DESKTOP.CLIENT",
		[]byte("database-duplicate"),
		formatTime(time.Now()),
		formatTime(time.Now()),
	); err == nil {
		testingObject.Fatal("the database accepted a case-insensitive duplicate RPC username")
	}

	second, err := store.CreateRPCLogin(ctx, RPCLogin{
		ID:           "rpl-0000000000000004",
		Username:     "phone",
		SecretDigest: []byte("second-secret-digest"),
	})
	if err != nil {
		testingObject.Fatalf("create second RPC login: %v", err)
	}

	listed, err := store.ListRPCLogins(ctx)
	if err != nil || len(listed) != 2 {
		testingObject.Fatalf("list RPC logins = %+v, %v", listed, err)
	}

	found, err := store.FindRPCLoginByUsername(ctx, "DESKTOP.CLIENT")
	if err != nil || found.ID != first.ID || !bytes.Equal(found.SecretDigest, firstDigest) {
		testingObject.Fatalf("find RPC login by username = %+v, %v", found, err)
	}

	renamed, err := store.UpdateRPCLogin(ctx, first.ID, RPCLoginChanges{
		Username: "DESKTOP.CLIENT",
	})
	if err != nil || renamed.Username != "DESKTOP.CLIENT" || !bytes.Equal(renamed.SecretDigest, firstDigest) {
		testingObject.Fatalf("rename RPC login = %+v, %v", renamed, err)
	}

	replacementDigest := []byte("replacement-secret-digest")
	updated, err := store.UpdateRPCLogin(ctx, first.ID, RPCLoginChanges{
		Username:     "television",
		SecretDigest: replacementDigest,
	})
	if err != nil || !bytes.Equal(updated.SecretDigest, replacementDigest) {
		testingObject.Fatalf("replace RPC login digest = %+v, %v", updated, err)
	}

	if _, err := store.UpdateRPCLogin(ctx, first.ID, RPCLoginChanges{
		Username: second.Username,
	}); !errors.Is(err, ErrRPCLoginUsernameTaken) {
		testingObject.Fatalf("rename onto existing RPC username error = %v", err)
	}

	if err := store.RecordRPCLoginUsed(ctx, first.ID); err != nil {
		testingObject.Fatalf("record first RPC login use: %v", err)
	}
	used, err := store.FindRPCLogin(ctx, first.ID)
	if err != nil || used.LastUsedAt == nil {
		testingObject.Fatalf("read first RPC login use = %+v, %v", used, err)
	}
	firstUse := *used.LastUsedAt

	if err := store.RecordRPCLoginUsed(ctx, first.ID); err != nil {
		testingObject.Fatalf("record throttled RPC login use: %v", err)
	}
	usedAgain, err := store.FindRPCLogin(ctx, first.ID)
	if err != nil || usedAgain.LastUsedAt == nil || !usedAgain.LastUsedAt.Equal(firstUse) {
		testingObject.Fatalf("throttled RPC login use = %+v, %v", usedAgain, err)
	}

	oldUse := time.Now().Add(-2 * time.Minute).UTC()
	if _, err := store.databaseHandle().ExecContext(
		ctx,
		"UPDATE rpc_logins SET last_used_at = ? WHERE id = ?",
		formatTime(oldUse),
		first.ID,
	); err != nil {
		testingObject.Fatalf("age RPC login use: %v", err)
	}
	if err := store.RecordRPCLoginUsed(ctx, first.ID); err != nil {
		testingObject.Fatalf("record aged RPC login use: %v", err)
	}
	usedAfterWindow, err := store.FindRPCLogin(ctx, first.ID)
	if err != nil || usedAfterWindow.LastUsedAt == nil || !usedAfterWindow.LastUsedAt.After(oldUse) {
		testingObject.Fatalf("RPC login use after window = %+v, %v", usedAfterWindow, err)
	}

	if err := store.DeleteRPCLogin(ctx, second.ID); err != nil {
		testingObject.Fatalf("delete RPC login: %v", err)
	}
	if err := store.DeleteRPCLogin(ctx, second.ID); !errors.Is(err, ErrNotFound) {
		testingObject.Fatalf("delete missing RPC login error = %v", err)
	}
	if _, err := store.FindRPCLogin(ctx, second.ID); !errors.Is(err, ErrNotFound) {
		testingObject.Fatalf("find deleted RPC login error = %v", err)
	}
	if err := store.RecordRPCLoginUsed(ctx, second.ID); !errors.Is(err, ErrNotFound) {
		testingObject.Fatalf("record deleted RPC login use error = %v", err)
	}
}

// TestRPCCompatibilityRequiresVPNConnection covers switch and login independence.
//
// Every enable path requires a protected route, while logins can be added or removed
// independently and remain stored when the proxy is turned off.
//
// Since: UNRELEASED
func TestRPCCompatibilityRequiresVPNConnection(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	registry := settings.NewRegistry()
	if _, err := store.UpdateSettings(
		ctx,
		registry,
		0,
		SettingChanges{"rpc.compatibilityEnabled": json.RawMessage("true")},
		"test",
	); !errors.Is(err, ErrVPNConnectionRequired) {
		testingObject.Fatalf("enable RPC without VPN connection error = %v", err)
	}
	if _, err := store.ApplyManagedConfiguration(ctx, registry, &settings.ManagedDocument{
		Version: 1,
		Settings: map[string]settings.ManagedValue{
			"rpc.compatibilityEnabled": {
				Mode:  settings.ManagedModeLock,
				Value: json.RawMessage("true"),
			},
		},
	}); !errors.Is(err, ErrVPNConnectionRequired) {
		testingObject.Fatalf("managed RPC enable without VPN connection error = %v", err)
	}

	profile := storeTestVPNProfile(testingObject, store)
	if _, err := store.CreateVPNConnection(
		ctx,
		testVPNConnection("RPC route", profile.ID),
	); err != nil {
		testingObject.Fatalf("create RPC VPN connection: %v", err)
	}
	revision, err := store.UpdateSettings(
		ctx,
		registry,
		0,
		SettingChanges{"rpc.compatibilityEnabled": json.RawMessage("true")},
		"test",
	)
	if err != nil {
		testingObject.Fatalf("enable RPC without login: %v", err)
	}

	login, err := store.CreateRPCLogin(ctx, RPCLogin{
		ID:           "rpl-0000000000000010",
		Username:     "remote-app",
		SecretDigest: []byte("digest"),
	})
	if err != nil {
		testingObject.Fatalf("create RPC login: %v", err)
	}
	if err := store.DeleteRPCLogin(ctx, login.ID); err != nil {
		testingObject.Fatalf("delete enabled RPC last login: %v", err)
	}
	logins, err := store.ListRPCLogins(ctx)
	if err != nil || len(logins) != 0 {
		testingObject.Fatalf("enabled RPC logins after deletion = %+v, %v", logins, err)
	}

	retainedLogin, err := store.CreateRPCLogin(ctx, RPCLogin{
		ID:           "rpl-0000000000000011",
		Username:     "retained-app",
		SecretDigest: []byte("retained-digest"),
	})
	if err != nil {
		testingObject.Fatalf("create retained RPC login: %v", err)
	}
	revision, err = store.UpdateSettings(
		ctx,
		registry,
		revision,
		SettingChanges{"rpc.compatibilityEnabled": json.RawMessage("false")},
		"test",
	)
	if err != nil {
		testingObject.Fatalf("disable RPC with login: %v", err)
	}
	if _, err := store.FindRPCLogin(ctx, retainedLogin.ID); err != nil {
		testingObject.Fatalf("find RPC login after disabling proxy: %v", err)
	}
	revision, err = store.UpdateSettings(
		ctx,
		registry,
		revision,
		SettingChanges{"rpc.compatibilityEnabled": json.RawMessage("true")},
		"test",
	)
	if err != nil {
		testingObject.Fatalf("re-enable RPC with retained login: %v", err)
	}
	if err := store.DeleteRPCLogin(ctx, retainedLogin.ID); err != nil {
		testingObject.Fatalf("delete re-enabled RPC last login: %v", err)
	}

	if _, err := store.ApplyManagedConfiguration(ctx, registry, &settings.ManagedDocument{
		Version: 1,
		Settings: map[string]settings.ManagedValue{
			"rpc.compatibilityEnabled": {
				Mode:  settings.ManagedModeLock,
				Value: json.RawMessage("true"),
			},
		},
	}); err != nil {
		testingObject.Fatalf("apply managed RPC enable without login: %v", err)
	}
	snapshot, err := store.EffectiveConfiguration(ctx, registry)
	if err != nil {
		testingObject.Fatalf("read managed RPC settings: %v", err)
	}
	managedSetting := findEffectiveSetting(
		testingObject,
		snapshot,
		"rpc.compatibilityEnabled",
	)
	if string(managedSetting.Value) != "true" || !managedSetting.Locked {
		testingObject.Fatalf("managed RPC setting = %+v", managedSetting)
	}
}
