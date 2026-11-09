package directorybrowser

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"golang.org/x/sys/unix"
)

var (
	// maximumDirectoryEntriesScanned caps one child metadata scan.
	//
	// The bound keeps listings responsive when a child contains many entries and
	// makes capped results conservative instead of implying the folder is empty.
	//
	// Since: UNRELEASED
	maximumDirectoryEntriesScanned = 1_000

	// maximumListingEntriesScanned caps aggregate child inspection work.
	//
	// Once a listing consumes this budget, later children receive only a one-entry
	// emptiness probe so large sibling sets cannot multiply the per-child limit.
	//
	// Since: UNRELEASED
	maximumListingEntriesScanned = 20_000

	// maximumDirectoryListingDuration bounds one listing's child inspections.
	//
	// Children reached after this deadline remain visible but are marked unchecked
	// so the API can refuse deletion without opening more filesystem descriptors.
	//
	// Since: UNRELEASED
	maximumDirectoryListingDuration = 3 * time.Second
)

const (

	// directoryEntryScanBatchSize controls each bounded child scan read.
	//
	// Small batches let the server stop after finding a real subfolder without
	// materializing the child's complete directory listing in memory.
	//
	// Since: UNRELEASED
	directoryEntryScanBatchSize = 128

	// maximumTorrentMetainfoBytes caps one torrent metainfo read.
	//
	// The fixed budget lets the controller serve daemon state without exposing an
	// unbounded local-protocol response to the control API process.
	//
	// Since: UNRELEASED
	maximumTorrentMetainfoBytes int64 = 16 * 1024 * 1024
)

// ServerConfig defines the immutable filesystem and local-socket boundaries.
//
// Production fixes RootPath to /data, while explicit paths keep tests isolated from
// host storage and avoid another deployment configuration surface.
type ServerConfig struct {
	RootPath             string
	TransmissionRootPath string
	SocketPath           string
	MarkerPath           string
	Logger               *slog.Logger
}

// Server exposes safe navigation, creation, and one empty-folder deletion.
//
// It runs as the Transmission user, giving created folders the same ownership as
// downloaded data without exposing recursive removal to the HTTP control process.
//
// Since: UNRELEASED
type Server struct {
	config                       ServerConfig
	resolvedRootPath             string
	resolvedTransmissionRootPath string

	// afterDirectoryResolution lets race tests replace a validated path component.
	//
	// Production leaves this hook nil; operations invoke it immediately before the
	// descriptor walk that must reject the deterministic symbolic-link swap.
	//
	// Since: UNRELEASED
	afterDirectoryResolution func(string)
}

// NewServer validates the fixed storage root and local runtime paths.
//
// Resolving the root once establishes the canonical boundary used to reject symlink
// traversal on every operation.
func NewServer(config ServerConfig) (*Server, error) {
	if config.RootPath == "" || config.TransmissionRootPath == "" ||
		config.SocketPath == "" || config.MarkerPath == "" {
		return nil, errors.New("directory controller roots, socket, and marker paths are required")
	}
	if !filepath.IsAbs(config.RootPath) || filepath.Clean(config.RootPath) != config.RootPath {
		return nil, errors.New("directory controller root must be a normalized absolute path")
	}
	if !filepath.IsAbs(config.TransmissionRootPath) ||
		filepath.Clean(config.TransmissionRootPath) != config.TransmissionRootPath {
		return nil, errors.New("Transmission root must be a normalized absolute path")
	}

	rootInformation, err := os.Stat(config.RootPath)
	if err != nil {
		return nil, fmt.Errorf("inspect directory controller root: %w", err)
	}
	if !rootInformation.IsDir() {
		return nil, errors.New("directory controller root is not a directory")
	}

	resolvedRootPath, err := filepath.EvalSymlinks(config.RootPath)
	if err != nil {
		return nil, fmt.Errorf("resolve directory controller root: %w", err)
	}
	transmissionRootInformation, err := os.Stat(config.TransmissionRootPath)
	if err != nil {
		return nil, fmt.Errorf("inspect Transmission root: %w", err)
	}
	if !transmissionRootInformation.IsDir() {
		return nil, errors.New("Transmission root is not a directory")
	}
	resolvedTransmissionRootPath, err := filepath.EvalSymlinks(config.TransmissionRootPath)
	if err != nil {
		return nil, fmt.Errorf("resolve Transmission root: %w", err)
	}
	if config.Logger == nil {
		config.Logger = slog.Default()
	}

	return &Server{
		config:                       config,
		resolvedRootPath:             filepath.Clean(resolvedRootPath),
		resolvedTransmissionRootPath: filepath.Clean(resolvedTransmissionRootPath),
	}, nil
}

// Serve listens for typed local requests until the supplied context is canceled.
//
// The socket is permissioned for the control group by its setgid parent directory;
// no network listener or generic filesystem command is exposed.
func (server *Server) Serve(ctx context.Context) error {
	_ = os.Remove(server.config.SocketPath)
	listener, err := net.Listen("unix", server.config.SocketPath)
	if err != nil {
		return fmt.Errorf("listen on directory controller socket: %w", err)
	}
	defer listener.Close()
	defer os.Remove(server.config.SocketPath)

	if err := os.Chmod(server.config.SocketPath, 0o660); err != nil {
		return fmt.Errorf("set directory controller socket permissions: %w", err)
	}
	if err := writeReadinessMarker(server.config.MarkerPath); err != nil {
		return err
	}
	defer os.Remove(server.config.MarkerPath)

	acceptErrors := make(chan error, 1)
	go func() {
		for {
			connection, acceptError := listener.Accept()
			if acceptError != nil {
				acceptErrors <- acceptError

				return
			}

			go server.handleConnection(connection)
		}
	}()

	select {
	case <-ctx.Done():
		_ = listener.Close()
	case acceptError := <-acceptErrors:
		if !errors.Is(acceptError, net.ErrClosed) {
			return fmt.Errorf("accept directory controller request: %w", acceptError)
		}
	}

	return nil
}

// handleConnection validates and executes one bounded local request.
//
// Each connection carries one operation, keeping protocol framing and permission
// lifetime small and predictable.
//
// Since: UNRELEASED
func (server *Server) handleConnection(connection net.Conn) {
	defer connection.Close()
	_ = connection.SetDeadline(time.Now().Add(10 * time.Second))

	limitedReader := io.LimitReader(connection, maximumDirectoryControllerRequestBytes+1)
	bufferedReader := bufio.NewReaderSize(limitedReader, 16*1024)
	payload, err := bufferedReader.ReadBytes('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		server.writeResponse(connection, invalidRequestResponse())

		return
	}
	if len(payload) == 0 || len(payload) > maximumDirectoryControllerRequestBytes {
		server.writeResponse(connection, Response{
			OK:        false,
			ErrorCode: ErrorCodeInvalidPath,
			Error:     "The directory request exceeds the size limit.",
		})

		return
	}

	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()

	var request Request
	if err := decoder.Decode(&request); err != nil {
		server.writeResponse(connection, invalidRequestResponse())

		return
	}

	var trailingValue any
	if err := decoder.Decode(&trailingValue); !errors.Is(err, io.EOF) {
		server.writeResponse(connection, invalidRequestResponse())

		return
	}
	if request.Version != ProtocolVersion {
		server.writeResponse(connection, Response{
			OK:        false,
			ErrorCode: ErrorCodeInvalidPath,
			Error:     "The directory-controller protocol version is unsupported.",
		})

		return
	}

	var directory *Directory
	var entry *DirectoryEntry
	var torrent []byte
	var operationError error
	switch request.Action {
	case "create":
		created, err := server.createDirectory(request.Path, request.Name)
		directory = &created
		operationError = err
	case "delete":
		operationError = server.deleteDirectory(request.Path)
	case "inspect":
		inspected, err := server.inspectDirectory(request.Path)
		entry = &inspected
		operationError = err
	case "list":
		listed, err := server.listDirectory(request.Path)
		directory = &listed
		operationError = err
	case "read-torrent":
		torrent, operationError = server.readTorrent(request.Path)
	default:
		operationError = newOperationError(
			ErrorCodeInvalidPath,
			"The directory action is unsupported.",
		)
	}

	if operationError != nil {
		server.writeOperationError(connection, operationError)

		return
	}

	server.writeResponse(connection, Response{
		OK:        true,
		Directory: directory,
		Entry:     entry,
		Torrent:   torrent,
	})
}

// readTorrent reads one regular metainfo file beneath a connection's torrents folder.
//
// The lexical shape, every path component, and the resolved path are checked before
// the bounded read so callers cannot turn the action into a general file primitive.
func (server *Server) readTorrent(path string) ([]byte, error) {
	relativePath, err := validateTorrentPath(server.config.TransmissionRootPath, path)
	if err != nil {
		return nil, err
	}
	if err := rejectPathSymlinks(server.config.TransmissionRootPath, relativePath); err != nil {
		return nil, err
	}

	resolvedPath, err := filepath.EvalSymlinks(path)
	if err != nil {
		return nil, filesystemOperationError(err, "The torrent metainfo could not be opened.")
	}
	expectedPath := filepath.Join(server.resolvedTransmissionRootPath, relativePath)
	if filepath.Clean(resolvedPath) != expectedPath {
		return nil, newOperationError(ErrorCodeInvalidPath, "Symbolic links cannot be used for torrent metainfo.")
	}

	information, err := os.Stat(resolvedPath)
	if err != nil {
		return nil, filesystemOperationError(err, "The torrent metainfo could not be opened.")
	}
	if !information.Mode().IsRegular() {
		return nil, newOperationError(ErrorCodeInvalidPath, "The torrent metainfo path is not a regular file.")
	}
	if information.Size() > maximumTorrentMetainfoBytes {
		return nil, newOperationError(ErrorCodeFileTooLarge, "The torrent metainfo exceeds 16 MiB.")
	}

	file, err := os.Open(resolvedPath)
	if err != nil {
		return nil, filesystemOperationError(err, "The torrent metainfo could not be opened.")
	}
	defer file.Close()

	content, err := io.ReadAll(io.LimitReader(file, maximumTorrentMetainfoBytes+1))
	if err != nil {
		return nil, filesystemOperationError(err, "The torrent metainfo could not be read.")
	}
	if int64(len(content)) > maximumTorrentMetainfoBytes {
		return nil, newOperationError(ErrorCodeFileTooLarge, "The torrent metainfo exceeds 16 MiB.")
	}

	return content, nil
}

// validateTorrentPath accepts only one connection hash file under the fixed root.
func validateTorrentPath(transmissionRootPath string, path string) (string, error) {
	if path == "" || !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return "", newOperationError(ErrorCodeInvalidPath, "The torrent metainfo path is invalid.")
	}

	relativePath, err := filepath.Rel(transmissionRootPath, path)
	if err != nil {
		return "", newOperationError(ErrorCodeInvalidPath, "The torrent metainfo path is invalid.")
	}
	parts := strings.Split(relativePath, string(os.PathSeparator))
	if len(parts) != 3 || !validConnectionDirectory(parts[0]) || parts[1] != "torrents" ||
		!validTorrentFilename(parts[2]) {
		return "", newOperationError(ErrorCodeInvalidPath, "The torrent metainfo path is invalid.")
	}

	return relativePath, nil
}

// rejectPathSymlinks refuses a symbolic link in the root or any requested component.
func rejectPathSymlinks(rootPath string, relativePath string) error {
	currentPath := rootPath
	parts := append([]string{""}, strings.Split(relativePath, string(os.PathSeparator))...)
	for index, part := range parts {
		if index > 0 {
			currentPath = filepath.Join(currentPath, part)
		}
		information, err := os.Lstat(currentPath)
		if err != nil {
			return filesystemOperationError(err, "The torrent metainfo could not be inspected.")
		}
		if information.Mode()&os.ModeSymlink != 0 {
			return newOperationError(ErrorCodeInvalidPath, "Symbolic links cannot be used for torrent metainfo.")
		}
	}

	return nil
}

// validConnectionDirectory recognizes the durable VPN connection identifier shape.
func validConnectionDirectory(value string) bool {
	hexadecimal, found := strings.CutPrefix(value, "vpc-")

	return found && len(hexadecimal) == 16 && isHexadecimal(hexadecimal)
}

// validTorrentFilename recognizes v1 and v2 info-hash metainfo file names.
func validTorrentFilename(value string) bool {
	hash, found := strings.CutSuffix(value, ".torrent")

	return found && (len(hash) == 40 || len(hash) == 64) && isHexadecimal(hash)
}

// isHexadecimal checks one nonempty ASCII hexadecimal value without normalization.
func isHexadecimal(value string) bool {
	if value == "" {
		return false
	}
	for _, character := range value {
		if !strings.ContainsRune("0123456789abcdefABCDEF", character) {
			return false
		}
	}

	return true
}

// createDirectory creates one direct child and returns it as a browser snapshot.
//
// Folder names cannot contain separators or control characters, and the validated
// parent is walked from the root descriptor before descriptor-relative creation.
//
// Since: UNRELEASED
func (server *Server) createDirectory(parentPath string, name string) (Directory, error) {
	if _, err := server.resolveDirectory(parentPath); err != nil {
		return Directory{}, err
	}
	if server.afterDirectoryResolution != nil {
		server.afterDirectoryResolution(parentPath)
	}
	if err := validateDirectoryName(name); err != nil {
		return Directory{}, err
	}

	parentDescriptor, err := server.walkResolvedDirectory(parentPath)
	if err != nil {
		return Directory{}, err
	}
	defer unix.Close(parentDescriptor)

	if err := unix.Mkdirat(parentDescriptor, name, 0o775); err != nil {
		return Directory{}, filesystemOperationError(err, "The folder could not be created.")
	}

	childDescriptor, err := unix.Openat(
		parentDescriptor,
		name,
		unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC,
		0,
	)
	if err != nil {
		operationError := directoryWalkError(err)

		return Directory{}, cleanupCreatedDirectory(parentDescriptor, name, operationError)
	}
	if err := unix.Fchmod(childDescriptor, 0o775); err != nil {
		_ = unix.Close(childDescriptor)
		operationError := filesystemOperationError(
			err,
			"The folder permissions could not be set.",
		)

		return Directory{}, cleanupCreatedDirectory(parentDescriptor, name, operationError)
	}
	_ = unix.Close(childDescriptor)

	childPath := filepath.Join(parentPath, name)

	return server.listDirectory(childPath)
}

// cleanupCreatedDirectory removes a partially initialized child by descriptor.
//
// Creation failures retain their stable category while a failed cleanup is joined
// for local logging instead of falling back to path-based removal.
//
// Since: UNRELEASED
func cleanupCreatedDirectory(parentDescriptor int, name string, operationError error) error {
	if err := unix.Unlinkat(parentDescriptor, name, unix.AT_REMOVEDIR); err != nil {
		return errors.Join(
			operationError,
			fmt.Errorf("clean up partially created folder: %w", err),
		)
	}

	return operationError
}

// deleteDirectory removes one empty child through its already resolved parent.
//
// Descriptor-relative removal and AT_REMOVEDIR prevent file unlinking, traversal,
// symlink following, and recursion while still allowing one deliberate cleanup.
//
// Since: UNRELEASED
func (server *Server) deleteDirectory(path string) error {
	parentPath, name, err := server.resolveDirectoryTarget(path)
	if err != nil {
		return err
	}
	if server.afterDirectoryResolution != nil {
		server.afterDirectoryResolution(path)
	}

	parentDescriptor, err := server.walkResolvedDirectory(parentPath)
	if err != nil {
		return err
	}
	defer unix.Close(parentDescriptor)

	if err := unix.Unlinkat(parentDescriptor, name, unix.AT_REMOVEDIR); err != nil {
		return deleteDirectoryError(err)
	}

	return nil
}

// inspectDirectory returns current facts for one named folder and no siblings.
//
// The delete preflight walks only the resolved parent, then opens the child through
// that descriptor so a large sibling set contributes no additional scan work.
//
// Since: UNRELEASED
func (server *Server) inspectDirectory(path string) (DirectoryEntry, error) {
	parentPath, name, err := server.resolveDirectoryTarget(path)
	if err != nil {
		return DirectoryEntry{}, err
	}
	if server.afterDirectoryResolution != nil {
		server.afterDirectoryResolution(path)
	}

	parentDescriptor, err := server.walkResolvedDirectory(parentPath)
	if err != nil {
		return DirectoryEntry{}, err
	}
	defer unix.Close(parentDescriptor)

	var parentInformation unix.Stat_t
	if err := unix.Fstat(parentDescriptor, &parentInformation); err != nil {
		return DirectoryEntry{}, filesystemOperationError(
			err,
			"The folder's parent could not be inspected.",
		)
	}

	entry := DirectoryEntry{
		Name:    name,
		Path:    path,
		Checked: true,
	}
	inspection, err := inspectChildDirectory(
		parentDescriptor,
		parentInformation,
		name,
		maximumDirectoryEntriesScanned,
	)
	if err != nil {
		if errors.Is(err, unix.EACCES) || errors.Is(err, unix.EPERM) {
			return entry, nil
		}

		return DirectoryEntry{}, directoryWalkError(err)
	}

	entry.Empty = inspection.empty
	entry.HasSubfolders = inspection.hasSubfolders
	entry.Readable = true
	entry.MountPoint = inspection.mountPoint

	return entry, nil
}

// resolveDirectoryTarget validates one deletable or inspectable folder path.
//
// Existing folder names receive only the minimal component checks needed by
// unlinkat, preserving leading, trailing, and otherwise unusual valid characters.
//
// Since: UNRELEASED
func (server *Server) resolveDirectoryTarget(path string) (string, string, error) {
	if path == server.config.RootPath {
		return "", "", newOperationError(
			ErrorCodeInvalidPath,
			"The storage root cannot be deleted.",
		)
	}
	if path == "" || !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return "", "", newOperationError(
			ErrorCodeInvalidPath,
			"Choose a normalized folder beneath %s.",
			server.config.RootPath,
		)
	}

	name := filepath.Base(path)
	if err := validateDirectoryDeletionName(name); err != nil {
		return "", "", err
	}
	if _, err := server.resolveDirectory(path); err != nil {
		return "", "", err
	}

	return filepath.Dir(path), name, nil
}

// listDirectory returns a sorted snapshot of one safe directory.
//
// Only real immediate child directories are returned; regular files and symbolic
// links remain invisible and cannot be selected through the browser.
//
// Since: UNRELEASED
func (server *Server) listDirectory(path string) (Directory, error) {
	listingStarted := time.Now()
	if _, err := server.resolveDirectory(path); err != nil {
		return Directory{}, err
	}
	if server.afterDirectoryResolution != nil {
		server.afterDirectoryResolution(path)
	}

	parentDescriptor, err := server.walkResolvedDirectory(path)
	if err != nil {
		return Directory{}, err
	}
	parentDirectory := os.NewFile(uintptr(parentDescriptor), path)
	if parentDirectory == nil {
		_ = unix.Close(parentDescriptor)

		return Directory{}, errors.New("open directory descriptor as a file")
	}
	defer parentDirectory.Close()

	var parentInformation unix.Stat_t
	if err := unix.Fstat(parentDescriptor, &parentInformation); err != nil {
		return Directory{}, filesystemOperationError(
			err,
			"The folder could not be inspected.",
		)
	}

	entries, err := parentDirectory.ReadDir(-1)
	if err != nil {
		return Directory{}, filesystemOperationError(err, "The folder could not be opened.")
	}
	sort.Slice(entries, func(leftIndex int, rightIndex int) bool {
		leftName := strings.ToLower(entries[leftIndex].Name())
		rightName := strings.ToLower(entries[rightIndex].Name())
		if leftName == rightName {
			return entries[leftIndex].Name() < entries[rightIndex].Name()
		}

		return leftName < rightName
	})

	directories := make([]DirectoryEntry, 0, len(entries))
	totalEntriesScanned := 0
	for _, entry := range entries {
		if !utf8.ValidString(entry.Name()) || !directoryEntryIsDirectory(entry) {
			continue
		}

		if time.Since(listingStarted) >= maximumDirectoryListingDuration {
			directories = append(directories, DirectoryEntry{
				Name:          entry.Name(),
				Path:          filepath.Join(path, entry.Name()),
				Empty:         false,
				HasSubfolders: true,
				Checked:       false,
			})

			continue
		}

		entryScanLimit := maximumDirectoryEntriesScanned
		if entryScanLimit < 1 {
			entryScanLimit = 1
		}
		if totalEntriesScanned >= maximumListingEntriesScanned {
			entryScanLimit = 1
		}
		inspection, inspectionError := inspectChildDirectory(
			parentDescriptor,
			parentInformation,
			entry.Name(),
			entryScanLimit,
		)
		totalEntriesScanned += inspection.entriesScanned
		readable := inspectionError == nil
		if inspectionError != nil {
			inspection = childDirectoryInspection{}
		}

		directories = append(directories, DirectoryEntry{
			Name:          entry.Name(),
			Path:          filepath.Join(path, entry.Name()),
			Empty:         inspection.empty,
			HasSubfolders: inspection.hasSubfolders,
			Readable:      readable,
			MountPoint:    inspection.mountPoint,
			Checked:       true,
		})
	}

	parentPath := ""
	if path != server.config.RootPath {
		parentPath = filepath.Dir(path)
	}

	return Directory{
		Path:        path,
		ParentPath:  parentPath,
		Directories: directories,
	}, nil
}

// walkResolvedDirectory opens a validated directory from the immutable root.
//
// Every component is opened with no-follow semantics and the previous descriptor is
// closed as the walk advances, preventing parent-link swaps from escaping the root.
//
// Since: UNRELEASED
func (server *Server) walkResolvedDirectory(path string) (int, error) {
	directoryDescriptor, err := unix.Open(
		server.resolvedRootPath,
		unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC,
		0,
	)
	if err != nil {
		return -1, directoryWalkError(err)
	}

	relativePath, err := filepath.Rel(server.config.RootPath, path)
	if err != nil {
		_ = unix.Close(directoryDescriptor)

		return -1, fmt.Errorf("derive directory walk: %w", err)
	}
	if relativePath == "." {
		return directoryDescriptor, nil
	}

	for _, component := range strings.Split(relativePath, string(os.PathSeparator)) {
		nextDescriptor, openError := unix.Openat(
			directoryDescriptor,
			component,
			unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC,
			0,
		)
		_ = unix.Close(directoryDescriptor)
		if openError != nil {
			return -1, directoryWalkError(openError)
		}

		directoryDescriptor = nextDescriptor
	}

	return directoryDescriptor, nil
}

// directoryEntryIsDirectory classifies one child without following symbolic links.
//
// Go's ReadDir resolves an unknown directory type before returning the entry, so a
// zero Type is a regular file and requires no additional per-file system call.
//
// Since: UNRELEASED
func directoryEntryIsDirectory(entry fs.DirEntry) bool {
	return entry.Type().IsDir()
}

// childDirectoryInspection records bounded metadata and consumed scan work.
//
// The listing aggregates entriesScanned across children, while inspect callers use
// the same facts without exposing this accounting field over the local protocol.
//
// Since: UNRELEASED
type childDirectoryInspection struct {
	empty          bool
	hasSubfolders  bool
	mountPoint     bool
	entriesScanned int
}

// inspectChildDirectory reads bounded metadata through a descriptor-relative open.
//
// Callers decide whether an open failure rejects one inspect request or becomes an
// unreadable listing entry. Reaching scanLimit leaves subfolder presence unknown.
//
// Since: UNRELEASED
func inspectChildDirectory(
	parentDescriptor int,
	parentInformation unix.Stat_t,
	name string,
	scanLimit int,
) (childDirectoryInspection, error) {
	childDescriptor, err := unix.Openat(
		parentDescriptor,
		name,
		unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC,
		0,
	)
	if err != nil {
		return childDirectoryInspection{}, err
	}

	childDirectory := os.NewFile(uintptr(childDescriptor), name)
	if childDirectory == nil {
		_ = unix.Close(childDescriptor)

		return childDirectoryInspection{}, errors.New("open child directory descriptor as a file")
	}
	defer childDirectory.Close()

	var childInformation unix.Stat_t
	if err := unix.Fstat(childDescriptor, &childInformation); err != nil {
		return childDirectoryInspection{}, err
	}
	inspection := childDirectoryInspection{
		empty:      true,
		mountPoint: childInformation.Dev != parentInformation.Dev,
	}
	for inspection.entriesScanned < scanLimit {
		batchSize := min(
			directoryEntryScanBatchSize,
			scanLimit-inspection.entriesScanned,
		)
		entries, readError := childDirectory.ReadDir(batchSize)
		if len(entries) > 0 {
			inspection.empty = false
		}
		for _, entry := range entries {
			inspection.entriesScanned++
			if directoryEntryIsDirectory(entry) {
				inspection.hasSubfolders = true

				return inspection, nil
			}
		}
		if errors.Is(readError, io.EOF) {
			return inspection, nil
		}
		if readError != nil {
			return inspection, readError
		}
	}

	inspection.empty = false
	inspection.hasSubfolders = true

	return inspection, nil
}

// directoryWalkError maps no-follow traversal failures to stable controller codes.
//
// Linux may report either ELOOP or ENOTDIR when O_NOFOLLOW meets a symbolic link;
// both receive the same safe path rejection required by the picker contract.
//
// Since: UNRELEASED
func directoryWalkError(err error) error {
	switch {
	case errors.Is(err, unix.ELOOP), errors.Is(err, unix.ENOTDIR):
		return newOperationError(
			ErrorCodeInvalidPath,
			"Symbolic links cannot be used as download locations.",
		)
	case errors.Is(err, unix.ENOENT):
		return newOperationError(ErrorCodeNotFound, "That folder no longer exists.")
	case errors.Is(err, unix.EACCES), errors.Is(err, unix.EPERM):
		return newOperationError(
			ErrorCodePermissionDenied,
			"Transmission does not have permission to use that folder.",
		)
	default:
		return fmt.Errorf("walk directory from storage root: %w", err)
	}
}

// resolveDirectory validates a lexical path and rejects symlinked descendants.
//
// Both the configured and resolved roots are checked, preventing traversal through
// dot segments, sibling prefixes, or symbolic links that point outside /data.
func (server *Server) resolveDirectory(path string) (string, error) {
	if path == "" || !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return "", newOperationError(
			ErrorCodeInvalidPath,
			"Choose a normalized folder beneath %s.",
			server.config.RootPath,
		)
	}

	relativePath, err := filepath.Rel(server.config.RootPath, path)
	if err != nil || relativePath == ".." || strings.HasPrefix(relativePath, ".."+string(os.PathSeparator)) {
		return "", newOperationError(
			ErrorCodeInvalidPath,
			"Choose a folder beneath %s.",
			server.config.RootPath,
		)
	}

	resolvedPath, err := filepath.EvalSymlinks(path)
	if err != nil {
		return "", filesystemOperationError(err, "The folder could not be opened.")
	}
	resolvedPath = filepath.Clean(resolvedPath)

	resolvedRelativePath, err := filepath.Rel(server.resolvedRootPath, resolvedPath)
	if err != nil || resolvedRelativePath == ".." || strings.HasPrefix(resolvedRelativePath, ".."+string(os.PathSeparator)) {
		return "", newOperationError(
			ErrorCodeInvalidPath,
			"Symbolic links outside %s cannot be browsed.",
			server.config.RootPath,
		)
	}

	expectedResolvedPath := filepath.Join(server.resolvedRootPath, relativePath)
	if resolvedPath != expectedResolvedPath {
		return "", newOperationError(
			ErrorCodeInvalidPath,
			"Symbolic links cannot be used as download locations.",
		)
	}

	pathInformation, err := os.Stat(resolvedPath)
	if err != nil {
		return "", filesystemOperationError(err, "The folder could not be opened.")
	}
	if !pathInformation.IsDir() {
		return "", newOperationError(
			ErrorCodeNotDirectory,
			"The selected path is not a folder.",
		)
	}

	return resolvedPath, nil
}

// writeOperationError maps one internal operation failure to the stable protocol.
//
// Unknown failures are logged with detail while the local client receives a generic
// message that is safe to forward to the browser.
func (server *Server) writeOperationError(connection net.Conn, err error) {
	var operationError *OperationError
	if errors.As(err, &operationError) {
		server.writeResponse(connection, Response{
			OK:        false,
			ErrorCode: operationError.Code,
			Error:     operationError.Error(),
		})

		return
	}

	server.config.Logger.Error("directory operation failed", "error", err)
	server.writeResponse(connection, Response{
		OK:        false,
		ErrorCode: ErrorCodeInternal,
		Error:     "The directory operation could not be completed.",
	})
}

// writeResponse serializes one local response.
//
// The protocol never includes file contents, secrets, or operating-system error text.
func (server *Server) writeResponse(connection net.Conn, response Response) {
	if err := json.NewEncoder(connection).Encode(response); err != nil {
		server.config.Logger.Error("write directory controller response", "error", err)
	}
}

// filesystemOperationError normalizes expected filesystem failures.
//
// Detailed operating-system errors remain local while stable categories drive API
// status codes and user-facing recovery guidance.
func filesystemOperationError(err error, fallbackMessage string) error {
	switch {
	case errors.Is(err, fs.ErrExist):
		return newOperationError(ErrorCodeAlreadyExists, "A folder with that name already exists.")
	case errors.Is(err, fs.ErrNotExist):
		return newOperationError(ErrorCodeNotFound, "That folder no longer exists.")
	case errors.Is(err, fs.ErrPermission):
		return newOperationError(
			ErrorCodePermissionDenied,
			"Transmission does not have permission to use that folder.",
		)
	default:
		return fmt.Errorf("%s: %w", fallbackMessage, err)
	}
}

// deleteDirectoryError maps unlinkat failures to the versioned controller contract.
//
// The HTTP boundary depends on these categories for stable status codes and supplies
// its own assignment-aware messages without exposing operating-system details.
//
// Since: UNRELEASED
func deleteDirectoryError(err error) error {
	switch {
	case errors.Is(err, unix.ENOTEMPTY), errors.Is(err, unix.EEXIST):
		return newOperationError(ErrorCodeNotEmpty, "The folder is not empty.")
	case errors.Is(err, unix.ENOENT):
		return newOperationError(ErrorCodeNotFound, "That folder no longer exists.")
	case errors.Is(err, unix.ENOTDIR):
		return newOperationError(ErrorCodeNotDirectory, "The selected path is not a folder.")
	case errors.Is(err, unix.EACCES), errors.Is(err, unix.EPERM):
		return newOperationError(
			ErrorCodePermissionDenied,
			"Transmission does not have permission to delete that folder.",
		)
	case errors.Is(err, unix.EROFS):
		return newOperationError(
			ErrorCodeReadOnly,
			"The storage is read-only.",
		)
	case errors.Is(err, unix.EBUSY):
		return newOperationError(ErrorCodeBusy, "The folder is busy and could not be deleted.")
	default:
		return fmt.Errorf("delete folder: %w", err)
	}
}

// invalidRequestResponse returns the stable malformed-request response.
//
// Invalid local payloads reveal no parser or filesystem implementation details.
func invalidRequestResponse() Response {
	return Response{
		OK:        false,
		ErrorCode: ErrorCodeInvalidPath,
		Error:     "The directory request is invalid.",
	}
}

// validateDirectoryName confines creation to one direct child component.
//
// Trimmed Unicode names are supported, while separators, dot entries, control
// characters, and filesystem-incompatible lengths are rejected.
func validateDirectoryName(name string) error {
	if name == "" || strings.TrimSpace(name) != name || !utf8.ValidString(name) || len(name) > 255 {
		return newOperationError(
			ErrorCodeInvalidName,
			"Folder names must contain between 1 and 255 valid, trimmed characters.",
		)
	}
	if name == "." || name == ".." || strings.ContainsAny(name, `/\`) {
		return newOperationError(
			ErrorCodeInvalidName,
			"Folder names cannot contain path separators or dot entries.",
		)
	}
	for _, character := range name {
		if unicode.IsControl(character) {
			return newOperationError(
				ErrorCodeInvalidName,
				"Folder names cannot contain control characters.",
			)
		}
	}

	return nil
}

// validateDirectoryDeletionName accepts any safe existing path component.
//
// Deletion deliberately keeps names that creation would reject, including leading
// or trailing spaces, while refusing traversal, separators, and NUL bytes.
//
// Since: UNRELEASED
func validateDirectoryDeletionName(name string) error {
	if name == "" || name == "." || name == ".." ||
		strings.ContainsRune(name, '/') || strings.ContainsRune(name, '\x00') {
		return newOperationError(
			ErrorCodeInvalidPath,
			"The folder path has an invalid final component.",
		)
	}

	return nil
}

// writeReadinessMarker atomically publishes directory-controller readiness.
//
// The health check observes the marker only after the socket is listening with its
// final permission mode.
func writeReadinessMarker(path string) error {
	directory := filepath.Dir(path)
	temporaryFile, err := os.CreateTemp(directory, ".directory-controller-ready-*")
	if err != nil {
		return fmt.Errorf("create directory controller readiness marker: %w", err)
	}

	temporaryPath := temporaryFile.Name()
	committed := false
	defer func() {
		_ = temporaryFile.Close()
		if !committed {
			_ = os.Remove(temporaryPath)
		}
	}()

	if err := temporaryFile.Chmod(0o644); err != nil {
		return fmt.Errorf("set directory controller readiness permissions: %w", err)
	}
	if err := json.NewEncoder(temporaryFile).Encode(map[string]string{
		"service": "directory-controller",
		"phase":   "storage",
	}); err != nil {
		return fmt.Errorf("encode directory controller readiness marker: %w", err)
	}
	if err := temporaryFile.Sync(); err != nil {
		return fmt.Errorf("sync directory controller readiness marker: %w", err)
	}
	if err := temporaryFile.Close(); err != nil {
		return fmt.Errorf("close directory controller readiness marker: %w", err)
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("publish directory controller readiness marker: %w", err)
	}

	committed = true

	return nil
}
