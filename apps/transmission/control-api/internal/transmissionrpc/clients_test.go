package transmissionrpc

import "testing"

// TestFacadeIDRoundTrip verifies slot-zero compatibility and high-slot routing.
func TestFacadeIDRoundTrip(testingObject *testing.T) {
	tests := []struct {
		name     string
		slot     int
		daemonID int64
		want     int64
	}{
		{name: "default connection", slot: 0, daemonID: 37, want: 37},
		{name: "second connection", slot: 1, daemonID: 37, want: 1<<24 | 37},
		{name: "last connection", slot: 63, daemonID: (1 << 24) - 1, want: 63<<24 | (1<<24 - 1)},
	}

	for _, test := range tests {
		testingObject.Run(test.name, func(testingObject *testing.T) {
			facadeID, err := FacadeID(test.slot, test.daemonID)
			if err != nil {
				testingObject.Fatalf("FacadeID() error = %v", err)
			}
			if facadeID != test.want {
				testingObject.Fatalf("FacadeID() = %d, want %d", facadeID, test.want)
			}

			slot, daemonID, err := SplitFacadeID(facadeID)
			if err != nil {
				testingObject.Fatalf("SplitFacadeID() error = %v", err)
			}
			if slot != test.slot || daemonID != test.daemonID {
				testingObject.Fatalf("SplitFacadeID() = (%d, %d), want (%d, %d)", slot, daemonID, test.slot, test.daemonID)
			}
		})
	}
}

// TestFacadeIDRejectsOverflow prevents one daemon from occupying another slot's IDs.
func TestFacadeIDRejectsOverflow(testingObject *testing.T) {
	if _, err := FacadeID(0, 1<<24); err == nil {
		testingObject.Fatal("FacadeID() accepted a daemon ID at the 24-bit boundary")
	}
	if _, _, err := SplitFacadeID(1 << 30); err == nil {
		testingObject.Fatal("SplitFacadeID() accepted a slot above 63")
	}
}
