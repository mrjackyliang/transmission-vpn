package webproxy

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"strings"
	"sync"
	"time"
)

const (
	authenticationCacheLifetime = 15 * time.Minute
	maximumAuthenticationCache  = 1024
	loginFailureLimit           = 10
	loginFailureWindow          = 5 * time.Minute
	loginBlockDuration          = 5 * time.Minute
)

// authenticationResult identifies a successful, failed, or rate-limited login.
type authenticationResult int

const (
	authenticationInvalid authenticationResult = iota
	authenticationAllowed
	authenticationBlocked
)

// passwordVerifier checks a plaintext password against one encoded Argon2id hash.
type passwordVerifier func(context.Context, string, string) (bool, error)

// authenticationCacheEntry records one successful credential until its short expiry.
type authenticationCacheEntry struct {
	expiresAt time.Time
	login     Login
}

// loginFailureState records recent failures and an active block for one client key.
type loginFailureState struct {
	failures     []time.Time
	blockedUntil time.Time
}

// authenticator owns configured logins, the success cache, and per-client failures.
type authenticator struct {
	mutex          sync.Mutex
	cacheKey       []byte
	dummyHash      string
	verifyPassword passwordVerifier
	clock          func() time.Time
	logins         []Login
	generation     uint64
	cache          map[[sha256.Size]byte]authenticationCacheEntry
	failures       map[string]loginFailureState
}

// newAuthenticator creates an empty authentication boundary under a process key.
func newAuthenticator(
	cacheKey []byte,
	dummyHash string,
	verifyPassword passwordVerifier,
	clock func() time.Time,
) *authenticator {
	return &authenticator{
		cacheKey:       append([]byte(nil), cacheKey...),
		dummyHash:      dummyHash,
		verifyPassword: verifyPassword,
		clock:          clock,
		cache:          map[[sha256.Size]byte]authenticationCacheEntry{},
		failures:       map[string]loginFailureState{},
	}
}

// setLogins replaces credentials and clears successes that referred to old verifiers.
func (authentication *authenticator) setLogins(logins []Login) {
	authentication.mutex.Lock()
	defer authentication.mutex.Unlock()

	authentication.logins = append([]Login(nil), logins...)
	authentication.generation++
	clear(authentication.cache)
}

// blocked reports whether a client is inside its five-minute refusal period.
func (authentication *authenticator) blocked(clientKey string) bool {
	authentication.mutex.Lock()
	defer authentication.mutex.Unlock()

	return authentication.blockedLocked(clientKey, authentication.clock())
}

// authenticate checks one supplied username and password and updates its client limit.
func (authentication *authenticator) authenticate(
	ctx context.Context,
	username string,
	password string,
	clientKey string,
) (authenticationResult, Login) {
	now := authentication.clock()
	authentication.mutex.Lock()
	if authentication.blockedLocked(clientKey, now) {
		authentication.mutex.Unlock()

		return authenticationBlocked, Login{}
	}

	cacheKey := authentication.credentialKey(username, password)
	if entry, found := authentication.cache[cacheKey]; found {
		if now.Before(entry.expiresAt) {
			delete(authentication.failures, clientKey)
			authentication.mutex.Unlock()

			return authenticationAllowed, entry.login
		}
		delete(authentication.cache, cacheKey)
	}

	login := Login{}
	loginFound := false
	passwordHash := authentication.dummyHash
	for _, configuredLogin := range authentication.logins {
		if strings.EqualFold(configuredLogin.Username, username) {
			login = configuredLogin
			loginFound = true
			passwordHash = configuredLogin.PasswordHash

			break
		}
	}
	generation := authentication.generation
	authentication.reserveAttemptLocked(clientKey, now)
	authentication.mutex.Unlock()

	passwordValid, err := authentication.verifyPassword(ctx, password, passwordHash)
	valid := loginFound && err == nil && passwordValid

	authentication.mutex.Lock()
	if authentication.generation != generation {
		authentication.mutex.Unlock()

		return authenticationInvalid, Login{}
	}
	defer authentication.mutex.Unlock()
	if valid {
		delete(authentication.failures, clientKey)
		authentication.addCacheLocked(cacheKey, login, now)

		return authenticationAllowed, login
	}

	if authentication.blockedLocked(clientKey, authentication.clock()) {
		return authenticationBlocked, Login{}
	}

	return authenticationInvalid, Login{}
}

// blockedLocked checks and lazily expires one client state while holding the mutex.
func (authentication *authenticator) blockedLocked(clientKey string, now time.Time) bool {
	state, found := authentication.failures[clientKey]
	if !found {
		return false
	}
	if now.Before(state.blockedUntil) {
		return true
	}
	if !state.blockedUntil.IsZero() {
		delete(authentication.failures, clientKey)

		return false
	}

	state.failures = recentFailures(state.failures, now)
	if len(state.failures) == 0 {
		delete(authentication.failures, clientKey)
	} else {
		authentication.failures[clientKey] = state
	}

	return false
}

// reserveAttemptLocked counts one password check before its expensive work begins.
func (authentication *authenticator) reserveAttemptLocked(clientKey string, now time.Time) {
	state := authentication.failures[clientKey]
	state.failures = append(recentFailures(state.failures, now), now)
	if len(state.failures) >= loginFailureLimit {
		state.failures = nil
		state.blockedUntil = now.Add(loginBlockDuration)
	}
	authentication.failures[clientKey] = state
}

// recentFailures keeps only failures inside the five-minute sliding window.
func recentFailures(failures []time.Time, now time.Time) []time.Time {
	cutoff := now.Add(-loginFailureWindow)
	firstRecent := 0
	for firstRecent < len(failures) && failures[firstRecent].Before(cutoff) {
		firstRecent++
	}

	return failures[firstRecent:]
}

// addCacheLocked inserts one success and evicts expired or earliest entries at the cap.
func (authentication *authenticator) addCacheLocked(
	key [sha256.Size]byte,
	login Login,
	now time.Time,
) {
	for existingKey, entry := range authentication.cache {
		if !now.Before(entry.expiresAt) {
			delete(authentication.cache, existingKey)
		}
	}

	if len(authentication.cache) >= maximumAuthenticationCache {
		var earliestKey [sha256.Size]byte
		var earliestExpiry time.Time
		for existingKey, entry := range authentication.cache {
			if earliestExpiry.IsZero() || entry.expiresAt.Before(earliestExpiry) {
				earliestKey = existingKey
				earliestExpiry = entry.expiresAt
			}
		}
		delete(authentication.cache, earliestKey)
	}

	authentication.cache[key] = authenticationCacheEntry{
		expiresAt: now.Add(authenticationCacheLifetime),
		login:     login,
	}
}

// credentialKey hides both credential fields under the random process HMAC key.
func (authentication *authenticator) credentialKey(
	username string,
	password string,
) [sha256.Size]byte {
	digest := hmac.New(sha256.New, authentication.cacheKey)
	_, _ = digest.Write([]byte(strings.ToLower(username)))
	_, _ = digest.Write([]byte{0})
	_, _ = digest.Write([]byte(password))

	var key [sha256.Size]byte
	copy(key[:], digest.Sum(nil))

	return key
}
