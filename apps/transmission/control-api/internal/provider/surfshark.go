package provider

import (
	"path/filepath"
	"strings"
)

const (
	maximumSurfsharkArchiveBytes      = 16 * 1024 * 1024
	maximumSurfsharkArchiveEntries    = 2000
	maximumSurfsharkUncompressedBytes = 64 * 1024 * 1024
)

// ParseSurfsharkCatalog validates Surfshark's public archive of per-location profiles.
//
// Each location has one UDP and one TCP profile whose remote is the location's host,
// which Surfshark balances across its servers there.
func ParseSurfsharkCatalog(content []byte) ([]Profile, error) {
	return parseZIPProfiles(
		"surfshark",
		"Surfshark",
		content,
		maximumSurfsharkArchiveBytes,
		maximumSurfsharkArchiveEntries,
		maximumSurfsharkUncompressedBytes,
		decorateSurfsharkProfile,
	)
}

// decorateSurfsharkProfile labels a location from its host name.
//
// Hosts are a country code and an airport code, such as es-mad.prod.surfshark.com. The
// city comes from surfsharkCities, and a location added after that table shows its
// airport code instead.
func decorateSurfsharkProfile(profile *Profile, profileName string) {
	hostName, _, found := strings.Cut(strings.ToLower(filepath.Base(profileName)), ".prod.surfshark.com")
	if !found {
		return
	}

	countryCode, airportCode, found := strings.Cut(hostName, "-")
	if !found || airportCode == "" {
		return
	}

	location, found := locationByCode(countryCode)
	if !found {
		return
	}

	city, known := surfsharkCities[hostName]
	if !known {
		city = strings.ToUpper(airportCode)
	}
	applyLocation(profile, location, city, "")
}

// surfsharkCities names the city of each Surfshark location host.
//
// It was built from Surfshark's public server list on 2026-11-03. It only labels
// profiles, so a location missing from it never blocks a refresh.
var surfsharkCities = map[string]string{
	"ad-leu": "Andorra la Vella",
	"ae-dub": "Dubai",
	"al-tia": "Tirana",
	"am-evn": "Yerevan",
	"ar-bua": "Buenos Aires",
	"at-vie": "Vienna",
	"au-adl": "Adelaide",
	"au-bne": "Brisbane",
	"au-mel": "Melbourne",
	"au-per": "Perth",
	"au-syd": "Sydney",
	"az-bak": "Baku",
	"ba-sjj": "Sarajevo",
	"bd-dac": "Dhaka",
	"be-anr": "Antwerp",
	"be-bru": "Brussels",
	"bg-sof": "Sofia",
	"bn-bwn": "Begawan",
	"bo-sre": "Sucre",
	"br-sao": "Sao Paulo",
	"bs-nas": "Bahamas",
	"bt-pbh": "Thimphu",
	"bz-blp": "Belmopan",
	"ca-mon": "Montreal",
	"ca-tor": "Toronto",
	"ca-van": "Vancouver",
	"ch-zur": "Zurich",
	"cl-san": "Santiago",
	"co-bog": "Bogota",
	"cr-sjn": "San Jose",
	"cy-nic": "Nicosia",
	"cz-prg": "Prague",
	"de-ber": "Berlin",
	"de-fra": "Frankfurt am Main",
	"dk-cph": "Copenhagen",
	"dz-alg": "Algiers",
	"ec-uio": "Quito",
	"ee-tll": "Tallinn",
	"eg-cai": "Cairo",
	"es-bcn": "Barcelona",
	"es-mad": "Madrid",
	"es-vlc": "Valencia",
	"fi-hel": "Helsinki",
	"fr-bod": "Bordeaux",
	"fr-mrs": "Marseille",
	"fr-par": "Paris",
	"ge-tbs": "Tbilisi",
	"gh-acc": "Accra",
	"gl-goh": "Nuuk",
	"gr-ath": "Athens",
	"hk-hkg": "Hong Kong",
	"hr-zag": "Zagreb",
	"hu-bud": "Budapest",
	"id-jak": "Jakarta",
	"ie-dub": "Dublin",
	"il-tlv": "Tel Aviv",
	"im-iom": "Douglas",
	"in-del": "Delhi",
	"in-mum": "Mumbai",
	"is-rkv": "Reykjavik",
	"it-mil": "Milan",
	"it-rom": "Rome",
	"jp-tok": "Tokyo",
	"kh-pnh": "Phnom Penh",
	"kr-seo": "Seoul",
	"kz-ura": "Oral",
	"la-vte": "Vientiane",
	"li-qvu": "Vaduz",
	"lk-cmb": "Colombo",
	"lt-vno": "Vilnius",
	"lu-ste": "Luxembourg",
	"lv-rig": "Riga",
	"ma-rab": "Rabat",
	"mc-mcm": "Monte Carlo",
	"md-chi": "Chisinau",
	"me-tgd": "Podgorica",
	"mk-skp": "Skopje",
	"mm-nyt": "Naypyidaw",
	"mn-uln": "Ulaanbaatar",
	"mo-mfm": "Macao",
	"mt-mla": "Valletta",
	"mx-qro": "Queretaro",
	"my-kul": "Kuala Lumpur",
	"ng-lag": "Lagos",
	"nl-ams": "Amsterdam",
	"no-osl": "Oslo",
	"np-ktm": "Kathmandu",
	"nz-akl": "Auckland",
	"pa-pac": "Panama",
	"pe-lim": "Lima",
	"ph-mnl": "Manila",
	"pk-khi": "Karachi",
	"pl-gdn": "Gdansk",
	"pl-waw": "Warsaw",
	"pr-sju": "San Juan",
	"pt-lis": "Lisbon",
	"pt-opo": "Porto",
	"py-asu": "Asunción",
	"ro-buc": "Bucharest",
	"rs-beg": "Belgrade",
	"sa-ruh": "Riyadh",
	"se-sto": "Stockholm",
	"sg-sng": "Singapore",
	"si-lju": "Ljubljana",
	"sk-bts": "Bratislava",
	"th-bkk": "Bangkok",
	"tr-ist": "Istanbul",
	"tw-tai": "Taipei",
	"ua-iev": "Kyiv",
	"uk-edi": "Edinburgh",
	"uk-gla": "Glasgow",
	"uk-lon": "London",
	"uk-man": "Manchester",
	"us-ash": "Ashburn",
	"us-atl": "Atlanta",
	"us-bdn": "Bend",
	"us-bna": "Nashville",
	"us-bos": "Boston",
	"us-buf": "Buffalo",
	"us-chi": "Chicago",
	"us-clt": "Charlotte",
	"us-dal": "Dallas",
	"us-den": "Denver",
	"us-dtw": "Detroit",
	"us-hou": "Houston",
	"us-kan": "Kansas City",
	"us-las": "Las Vegas",
	"us-lax": "Los Angeles",
	"us-ltm": "Latham",
	"us-mia": "Miami",
	"us-nyc": "New York",
	"us-oma": "Omaha",
	"us-phx": "Phoenix",
	"us-sea": "Seattle",
	"us-sfo": "San Francisco",
	"us-sjc": "San Jose",
	"us-slc": "Salt Lake City",
	"uy-mvd": "Montevideo",
	"uz-tas": "Tashkent",
	"ve-car": "Caracas",
	"vn-hcm": "Ho Chi Minh City",
	"za-jnb": "Johannesburg",
}

// surfsharkWireGuardDefaults holds the interface settings every Surfshark location shares.
//
// Surfshark's WireGuard files use the tunnel address 10.14.0.2/16 for every key, and its
// own resolvers for DNS. A user can still enter a different address.
var surfsharkWireGuardDefaults = wireGuardDefaults{
	addresses:  mustWireGuardAddresses("10.14.0.2/16"),
	dnsServers: mustWireGuardDNS("162.252.172.57", "149.154.159.92"),
}

// ParseSurfsharkWireGuardCatalog validates Surfshark's cluster list into WireGuard templates.
//
// Each location's load-balanced host becomes one template on port 51820; clusters
// without a WireGuard public key are skipped.
func ParseSurfsharkWireGuardCatalog(content []byte) ([]Profile, error) {
	var clusters []struct {
		ConnectionName string `json:"connectionName"`
		CountryCode    string `json:"countryCode"`
		Country        string `json:"country"`
		Location       string `json:"location"`
		PublicKey      string `json:"pubKey"`
	}
	if err := decodeWireGuardCatalog("Surfshark", content, &clusters); err != nil {
		return nil, err
	}

	servers := make([]wireGuardServer, 0, len(clusters))
	for _, cluster := range clusters {
		if strings.TrimSpace(cluster.PublicKey) == "" {
			continue
		}
		servers = append(servers, wireGuardServer{
			name:         cluster.ConnectionName,
			countryCode:  cluster.CountryCode,
			countryName:  cluster.Country,
			city:         cluster.Location,
			publicKey:    cluster.PublicKey,
			endpointHost: cluster.ConnectionName,
			endpointPort: wireGuardDefaultPort,
		})
	}

	return buildWireGuardCatalog("surfshark", "Surfshark", servers, surfsharkWireGuardDefaults)
}
