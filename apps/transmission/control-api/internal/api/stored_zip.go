package api

import (
	"encoding/binary"
	"errors"
	"fmt"
	"hash/crc32"
	"io"
	"time"
	"unicode/utf8"
)

const (
	// storedZipMaximum32 is the largest size or offset a zip's 32-bit fields hold. A
	// value this big or bigger moves to the Zip64 fields.
	storedZipMaximum32 = 1<<32 - 1

	// storedZipCopyBufferBytes is how much of a file is read from disk at a time.
	storedZipCopyBufferBytes = 1 << 20

	// storedZipVersionMadeBy reads Unix, zip format 4.5.
	storedZipVersionMadeBy = 3<<8 | 45
)

// storedZipEntry is one file in a stored zip.
//
// Since: 2.2.0
type storedZipEntry struct {
	name     string
	size     int64
	modified time.Time
	open     func() (io.ReadCloser, error)
}

// storedZipWritten is where an entry landed and its checksum, for the central directory.
//
// Since: 2.2.0
type storedZipWritten struct {
	entry  storedZipEntry
	offset int64
	crc    uint32
}

// storedZipBuffer appends little-endian zip fields.
//
// Since: 2.2.0
type storedZipBuffer struct {
	bytes []byte
}

// storedZipLayout writes the zip's records and counts every byte, data included.
//
// Since: 2.2.0
type storedZipLayout struct {
	writer io.Writer
	offset int64
}

// storedZipSize is the exact length writeStoredZip writes for these entries, worked out
// without reading any file, so a download can say its size before it starts.
//
// Since: 2.2.0
func storedZipSize(entries []storedZipEntry) int64 {
	layout := &storedZipLayout{writer: io.Discard}
	_ = layout.write(entries, false)

	return layout.offset
}

// writeStoredZip writes the entries as one zip without compression.
//
// Downloads are mostly video and archives that don't compress, and storing them lets
// the length be known ahead and each file be read once. Every entry's checksum and
// sizes follow its data, and an entry of 4 GiB or more is marked Zip64 in its own
// header too, which macOS's Archive Utility needs to find the entry after it.
//
// Since: 2.2.0
func writeStoredZip(writer io.Writer, entries []storedZipEntry) error {
	layout := &storedZipLayout{writer: writer}

	return layout.write(entries, true)
}

// put16 appends a 16-bit field.
func (buffer *storedZipBuffer) put16(value uint16) {
	buffer.bytes = binary.LittleEndian.AppendUint16(buffer.bytes, value)
}

// put32 appends a 32-bit field.
func (buffer *storedZipBuffer) put32(value uint32) {
	buffer.bytes = binary.LittleEndian.AppendUint32(buffer.bytes, value)
}

// put64 appends a 64-bit field.
func (buffer *storedZipBuffer) put64(value uint64) {
	buffer.bytes = binary.LittleEndian.AppendUint64(buffer.bytes, value)
}

// putTimestamp appends the extended timestamp field Info-ZIP and macOS read, which
// keeps the modified time exact and in UTC.
func (buffer *storedZipBuffer) putTimestamp(modified time.Time) {
	buffer.put16(0x5455)
	buffer.put16(5)
	buffer.bytes = append(buffer.bytes, 1)
	buffer.put32(uint32(modified.Unix()))
}

// emit writes bytes and moves the offset past them.
func (layout *storedZipLayout) emit(bytes []byte) error {
	written, err := layout.writer.Write(bytes)
	layout.offset += int64(written)

	return err
}

// write lays out every entry, then the central directory and its end records. Without
// data, each entry's data is only counted and its checksum is left at zero.
func (layout *storedZipLayout) write(entries []storedZipEntry, withData bool) error {
	written := make([]storedZipWritten, 0, len(entries))
	buffer := []byte(nil)
	if withData {
		buffer = make([]byte, storedZipCopyBufferBytes)
	}

	for _, entry := range entries {
		if len(entry.name) == 0 || len(entry.name) > 0xffff || entry.size < 0 {
			return fmt.Errorf("zip entry %q can't be stored", entry.name)
		}
		record := storedZipWritten{entry: entry, offset: layout.offset}
		zip64 := entry.size >= storedZipMaximum32
		date, clock := storedZipDOSTime(entry.modified)

		extra := &storedZipBuffer{}
		if zip64 {
			// The real sizes follow the data; this field only says they're 64-bit.
			extra.put16(0x0001)
			extra.put16(16)
			extra.put64(0)
			extra.put64(0)
		}
		extra.putTimestamp(entry.modified)

		header := &storedZipBuffer{}
		header.put32(0x04034b50)
		header.put16(storedZipVersionNeeded(zip64))
		header.put16(storedZipFlags(entry.name))
		header.put16(0)
		header.put16(clock)
		header.put16(date)
		header.put32(0)
		if zip64 {
			header.put32(storedZipMaximum32)
			header.put32(storedZipMaximum32)
		} else {
			header.put32(0)
			header.put32(0)
		}
		header.put16(uint16(len(entry.name)))
		header.put16(uint16(len(extra.bytes)))
		header.bytes = append(header.bytes, entry.name...)
		header.bytes = append(header.bytes, extra.bytes...)
		if err := layout.emit(header.bytes); err != nil {
			return err
		}

		if withData {
			checksum, err := layout.copyEntry(entry, buffer)
			if err != nil {
				return err
			}
			record.crc = checksum
		} else {
			layout.offset += entry.size
		}

		descriptor := &storedZipBuffer{}
		descriptor.put32(0x08074b50)
		descriptor.put32(record.crc)
		if zip64 {
			descriptor.put64(uint64(entry.size))
			descriptor.put64(uint64(entry.size))
		} else {
			descriptor.put32(uint32(entry.size))
			descriptor.put32(uint32(entry.size))
		}
		if err := layout.emit(descriptor.bytes); err != nil {
			return err
		}
		written = append(written, record)
	}

	directoryStart := layout.offset
	for _, record := range written {
		if err := layout.emit(storedZipDirectoryRecord(record)); err != nil {
			return err
		}
	}

	return layout.emit(storedZipEnd(len(written), directoryStart, layout.offset-directoryStart))
}

// copyEntry streams one file's bytes and returns their checksum.
//
// Exactly the promised size is read, since the zip's length was sent before its data.
// A file that got shorter stops the download instead.
func (layout *storedZipLayout) copyEntry(entry storedZipEntry, buffer []byte) (uint32, error) {
	if entry.open == nil {
		return 0, errors.New("zip entry has nothing to read from")
	}
	source, err := entry.open()
	if err != nil {
		return 0, err
	}
	defer source.Close()

	checksum := crc32.NewIEEE()
	copied, err := io.CopyBuffer(
		storedZipWriter{layout: layout, checksum: checksum},
		io.LimitReader(source, entry.size),
		buffer,
	)
	if err != nil {
		return 0, err
	}
	if copied != entry.size {
		return 0, fmt.Errorf("%s is %d bytes now, not %d", entry.name, copied, entry.size)
	}

	return checksum.Sum32(), nil
}

// storedZipWriter adds what it passes on to the layout's offset and the checksum.
//
// Since: 2.2.0
type storedZipWriter struct {
	layout   *storedZipLayout
	checksum io.Writer
}

// Write passes bytes to the zip and the checksum.
func (writer storedZipWriter) Write(bytes []byte) (int, error) {
	_, _ = writer.checksum.Write(bytes)
	if err := writer.layout.emit(bytes); err != nil {
		return 0, err
	}

	return len(bytes), nil
}

// storedZipDirectoryRecord is an entry's central directory record, which holds its real
// sizes and checksum and is where readers look first.
func storedZipDirectoryRecord(record storedZipWritten) []byte {
	entry := record.entry
	sizesZip64 := entry.size >= storedZipMaximum32
	offsetZip64 := record.offset >= storedZipMaximum32
	date, clock := storedZipDOSTime(entry.modified)

	extra := &storedZipBuffer{}
	if sizesZip64 || offsetZip64 {
		length := uint16(0)
		if sizesZip64 {
			length += 16
		}
		if offsetZip64 {
			length += 8
		}
		extra.put16(0x0001)
		extra.put16(length)
		if sizesZip64 {
			extra.put64(uint64(entry.size))
			extra.put64(uint64(entry.size))
		}
		if offsetZip64 {
			extra.put64(uint64(record.offset))
		}
	}
	extra.putTimestamp(entry.modified)

	directory := &storedZipBuffer{}
	directory.put32(0x02014b50)
	directory.put16(storedZipVersionMadeBy)
	directory.put16(storedZipVersionNeeded(sizesZip64 || offsetZip64))
	directory.put16(storedZipFlags(entry.name))
	directory.put16(0)
	directory.put16(clock)
	directory.put16(date)
	directory.put32(record.crc)
	if sizesZip64 {
		directory.put32(storedZipMaximum32)
		directory.put32(storedZipMaximum32)
	} else {
		directory.put32(uint32(entry.size))
		directory.put32(uint32(entry.size))
	}
	directory.put16(uint16(len(entry.name)))
	directory.put16(uint16(len(extra.bytes)))
	directory.put16(0)
	directory.put16(0)
	directory.put16(0)
	directory.put32(0o100644 << 16)
	if offsetZip64 {
		directory.put32(storedZipMaximum32)
	} else {
		directory.put32(uint32(record.offset))
	}
	directory.bytes = append(directory.bytes, entry.name...)
	directory.bytes = append(directory.bytes, extra.bytes...)

	return directory.bytes
}

// storedZipEnd closes the zip. Zip64 end records come first when the entry count, the
// directory's size, or where it starts no longer fit the classic record.
func storedZipEnd(count int, directoryStart int64, directorySize int64) []byte {
	end := &storedZipBuffer{}
	if count >= 0xffff || directoryStart >= storedZipMaximum32 || directorySize >= storedZipMaximum32 {
		zip64End := directoryStart + directorySize
		end.put32(0x06064b50)
		end.put64(44)
		end.put16(storedZipVersionMadeBy)
		end.put16(45)
		end.put32(0)
		end.put32(0)
		end.put64(uint64(count))
		end.put64(uint64(count))
		end.put64(uint64(directorySize))
		end.put64(uint64(directoryStart))
		end.put32(0x07064b50)
		end.put32(0)
		end.put64(uint64(zip64End))
		end.put32(1)
	}
	end.put32(0x06054b50)
	end.put16(0)
	end.put16(0)
	end.put16(uint16(min(count, 0xffff)))
	end.put16(uint16(min(count, 0xffff)))
	end.put32(uint32(min(directorySize, storedZipMaximum32)))
	end.put32(uint32(min(directoryStart, storedZipMaximum32)))
	end.put16(0)

	return end.bytes
}

// storedZipVersionNeeded is 4.5 for Zip64 records and 2.0 otherwise.
func storedZipVersionNeeded(zip64 bool) uint16 {
	if zip64 {
		return 45
	}

	return 20
}

// storedZipFlags says the sizes follow the data, and that a name outside ASCII is UTF-8.
func storedZipFlags(name string) uint16 {
	flags := uint16(0x8)
	for index := range len(name) {
		if name[index] >= 0x80 {
			if utf8.ValidString(name) {
				flags |= 0x800
			}

			break
		}
	}

	return flags
}

// storedZipDOSTime is the MS-DOS date and time older tools read, in the time's own zone.
func storedZipDOSTime(modified time.Time) (uint16, uint16) {
	year := min(max(modified.Year(), 1980), 2107)
	date := uint16(modified.Day() + int(modified.Month())<<5 + (year-1980)<<9)
	clock := uint16(modified.Second()/2 + modified.Minute()<<5 + modified.Hour()<<11)

	return date, clock
}
