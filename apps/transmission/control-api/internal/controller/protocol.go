package controller

import "time"

// ProtocolVersion is the exact API-to-controller command contract version.
//
// Both binaries ship in one image, but explicit versioning keeps mismatched rolling or
// test components from interpreting a privileged command incorrectly.
const ProtocolVersion = 4

const (
	// maximumConnectDuration bounds one connect command, which may try a whole pool.
	// When it runs out, the controller tries no further endpoint and answers with the
	// endpoints that failed. A restore has no limit, because nobody waits for it.
	maximumConnectDuration = 15 * time.Minute

	// connectResponseMargin covers what a connect does outside that limit, such as
	// stopping the previous tunnel and the endpoint the limit cut short. The client
	// waits this much longer, so it always receives the controller's own answer.
	connectResponseMargin = 2 * time.Minute
)

// Request is one narrow command sent over the permission-restricted Unix socket.
//
// The contract has no generic command execution or firewall arguments; each action has
// a typed payload validated again by the privileged controller.
type Request struct {
	Version      int         `json:"version"`
	Action       string      `json:"action"`
	ConnectionID string      `json:"connectionId,omitempty"`
	Slot         int         `json:"slot"`
	Default      bool        `json:"default"`
	Connection   *Connection `json:"connection,omitempty"`
}

// Endpoint contains one already normalized candidate VPN configuration.
//
// Every endpoint is revalidated by the privileged controller before use. A WireGuard
// configuration already carries the user's private key, merged in by the API.
type Endpoint struct {
	ProfileID     string `json:"profileId"`
	Configuration []byte `json:"configuration"`
	RemoteHost    string `json:"remoteHost"`
	RemotePort    int    `json:"remotePort"`
}

// Connection contains an ordered pool of normalized VPN endpoints of one tunnel type.
//
// Credentials cross only the local Unix socket and are written to an ephemeral root-
// owned file; status and response structures never include them. Username and
// password apply to OpenVPN only and must be empty for WireGuard.
type Connection struct {
	ProviderID           string     `json:"providerId"`
	Tunnel               string     `json:"tunnel"`
	Endpoints            []Endpoint `json:"endpoints"`
	EndpointStrategy     string     `json:"endpointStrategy"`
	Username             string     `json:"username"`
	Password             string     `json:"password"`
	DNSServers           []string   `json:"dnsServers"`
	RetryIntervalSeconds int        `json:"retryIntervalSeconds"`
}

// Response reports the result of one controller command.
//
// Errors are normalized for the API and UI while detailed child-process output
// remains in controller-owned logs.
type Response struct {
	OK       bool     `json:"ok"`
	Status   *Status  `json:"status,omitempty"`
	Statuses []Status `json:"statuses,omitempty"`
	Error    string   `json:"error,omitempty"`
}

// Status is the secret-free normalized VPN controller state.
//
// The control API can expose this type directly without reading privileged files or
// leaking profile contents and credentials.
//
// Implementation and LastHandshakeAt are filled only for a protected WireGuard tunnel.
type Status struct {
	ConnectionID     string     `json:"connectionId"`
	Slot             int        `json:"slot"`
	Default          bool       `json:"default"`
	State            string     `json:"state"`
	ProviderID       string     `json:"providerId,omitempty"`
	Tunnel           string     `json:"tunnel,omitempty"`
	ProfileID        string     `json:"profileId,omitempty"`
	EndpointPosition int        `json:"endpointPosition,omitempty"`
	EndpointCount    int        `json:"endpointCount,omitempty"`
	EndpointStrategy string     `json:"endpointStrategy,omitempty"`
	Interface        string     `json:"interface,omitempty"`
	Implementation   string     `json:"implementation,omitempty"`
	RemoteHost       string     `json:"remoteHost,omitempty"`
	RemotePort       int        `json:"remotePort,omitempty"`
	Address          string     `json:"address"`
	DNSServers       []string   `json:"dnsServers"`
	LastHandshakeAt  *time.Time `json:"lastHandshakeAt,omitempty"`
	Attempt          int        `json:"attempt"`
	LastError        string     `json:"lastError,omitempty"`
	TransitionedAt   time.Time  `json:"transitionedAt"`
}
