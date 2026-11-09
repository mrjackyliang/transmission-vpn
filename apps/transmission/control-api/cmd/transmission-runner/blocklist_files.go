package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/unix"
)

const (
	// blocklistMaximumLineBytes bounds one source line during streaming parsing.
	//
	// Oversized lines are discarded without retaining their full contents, which keeps
	// malformed input from becoming a second unbounded allocation path.
	//
	// Since: UNRELEASED
	blocklistMaximumLineBytes = 1 << 20

	// blocklistZipEndRecordBytes is the largest bounded end-record search.
	//
	// A zip comment is at most 65,535 bytes, so this window always contains the
	// standard end record without reading the archive's central directory.
	//
	// Since: UNRELEASED
	blocklistZipEndRecordBytes = 22 + 65_535
)

var (
	// errBlocklistZipUnsupported identifies ambiguous or commented zip endings.
	//
	// One unambiguous end record makes the preflight parser and archive/zip select
	// the same directory before the standard library allocates entries.
	//
	// Since: UNRELEASED
	errBlocklistZipUnsupported = errors.New("This zip file isn't supported.")
)

// blocklistZipDirectory describes the bounded metadata needed before archive parsing.
//
// Reading these values from the fixed-size end records lets the runner reject large
// entry tables before archive/zip materializes them in memory.
//
// Since: UNRELEASED
type blocklistZipDirectory struct {
	Entries int
	Offset  int64
	Size    int64
}

// createUnlinkedBlocklistFile creates one disk-backed temporary source file.
//
// The directory entry is removed immediately while the open descriptor retains the
// contents, preventing stale downloads from surviving a runner crash.
//
// Since: UNRELEASED
func createUnlinkedBlocklistFile(directory string, pattern string) (*os.File, error) {
	temporaryFile, err := os.CreateTemp(directory, pattern)
	if err != nil {
		return nil, err
	}
	if err := temporaryFile.Chmod(0o640); err != nil {
		_ = temporaryFile.Close()
		_ = os.Remove(temporaryFile.Name())

		return nil, err
	}
	if err := os.Remove(temporaryFile.Name()); err != nil {
		_ = temporaryFile.Close()

		return nil, err
	}

	return temporaryFile, nil
}

// normalizeBlocklistReader streams accepted ranges into one normalized destination.
//
// Independent input, output, and range limits keep decompression and canonicalization
// bounded without retaining the complete source or result in memory.
//
// Since: UNRELEASED
func normalizeBlocklistReader(
	ctx context.Context,
	reader io.Reader,
	writer io.Writer,
	maximumInputBytes int64,
	maximumOutputBytes int64,
	maximumRanges int,
) (int, int64, error) {
	limitedReader := &io.LimitedReader{R: reader, N: maximumInputBytes + 1}
	bufferedReader := bufio.NewReaderSize(limitedReader, 64*1024)
	bufferedWriter := bufio.NewWriterSize(writer, 64*1024)
	line := make([]byte, 0, 4096)
	lineTooLarge := false
	rangeCount := 0
	writtenBytes := int64(0)

	for {
		if err := ctx.Err(); err != nil {
			return 0, 0, err
		}

		fragment, prefix, readError := bufferedReader.ReadLine()
		if !lineTooLarge {
			if len(line)+len(fragment) > blocklistMaximumLineBytes {
				line = line[:0]
				lineTooLarge = true
			} else {
				line = append(line, fragment...)
			}
		}
		if !prefix {
			if !lineTooLarge {
				start, end, valid := parseBlocklistLine(strings.TrimSpace(string(line)))
				if valid {
					if rangeCount >= maximumRanges {
						return 0, 0, errBlocklistTooLarge
					}
					normalizedLine := "tvpn:" + start.String() + "-" + end.String() + "\n"
					if writtenBytes+int64(len(normalizedLine)) > maximumOutputBytes {
						return 0, 0, errBlocklistTooLarge
					}
					if _, err := bufferedWriter.WriteString(normalizedLine); err != nil {
						return 0, 0, err
					}
					writtenBytes += int64(len(normalizedLine))
					rangeCount++
				}
			}
			line = line[:0]
			lineTooLarge = false
		}

		if errors.Is(readError, io.EOF) {
			break
		}
		if readError != nil {
			return 0, 0, readError
		}
	}
	if limitedReader.N == 0 {
		return 0, 0, errBlocklistUnpackedTooLarge
	}
	if rangeCount == 0 {
		return 0, 0, errors.New("No address ranges found in this list.")
	}
	if err := bufferedWriter.Flush(); err != nil {
		return 0, 0, err
	}

	return rangeCount, writtenBytes, nil
}

// inspectBlocklistZipDirectory validates entry and directory limits from end records.
//
// Only the fixed comment window and, when present, one fixed zip64 record are read;
// archive/zip runs only after both the entry count and directory bytes are bounded.
//
// Since: UNRELEASED
func inspectBlocklistZipDirectory(
	reader io.ReaderAt,
	archiveSize int64,
	maximumEntries int,
	maximumDirectoryBytes int64,
) (blocklistZipDirectory, error) {
	if archiveSize < 22 {
		return blocklistZipDirectory{}, errBlocklistZipUnsupported
	}
	tailSize := int64(blocklistZipEndRecordBytes)
	if archiveSize < tailSize {
		tailSize = archiveSize
	}
	tail := make([]byte, int(tailSize))
	if _, err := reader.ReadAt(tail, archiveSize-tailSize); err != nil {
		return blocklistZipDirectory{}, fmt.Errorf("read zip end record: %w", err)
	}

	endSignature := []byte{'P', 'K', 0x05, 0x06}
	if bytes.Count(tail, endSignature) != 1 {
		return blocklistZipDirectory{}, errBlocklistZipUnsupported
	}
	endOffset := bytes.Index(tail, endSignature)
	if endOffset != len(tail)-22 ||
		binary.LittleEndian.Uint16(tail[endOffset+20:endOffset+22]) != 0 {
		return blocklistZipDirectory{}, errBlocklistZipUnsupported
	}
	endRecord := tail[endOffset:]
	if binary.LittleEndian.Uint16(endRecord[4:6]) != 0 ||
		binary.LittleEndian.Uint16(endRecord[6:8]) != 0 {
		return blocklistZipDirectory{}, errors.New("Multi-disk zip lists are not supported.")
	}

	entries := uint64(binary.LittleEndian.Uint16(endRecord[10:12]))
	directorySize := uint64(binary.LittleEndian.Uint32(endRecord[12:16]))
	directoryOffset := uint64(binary.LittleEndian.Uint32(endRecord[16:20]))
	directoryEndOffset := archiveSize - tailSize + int64(endOffset)
	if entries == 0xffff || directorySize == 0xffffffff || directoryOffset == 0xffffffff {
		globalEndOffset := directoryEndOffset
		if globalEndOffset < 20 {
			return blocklistZipDirectory{}, errors.New("The zip64 list is invalid.")
		}
		locator := make([]byte, 20)
		if _, err := reader.ReadAt(locator, globalEndOffset-20); err != nil {
			return blocklistZipDirectory{}, fmt.Errorf("read zip64 locator: %w", err)
		}
		if binary.LittleEndian.Uint32(locator[:4]) != 0x07064b50 ||
			binary.LittleEndian.Uint32(locator[4:8]) != 0 ||
			binary.LittleEndian.Uint32(locator[16:20]) != 1 {
			return blocklistZipDirectory{}, errors.New("The zip64 list is invalid.")
		}
		zip64Offset := binary.LittleEndian.Uint64(locator[8:16])
		if zip64Offset > uint64(archiveSize-56) {
			return blocklistZipDirectory{}, errors.New("The zip64 list is invalid.")
		}
		zip64Record := make([]byte, 56)
		if _, err := reader.ReadAt(zip64Record, int64(zip64Offset)); err != nil {
			return blocklistZipDirectory{}, fmt.Errorf("read zip64 end record: %w", err)
		}
		if binary.LittleEndian.Uint32(zip64Record[:4]) != 0x06064b50 ||
			binary.LittleEndian.Uint64(zip64Record[4:12]) < 44 ||
			binary.LittleEndian.Uint32(zip64Record[16:20]) != 0 ||
			binary.LittleEndian.Uint32(zip64Record[20:24]) != 0 {
			return blocklistZipDirectory{}, errors.New("The zip64 list is invalid.")
		}
		entries = binary.LittleEndian.Uint64(zip64Record[32:40])
		directorySize = binary.LittleEndian.Uint64(zip64Record[40:48])
		directoryOffset = binary.LittleEndian.Uint64(zip64Record[48:56])
		directoryEndOffset = int64(zip64Offset)
	}

	if entries > uint64(maximumEntries) || directorySize > uint64(maximumDirectoryBytes) {
		return blocklistZipDirectory{}, errBlocklistTooLarge
	}
	if directoryOffset > uint64(archiveSize) ||
		directorySize > uint64(archiveSize)-directoryOffset {
		return blocklistZipDirectory{}, errors.New("The zip list is invalid.")
	}
	if directorySize > uint64(directoryEndOffset) {
		return blocklistZipDirectory{}, errors.New("The zip list is invalid.")
	}
	physicalOffset := directoryEndOffset - int64(directorySize)
	if directoryOffset != uint64(physicalOffset) {
		return blocklistZipDirectory{}, errors.New("Self-extracting zip lists are not supported.")
	}

	return blocklistZipDirectory{
		Entries: int(entries),
		Offset:  physicalOffset,
		Size:    int64(directorySize),
	}, nil
}

// validateBlocklistZipEntries counts actual records in one bounded central directory.
//
// ZIP readers tolerate a truncated advertised count and can otherwise allocate every
// hidden record; this fixed-header walk rejects the real 1,001st entry before that.
//
// Since: UNRELEASED
func validateBlocklistZipEntries(
	reader io.ReaderAt,
	directory blocklistZipDirectory,
	maximumEntries int,
) error {
	section := io.NewSectionReader(reader, directory.Offset, directory.Size)
	remainingBytes := directory.Size
	entryCount := 0
	for remainingBytes > 0 {
		if remainingBytes < 4 {
			return errors.New("The zip list is invalid.")
		}
		signature := make([]byte, 4)
		if _, err := io.ReadFull(section, signature); err != nil {
			return fmt.Errorf("read zip directory signature: %w", err)
		}
		remainingBytes -= 4
		switch binary.LittleEndian.Uint32(signature) {
		case 0x02014b50:
			if remainingBytes < 42 {
				return errors.New("The zip list is invalid.")
			}
			header := make([]byte, 42)
			if _, err := io.ReadFull(section, header); err != nil {
				return fmt.Errorf("read zip directory entry: %w", err)
			}
			remainingBytes -= 42
			entryCount++
			if entryCount > maximumEntries {
				return errBlocklistTooLarge
			}
			variableBytes := int64(binary.LittleEndian.Uint16(header[24:26])) +
				int64(binary.LittleEndian.Uint16(header[26:28])) +
				int64(binary.LittleEndian.Uint16(header[28:30]))
			if variableBytes > remainingBytes {
				return errors.New("The zip list is invalid.")
			}
			if _, err := section.Seek(variableBytes, io.SeekCurrent); err != nil {
				return fmt.Errorf("skip zip directory entry: %w", err)
			}
			remainingBytes -= variableBytes
		case 0x05054b50:
			if remainingBytes < 2 {
				return errors.New("The zip list is invalid.")
			}
			lengthBytes := make([]byte, 2)
			if _, err := io.ReadFull(section, lengthBytes); err != nil {
				return fmt.Errorf("read zip directory signature length: %w", err)
			}
			remainingBytes -= 2
			signatureBytes := int64(binary.LittleEndian.Uint16(lengthBytes))
			if signatureBytes != remainingBytes {
				return errors.New("The zip list is invalid.")
			}
			if _, err := section.Seek(signatureBytes, io.SeekCurrent); err != nil {
				return fmt.Errorf("skip zip directory signature: %w", err)
			}
			remainingBytes = 0
		default:
			return errors.New("The zip list is invalid.")
		}
	}
	if entryCount != directory.Entries {
		return errors.New("The zip list is invalid.")
	}

	return nil
}

// openDaemonBlocklistDirectory opens one daemon folder without following links.
//
// The config directory must already exist after migration and daemon preparation;
// only the child blocklists directory may be created through its parent descriptor.
//
// Since: UNRELEASED
func openDaemonBlocklistDirectory(
	configRoot string,
	entry daemonEntry,
	create bool,
) (*os.File, error) {
	configPath := filepath.Join(configRoot, entry.ConnectionID)
	configDescriptor, err := unix.Open(
		configPath,
		unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC,
		0,
	)
	if err != nil {
		if errors.Is(err, unix.ENOENT) {
			return nil, errBlocklistDaemonNotPrepared
		}

		return nil, fmt.Errorf("open prepared daemon %s: %w", entry.ConnectionID, err)
	}
	defer unix.Close(configDescriptor)

	if create {
		err = unix.Mkdirat(configDescriptor, "blocklists", 0o750)
		if err != nil && !errors.Is(err, unix.EEXIST) {
			return nil, fmt.Errorf("create blocklists folder for %s: %w", entry.ConnectionID, err)
		}
	}
	blocklistDescriptor, err := unix.Openat(
		configDescriptor,
		"blocklists",
		unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC,
		0,
	)
	if err != nil {
		if !create && errors.Is(err, unix.ENOENT) {
			return nil, errBlocklistDaemonNotPrepared
		}
		if errors.Is(err, unix.ELOOP) || errors.Is(err, unix.ENOTDIR) {
			return nil, fmt.Errorf(
				"daemon %s: %w",
				entry.ConnectionID,
				errBlocklistDirectoryUnsafe,
			)
		}

		return nil, fmt.Errorf("open blocklists folder for %s: %w", entry.ConnectionID, err)
	}

	return os.NewFile(uintptr(blocklistDescriptor), "blocklists:"+entry.ConnectionID), nil
}

// openRegularBlocklistFile opens one source copy relative to a verified directory.
//
// O_NOFOLLOW and an fstat regular-file check prevent cached copies from traversing a
// file symlink or reading a non-file entry supplied by the daemon directory.
//
// Since: UNRELEASED
func openRegularBlocklistFile(directory *os.File, name string) (*os.File, error) {
	descriptor, err := unix.Openat(
		int(directory.Fd()),
		name,
		unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_CLOEXEC,
		0,
	)
	if err != nil {
		return nil, err
	}
	var information unix.Stat_t
	if err := unix.Fstat(descriptor, &information); err != nil {
		_ = unix.Close(descriptor)

		return nil, err
	}
	if uint32(information.Mode)&unix.S_IFMT != unix.S_IFREG {
		_ = unix.Close(descriptor)

		return nil, errors.New("blocklist copy is not a regular file")
	}

	return os.NewFile(uintptr(descriptor), name), nil
}

// writeBlocklistCopyAt streams one cached source into a verified daemon directory.
//
// A descriptor-relative temporary file is synced and renamed atomically, so an error
// leaves the previous regular file untouched without resolving the directory again.
//
// Since: UNRELEASED
func writeBlocklistCopyAt(
	directory *os.File,
	name string,
	copy *blocklistCopy,
) error {
	temporaryName, err := newBlocklistTemporaryName()
	if err != nil {
		return fmt.Errorf("name temporary blocklist: %w", err)
	}
	descriptor, err := unix.Openat(
		int(directory.Fd()),
		temporaryName,
		unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC,
		0o640,
	)
	if err != nil {
		return fmt.Errorf("create temporary blocklist: %w", err)
	}
	temporaryFile := os.NewFile(uintptr(descriptor), temporaryName)
	committed := false
	defer func() {
		_ = temporaryFile.Close()
		if !committed {
			_ = unix.Unlinkat(int(directory.Fd()), temporaryName, 0)
		}
	}()

	if _, err := copy.File.Seek(0, io.SeekStart); err != nil {
		return fmt.Errorf("rewind cached blocklist: %w", err)
	}
	written, err := io.CopyBuffer(temporaryFile, copy.File, make([]byte, 64*1024))
	if err != nil {
		return fmt.Errorf("copy cached blocklist: %w", err)
	}
	if written != copy.Size {
		return errors.New("cached blocklist size changed while copying")
	}
	if err := temporaryFile.Sync(); err != nil {
		return fmt.Errorf("sync temporary blocklist: %w", err)
	}
	if err := temporaryFile.Close(); err != nil {
		return fmt.Errorf("close temporary blocklist: %w", err)
	}
	if err := unix.Renameat(
		int(directory.Fd()),
		temporaryName,
		int(directory.Fd()),
		name,
	); err != nil {
		return fmt.Errorf("publish blocklist file: %w", err)
	}
	committed = true

	return nil
}

// removeStaleBlocklistFiles removes only regular files outside the expected set.
//
// Directories, links, sockets, and other entry types remain untouched; every stat and
// unlink operation stays relative to the already verified directory descriptor.
//
// Since: UNRELEASED
func removeStaleBlocklistFiles(
	directory *os.File,
	expected map[string]struct{},
) error {
	entries, err := directory.ReadDir(-1)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if _, keep := expected[entry.Name()]; keep {
			continue
		}
		var information unix.Stat_t
		if err := unix.Fstatat(
			int(directory.Fd()),
			entry.Name(),
			&information,
			unix.AT_SYMLINK_NOFOLLOW,
		); err != nil {
			if errors.Is(err, unix.ENOENT) {
				continue
			}

			return err
		}
		if uint32(information.Mode)&unix.S_IFMT != unix.S_IFREG {
			continue
		}
		if err := unix.Unlinkat(int(directory.Fd()), entry.Name(), 0); err != nil {
			return err
		}
	}

	return nil
}

// newBlocklistTemporaryName returns an unpredictable descriptor-relative filename.
//
// Random names keep concurrent or crash-left temporary files from colliding without
// relying on path-based os.CreateTemp inside a security-sensitive daemon folder.
//
// Since: UNRELEASED
func newBlocklistTemporaryName() (string, error) {
	randomBytes := make([]byte, 12)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}

	return ".tvpn-blocklist-" + hex.EncodeToString(randomBytes), nil
}
