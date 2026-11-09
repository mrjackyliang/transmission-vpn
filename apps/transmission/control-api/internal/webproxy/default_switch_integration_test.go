package webproxy

import (
	"bufio"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	controlapi "github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/api"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/controller"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/security"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
)

// TestDefaultSwitchRepublishesReloadsAndRoutesCONNECT covers the complete proxy handoff.
//
// A cached default login and its live tunnel must be invalidated after the API changes
// the durable default, and the next CONNECT must bind the replacement slot address.
func TestDefaultSwitchRepublishesReloadsAndRoutesCONNECT(testingObject *testing.T) {
	testingObject.Parallel()

	ctx := context.Background()
	temporaryDirectory := testingObject.TempDir()
	runtimeDirectory := filepath.Join(temporaryDirectory, "runtime")
	runtimeDirectories := []string{
		filepath.Join(runtimeDirectory, "services"),
		filepath.Join(runtimeDirectory, "transmission-config"),
		filepath.Join(runtimeDirectory, "transmission-state"),
		filepath.Join(runtimeDirectory, "vpn.status.d"),
		filepath.Join(runtimeDirectory, "web-proxy"),
		filepath.Join(runtimeDirectory, "web-proxy-state"),
	}
	for _, runtimePath := range runtimeDirectories {
		if err := os.MkdirAll(runtimePath, 0o755); err != nil {
			testingObject.Fatalf("create runtime directory: %v", err)
		}
	}

	store, err := storage.Open(ctx, filepath.Join(temporaryDirectory, "state.sqlite3"))
	if err != nil {
		testingObject.Fatalf("open store: %v", err)
	}
	defer func() { _ = store.Close() }()

	const profileID = "custom:wg-default-switch"
	if err := store.UpsertCustomVPNProfile(ctx, storage.EncryptedVPNProfile{
		ID:          profileID,
		ProviderID:  "custom",
		Tunnel:      "wireguard",
		DisplayName: "Default switch",
		CountryCode: "US",
		Country:     "United States",
		City:        "Test",
		Continent:   "North America",
		Protocol:    "udp",
		RemoteHost:  "vpn.example.test",
		RemotePort:  51820,
		Fingerprint: "default-switch",
		Source:      "upload",
		Nonce:       []byte("test-nonce"),
		Ciphertext:  []byte("test-ciphertext"),
	}); err != nil {
		testingObject.Fatalf("create VPN profile: %v", err)
	}

	createConnection := func(id string, name string, slot int, peerPort int) storage.EncryptedVPNConnection {
		connection, createError := store.CreateVPNConnectionInSlot(ctx, storage.EncryptedVPNConnection{
			ID:                   id,
			Name:                 name,
			Enabled:              true,
			ProviderID:           "custom",
			Tunnel:               "wireguard",
			ProfileIDs:           []string{profileID},
			EndpointStrategy:     "sticky",
			DNSServers:           []string{"1.1.1.1"},
			RetryIntervalSeconds: 3,
			PeerPort:             peerPort,
		}, slot)
		if createError != nil {
			testingObject.Fatalf("create %s: %v", name, createError)
		}

		return connection
	}
	firstConnection := createConnection(
		"vpc-0000000000000001",
		"Connection one",
		0,
		storage.DefaultVPNPeerPort,
	)
	secondConnection := createConnection(
		"vpc-0000000000000002",
		"Connection two",
		1,
		storage.DefaultVPNPeerPort+1,
	)

	const proxyUsername = "default-proxy"
	const proxyPassword = "default proxy password"
	if _, err := store.CreateWebProxyLogin(ctx, storage.WebProxyLogin{
		ID:           "wpl-0000000000000001",
		Username:     proxyUsername,
		PasswordHash: "test-password-hash",
	}); err != nil {
		testingObject.Fatalf("create web proxy login: %v", err)
	}
	if _, err := store.SetWebProxyEnabled(ctx, true); err != nil {
		testingObject.Fatalf("enable web proxy: %v", err)
	}

	const claimCode = "ABCDE-23456-FGHIJ"
	if err := store.ReplaceSetupClaim(
		ctx,
		security.Digest(claimCode),
		time.Now().Add(time.Hour),
	); err != nil {
		testingObject.Fatalf("store setup claim: %v", err)
	}

	controllerSocketDirectory, err := os.MkdirTemp("", "tvpn-default-")
	if err != nil {
		testingObject.Fatalf("create controller socket directory: %v", err)
	}
	testingObject.Cleanup(func() { _ = os.RemoveAll(controllerSocketDirectory) })
	controllerSocketPath := filepath.Join(controllerSocketDirectory, "controller.sock")
	controllerListener, err := net.Listen("unix", controllerSocketPath)
	if err != nil {
		testingObject.Fatalf("listen on fake controller socket: %v", err)
	}
	controllerStopped := make(chan struct{})
	var controllerMutex sync.Mutex
	controllerDefaultID := firstConnection.ID
	controllerStatus := func(connection storage.EncryptedVPNConnection, isDefault bool) controller.Status {
		return controller.Status{
			ConnectionID:   connection.ID,
			Slot:           connection.Slot,
			Default:        isDefault,
			State:          "protected",
			ProviderID:     connection.ProviderID,
			Tunnel:         connection.Tunnel,
			Address:        "10.99.0.2",
			DNSServers:     append([]string(nil), connection.DNSServers...),
			TransitionedAt: time.Now().UTC(),
		}
	}
	go func() {
		defer close(controllerStopped)
		for {
			connection, acceptError := controllerListener.Accept()
			if acceptError != nil {
				return
			}

			var request controller.Request
			decodeError := json.NewDecoder(connection).Decode(&request)
			response := controller.Response{OK: decodeError == nil}
			if decodeError != nil {
				response.Error = decodeError.Error()
			} else {
				switch request.Action {
				case "set-default":
					controllerMutex.Lock()
					controllerDefaultID = request.ConnectionID
					controllerMutex.Unlock()
					status := controllerStatus(secondConnection, true)
					response.Status = &status
				case "status":
					controllerMutex.Lock()
					defaultID := controllerDefaultID
					controllerMutex.Unlock()
					response.Statuses = []controller.Status{
						controllerStatus(firstConnection, defaultID == firstConnection.ID),
						controllerStatus(secondConnection, defaultID == secondConnection.ID),
					}
				default:
					response.OK = false
					response.Error = "unexpected controller action"
				}
			}
			_ = json.NewEncoder(connection).Encode(response)
			_ = connection.Close()
		}
	}()
	defer func() {
		_ = controllerListener.Close()
		<-controllerStopped
	}()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	apiServer, err := controlapi.NewServer(controlapi.Config{
		Store:            store,
		Registry:         settings.NewRegistry(),
		InstallationKey:  make([]byte, 32),
		Controller:       controller.NewClient(controllerSocketPath, time.Second),
		RuntimeDirectory: runtimeDirectory,
		Logger:           logger,
		Version:          "test",
	})
	if err != nil {
		testingObject.Fatalf("create control API server: %v", err)
	}
	defer apiServer.Close()

	performAPIRequest := func(
		method string,
		path string,
		body string,
		cookies []*http.Cookie,
		csrfToken string,
	) *httptest.ResponseRecorder {
		request := httptest.NewRequest(method, path, strings.NewReader(body))
		if body != "" {
			request.Header.Set("Content-Type", "application/json")
		}
		if csrfToken != "" {
			request.Header.Set("X-CSRF-Token", csrfToken)
		}
		for _, cookie := range cookies {
			request.AddCookie(cookie)
		}
		response := httptest.NewRecorder()
		apiServer.ServeHTTP(response, request)

		return response
	}
	claimResponse := performAPIRequest(
		http.MethodPost,
		"/api/v1/setup/claim",
		`{"claimCode":"`+claimCode+`","username":"administrator","password":"integration administrator password"}`,
		nil,
		"",
	)
	if claimResponse.Code != http.StatusCreated {
		testingObject.Fatalf(
			"claim control API = %d %s",
			claimResponse.Code,
			claimResponse.Body.String(),
		)
	}
	cookies := claimResponse.Result().Cookies()
	csrfToken := ""
	for _, cookie := range cookies {
		if cookie.Name == "tvpn_csrf" {
			csrfToken = cookie.Value
		}
	}
	if csrfToken == "" {
		testingObject.Fatal("claim response did not include a CSRF token")
	}

	for _, connection := range []storage.EncryptedVPNConnection{
		firstConnection,
		secondConnection,
	} {
		status := controllerStatus(connection, connection.ID == firstConnection.ID)
		statusPath := filepath.Join(
			runtimeDirectory,
			"vpn.status.d",
			connection.ID+".json",
		)
		if err := writeAtomicJSON(statusPath, 0o640, status); err != nil {
			testingObject.Fatalf("write VPN status for %s: %v", connection.ID, err)
		}
	}

	proxyService, err := New(Config{
		ListenAddress:      "127.0.0.1:0",
		ConfigPath:         filepath.Join(runtimeDirectory, "web-proxy", "config.json"),
		StatusPath:         filepath.Join(runtimeDirectory, "web-proxy-state", "status.json"),
		VPNStatusDirectory: filepath.Join(runtimeDirectory, "vpn.status.d"),
		ReadyPath:          filepath.Join(runtimeDirectory, "services", "web-proxy.ready"),
		Logger:             logger,
	})
	if err != nil {
		testingObject.Fatalf("create web proxy service: %v", err)
	}
	proxyService.clientAllowed = func(net.Addr) bool { return true }
	proxyService.destinationAllowed = func(net.IP) bool { return true }
	var passwordVerifications atomic.Int32
	proxyService.authenticator.verifyPassword = func(
		_ context.Context,
		password string,
		passwordHash string,
	) (bool, error) {
		passwordVerifications.Add(1)

		return password == proxyPassword && passwordHash == "test-password-hash", nil
	}
	sourceAddresses := make(chan string, 4)
	proxyService.dialContext = func(
		dialer *net.Dialer,
		_ context.Context,
		_ string,
		_ string,
	) (net.Conn, error) {
		sourceAddress, valid := dialer.LocalAddr.(*net.TCPAddr)
		if !valid || sourceAddress.IP == nil {
			return nil, errors.New("outbound dialer has no TCP source address")
		}
		sourceAddresses <- sourceAddress.IP.String()
		proxyConnection, peerConnection := net.Pipe()
		go func() {
			_, _ = io.Copy(io.Discard, peerConnection)
			_ = peerConnection.Close()
		}()

		return proxyConnection, nil
	}

	runContext, cancelRun := context.WithCancel(context.Background())
	runErrors := make(chan error, 1)
	go func() { runErrors <- proxyService.Run(runContext) }()
	defer func() {
		cancelRun()
		if runError := <-runErrors; runError != nil {
			testingObject.Errorf("run web proxy service: %v", runError)
		}
	}()

	listenerAddress := ""
	listenerDeadline := time.Now().Add(3 * time.Second)
	for listenerAddress == "" && time.Now().Before(listenerDeadline) {
		proxyService.mutex.Lock()
		if proxyService.listener != nil {
			listenerAddress = proxyService.listener.Addr().String()
		}
		proxyService.mutex.Unlock()
		if listenerAddress == "" {
			time.Sleep(10 * time.Millisecond)
		}
	}
	if listenerAddress == "" {
		testingObject.Fatal("web proxy listener did not open")
	}

	openCONNECT := func() (net.Conn, *bufio.Reader) {
		connection, dialError := net.DialTimeout("tcp", listenerAddress, time.Second)
		if dialError != nil {
			testingObject.Fatalf("connect to web proxy: %v", dialError)
		}
		authorization := base64.StdEncoding.EncodeToString(
			[]byte(proxyUsername + ":" + proxyPassword),
		)
		if _, writeError := fmt.Fprintf(
			connection,
			"CONNECT 8.8.8.8:443 HTTP/1.1\r\nHost: 8.8.8.8:443\r\nProxy-Authorization: Basic %s\r\n\r\n",
			authorization,
		); writeError != nil {
			_ = connection.Close()
			testingObject.Fatalf("write CONNECT request: %v", writeError)
		}
		if deadlineError := connection.SetReadDeadline(time.Now().Add(2 * time.Second)); deadlineError != nil {
			_ = connection.Close()
			testingObject.Fatalf("set CONNECT response deadline: %v", deadlineError)
		}
		reader := bufio.NewReader(connection)
		statusLine, readError := reader.ReadString('\n')
		if readError != nil {
			_ = connection.Close()
			testingObject.Fatalf("read CONNECT response: %v", readError)
		}
		if !strings.Contains(statusLine, " 200 ") {
			_ = connection.Close()
			testingObject.Fatalf("CONNECT response = %q", statusLine)
		}
		for {
			line, lineError := reader.ReadString('\n')
			if lineError != nil {
				_ = connection.Close()
				testingObject.Fatalf("read CONNECT response headers: %v", lineError)
			}
			if line == "\r\n" || line == "\n" {
				break
			}
		}
		if deadlineError := connection.SetReadDeadline(time.Time{}); deadlineError != nil {
			_ = connection.Close()
			testingObject.Fatalf("clear CONNECT response deadline: %v", deadlineError)
		}

		return connection, reader
	}
	nextSourceAddress := func() string {
		select {
		case sourceAddress := <-sourceAddresses:
			return sourceAddress
		case <-time.After(2 * time.Second):
			testingObject.Fatal("web proxy did not dial a destination")

			return ""
		}
	}

	firstTransport := proxyService.transportForLogin(Login{ConnectionID: firstConnection.ID})
	firstClient, firstReader := openCONNECT()
	defer firstClient.Close()
	if sourceAddress := nextSourceAddress(); sourceAddress != "198.18.0.1" {
		testingObject.Fatalf("initial CONNECT source = %s, want 198.18.0.1", sourceAddress)
	}

	defaultResponse := performAPIRequest(
		http.MethodPut,
		"/api/v1/vpn/default",
		`{"connectionId":"`+secondConnection.ID+`"}`,
		cookies,
		csrfToken,
	)
	if defaultResponse.Code != http.StatusOK {
		testingObject.Fatalf(
			"switch default = %d %s",
			defaultResponse.Code,
			defaultResponse.Body.String(),
		)
	}
	defaultConnection, err := store.DefaultVPNConnection(ctx)
	if err != nil || defaultConnection.ID != secondConnection.ID {
		testingObject.Fatalf("stored default = %+v, %v", defaultConnection, err)
	}

	publishedConfiguration, err := readRuntimeConfig(proxyService.config.ConfigPath)
	if err != nil {
		testingObject.Fatalf("read published web proxy configuration: %v", err)
	}
	if len(publishedConfiguration.Logins) != 1 ||
		publishedConfiguration.Logins[0].ConnectionID != secondConnection.ID {
		testingObject.Fatalf("published web proxy configuration = %+v", publishedConfiguration)
	}

	reloadDeadline := time.Now().Add(configPollInterval + 2*time.Second)
	for {
		proxyService.mutex.Lock()
		reloaded := len(proxyService.runtimeConfig.Logins) == 1 &&
			proxyService.runtimeConfig.Logins[0].ConnectionID == secondConnection.ID
		proxyService.mutex.Unlock()
		if reloaded {
			break
		}
		if time.Now().After(reloadDeadline) {
			testingObject.Fatal("web proxy did not reload the default-switched configuration")
		}
		time.Sleep(10 * time.Millisecond)
	}

	proxyService.authenticator.mutex.Lock()
	cachedCredentials := len(proxyService.authenticator.cache)
	proxyService.authenticator.mutex.Unlock()
	if cachedCredentials != 0 {
		testingObject.Fatalf("authentication cache retained %d stale credential(s)", cachedCredentials)
	}

	if deadlineError := firstClient.SetReadDeadline(time.Now().Add(time.Second)); deadlineError != nil {
		testingObject.Fatalf("set invalidated CONNECT deadline: %v", deadlineError)
	}
	if _, readError := firstReader.ReadByte(); readError == nil {
		testingObject.Fatal("default switch did not close the CONNECT linked to the old route")
	}

	secondTransport := proxyService.transportForLogin(Login{ConnectionID: secondConnection.ID})
	if secondTransport == firstTransport {
		testingObject.Fatal("connection-specific HTTP transport was reused across VPN routes")
	}
	secondClient, _ := openCONNECT()
	if sourceAddress := nextSourceAddress(); sourceAddress != "198.18.1.1" {
		_ = secondClient.Close()
		testingObject.Fatalf("default-switched CONNECT source = %s, want 198.18.1.1", sourceAddress)
	}
	_ = secondClient.Close()
	if verifications := passwordVerifications.Load(); verifications != 2 {
		testingObject.Fatalf("password verification count = %d, want 2 after reload", verifications)
	}
}
