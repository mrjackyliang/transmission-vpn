package provider

const (
	// TunnelOpenVPN identifies an OpenVPN tunnel and its `.ovpn` profiles.
	TunnelOpenVPN = "openvpn"

	// TunnelWireGuard identifies a WireGuard tunnel and its `.conf` configurations.
	TunnelWireGuard = "wireguard"
)

const (
	// CredentialKindText is a plain single-line value such as a username.
	CredentialKindText = "text"

	// CredentialKindPassword is a secret single-line value such as a password.
	CredentialKindPassword = "password"

	// CredentialKindWireGuardKey is a base64 WireGuard private key.
	CredentialKindWireGuardKey = "wireguard-key"

	// CredentialKindIPv4Address is an IPv4 tunnel address with an optional prefix length.
	CredentialKindIPv4Address = "ipv4-address"
)

// CredentialField describes one secret or identifier requested by a provider tunnel.
//
// The UI renders these definitions without embedding provider-specific forms in
// its main configuration flow, and the kind tells both sides how to validate a value.
type CredentialField struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Kind        string `json:"kind"`
	Secret      bool   `json:"secret"`
	Required    bool   `json:"required"`
	Description string `json:"description"`
}

// TunnelDefinition describes how one provider is used over one tunnel protocol.
//
// A provider can publish different catalogs and ask for different credentials per
// tunnel, so every capability lives here rather than on the provider itself.
type TunnelDefinition struct {
	ID                     string            `json:"id"`
	Description            string            `json:"description"`
	CatalogSource          string            `json:"catalogSource"`
	SupportsProfileUpload  bool              `json:"supportsProfileUpload"`
	SupportsCatalogRefresh bool              `json:"supportsCatalogRefresh"`
	CredentialFields       []CredentialField `json:"credentialFields"`
}

// P2PGuidance points to a provider's own page about which servers allow P2P traffic.
//
// Restricted marks providers that allow P2P on only some servers, so the console warns
// before endpoints are picked rather than after a torrent stalls.
type P2PGuidance struct {
	Restricted bool   `json:"restricted"`
	Note       string `json:"note"`
	LinkLabel  string `json:"linkLabel"`
	URL        string `json:"url"`
}

// Definition describes one supported VPN provider adapter.
//
// Capabilities and credential fields are data-oriented so the networking core and UI
// do not accumulate provider-specific branches. Tunnels are listed in the order the
// console offers them, so the first one is the default for a new setup. P2P is nil
// when the provider publishes no P2P server guidance.
type Definition struct {
	ID                     string             `json:"id"`
	DisplayName            string             `json:"displayName"`
	Description            string             `json:"description"`
	SupportsPortForwarding bool               `json:"supportsPortForwarding"`
	P2P                    *P2PGuidance       `json:"p2p"`
	Tunnels                []TunnelDefinition `json:"tunnels"`
}

// Tunnel finds one of the provider's tunnel definitions.
//
// The boolean result lets callers reject a tunnel the provider doesn't offer before
// any profile is read or any network request is made.
func (definition Definition) Tunnel(tunnelID string) (TunnelDefinition, bool) {
	for _, tunnel := range definition.Tunnels {
		if tunnel.ID == tunnelID {
			return tunnel, true
		}
	}

	return TunnelDefinition{}, false
}

// Definitions returns supported providers in stable display order.
//
// Custom establishes the generic adapter contract for both tunnels, while PureVPN
// provides the first maintained catalog needed to migrate the user's current
// deployment.
func Definitions() []Definition {
	return []Definition{
		{
			ID:                     "custom",
			DisplayName:            "Custom",
			Description:            "Import a validated OpenVPN or WireGuard file from any compatible provider.",
			SupportsPortForwarding: false,
			Tunnels: []TunnelDefinition{
				{
					ID:                     TunnelOpenVPN,
					Description:            "Import a validated OpenVPN profile from any compatible provider.",
					CatalogSource:          "upload",
					SupportsProfileUpload:  true,
					SupportsCatalogRefresh: false,
					CredentialFields: []CredentialField{
						{
							Key:         "username",
							Label:       "Username",
							Kind:        CredentialKindText,
							Secret:      false,
							Required:    false,
							Description: "The OpenVPN service username when the profile uses password authentication.",
						},
						{
							Key:         "password",
							Label:       "Password",
							Kind:        CredentialKindPassword,
							Secret:      true,
							Required:    false,
							Description: "The OpenVPN service password when the profile uses password authentication.",
						},
					},
				},
				{
					ID:                     TunnelWireGuard,
					Description:            "Import a validated WireGuard configuration that includes its own private key.",
					CatalogSource:          "upload",
					SupportsProfileUpload:  true,
					SupportsCatalogRefresh: false,
					CredentialFields:       []CredentialField{},
				},
			},
		},
		{
			ID:                     "purevpn",
			DisplayName:            "PureVPN",
			Description:            "Use PureVPN's official recommended OpenVPN profile catalog.",
			SupportsPortForwarding: false,
			P2P: &P2PGuidance{
				Restricted: true,
				Note:       "PureVPN allows P2P only on servers in the countries it lists.",
				LinkLabel:  "See PureVPN's P2P countries",
				URL:        "https://support.purevpn.com/en_US/about-purevpn/p2p-file-sharing",
			},
			Tunnels: []TunnelDefinition{
				openVPNCatalogTunnel(
					"Use PureVPN's official recommended OpenVPN profile catalog.",
					PureVPNCatalogURL,
					"VPN username",
					"The generated manual-connection username from the PureVPN member area.",
					"The generated manual-connection password from the PureVPN member area.",
				),
			},
		},
		{
			ID:                     "pia",
			DisplayName:            "Private Internet Access",
			Description:            "Use PIA's official strong UDP and TCP location catalogs.",
			SupportsPortForwarding: false,
			P2P: &P2PGuidance{
				Restricted: false,
				Note:       "Private Internet Access allows P2P on every server.",
				LinkLabel:  "See PIA's server list",
				URL:        "https://www.privateinternetaccess.com/vpn-server",
			},
			Tunnels: []TunnelDefinition{
				openVPNCatalogTunnel(
					"Use PIA's official strong UDP and TCP location catalogs.",
					PIAStrongUDPCatalogURL,
					"VPN username",
					"The PIA service username used for manual OpenVPN connections.",
					"The PIA service password used for manual OpenVPN connections.",
				),
			},
		},
		{
			ID:                     "ipvanish",
			DisplayName:            "IPVanish",
			Description:            "Use IPVanish's official OpenVPN 2.6 server catalog.",
			SupportsPortForwarding: false,
			Tunnels: []TunnelDefinition{
				openVPNCatalogTunnel(
					"Use IPVanish's official OpenVPN 2.6 server catalog.",
					IPVanishCatalogURL,
					"VPN username",
					"The username associated with the IPVanish subscription.",
					"The password associated with the IPVanish subscription.",
				),
			},
		},
		{
			ID:                     "nordvpn",
			DisplayName:            "NordVPN",
			Description:            "Use NordVPN's official OpenVPN and WireGuard server catalogs.",
			SupportsPortForwarding: false,
			P2P: &P2PGuidance{
				Restricted: false,
				Note:       "NordVPN allows P2P on all of its standard servers.",
				LinkLabel:  "Read NordVPN's P2P answer",
				URL:        "https://support.nordvpn.com/hc/en-us/articles/45840292778897-I-can-t-find-NordVPN-P2P-servers",
			},
			Tunnels: []TunnelDefinition{
				openVPNCatalogTunnel(
					"Use NordVPN's official OpenVPN 2.6 server catalog.",
					NordVPNCatalogURL,
					"VPN username",
					"The service username from the manual setup section of your Nord Account.",
					"The service password from the manual setup section of your Nord Account.",
				),
				wireGuardCatalogTunnel(
					"Use NordVPN's official WireGuard server list.",
					NordVPNWireGuardCatalogURL,
					"The PrivateKey line from a WireGuard file downloaded in your Nord Account under Set up NordVPN manually.",
					"",
					false,
				),
			},
		},
		{
			ID:                     "surfshark",
			DisplayName:            "Surfshark",
			Description:            "Use Surfshark's official OpenVPN and WireGuard location catalogs.",
			SupportsPortForwarding: false,
			P2P: &P2PGuidance{
				Restricted: true,
				Note:       "Surfshark's server list marks which locations allow P2P.",
				LinkLabel:  "See Surfshark's server list",
				URL:        "https://surfshark.com/servers",
			},
			Tunnels: []TunnelDefinition{
				openVPNCatalogTunnel(
					"Use Surfshark's official OpenVPN location catalog.",
					SurfsharkCatalogURL,
					"VPN username",
					"The service username from the manual setup page of your Surfshark account.",
					"The service password from the manual setup page of your Surfshark account.",
				),
				wireGuardCatalogTunnel(
					"Use Surfshark's official WireGuard location list.",
					SurfsharkWireGuardCatalogURL,
					"The private key of a WireGuard key pair from the manual setup page of your Surfshark account.",
					"Leave empty to use 10.14.0.2/16, the address in Surfshark's WireGuard files.",
					false,
				),
			},
		},
		{
			ID:                     "ivpn",
			DisplayName:            "IVPN",
			Description:            "Use IVPN's official OpenVPN and WireGuard location catalogs.",
			SupportsPortForwarding: false,
			P2P: &P2PGuidance{
				Restricted: true,
				Note:       "IVPN asks P2P users to avoid its US servers.",
				LinkLabel:  "Read IVPN's P2P answer",
				URL:        "https://www.ivpn.net/knowledgebase/general/do-you-allow-p2p-or-bittorrent-or-torrents-downloading/",
			},
			Tunnels: []TunnelDefinition{
				openVPNCatalogTunnel(
					"Use IVPN's official OpenVPN UDP and TCP location catalogs.",
					IVPNUDPCatalogURL,
					"Account ID",
					"Your IVPN account ID, such as i-XXXX-XXXX-XXXX.",
					"IVPN doesn't check it. Enter any value, such as ivpn.",
				),
				wireGuardCatalogTunnel(
					"Use IVPN's official WireGuard server list.",
					IVPNWireGuardCatalogURL,
					"The private key of the WireGuard key you added under WireGuard in your IVPN account.",
					"The IP address IVPN assigned to that key, such as 172.20.12.34/32.",
					true,
				),
			},
		},
		{
			ID:                     "mullvad",
			DisplayName:            "Mullvad",
			Description:            "Use Mullvad's official WireGuard relay list.",
			SupportsPortForwarding: false,
			Tunnels: []TunnelDefinition{
				wireGuardCatalogTunnel(
					"Use Mullvad's official WireGuard relay list.",
					MullvadWireGuardCatalogURL,
					"The PrivateKey line from a WireGuard file generated in your Mullvad account.",
					"The IPv4 Address line from that file, such as 10.68.12.34/32.",
					true,
				),
			},
		},
	}
}

// openVPNCatalogTunnel builds the OpenVPN tunnel of a provider with an official catalog.
//
// Every catalog provider signs in with a required username and password, so only the
// wording changes between them.
func openVPNCatalogTunnel(
	description string,
	catalogSource string,
	usernameLabel string,
	usernameDescription string,
	passwordDescription string,
) TunnelDefinition {
	return TunnelDefinition{
		ID:                     TunnelOpenVPN,
		Description:            description,
		CatalogSource:          catalogSource,
		SupportsProfileUpload:  false,
		SupportsCatalogRefresh: true,
		CredentialFields: []CredentialField{
			{
				Key:         "username",
				Label:       usernameLabel,
				Kind:        CredentialKindText,
				Secret:      false,
				Required:    true,
				Description: usernameDescription,
			},
			{
				Key:         "password",
				Label:       "VPN password",
				Kind:        CredentialKindPassword,
				Secret:      true,
				Required:    true,
				Description: passwordDescription,
			},
		},
	}
}

// wireGuardCatalogTunnel builds the WireGuard tunnel of a provider with an official list.
//
// The private key is always required. An address field appears only for providers
// that assign one per key; an empty description leaves it out because the provider
// uses one fixed address that the catalog template already carries.
func wireGuardCatalogTunnel(
	description string,
	catalogSource string,
	privateKeyDescription string,
	addressDescription string,
	addressRequired bool,
) TunnelDefinition {
	fields := []CredentialField{
		{
			Key:         "privateKey",
			Label:       "Private key",
			Kind:        CredentialKindWireGuardKey,
			Secret:      true,
			Required:    true,
			Description: privateKeyDescription,
		},
	}
	if addressDescription != "" {
		fields = append(fields, CredentialField{
			Key:         "address",
			Label:       "Tunnel address",
			Kind:        CredentialKindIPv4Address,
			Secret:      false,
			Required:    addressRequired,
			Description: addressDescription,
		})
	}

	return TunnelDefinition{
		ID:                     TunnelWireGuard,
		Description:            description,
		CatalogSource:          catalogSource,
		SupportsProfileUpload:  false,
		SupportsCatalogRefresh: true,
		CredentialFields:       fields,
	}
}

// DefinitionByID finds one supported provider definition.
//
// The boolean result lets API validation distinguish an unknown provider from a
// definition containing optional zero-value capabilities.
func DefinitionByID(providerID string) (Definition, bool) {
	for _, definition := range Definitions() {
		if definition.ID == providerID {
			return definition, true
		}
	}

	return Definition{}, false
}
