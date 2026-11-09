package api

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/settings"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/storage"
	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/transmissionrpc"
)

// TestSetDefaultPublishesBothConfigurationsAndRetriesTransmission verifies one
// failed daemon hand-off cannot skip the proxy hand-off after the durable switch.
func TestSetDefaultPublishesBothConfigurationsAndRetriesTransmission(
	testingObject *testing.T,
) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{}}
		},
		func(recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{}}
		},
	)
	startFakeController(testingObject, fixture.server)
	fixture.server.transmissionConfigRetryInterval = 10 * time.Millisecond
	var transmissionAttempts atomic.Int32
	transmissionRetried := make(chan struct{})
	var transmissionRetryOnce sync.Once
	fixture.server.transmissionConfigPublisher = func(
		context.Context,
		*storage.Store,
		settings.Registry,
		string,
	) ([]transmissionrpc.DaemonConfig, error) {
		if transmissionAttempts.Add(1) == 1 {
			return nil, errors.New("test Transmission publisher unavailable")
		}
		transmissionRetryOnce.Do(func() { close(transmissionRetried) })

		return nil, nil
	}
	var webProxyPublishes atomic.Int32
	fixture.server.webProxyConfigPublisher = func(
		string,
		webProxyRuntimeConfig,
	) error {
		webProxyPublishes.Add(1)

		return nil
	}

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodPut,
		"/api/v1/vpn/default",
		`{"connectionId":"`+fixture.second.ID+`"}`,
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusInternalServerError ||
		!strings.Contains(response.Body.String(), `"code":"vpn_runtime_update_deferred"`) {
		testingObject.Fatalf("deferred default publish = %d %s", response.Code, response.Body.String())
	}
	if webProxyPublishes.Load() != 1 {
		testingObject.Fatalf("web proxy publishes = %d, want 1", webProxyPublishes.Load())
	}
	select {
	case <-transmissionRetried:
	case <-time.After(time.Second):
		testingObject.Fatal("Transmission configuration was not retried")
	}
	defaultConnection, err := fixture.server.store.DefaultVPNConnection(context.Background())
	if err != nil || defaultConnection.ID != fixture.second.ID {
		testingObject.Fatalf("saved default = %+v, %v", defaultConnection, err)
	}
}

// TestDeletePublishesAndRetriesBothConfigurations independently reconciles each
// runtime hand-off after the connection row has already been deleted.
func TestDeletePublishesAndRetriesBothConfigurations(testingObject *testing.T) {
	fixture := newMultiTransmissionFixture(
		testingObject,
		func(recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{}}
		},
		func(recordedTransmissionCall) any {
			return map[string]any{"torrents": []map[string]any{}}
		},
	)
	startFakeController(testingObject, fixture.server)
	fixture.server.transmissionConfigRetryInterval = 10 * time.Millisecond
	fixture.server.webProxyRetryInterval = 10 * time.Millisecond
	var transmissionAttempts atomic.Int32
	var webProxyAttempts atomic.Int32
	transmissionRetried := make(chan struct{})
	webProxyRetried := make(chan struct{})
	var transmissionRetryOnce sync.Once
	var webProxyRetryOnce sync.Once
	fixture.server.transmissionConfigPublisher = func(
		context.Context,
		*storage.Store,
		settings.Registry,
		string,
	) ([]transmissionrpc.DaemonConfig, error) {
		if transmissionAttempts.Add(1) == 1 {
			return nil, errors.New("test Transmission publisher unavailable")
		}
		transmissionRetryOnce.Do(func() { close(transmissionRetried) })

		return nil, nil
	}
	fixture.server.webProxyConfigPublisher = func(
		string,
		webProxyRuntimeConfig,
	) error {
		if webProxyAttempts.Add(1) == 1 {
			return errors.New("test web proxy publisher unavailable")
		}
		webProxyRetryOnce.Do(func() { close(webProxyRetried) })

		return nil
	}

	response := performRequest(
		testingObject,
		fixture.server,
		http.MethodDelete,
		"/api/v1/vpn/connections/"+fixture.second.ID,
		"",
		fixture.cookies,
		fixture.csrfToken,
	)
	if response.Code != http.StatusInternalServerError ||
		!strings.Contains(response.Body.String(), `"code":"vpn_runtime_update_deferred"`) {
		testingObject.Fatalf("deferred delete publish = %d %s", response.Code, response.Body.String())
	}
	for name, retried := range map[string]<-chan struct{}{
		"Transmission": transmissionRetried,
		"web proxy":    webProxyRetried,
	} {
		select {
		case <-retried:
		case <-time.After(time.Second):
			testingObject.Fatalf("%s configuration was not retried", name)
		}
	}
	if _, err := fixture.server.store.VPNConnectionByID(
		context.Background(),
		fixture.second.ID,
	); !errors.Is(err, storage.ErrNotFound) {
		testingObject.Fatalf("deleted connection lookup error = %v", err)
	}
}
