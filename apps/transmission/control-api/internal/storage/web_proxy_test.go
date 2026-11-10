package storage

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
)

// TestWebProxyLogins exercises the proxy switch and login CRUD invariants.
//
// The storage boundary requires a VPN before enabling, then keeps the switch and
// credentials independent while preserving hashes, routes, and username uniqueness.
//
// Since: 2.0.0
func TestWebProxyLogins(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	proxy, logins, err := store.WebProxyConfiguration(ctx)
	if err != nil || proxy.Enabled || len(logins) != 0 {
		testingObject.Fatalf("initial configuration = %+v, %+v, %v", proxy, logins, err)
	}

	if _, err := store.SetWebProxyEnabled(ctx, true); !errors.Is(err, ErrVPNConnectionRequired) {
		testingObject.Fatalf("enable without a VPN connection error = %v", err)
	}

	profile := storeTestVPNProfile(testingObject, store)
	connection, err := store.CreateVPNConnection(
		ctx,
		testVPNConnection("Proxy route", profile.ID),
	)
	if err != nil {
		testingObject.Fatalf("create proxy VPN connection: %v", err)
	}
	proxy, err = store.SetWebProxyEnabled(ctx, true)
	if err != nil || !proxy.Enabled {
		testingObject.Fatalf("enable without a login = %+v, %v", proxy, err)
	}
	connectionID := connection.ID
	first, err := store.CreateWebProxyLogin(ctx, WebProxyLogin{
		ID:           "wpl-0000000000000001",
		Username:     "Living.Room",
		PasswordHash: "first-hash",
		ConnectionID: &connectionID,
	})
	if err != nil || first.CreatedAt.IsZero() || first.UpdatedAt.IsZero() {
		testingObject.Fatalf("create first login = %+v, %v", first, err)
	}

	if _, err := store.CreateWebProxyLogin(ctx, WebProxyLogin{
		ID:           "wpl-0000000000000002",
		Username:     "living.room",
		PasswordHash: "duplicate-hash",
	}); !errors.Is(err, ErrWebProxyUsernameTaken) {
		testingObject.Fatalf("duplicate username error = %v", err)
	}

	second, err := store.CreateWebProxyLogin(ctx, WebProxyLogin{
		ID:           "wpl-0000000000000003",
		Username:     "tablet",
		PasswordHash: "second-hash",
	})
	if err != nil {
		testingObject.Fatalf("create second login: %v", err)
	}

	proxy, err = store.SetWebProxyEnabled(ctx, false)
	if err != nil || proxy.Enabled {
		testingObject.Fatalf("disable proxy with logins = %+v, %v", proxy, err)
	}
	_, logins, err = store.WebProxyConfiguration(ctx)
	if err != nil || len(logins) != 2 {
		testingObject.Fatalf("disabled proxy logins = %+v, %v", logins, err)
	}
	proxy, err = store.SetWebProxyEnabled(ctx, true)
	if err != nil || !proxy.Enabled {
		testingObject.Fatalf("re-enable proxy with retained logins = %+v, %v", proxy, err)
	}

	renamed, err := store.UpdateWebProxyLogin(ctx, first.ID, WebProxyLoginChanges{
		Username: "LIVING.ROOM",
	})
	if err != nil || renamed.Username != "LIVING.ROOM" || renamed.PasswordHash != "first-hash" ||
		renamed.ConnectionID == nil || *renamed.ConnectionID != connectionID {
		testingObject.Fatalf("rename login = %+v, %v", renamed, err)
	}

	replacementHash := "replacement-hash"
	updated, err := store.UpdateWebProxyLogin(ctx, first.ID, WebProxyLoginChanges{
		Username:     "television",
		PasswordHash: &replacementHash,
	})
	if err != nil || updated.PasswordHash != replacementHash {
		testingObject.Fatalf("replace login password = %+v, %v", updated, err)
	}

	if _, err := store.UpdateWebProxyLogin(ctx, first.ID, WebProxyLoginChanges{
		Username: second.Username,
	}); !errors.Is(err, ErrWebProxyUsernameTaken) {
		testingObject.Fatalf("rename onto existing username error = %v", err)
	}

	if err := store.DeleteWebProxyLogin(ctx, second.ID); err != nil {
		testingObject.Fatalf("delete second login: %v", err)
	}
	if err := store.DeleteWebProxyLogin(ctx, first.ID); err != nil {
		testingObject.Fatalf("delete enabled final login: %v", err)
	}
	proxy, logins, err = store.WebProxyConfiguration(ctx)
	if err != nil || !proxy.Enabled || len(logins) != 0 {
		testingObject.Fatalf("enabled proxy without logins = %+v, %+v, %v", proxy, logins, err)
	}

	if _, err := store.SetWebProxyEnabled(ctx, false); err != nil {
		testingObject.Fatalf("disable proxy without logins: %v", err)
	}
	if err := store.DeleteWebProxyLogin(ctx, first.ID); !errors.Is(err, ErrNotFound) {
		testingObject.Fatalf("delete missing login error = %v", err)
	}

	if _, err := store.FindWebProxyLogin(ctx, first.ID); !errors.Is(err, ErrNotFound) {
		testingObject.Fatalf("find deleted login error = %v", err)
	}

	proxy, logins, err = store.WebProxyConfiguration(ctx)
	if err != nil || proxy.Enabled || len(logins) != 0 {
		testingObject.Fatalf("final configuration = %+v, %+v, %v", proxy, logins, err)
	}
}

// TestWebProxyLoginConnectionReferencesAreTransactional rejects a relationship
// whose connection does not exist in the transaction performing the login write.
func TestWebProxyLoginConnectionReferencesAreTransactional(testingObject *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(testingObject.TempDir(), "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer store.Close()

	missingConnectionID := "vpc-ffffffffffffffff"
	login := WebProxyLogin{
		ID:           "wpl-0000000000000010",
		Username:     "missing-route",
		PasswordHash: "test-hash",
		ConnectionID: &missingConnectionID,
	}
	if _, err := store.CreateWebProxyLogin(ctx, login); !errors.Is(
		err,
		ErrVPNConnectionReference,
	) {
		testingObject.Fatalf("create with missing connection error = %v", err)
	}

	login.ConnectionID = nil
	created, err := store.CreateWebProxyLogin(ctx, login)
	if err != nil {
		testingObject.Fatalf("create default login: %v", err)
	}
	if _, err := store.UpdateWebProxyLogin(ctx, created.ID, WebProxyLoginChanges{
		Username:        created.Username,
		ConnectionID:    &missingConnectionID,
		ConnectionIDSet: true,
	}); !errors.Is(err, ErrVPNConnectionReference) {
		testingObject.Fatalf("update with missing connection error = %v", err)
	}
}
