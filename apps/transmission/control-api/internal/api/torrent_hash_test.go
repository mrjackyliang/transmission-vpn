package api

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"testing"
	"time"
)

// TestTorrentMetainfoHashAcceptsTransmissionBencodeCompatibility covers parser parity.
func TestTorrentMetainfoHashAcceptsTransmissionBencodeCompatibility(testingObject *testing.T) {
	tests := []struct {
		name     string
		metainfo []byte
		info     []byte
	}{
		{
			name:     "trailing newline",
			metainfo: []byte("d4:infod4:name4:test6:lengthi1eee\n"),
			info:     []byte("d4:name4:test6:lengthi1ee"),
		},
		{
			name:     "leading zero string lengths",
			metainfo: []byte("d04:infod04:name04:test6:lengthi1eee"),
			info:     []byte("d04:name04:test6:lengthi1ee"),
		},
	}

	for _, test := range tests {
		testingObject.Run(test.name, func(testingObject *testing.T) {
			digest := sha1.Sum(test.info)
			want := hex.EncodeToString(digest[:])
			got, err := torrentMetainfoHash(test.metainfo)
			if err != nil || got != want {
				testingObject.Fatalf("torrentMetainfoHash() = %q, %v, want %q", got, err, want)
			}
		})
	}
}

// TestTorrentMetainfoHashLargeFileListStaysLinear guards against quadratic scans.
func TestTorrentMetainfoHashLargeFileListStaysLinear(testingObject *testing.T) {
	var metainfo bytes.Buffer
	metainfo.Grow(500_000)
	metainfo.WriteString("d4:infod5:filesl")
	for range 15_000 {
		metainfo.WriteString("d6:lengthi1e4:pathl1:aee")
	}
	metainfo.WriteString("e4:name4:testee")

	startedAt := time.Now()
	if _, err := torrentMetainfoHash(metainfo.Bytes()); err != nil {
		testingObject.Fatalf("hash large metainfo: %v", err)
	}
	if duration := time.Since(startedAt); duration >= 100*time.Millisecond {
		testingObject.Fatalf("hashing 15,000 files took %s, want under 100ms", duration)
	}
}
