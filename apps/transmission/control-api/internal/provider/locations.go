package provider

import (
	"strings"
	"unicode"
)

// locationMetadata is the stable geographic identity of one provider location.
//
// Catalog adapters use this local table instead of making network geolocation calls,
// keeping refreshes deterministic and preventing endpoint addresses from leaking.
type locationMetadata struct {
	Code      string
	Country   string
	Continent string
}

var locationsByCode = map[string]locationMetadata{
	"AD": {Code: "AD", Country: "Andorra", Continent: "Europe"},
	"AE": {Code: "AE", Country: "United Arab Emirates", Continent: "Asia"},
	"AF": {Code: "AF", Country: "Afghanistan", Continent: "Asia"},
	"AG": {Code: "AG", Country: "Antigua and Barbuda", Continent: "North America"},
	"AL": {Code: "AL", Country: "Albania", Continent: "Europe"},
	"AM": {Code: "AM", Country: "Armenia", Continent: "Asia"},
	"AO": {Code: "AO", Country: "Angola", Continent: "Africa"},
	"AR": {Code: "AR", Country: "Argentina", Continent: "South America"},
	"AT": {Code: "AT", Country: "Austria", Continent: "Europe"},
	"AU": {Code: "AU", Country: "Australia", Continent: "Oceania"},
	"AZ": {Code: "AZ", Country: "Azerbaijan", Continent: "Asia"},
	"BA": {Code: "BA", Country: "Bosnia and Herzegovina", Continent: "Europe"},
	"BB": {Code: "BB", Country: "Barbados", Continent: "North America"},
	"BD": {Code: "BD", Country: "Bangladesh", Continent: "Asia"},
	"BE": {Code: "BE", Country: "Belgium", Continent: "Europe"},
	"BF": {Code: "BF", Country: "Burkina Faso", Continent: "Africa"},
	"BG": {Code: "BG", Country: "Bulgaria", Continent: "Europe"},
	"BH": {Code: "BH", Country: "Bahrain", Continent: "Asia"},
	"BJ": {Code: "BJ", Country: "Benin", Continent: "Africa"},
	"BM": {Code: "BM", Country: "Bermuda", Continent: "North America"},
	"BN": {Code: "BN", Country: "Brunei", Continent: "Asia"},
	"BO": {Code: "BO", Country: "Bolivia", Continent: "South America"},
	"BR": {Code: "BR", Country: "Brazil", Continent: "South America"},
	"BS": {Code: "BS", Country: "Bahamas", Continent: "North America"},
	"BT": {Code: "BT", Country: "Bhutan", Continent: "Asia"},
	"BW": {Code: "BW", Country: "Botswana", Continent: "Africa"},
	"BZ": {Code: "BZ", Country: "Belize", Continent: "North America"},
	"CA": {Code: "CA", Country: "Canada", Continent: "North America"},
	"CH": {Code: "CH", Country: "Switzerland", Continent: "Europe"},
	"CL": {Code: "CL", Country: "Chile", Continent: "South America"},
	"CN": {Code: "CN", Country: "China", Continent: "Asia"},
	"CO": {Code: "CO", Country: "Colombia", Continent: "South America"},
	"CR": {Code: "CR", Country: "Costa Rica", Continent: "North America"},
	"CV": {Code: "CV", Country: "Cape Verde", Continent: "Africa"},
	"CY": {Code: "CY", Country: "Cyprus", Continent: "Europe"},
	"CZ": {Code: "CZ", Country: "Czech Republic", Continent: "Europe"},
	"DE": {Code: "DE", Country: "Germany", Continent: "Europe"},
	"DK": {Code: "DK", Country: "Denmark", Continent: "Europe"},
	"DO": {Code: "DO", Country: "Dominican Republic", Continent: "North America"},
	"DZ": {Code: "DZ", Country: "Algeria", Continent: "Africa"},
	"EC": {Code: "EC", Country: "Ecuador", Continent: "South America"},
	"EE": {Code: "EE", Country: "Estonia", Continent: "Europe"},
	"EG": {Code: "EG", Country: "Egypt", Continent: "Africa"},
	"ES": {Code: "ES", Country: "Spain", Continent: "Europe"},
	"ET": {Code: "ET", Country: "Ethiopia", Continent: "Africa"},
	"FI": {Code: "FI", Country: "Finland", Continent: "Europe"},
	"FJ": {Code: "FJ", Country: "Fiji", Continent: "Oceania"},
	"FR": {Code: "FR", Country: "France", Continent: "Europe"},
	"GD": {Code: "GD", Country: "Grenada", Continent: "North America"},
	"GE": {Code: "GE", Country: "Georgia", Continent: "Asia"},
	"GH": {Code: "GH", Country: "Ghana", Continent: "Africa"},
	"GI": {Code: "GI", Country: "Gibraltar", Continent: "Europe"},
	"GL": {Code: "GL", Country: "Greenland", Continent: "North America"},
	"GM": {Code: "GM", Country: "Gambia", Continent: "Africa"},
	"GQ": {Code: "GQ", Country: "Equatorial Guinea", Continent: "Africa"},
	"GR": {Code: "GR", Country: "Greece", Continent: "Europe"},
	"GT": {Code: "GT", Country: "Guatemala", Continent: "North America"},
	"GU": {Code: "GU", Country: "Guam", Continent: "Oceania"},
	"GY": {Code: "GY", Country: "Guyana", Continent: "South America"},
	"HK": {Code: "HK", Country: "Hong Kong", Continent: "Asia"},
	"HN": {Code: "HN", Country: "Honduras", Continent: "North America"},
	"HR": {Code: "HR", Country: "Croatia", Continent: "Europe"},
	"HT": {Code: "HT", Country: "Haiti", Continent: "North America"},
	"HU": {Code: "HU", Country: "Hungary", Continent: "Europe"},
	"ID": {Code: "ID", Country: "Indonesia", Continent: "Asia"},
	"IE": {Code: "IE", Country: "Ireland", Continent: "Europe"},
	"IL": {Code: "IL", Country: "Israel", Continent: "Asia"},
	"IM": {Code: "IM", Country: "Isle of Man", Continent: "Europe"},
	"IN": {Code: "IN", Country: "India", Continent: "Asia"},
	"IQ": {Code: "IQ", Country: "Iraq", Continent: "Asia"},
	"IS": {Code: "IS", Country: "Iceland", Continent: "Europe"},
	"IT": {Code: "IT", Country: "Italy", Continent: "Europe"},
	"JE": {Code: "JE", Country: "Jersey", Continent: "Europe"},
	"JM": {Code: "JM", Country: "Jamaica", Continent: "North America"},
	"JO": {Code: "JO", Country: "Jordan", Continent: "Asia"},
	"JP": {Code: "JP", Country: "Japan", Continent: "Asia"},
	"KE": {Code: "KE", Country: "Kenya", Continent: "Africa"},
	"KG": {Code: "KG", Country: "Kyrgyzstan", Continent: "Asia"},
	"KH": {Code: "KH", Country: "Cambodia", Continent: "Asia"},
	"KM": {Code: "KM", Country: "Comoros", Continent: "Africa"},
	"KR": {Code: "KR", Country: "South Korea", Continent: "Asia"},
	"KW": {Code: "KW", Country: "Kuwait", Continent: "Asia"},
	"KY": {Code: "KY", Country: "Cayman Islands", Continent: "North America"},
	"KZ": {Code: "KZ", Country: "Kazakhstan", Continent: "Asia"},
	"LA": {Code: "LA", Country: "Laos", Continent: "Asia"},
	"LB": {Code: "LB", Country: "Lebanon", Continent: "Asia"},
	"LC": {Code: "LC", Country: "Saint Lucia", Continent: "North America"},
	"LI": {Code: "LI", Country: "Liechtenstein", Continent: "Europe"},
	"LK": {Code: "LK", Country: "Sri Lanka", Continent: "Asia"},
	"LR": {Code: "LR", Country: "Liberia", Continent: "Africa"},
	"LS": {Code: "LS", Country: "Lesotho", Continent: "Africa"},
	"LT": {Code: "LT", Country: "Lithuania", Continent: "Europe"},
	"LU": {Code: "LU", Country: "Luxembourg", Continent: "Europe"},
	"LV": {Code: "LV", Country: "Latvia", Continent: "Europe"},
	"LY": {Code: "LY", Country: "Libya", Continent: "Africa"},
	"MA": {Code: "MA", Country: "Morocco", Continent: "Africa"},
	"MC": {Code: "MC", Country: "Monaco", Continent: "Europe"},
	"MD": {Code: "MD", Country: "Moldova", Continent: "Europe"},
	"ME": {Code: "ME", Country: "Montenegro", Continent: "Europe"},
	"MG": {Code: "MG", Country: "Madagascar", Continent: "Africa"},
	"MK": {Code: "MK", Country: "North Macedonia", Continent: "Europe"},
	"MM": {Code: "MM", Country: "Myanmar", Continent: "Asia"},
	"MN": {Code: "MN", Country: "Mongolia", Continent: "Asia"},
	"MO": {Code: "MO", Country: "Macao", Continent: "Asia"},
	"MR": {Code: "MR", Country: "Mauritania", Continent: "Africa"},
	"MT": {Code: "MT", Country: "Malta", Continent: "Europe"},
	"MU": {Code: "MU", Country: "Mauritius", Continent: "Africa"},
	"MV": {Code: "MV", Country: "Maldives", Continent: "Asia"},
	"MW": {Code: "MW", Country: "Malawi", Continent: "Africa"},
	"MX": {Code: "MX", Country: "Mexico", Continent: "North America"},
	"MY": {Code: "MY", Country: "Malaysia", Continent: "Asia"},
	"MZ": {Code: "MZ", Country: "Mozambique", Continent: "Africa"},
	"NG": {Code: "NG", Country: "Nigeria", Continent: "Africa"},
	"NI": {Code: "NI", Country: "Nicaragua", Continent: "North America"},
	"NL": {Code: "NL", Country: "Netherlands", Continent: "Europe"},
	"NO": {Code: "NO", Country: "Norway", Continent: "Europe"},
	"NP": {Code: "NP", Country: "Nepal", Continent: "Asia"},
	"NZ": {Code: "NZ", Country: "New Zealand", Continent: "Oceania"},
	"OM": {Code: "OM", Country: "Oman", Continent: "Asia"},
	"PA": {Code: "PA", Country: "Panama", Continent: "North America"},
	"PE": {Code: "PE", Country: "Peru", Continent: "South America"},
	"PG": {Code: "PG", Country: "Papua New Guinea", Continent: "Oceania"},
	"PH": {Code: "PH", Country: "Philippines", Continent: "Asia"},
	"PK": {Code: "PK", Country: "Pakistan", Continent: "Asia"},
	"PL": {Code: "PL", Country: "Poland", Continent: "Europe"},
	"PR": {Code: "PR", Country: "Puerto Rico", Continent: "North America"},
	"PT": {Code: "PT", Country: "Portugal", Continent: "Europe"},
	"PY": {Code: "PY", Country: "Paraguay", Continent: "South America"},
	"QA": {Code: "QA", Country: "Qatar", Continent: "Asia"},
	"RO": {Code: "RO", Country: "Romania", Continent: "Europe"},
	"RU": {Code: "RU", Country: "Russia", Continent: "Europe"},
	"RS": {Code: "RS", Country: "Serbia", Continent: "Europe"},
	"SA": {Code: "SA", Country: "Saudi Arabia", Continent: "Asia"},
	"SC": {Code: "SC", Country: "Seychelles", Continent: "Africa"},
	"SE": {Code: "SE", Country: "Sweden", Continent: "Europe"},
	"SG": {Code: "SG", Country: "Singapore", Continent: "Asia"},
	"SI": {Code: "SI", Country: "Slovenia", Continent: "Europe"},
	"SK": {Code: "SK", Country: "Slovakia", Continent: "Europe"},
	"SL": {Code: "SL", Country: "Sierra Leone", Continent: "Africa"},
	"SM": {Code: "SM", Country: "San Marino", Continent: "Europe"},
	"SN": {Code: "SN", Country: "Senegal", Continent: "Africa"},
	"SO": {Code: "SO", Country: "Somalia", Continent: "Africa"},
	"SR": {Code: "SR", Country: "Suriname", Continent: "South America"},
	"SV": {Code: "SV", Country: "El Salvador", Continent: "North America"},
	"TD": {Code: "TD", Country: "Chad", Continent: "Africa"},
	"TH": {Code: "TH", Country: "Thailand", Continent: "Asia"},
	"TJ": {Code: "TJ", Country: "Tajikistan", Continent: "Asia"},
	"TN": {Code: "TN", Country: "Tunisia", Continent: "Africa"},
	"TR": {Code: "TR", Country: "Turkey", Continent: "Asia"},
	"TT": {Code: "TT", Country: "Trinidad and Tobago", Continent: "North America"},
	"TW": {Code: "TW", Country: "Taiwan", Continent: "Asia"},
	"TZ": {Code: "TZ", Country: "Tanzania", Continent: "Africa"},
	"UA": {Code: "UA", Country: "Ukraine", Continent: "Europe"},
	"UK": {Code: "UK", Country: "United Kingdom", Continent: "Europe"},
	"US": {Code: "US", Country: "United States", Continent: "North America"},
	"UY": {Code: "UY", Country: "Uruguay", Continent: "South America"},
	"UZ": {Code: "UZ", Country: "Uzbekistan", Continent: "Asia"},
	"VE": {Code: "VE", Country: "Venezuela", Continent: "South America"},
	"VG": {Code: "VG", Country: "British Virgin Islands", Continent: "North America"},
	"VN": {Code: "VN", Country: "Vietnam", Continent: "Asia"},
	"WS": {Code: "WS", Country: "Samoa", Continent: "Oceania"},
	"YE": {Code: "YE", Country: "Yemen", Continent: "Asia"},
	"ZA": {Code: "ZA", Country: "South Africa", Continent: "Africa"},
	"ZM": {Code: "ZM", Country: "Zambia", Continent: "Africa"},
}

// locationAliases maps a second code for the same country onto its table entry.
//
// The table keeps one row per country so looking a country up by name stays
// deterministic; an alias reuses that row under the provider's own code.
var locationAliases = map[string]string{
	"GB": "UK",
}

// locationByCode resolves provider country identifiers into display metadata.
//
// UK remains accepted because several provider catalogs use it instead of ISO GB, and
// GB resolves through an alias for the WireGuard server lists; the stored code
// intentionally preserves the provider-facing identifier.
func locationByCode(code string) (locationMetadata, bool) {
	normalizedCode := strings.ToUpper(strings.TrimSpace(code))
	if canonicalCode, aliased := locationAliases[normalizedCode]; aliased {
		location, found := locationsByCode[canonicalCode]
		location.Code = normalizedCode

		return location, found
	}

	location, found := locationsByCode[normalizedCode]

	return location, found
}

// locationByCountrySlug resolves a filename-safe country name without a second map.
//
// Normalizing both sides covers underscore and punctuation differences while keeping
// the canonical country spelling in one audited table.
func locationByCountrySlug(slug string) (locationMetadata, bool) {
	normalizedSlug := normalizeLocationText(slug)
	for _, location := range locationsByCode {
		if normalizeLocationText(location.Country) == normalizedSlug {
			return location, true
		}
	}

	return locationMetadata{}, false
}

// normalizeLocationText removes filename separators for tolerant metadata matching.
//
// Catalog names remain provider-controlled display inputs, while matching uses only
// letters and digits to avoid punctuation-specific adapter branches.
func normalizeLocationText(value string) string {
	var normalized strings.Builder
	for _, character := range strings.ToLower(value) {
		if unicode.IsLetter(character) || unicode.IsDigit(character) {
			normalized.WriteRune(character)
		}
	}

	return normalized.String()
}

// titleLocationPart turns a catalog slug into restrained human-readable text.
//
// It is used only after adapters have separated country, city, and server identity,
// preventing arbitrary filenames from becoming geographic metadata.
func titleLocationPart(value string) string {
	parts := strings.FieldsFunc(value, func(character rune) bool {
		return character == '-' || character == '_'
	})
	for index, part := range parts {
		switch strings.ToLower(part) {
		case "dc":
			parts[index] = "DC"
		case "uk", "us":
			parts[index] = strings.ToUpper(part)
		default:
			if part != "" {
				parts[index] = strings.ToUpper(part[:1]) + strings.ToLower(part[1:])
			}
		}
	}

	return strings.Join(parts, " ")
}

// applyLocation copies canonical geographic fields onto one normalized profile.
//
// Display names use a consistent country-city hierarchy while retaining an optional
// server suffix for providers that expose multiple hosts in the same location.
func applyLocation(profile *Profile, location locationMetadata, city string, suffix string) {
	profile.CountryCode = location.Code
	profile.Country = location.Country
	profile.City = city
	profile.Continent = location.Continent
	profile.DisplayName = location.Country
	if city != "" {
		profile.DisplayName += " — " + city
	}
	if suffix != "" {
		profile.DisplayName += " · " + suffix
	}
}
