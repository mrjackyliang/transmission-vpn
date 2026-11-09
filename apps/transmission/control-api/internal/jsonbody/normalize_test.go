package jsonbody

import (
	"encoding/json"
	"testing"
)

// TestNormalizeReplacesNestedNilSlices protects every supported JSON container.
func TestNormalizeReplacesNestedNilSlices(testingObject *testing.T) {
	type nested struct {
		Names []string `json:"names"`
	}
	type response struct {
		Nested   nested         `json:"nested"`
		Values   map[string]any `json:"values"`
		Optional *[]int         `json:"optional"`
	}

	encoded, err := json.Marshal(Normalize(response{
		Values: map[string]any{
			"items": []map[string]any(nil),
		},
	}))
	if err != nil {
		testingObject.Fatalf("encode normalized value: %v", err)
	}
	const expected = `{"nested":{"names":[]},"values":{"items":[]},"optional":[]}`
	if string(encoded) != expected {
		testingObject.Fatalf("normalized JSON = %s, want %s", encoded, expected)
	}
}
