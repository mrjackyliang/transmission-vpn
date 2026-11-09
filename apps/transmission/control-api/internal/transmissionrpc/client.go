package transmissionrpc

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const (
	maximumResponseBytes            int64 = 32 * 1024 * 1024
	torrentAddResponseHeaderTimeout       = 120 * time.Second
)

// ResultError is a Transmission-reported RPC failure.
//
// Transport failures remain ordinary wrapped errors so API handlers can distinguish
// rejected arguments from an unavailable daemon without parsing text.
type ResultError struct {
	Result string
}

// Error implements the error interface without exposing request contents.
func (resultError *ResultError) Error() string {
	return "Transmission RPC returned: " + resultError.Result
}

// Client is a concurrency-safe client for Transmission's loopback RPC endpoint.
//
// It owns the X-Transmission-Session-Id handshake and deliberately disables HTTP
// proxy discovery so internal daemon traffic can never leave the container.
type Client struct {
	endpoint             *url.URL
	httpClient           *http.Client
	torrentAddHTTPClient *http.Client
	mutex                sync.RWMutex
	sessionID            string
}

// NewClient validates that the native daemon endpoint is local-only.
//
// The app-facing API must remain the only published surface, so a non-loopback RPC
// target is rejected even if supplied by an internal command-line flag.
func NewClient(endpoint string, timeout time.Duration) (*Client, error) {
	parsedEndpoint, err := url.Parse(endpoint)
	if err != nil {
		return nil, fmt.Errorf("parse Transmission RPC endpoint: %w", err)
	}

	if parsedEndpoint.Scheme != "http" || parsedEndpoint.User != nil ||
		parsedEndpoint.RawQuery != "" || parsedEndpoint.Fragment != "" {
		return nil, errors.New("Transmission RPC endpoint must be a plain loopback HTTP URL")
	}

	hostname := strings.TrimSuffix(strings.ToLower(parsedEndpoint.Hostname()), ".")
	ipAddress := net.ParseIP(hostname)
	if hostname != "localhost" && (ipAddress == nil || !ipAddress.IsLoopback()) {
		return nil, errors.New("Transmission RPC endpoint must resolve directly to loopback")
	}

	if parsedEndpoint.Port() == "" || parsedEndpoint.Path == "" {
		return nil, errors.New("Transmission RPC endpoint must include a port and path")
	}

	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	transport := newTransport(10 * time.Second)
	torrentAddTransport := newTransport(torrentAddResponseHeaderTimeout)

	return &Client{
		endpoint: parsedEndpoint,
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   timeout,
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return errors.New("Transmission RPC redirects are not allowed")
			},
		},
		torrentAddHTTPClient: &http.Client{
			Transport: torrentAddTransport,
			Timeout:   torrentAddResponseHeaderTimeout,
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return errors.New("Transmission RPC redirects are not allowed")
			},
		},
	}, nil
}

// newTransport creates one loopback-only RPC transport with a method-specific wait.
func newTransport(responseHeaderTimeout time.Duration) *http.Transport {
	return &http.Transport{
		Proxy:                 nil,
		DialContext:           (&net.Dialer{Timeout: 5 * time.Second}).DialContext,
		ForceAttemptHTTP2:     false,
		MaxIdleConns:          4,
		MaxIdleConnsPerHost:   4,
		IdleConnTimeout:       30 * time.Second,
		ResponseHeaderTimeout: responseHeaderTimeout,
	}
}

// Call executes one typed Transmission RPC method.
//
// A 409 response refreshes the CSRF session identifier and retries the exact request
// once, matching Transmission's documented transport contract.
func (client *Client) Call(
	ctx context.Context,
	method string,
	arguments any,
	result any,
) error {
	if strings.TrimSpace(method) == "" {
		return errors.New("Transmission RPC method is required")
	}

	payload, err := json.Marshal(struct {
		Method    string `json:"method"`
		Arguments any    `json:"arguments,omitempty"`
	}{
		Method:    method,
		Arguments: arguments,
	})
	if err != nil {
		return fmt.Errorf("encode Transmission RPC request: %w", err)
	}

	for attempt := 0; attempt < 2; attempt++ {
		httpClient := client.httpClient
		if method == "torrent-add" {
			httpClient = client.torrentAddHTTPClient
		}
		response, requestError := client.send(ctx, httpClient, payload)
		if requestError != nil {
			return requestError
		}

		if response.StatusCode == http.StatusConflict {
			sessionID := strings.TrimSpace(response.Header.Get("X-Transmission-Session-Id"))
			_ = response.Body.Close()
			if sessionID == "" {
				return errors.New("Transmission RPC omitted its session identifier")
			}

			client.setSessionID(sessionID)
			continue
		}

		return decodeResponse(response, result)
	}

	return errors.New("Transmission RPC rejected the refreshed session identifier")
}

// send creates one request with the latest known Transmission session identifier.
func (client *Client) send(
	ctx context.Context,
	httpClient *http.Client,
	payload []byte,
) (*http.Response, error) {
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		client.endpoint.String(),
		bytes.NewReader(payload),
	)
	if err != nil {
		return nil, fmt.Errorf("create Transmission RPC request: %w", err)
	}

	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	if sessionID := client.currentSessionID(); sessionID != "" {
		request.Header.Set("X-Transmission-Session-Id", sessionID)
	}

	response, err := httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("call Transmission RPC: %w", err)
	}

	return response, nil
}

// decodeResponse validates one bounded RPC response and extracts its arguments.
func decodeResponse(response *http.Response, result any) error {
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))

		return fmt.Errorf("Transmission RPC returned HTTP %d", response.StatusCode)
	}

	limitedBody := io.LimitReader(response.Body, maximumResponseBytes+1)
	content, err := io.ReadAll(limitedBody)
	if err != nil {
		return fmt.Errorf("read Transmission RPC response: %w", err)
	}
	if int64(len(content)) > maximumResponseBytes {
		return errors.New("Transmission RPC response exceeds the size limit")
	}

	var envelope struct {
		Arguments json.RawMessage `json:"arguments"`
		Result    string          `json:"result"`
	}
	if err := json.Unmarshal(content, &envelope); err != nil {
		return fmt.Errorf("decode Transmission RPC response: %w", err)
	}

	if envelope.Result != "success" {
		if envelope.Result == "" {
			return errors.New("Transmission RPC response omitted its result")
		}

		return &ResultError{Result: envelope.Result}
	}

	if result == nil || len(envelope.Arguments) == 0 || string(envelope.Arguments) == "null" {
		return nil
	}

	if err := json.Unmarshal(envelope.Arguments, result); err != nil {
		return fmt.Errorf("decode Transmission RPC arguments: %w", err)
	}

	return nil
}

// currentSessionID returns the most recently negotiated session identifier.
func (client *Client) currentSessionID() string {
	client.mutex.RLock()
	defer client.mutex.RUnlock()

	return client.sessionID
}

// setSessionID replaces the negotiated session identifier atomically.
func (client *Client) setSessionID(sessionID string) {
	client.mutex.Lock()
	client.sessionID = sessionID
	client.mutex.Unlock()
}
