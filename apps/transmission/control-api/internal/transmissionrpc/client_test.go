package transmissionrpc

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// TestClientNegotiatesSessionIdentifier proves the documented 409 retry handshake.
func TestClientNegotiatesSessionIdentifier(testingObject *testing.T) {
	var requestCount atomic.Int32
	testServer := httptest.NewServer(http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		request *http.Request,
	) {
		requestCount.Add(1)
		if request.Header.Get("X-Transmission-Session-Id") != "test-session" {
			responseWriter.Header().Set("X-Transmission-Session-Id", "test-session")
			responseWriter.WriteHeader(http.StatusConflict)

			return
		}

		responseWriter.Header().Set("Content-Type", "application/json")
		_, _ = responseWriter.Write([]byte(
			`{"arguments":{"version":"4.1.3"},"result":"success"}`,
		))
	}))
	defer testServer.Close()

	client, err := NewClient(testServer.URL+"/transmission/rpc", time.Second)
	if err != nil {
		testingObject.Fatalf("create client: %v", err)
	}

	var response struct {
		Version string `json:"version"`
	}
	if err := client.Call(context.Background(), "session-get", nil, &response); err != nil {
		testingObject.Fatalf("call session-get: %v", err)
	}

	if response.Version != "4.1.3" {
		testingObject.Fatalf("version = %q, want 4.1.3", response.Version)
	}
	if requestCount.Load() != 2 {
		testingObject.Fatalf("request count = %d, want 2", requestCount.Load())
	}
}

// TestClientReturnsTypedResultError preserves daemon validation as a distinct error.
func TestClientReturnsTypedResultError(testingObject *testing.T) {
	testServer := httptest.NewServer(http.HandlerFunc(func(
		responseWriter http.ResponseWriter,
		_ *http.Request,
	) {
		responseWriter.Header().Set("Content-Type", "application/json")
		_, _ = responseWriter.Write([]byte(`{"arguments":{},"result":"invalid argument"}`))
	}))
	defer testServer.Close()

	client, err := NewClient(testServer.URL+"/transmission/rpc", time.Second)
	if err != nil {
		testingObject.Fatalf("create client: %v", err)
	}

	err = client.Call(context.Background(), "torrent-set", map[string]any{}, nil)
	var resultError *ResultError
	if !errors.As(err, &resultError) || resultError.Result != "invalid argument" {
		testingObject.Fatalf("error = %v, want typed invalid argument result", err)
	}
}

// TestClientRejectsNonLoopbackEndpoint enforces the internal-only trust boundary.
func TestClientRejectsNonLoopbackEndpoint(testingObject *testing.T) {
	_, err := NewClient("http://example.com:9092/transmission/rpc", time.Second)
	if err == nil || !strings.Contains(err.Error(), "loopback") {
		testingObject.Fatalf("error = %v, want loopback rejection", err)
	}
}

// TestTorrentAddUsesLongResponseHeaderTimeout protects slow URL metainfo fetches.
func TestTorrentAddUsesLongResponseHeaderTimeout(testingObject *testing.T) {
	client, err := NewClient("http://127.0.0.1:9092/transmission/rpc", time.Second)
	if err != nil {
		testingObject.Fatalf("create client: %v", err)
	}

	regularTransport, regularValid := client.httpClient.Transport.(*http.Transport)
	addTransport, addValid := client.torrentAddHTTPClient.Transport.(*http.Transport)
	if !regularValid || !addValid {
		testingObject.Fatal("Transmission clients did not use HTTP transports")
	}
	if regularTransport.ResponseHeaderTimeout != 10*time.Second {
		testingObject.Fatalf(
			"regular response-header timeout = %s, want 10s",
			regularTransport.ResponseHeaderTimeout,
		)
	}
	if addTransport.ResponseHeaderTimeout != 120*time.Second ||
		client.torrentAddHTTPClient.Timeout != 120*time.Second {
		testingObject.Fatalf(
			"torrent-add timeouts = header %s, total %s, want 2m",
			addTransport.ResponseHeaderTimeout,
			client.torrentAddHTTPClient.Timeout,
		)
	}
}
