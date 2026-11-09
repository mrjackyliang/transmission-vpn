package notifications

import (
	"testing"
)

// TestEncodeJSONNormalizesNestedLists keeps webhook and service bodies null-free.
func TestEncodeJSONNormalizesNestedLists(testingObject *testing.T) {
	encoded, err := encodeJSON(map[string]any{
		"details": map[string]any{"items": []string(nil)},
		"tags":    []string(nil),
	})
	if err != nil {
		testingObject.Fatalf("encode notification: %v", err)
	}
	const expected = `{"details":{"items":[]},"tags":[]}`
	if string(encoded) != expected {
		testingObject.Fatalf("encoded notification = %s, want %s", encoded, expected)
	}
}
