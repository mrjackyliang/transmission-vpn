package provider

import (
	"net/url"
	"testing"
	"time"
)

// TestCatalogRefreshDeadline gives each refresh its sources' time plus a margin, and
// never less than the shared floor.
func TestCatalogRefreshDeadline(testingObject *testing.T) {
	tests := []struct {
		providerID string
		tunnel     string
		want       time.Duration
	}{
		{providerID: "purevpn", tunnel: TunnelOpenVPN, want: 90 * time.Second},
		{providerID: "pia", tunnel: TunnelOpenVPN, want: 90 * time.Second},
		{providerID: "nordvpn", tunnel: TunnelOpenVPN, want: nordVPNCatalogTimeout + catalogRefreshMargin},
		{providerID: "nordvpn", tunnel: TunnelWireGuard, want: nordVPNServerListTimeout + catalogRefreshMargin},
		{providerID: "mullvad", tunnel: TunnelWireGuard, want: 90 * time.Second},
	}

	for _, test := range tests {
		testingObject.Run(test.providerID+"/"+test.tunnel, func(testingObject *testing.T) {
			definition, found := CatalogDefinitionFor(test.providerID, test.tunnel)
			if !found {
				testingObject.Fatalf("no catalog for %s/%s", test.providerID, test.tunnel)
			}
			if got := definition.RefreshDeadline(); got != test.want {
				testingObject.Fatalf("RefreshDeadline() = %s, want %s", got, test.want)
			}
		})
	}
}

// TestCatalogsMatchProviderDefinitions keeps every refreshable provider tunnel wired
// through its definition, its sources, and an adapter.
func TestCatalogsMatchProviderDefinitions(testingObject *testing.T) {
	for _, definition := range Definitions() {
		if len(definition.Tunnels) == 0 {
			testingObject.Fatalf("%s has no tunnels", definition.ID)
		}

		for _, tunnel := range definition.Tunnels {
			name := definition.ID + "/" + tunnel.ID
			if tunnel.ID != TunnelOpenVPN && tunnel.ID != TunnelWireGuard {
				testingObject.Fatalf("%s: unknown tunnel", name)
			}

			catalog, found := CatalogDefinitionFor(definition.ID, tunnel.ID)
			if found != tunnel.SupportsCatalogRefresh {
				testingObject.Fatalf("%s: catalog found = %t, refresh supported = %t", name, found, tunnel.SupportsCatalogRefresh)
			}
			if !found {
				continue
			}
			if catalog.Sources[0].URL != tunnel.CatalogSource {
				testingObject.Fatalf("%s: first source %s, definition says %s", name, catalog.Sources[0].URL, tunnel.CatalogSource)
			}

			empty := make([][]byte, len(catalog.Sources))
			if _, err := ParseCatalog(definition.ID, tunnel.ID, empty); err == nil || err.Error() == "the VPN catalog adapter is unavailable" {
				testingObject.Fatalf("%s: ParseCatalog error = %v, want the adapter to reject an empty source", name, err)
			}
		}
	}
}

// TestP2PGuidanceLinksToProviderPages keeps each P2P note on its own provider's HTTPS
// site, and leaves providers without a verified page, including Custom, with none.
func TestP2PGuidanceLinksToProviderPages(testingObject *testing.T) {
	hosts := map[string]string{
		"purevpn":   "support.purevpn.com",
		"pia":       "www.privateinternetaccess.com",
		"nordvpn":   "support.nordvpn.com",
		"surfshark": "surfshark.com",
		"ivpn":      "www.ivpn.net",
	}

	for _, definition := range Definitions() {
		host, expected := hosts[definition.ID]
		if !expected {
			if definition.P2P != nil {
				testingObject.Fatalf("%s has P2P guidance without a verified page", definition.ID)
			}

			continue
		}
		if definition.P2P == nil {
			testingObject.Fatalf("%s has no P2P guidance", definition.ID)
		}

		link, err := url.Parse(definition.P2P.URL)
		if err != nil || link.Scheme != "https" || link.Host != host {
			testingObject.Fatalf("%s P2P link = %q, want an HTTPS page on %s", definition.ID, definition.P2P.URL, host)
		}
		if definition.P2P.Note == "" || definition.P2P.LinkLabel == "" {
			testingObject.Fatalf("%s P2P guidance is missing its note or link label", definition.ID)
		}
	}
}

// TestWireGuardSourcesAskForJSON keeps the WireGuard lists off the archive Accept header.
func TestWireGuardSourcesAskForJSON(testingObject *testing.T) {
	for _, definition := range Definitions() {
		tunnel, found := definition.Tunnel(TunnelWireGuard)
		if !found || !tunnel.SupportsCatalogRefresh {
			continue
		}

		catalog, _ := CatalogDefinitionFor(definition.ID, TunnelWireGuard)
		for _, source := range catalog.Sources {
			if source.AcceptHeader() != "application/json" {
				testingObject.Fatalf("%s WireGuard source asks for %q", definition.ID, source.AcceptHeader())
			}
		}
	}
}
