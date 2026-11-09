package api

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-webauthn/webauthn/protocol/webauthncbor"
)

// softwareAuthenticator is a minimal WebAuthn authenticator for tests: one P-256 key
// producing "none" attestations and signed assertions like a real platform passkey.
type softwareAuthenticator struct {
	key          *ecdsa.PrivateKey
	credentialID []byte
	userHandle   []byte
	signCount    uint32
}

func newSoftwareAuthenticator(t *testing.T) *softwareAuthenticator {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}

	credentialID := make([]byte, 32)
	_, _ = rand.Read(credentialID)

	return &softwareAuthenticator{key: key, credentialID: credentialID}
}

func encode(value []byte) string {
	return base64.RawURLEncoding.EncodeToString(value)
}

// authenticatorData builds rpIdHash | flags | signCount, plus attested credential data
// when a COSE key is given (registration).
func (authenticator *softwareAuthenticator) authenticatorData(rpID string, coseKey []byte) []byte {
	rpIDHash := sha256.Sum256([]byte(rpID))
	flags := byte(0x01 | 0x04) // user present, user verified
	if coseKey != nil {
		flags |= 0x40 // attested credential data
	}

	data := append([]byte{}, rpIDHash[:]...)
	data = append(data, flags)
	data = binary.BigEndian.AppendUint32(data, authenticator.signCount)

	if coseKey != nil {
		data = append(data, make([]byte, 16)...) // AAGUID
		data = binary.BigEndian.AppendUint16(data, uint16(len(authenticator.credentialID)))
		data = append(data, authenticator.credentialID...)
		data = append(data, coseKey...)
	}

	return data
}

// register answers creation options with a credential creation response.
func (authenticator *softwareAuthenticator) register(t *testing.T, options map[string]any, origin string) json.RawMessage {
	t.Helper()

	rp := options["rp"].(map[string]any)
	user := options["user"].(map[string]any)
	userHandle, err := base64.RawURLEncoding.DecodeString(user["id"].(string))
	if err != nil {
		t.Fatalf("decode user handle: %v", err)
	}
	authenticator.userHandle = userHandle

	coseKey, err := webauthncbor.Marshal(map[int]any{
		1:  2,  // kty: EC2
		3:  -7, // alg: ES256
		-1: 1,  // crv: P-256
		-2: authenticator.key.PublicKey.X.FillBytes(make([]byte, 32)),
		-3: authenticator.key.PublicKey.Y.FillBytes(make([]byte, 32)),
	})
	if err != nil {
		t.Fatal(err)
	}

	clientData, _ := json.Marshal(map[string]any{
		"type":        "webauthn.create",
		"challenge":   options["challenge"],
		"origin":      origin,
		"crossOrigin": false,
	})

	attestationObject, err := webauthncbor.Marshal(map[string]any{
		"fmt":      "none",
		"attStmt":  map[string]any{},
		"authData": authenticator.authenticatorData(rp["id"].(string), coseKey),
	})
	if err != nil {
		t.Fatal(err)
	}

	credential, _ := json.Marshal(map[string]any{
		"id":    encode(authenticator.credentialID),
		"rawId": encode(authenticator.credentialID),
		"type":  "public-key",
		"response": map[string]any{
			"clientDataJSON":    encode(clientData),
			"attestationObject": encode(attestationObject),
			"transports":        []string{"internal"},
		},
		"clientExtensionResults":  map[string]any{},
		"authenticatorAttachment": "platform",
	})

	return credential
}

// assert answers request options with a signed assertion.
func (authenticator *softwareAuthenticator) assert(t *testing.T, options map[string]any, origin string) json.RawMessage {
	t.Helper()

	authenticator.signCount++
	authenticatorData := authenticator.authenticatorData(options["rpId"].(string), nil)

	clientData, _ := json.Marshal(map[string]any{
		"type":        "webauthn.get",
		"challenge":   options["challenge"],
		"origin":      origin,
		"crossOrigin": false,
	})
	clientDataHash := sha256.Sum256(clientData)
	digest := sha256.Sum256(append(append([]byte{}, authenticatorData...), clientDataHash[:]...))

	signature, err := ecdsa.SignASN1(rand.Reader, authenticator.key, digest[:])
	if err != nil {
		t.Fatal(err)
	}

	credential, _ := json.Marshal(map[string]any{
		"id":    encode(authenticator.credentialID),
		"rawId": encode(authenticator.credentialID),
		"type":  "public-key",
		"response": map[string]any{
			"clientDataJSON":    encode(clientData),
			"authenticatorData": encode(authenticatorData),
			"signature":         encode(signature),
			"userHandle":        encode(authenticator.userHandle),
		},
		"clientExtensionResults":  map[string]any{},
		"authenticatorAttachment": "platform",
	})

	return credential
}

// secureRequest sends an https request to torrents.example.com with optional session.
func secureRequest(
	t *testing.T,
	server *Server,
	method string,
	path string,
	body string,
	cookies []*http.Cookie,
	csrfToken string,
	host string,
) *httptest.ResponseRecorder {
	t.Helper()

	request := httptest.NewRequest(method, "https://"+host+path, strings.NewReader(body))
	request.TLS = &tls.ConnectionState{}
	if csrfToken != "" {
		request.Header.Set("X-CSRF-Token", csrfToken)
	}
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}

	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)

	return response
}

func TestPasskeyRegistrationAndSignIn(t *testing.T) {
	server, cookies, csrfToken := newClaimedTestServer(t)
	authenticator := newSoftwareAuthenticator(t)

	const host = "torrents.example.com"
	const origin = "https://" + host

	registrationOptions := secureRequest(t, server, http.MethodPost, "/api/v1/auth/passkeys/register/options",
		`{"name":"Test laptop","password":"`+testPassword+`"}`, cookies, csrfToken, host)
	var registrationBody struct {
		CeremonyID string         `json:"ceremonyId"`
		Options    map[string]any `json:"options"`
	}
	decodeBody(t, registrationOptions, &registrationBody)

	credential := authenticator.register(t, registrationBody.Options, origin)
	verifyBody, _ := json.Marshal(map[string]any{
		"ceremonyId": registrationBody.CeremonyID,
		"name":       "Test laptop",
		"credential": credential,
	})
	registered := secureRequest(t, server, http.MethodPost, "/api/v1/auth/passkeys/register/verify", string(verifyBody), cookies, csrfToken, host)
	if registered.Code != http.StatusCreated || !strings.Contains(registered.Body.String(), `"hostname":"torrents.example.com"`) {
		t.Fatalf("passkey registration status %d: %s", registered.Code, registered.Body.String())
	}

	signIn := func(requestHost string) *httptest.ResponseRecorder {
		t.Helper()

		loginOptions := secureRequest(t, server, http.MethodPost, "/api/v1/auth/passkeys/login/options", "", nil, "", requestHost)
		var loginBody struct {
			CeremonyID string         `json:"ceremonyId"`
			Options    map[string]any `json:"options"`
		}
		decodeBody(t, loginOptions, &loginBody)

		// The authenticator signs for the hostname it was registered on.
		loginBody.Options["rpId"] = host
		assertion := authenticator.assert(t, loginBody.Options, origin)
		body, _ := json.Marshal(map[string]any{
			"ceremonyId": loginBody.CeremonyID,
			"credential": assertion,
		})

		return secureRequest(t, server, http.MethodPost, "/api/v1/auth/passkeys/login/verify", string(body), nil, "", requestHost)
	}

	signedIn := signIn(host)
	if signedIn.Code != http.StatusOK || cookieValue(t, signedIn.Result().Cookies(), "tvpn_session") == "" {
		t.Fatalf("passkey sign-in status %d: %s", signedIn.Code, signedIn.Body.String())
	}

	if again := signIn(host); again.Code != http.StatusOK {
		t.Fatalf("second passkey sign-in status %d: %s", again.Code, again.Body.String())
	}

	if elsewhere := signIn("other.example.com"); elsewhere.Code != http.StatusUnauthorized {
		t.Fatalf("a passkey must not work on another hostname, got %d: %s", elsewhere.Code, elsewhere.Body.String())
	}

	security := secureRequest(t, server, http.MethodGet, "/api/v1/auth/security", "", cookies, "", host)
	var securityBody struct {
		Passkeys []struct {
			ID         string  `json:"id"`
			Name       string  `json:"name"`
			LastUsedAt *string `json:"lastUsedAt"`
		} `json:"passkeys"`
	}
	decodeBody(t, security, &securityBody)
	if len(securityBody.Passkeys) != 1 || securityBody.Passkeys[0].LastUsedAt == nil {
		t.Fatalf("passkey should be listed with a last-used time: %s", security.Body.String())
	}

	removeWrong := secureRequest(t, server, http.MethodDelete, "/api/v1/auth/passkeys/"+securityBody.Passkeys[0].ID,
		`{"password":"wrong password"}`, cookies, csrfToken, host)
	if removeWrong.Code != http.StatusUnprocessableEntity || !strings.Contains(removeWrong.Body.String(), `"field":"password"`) {
		t.Fatalf("passkey removal with a wrong password status %d: %s", removeWrong.Code, removeWrong.Body.String())
	}

	if stillWorks := signIn(host); stillWorks.Code != http.StatusOK {
		t.Fatalf("a passkey must survive a removal with the wrong password, got %d", stillWorks.Code)
	}

	removed := secureRequest(t, server, http.MethodDelete, "/api/v1/auth/passkeys/"+securityBody.Passkeys[0].ID,
		`{"password":"`+testPassword+`"}`, cookies, csrfToken, host)
	if removed.Code != http.StatusNoContent {
		t.Fatalf("passkey removal status %d: %s", removed.Code, removed.Body.String())
	}

	if afterRemoval := signIn(host); afterRemoval.Code != http.StatusUnauthorized {
		t.Fatalf("a removed passkey must not sign in, got %d", afterRemoval.Code)
	}
}
