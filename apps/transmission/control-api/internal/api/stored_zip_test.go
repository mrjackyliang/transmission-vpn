package api

import (
	"archive/zip"
	"bytes"
	"crypto/rand"
	"io"
	"strings"
	"testing"
	"time"
)

// storedZipTestEntry is a zip entry read from memory.
func storedZipTestEntry(name string, content []byte, modified time.Time) storedZipEntry {
	return storedZipEntry{
		name:     name,
		size:     int64(len(content)),
		modified: modified,
		open: func() (io.ReadCloser, error) {
			return io.NopCloser(bytes.NewReader(content)), nil
		},
	}
}

// TestStoredZipReadsBack writes a zip that Go's reader opens and checks.
//
// Its length matches the length worked out ahead, every checksum holds, names outside
// ASCII are marked UTF-8, and modified times survive.
func TestStoredZipReadsBack(testingObject *testing.T) {
	random := make([]byte, 3<<20+17)
	if _, err := rand.Read(random); err != nil {
		testingObject.Fatalf("random data: %v", err)
	}
	modified := time.Date(2026, time.November, 11, 9, 30, 0, 0, time.UTC)
	entries := []storedZipEntry{
		storedZipTestEntry("Show.S01/E01.mkv", random, modified),
		storedZipTestEntry("沐浴之王/片段 01.txt", []byte(strings.Repeat("hello\n", 1000)), modified),
		storedZipTestEntry("empty.nfo", nil, modified),
	}

	var output bytes.Buffer
	if err := writeStoredZip(&output, entries); err != nil {
		testingObject.Fatalf("write zip: %v", err)
	}
	if size := storedZipSize(entries); size != int64(output.Len()) {
		testingObject.Fatalf("worked-out size %d, written %d", size, output.Len())
	}

	archive, err := zip.NewReader(bytes.NewReader(output.Bytes()), int64(output.Len()))
	if err != nil {
		testingObject.Fatalf("read zip: %v", err)
	}
	if len(archive.File) != len(entries) {
		testingObject.Fatalf("zip has %d entries, want %d", len(archive.File), len(entries))
	}
	for index, file := range archive.File {
		entry := entries[index]
		if file.Name != entry.name || int64(file.UncompressedSize64) != entry.size || !file.Modified.Equal(modified) {
			testingObject.Fatalf("entry %d = %s %d %s", index, file.Name, file.UncompressedSize64, file.Modified)
		}
		utf8Name := file.Flags&0x800 != 0
		if utf8Name != (file.Name == "沐浴之王/片段 01.txt") {
			testingObject.Fatalf("%s UTF-8 flag = %v", file.Name, utf8Name)
		}
		reader, err := file.Open()
		if err != nil {
			testingObject.Fatalf("open %s: %v", file.Name, err)
		}
		content, err := io.ReadAll(reader)
		_ = reader.Close()
		if err != nil {
			testingObject.Fatalf("read %s, which checks its checksum: %v", file.Name, err)
		}
		source, _ := entry.open()
		expected, _ := io.ReadAll(source)
		if !bytes.Equal(content, expected) {
			testingObject.Fatalf("%s content differs", file.Name)
		}
	}
}

// TestStoredZipSizeCountsZip64Records works out the length of a zip past 4 GiB.
//
// The big entry's header carries a Zip64 field and its sizes follow as 64-bit values,
// the entry after it is found through a Zip64 offset, and Zip64 end records close it.
func TestStoredZipSizeCountsZip64Records(testingObject *testing.T) {
	const bigSize = 5 << 30
	modified := time.Date(2026, time.November, 11, 9, 30, 0, 0, time.UTC)
	entries := []storedZipEntry{
		{name: "big.mkv", size: bigSize, modified: modified},
		{name: "after.txt", size: 10, modified: modified},
	}

	const (
		localHeader     = 30
		timestampField  = 9
		zip64LocalField = 4 + 16
		descriptor      = 16
		descriptor64    = 24
		directoryHeader = 46
		zip64EndRecords = 56 + 20
		endRecord       = 22
	)
	want := int64(localHeader+len("big.mkv")+zip64LocalField+timestampField) + bigSize + descriptor64 +
		int64(localHeader+len("after.txt")+timestampField) + 10 + descriptor +
		int64(directoryHeader+len("big.mkv")+4+16+timestampField) +
		int64(directoryHeader+len("after.txt")+4+8+timestampField) +
		zip64EndRecords + endRecord
	if size := storedZipSize(entries); size != want {
		testingObject.Fatalf("worked-out size %d, want %d", size, want)
	}
}

// TestStoredZipStopsWhenAFileShrinks refuses to send fewer bytes than it promised.
func TestStoredZipStopsWhenAFileShrinks(testingObject *testing.T) {
	entry := storedZipTestEntry("short.txt", []byte("12345"), time.Now())
	entry.size = 10

	if err := writeStoredZip(io.Discard, []storedZipEntry{entry}); err == nil {
		testingObject.Fatal("a file shorter than promised should stop the zip")
	}
}
