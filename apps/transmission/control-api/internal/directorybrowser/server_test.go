package directorybrowser

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/unix"
)

// TestServerBrowsesAndCreatesDirectories verifies the complete local protocol.
//
// The test covers sorted directory-only responses, Transmission-compatible folder
// modes, duplicate handling, traversal rejection, and symlink rejection.
//
// Since: UNRELEASED
func TestServerBrowsesAndCreatesDirectories(testingObject *testing.T) {
	temporaryDirectory := testingObject.TempDir()
	rootPath := filepath.Join(temporaryDirectory, "data")
	transmissionRootPath := filepath.Join(temporaryDirectory, "config", "transmission")
	runtimePath := filepath.Join(temporaryDirectory, "runtime")
	if err := os.MkdirAll(filepath.Join(rootPath, "zeta"), 0o755); err != nil {
		testingObject.Fatalf("create zeta fixture: %v", err)
	}
	if err := os.Mkdir(filepath.Join(rootPath, "Alpha"), 0o755); err != nil {
		testingObject.Fatalf("create Alpha fixture: %v", err)
	}
	if err := os.WriteFile(filepath.Join(rootPath, "readme.txt"), []byte("file"), 0o644); err != nil {
		testingObject.Fatalf("create file fixture: %v", err)
	}
	if err := os.Symlink(temporaryDirectory, filepath.Join(rootPath, "outside-link")); err != nil {
		testingObject.Fatalf("create symlink fixture: %v", err)
	}
	if err := os.MkdirAll(runtimePath, 0o755); err != nil {
		testingObject.Fatalf("create runtime fixture: %v", err)
	}
	connectionPath := filepath.Join(
		transmissionRootPath,
		"vpc-0123456789abcdef",
		"torrents",
	)
	if err := os.MkdirAll(connectionPath, 0o755); err != nil {
		testingObject.Fatalf("create Transmission fixture: %v", err)
	}
	validHash := "0123456789abcdef0123456789abcdef01234567"
	validTorrentPath := filepath.Join(connectionPath, validHash+".torrent")
	if err := os.WriteFile(validTorrentPath, []byte("torrent metainfo"), 0o644); err != nil {
		testingObject.Fatalf("create torrent metainfo fixture: %v", err)
	}
	validV2Hash := "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
	validV2TorrentPath := filepath.Join(connectionPath, validV2Hash+".torrent")
	if err := os.WriteFile(validV2TorrentPath, []byte("v2 torrent metainfo"), 0o644); err != nil {
		testingObject.Fatalf("create v2 torrent metainfo fixture: %v", err)
	}
	symlinkTorrentPath := filepath.Join(
		connectionPath,
		"1111111111111111111111111111111111111111.torrent",
	)
	if err := os.Symlink(validTorrentPath, symlinkTorrentPath); err != nil {
		testingObject.Fatalf("create torrent metainfo symlink: %v", err)
	}
	oversizedTorrentPath := filepath.Join(
		connectionPath,
		"2222222222222222222222222222222222222222.torrent",
	)
	oversizedFile, err := os.Create(oversizedTorrentPath)
	if err != nil {
		testingObject.Fatalf("create oversized torrent metainfo: %v", err)
	}
	if err := oversizedFile.Truncate(maximumTorrentMetainfoBytes + 1); err != nil {
		_ = oversizedFile.Close()
		testingObject.Fatalf("size oversized torrent metainfo: %v", err)
	}
	if err := oversizedFile.Close(); err != nil {
		testingObject.Fatalf("close oversized torrent metainfo: %v", err)
	}

	socketFile, err := os.CreateTemp("/tmp", "transmission-vpn-directory-*.sock")
	if err != nil {
		testingObject.Fatalf("reserve short socket path: %v", err)
	}
	socketPath := socketFile.Name()
	if err := socketFile.Close(); err != nil {
		testingObject.Fatalf("close socket placeholder: %v", err)
	}
	if err := os.Remove(socketPath); err != nil {
		testingObject.Fatalf("remove socket placeholder: %v", err)
	}
	testingObject.Cleanup(func() {
		_ = os.Remove(socketPath)
	})

	markerPath := filepath.Join(runtimePath, "directory.ready")
	server, err := NewServer(ServerConfig{
		RootPath:             rootPath,
		TransmissionRootPath: transmissionRootPath,
		SocketPath:           socketPath,
		MarkerPath:           markerPath,
		Logger:               slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	if err != nil {
		testingObject.Fatalf("create directory server: %v", err)
	}

	serveContext, cancelServe := context.WithCancel(context.Background())
	serveErrors := make(chan error, 1)
	go func() {
		serveErrors <- server.Serve(serveContext)
	}()

	waitForSocket(testingObject, socketPath, serveErrors)
	client := NewClient(socketPath, 2*time.Second)
	directory, err := client.List(context.Background(), rootPath)
	if err != nil {
		testingObject.Fatalf("list root directory: %v", err)
	}
	if directory.ParentPath != "" || len(directory.Directories) != 2 {
		testingObject.Fatalf("unexpected root directory: %#v", directory)
	}
	if directory.Directories[0].Name != "Alpha" || directory.Directories[1].Name != "zeta" {
		testingObject.Fatalf("directories are not sorted: %#v", directory.Directories)
	}

	createdDirectory, err := client.Create(context.Background(), rootPath, "Movies")
	if err != nil {
		testingObject.Fatalf("create Movies directory: %v", err)
	}
	if createdDirectory.Path != filepath.Join(rootPath, "Movies") || createdDirectory.ParentPath != rootPath {
		testingObject.Fatalf("unexpected created directory: %#v", createdDirectory)
	}

	createdInformation, err := os.Stat(createdDirectory.Path)
	if err != nil {
		testingObject.Fatalf("inspect created directory: %v", err)
	}
	if createdInformation.Mode().Perm() != 0o775 {
		testingObject.Fatalf("created directory mode = %o, want 775", createdInformation.Mode().Perm())
	}
	inspectedEntry, err := client.Inspect(context.Background(), createdDirectory.Path)
	if err != nil {
		testingObject.Fatalf("inspect Movies directory: %v", err)
	}
	if inspectedEntry.Path != createdDirectory.Path || !inspectedEntry.Checked ||
		!inspectedEntry.Empty || !inspectedEntry.Readable {
		testingObject.Fatalf("unexpected inspected directory: %#v", inspectedEntry)
	}

	_, err = client.Create(context.Background(), rootPath, "Movies")
	if CodeOf(err) != ErrorCodeAlreadyExists {
		testingObject.Fatalf("duplicate directory error = %v, want %s", err, ErrorCodeAlreadyExists)
	}

	_, err = client.List(context.Background(), filepath.Join(rootPath, ".."))
	if CodeOf(err) != ErrorCodeInvalidPath {
		testingObject.Fatalf("traversal error = %v, want %s", err, ErrorCodeInvalidPath)
	}

	_, err = client.List(context.Background(), filepath.Join(rootPath, "outside-link"))
	if CodeOf(err) != ErrorCodeInvalidPath {
		testingObject.Fatalf("symlink error = %v, want %s", err, ErrorCodeInvalidPath)
	}

	metainfo, err := client.ReadTorrent(context.Background(), validTorrentPath)
	if err != nil || string(metainfo) != "torrent metainfo" {
		testingObject.Fatalf("read torrent metainfo = %q, %v", metainfo, err)
	}
	v2Metainfo, err := client.ReadTorrent(context.Background(), validV2TorrentPath)
	if err != nil || string(v2Metainfo) != "v2 torrent metainfo" {
		testingObject.Fatalf("read v2 torrent metainfo = %q, %v", v2Metainfo, err)
	}

	invalidTorrentPaths := []struct {
		name     string
		path     string
		wantCode string
	}{
		{
			name:     "outside Transmission root",
			path:     filepath.Join(rootPath, validHash+".torrent"),
			wantCode: ErrorCodeInvalidPath,
		},
		{
			name:     "invalid connection identifier",
			path:     filepath.Join(transmissionRootPath, "default", "torrents", validHash+".torrent"),
			wantCode: ErrorCodeInvalidPath,
		},
		{
			name:     "invalid hash",
			path:     filepath.Join(connectionPath, "not-a-hash.torrent"),
			wantCode: ErrorCodeInvalidPath,
		},
		{
			name:     "symbolic link",
			path:     symlinkTorrentPath,
			wantCode: ErrorCodeInvalidPath,
		},
		{
			name:     "over size cap",
			path:     oversizedTorrentPath,
			wantCode: ErrorCodeFileTooLarge,
		},
	}
	for _, testCase := range invalidTorrentPaths {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			_, err := client.ReadTorrent(context.Background(), testCase.path)
			if CodeOf(err) != testCase.wantCode {
				testingObject.Fatalf("ReadTorrent() error = %v, want %s", err, testCase.wantCode)
			}
		})
	}
	if err := client.Delete(context.Background(), createdDirectory.Path); err != nil {
		testingObject.Fatalf("delete empty Movies directory: %v", err)
	}
	if _, err := os.Lstat(createdDirectory.Path); !os.IsNotExist(err) {
		testingObject.Fatalf("deleted Movies directory still exists: %v", err)
	}

	cancelServe()
	select {
	case err := <-serveErrors:
		if err != nil {
			testingObject.Fatalf("directory server shutdown: %v", err)
		}
	case <-time.After(3 * time.Second):
		testingObject.Fatal("directory server did not stop after cancellation")
	}
}

// TestServerDeletesOnlyEmptyDirectories exercises the non-recursive boundary.
//
// Files, hidden files, child folders, and symbolic links all make a folder nonempty,
// while one genuinely empty child can be removed through its resolved parent.
//
// Since: UNRELEASED
func TestServerDeletesOnlyEmptyDirectories(testingObject *testing.T) {
	server, rootPath := newDirectoryFilesystemTestServer(testingObject)
	emptyPath := filepath.Join(rootPath, "empty")
	if err := os.Mkdir(emptyPath, 0o755); err != nil {
		testingObject.Fatalf("create empty fixture: %v", err)
	}

	fixtures := map[string]func(string) error{
		"file": func(path string) error {
			return os.WriteFile(filepath.Join(path, "content.txt"), []byte("content"), 0o644)
		},
		"hidden file": func(path string) error {
			return os.WriteFile(filepath.Join(path, ".hidden"), []byte("content"), 0o644)
		},
		"subfolder": func(path string) error {
			return os.Mkdir(filepath.Join(path, "child"), 0o755)
		},
		"symbolic link": func(path string) error {
			return os.Symlink(emptyPath, filepath.Join(path, "link"))
		},
	}
	for name, populate := range fixtures {
		testingObject.Run(name, func(testingObject *testing.T) {
			path := filepath.Join(rootPath, strings.ReplaceAll(name, " ", "-"))
			if err := os.Mkdir(path, 0o755); err != nil {
				testingObject.Fatalf("create fixture: %v", err)
			}
			if err := populate(path); err != nil {
				testingObject.Fatalf("populate fixture: %v", err)
			}

			err := server.deleteDirectory(path)
			if CodeOf(err) != ErrorCodeNotEmpty {
				testingObject.Fatalf("deleteDirectory() error = %v, want %s", err, ErrorCodeNotEmpty)
			}
			if _, err := os.Stat(path); err != nil {
				testingObject.Fatalf("nonempty directory was removed: %v", err)
			}
		})
	}

	if err := server.deleteDirectory(emptyPath); err != nil {
		testingObject.Fatalf("delete empty directory: %v", err)
	}
	if _, err := os.Lstat(emptyPath); !os.IsNotExist(err) {
		testingObject.Fatalf("empty directory still exists: %v", err)
	}
}

// TestServerRejectsUnsafeDeletePaths covers path and target validation.
//
// The controller refuses roots, files, missing targets, traversal, unnormalized
// paths, and symbolic links without unlinking anything outside the directory contract.
//
// Since: UNRELEASED
func TestServerRejectsUnsafeDeletePaths(testingObject *testing.T) {
	server, rootPath := newDirectoryFilesystemTestServer(testingObject)
	regularFilePath := filepath.Join(rootPath, "regular-file")
	if err := os.WriteFile(regularFilePath, []byte("content"), 0o644); err != nil {
		testingObject.Fatalf("create regular file: %v", err)
	}
	directoryPath := filepath.Join(rootPath, "directory")
	if err := os.Mkdir(directoryPath, 0o755); err != nil {
		testingObject.Fatalf("create directory fixture: %v", err)
	}
	symlinkPath := filepath.Join(rootPath, "directory-link")
	if err := os.Symlink(directoryPath, symlinkPath); err != nil {
		testingObject.Fatalf("create directory symlink: %v", err)
	}

	testCases := []struct {
		name     string
		path     string
		wantCode string
	}{
		{name: "root", path: rootPath, wantCode: ErrorCodeInvalidPath},
		{name: "regular file", path: regularFilePath, wantCode: ErrorCodeNotDirectory},
		{name: "missing folder", path: filepath.Join(rootPath, "missing"), wantCode: ErrorCodeNotFound},
		{name: "symbolic link", path: symlinkPath, wantCode: ErrorCodeInvalidPath},
		{name: "dot dot", path: "..", wantCode: ErrorCodeInvalidPath},
		{
			name:     "unnormalized",
			path:     rootPath + string(os.PathSeparator) + "directory" + string(os.PathSeparator) + ".." + string(os.PathSeparator) + "directory",
			wantCode: ErrorCodeInvalidPath,
		},
	}
	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			err := server.deleteDirectory(testCase.path)
			if CodeOf(err) != testCase.wantCode {
				testingObject.Fatalf("deleteDirectory() error = %v, want %s", err, testCase.wantCode)
			}
		})
	}

	if _, err := os.Lstat(symlinkPath); err != nil {
		testingObject.Fatalf("symbolic link was removed: %v", err)
	}
	if _, err := os.Stat(directoryPath); err != nil {
		testingObject.Fatalf("symbolic-link target was removed: %v", err)
	}
}

// TestServerListsBoundedDirectoryMetadata checks entry facts for the picker.
//
// Empty means no entry of any kind, and only a real child directory sets
// HasSubfolders; a symbolic link to a directory never counts as one.
//
// Since: UNRELEASED
func TestServerListsBoundedDirectoryMetadata(testingObject *testing.T) {
	server, rootPath := newDirectoryFilesystemTestServer(testingObject)
	emptyPath := filepath.Join(rootPath, "empty")
	fileOnlyPath := filepath.Join(rootPath, "file-only")
	symlinkOnlyPath := filepath.Join(rootPath, "symlink-only")
	subfolderPath := filepath.Join(rootPath, "subfolder")
	unreadablePath := filepath.Join(rootPath, "unreadable")
	for _, path := range []string{emptyPath, fileOnlyPath, symlinkOnlyPath, subfolderPath, unreadablePath} {
		if err := os.Mkdir(path, 0o755); err != nil {
			testingObject.Fatalf("create %s: %v", path, err)
		}
	}
	if err := os.WriteFile(filepath.Join(fileOnlyPath, ".hidden"), []byte("content"), 0o644); err != nil {
		testingObject.Fatalf("create hidden file: %v", err)
	}
	if err := os.Symlink(emptyPath, filepath.Join(symlinkOnlyPath, "folder-link")); err != nil {
		testingObject.Fatalf("create folder symlink: %v", err)
	}
	if err := os.Mkdir(filepath.Join(subfolderPath, "real-child"), 0o755); err != nil {
		testingObject.Fatalf("create real child: %v", err)
	}
	if err := os.Chmod(unreadablePath, 0); err != nil {
		testingObject.Fatalf("remove unreadable permissions: %v", err)
	}
	defer os.Chmod(unreadablePath, 0o755)

	directory, err := server.listDirectory(rootPath)
	if err != nil {
		testingObject.Fatalf("list root: %v", err)
	}
	entries := make(map[string]DirectoryEntry, len(directory.Directories))
	for _, entry := range directory.Directories {
		entries[entry.Name] = entry
	}

	assertDirectoryMetadata(testingObject, entries["empty"], true, false)
	assertDirectoryMetadata(testingObject, entries["file-only"], false, false)
	assertDirectoryMetadata(testingObject, entries["symlink-only"], false, false)
	assertDirectoryMetadata(testingObject, entries["subfolder"], false, true)
	testingObject.Run("unreadable", func(testingObject *testing.T) {
		if os.Geteuid() == 0 {
			testingObject.Skip("root can open mode 0000 directories")
		}
		if entries["unreadable"].Readable {
			testingObject.Fatalf("unreadable entry = %#v, want readable false", entries["unreadable"])
		}
	})
}

// TestServerRefusesPathsOutsideTheStorageRoot covers lexical confinement.
//
// An unrelated absolute path and a similarly prefixed sibling are rejected for
// list, create, and delete without creating or removing anything at either path.
//
// Since: UNRELEASED
func TestServerRefusesPathsOutsideTheStorageRoot(testingObject *testing.T) {
	server, rootPath := newDirectoryFilesystemTestServer(testingObject)
	temporaryDirectory := filepath.Dir(rootPath)
	outsidePath := filepath.Join(temporaryDirectory, "outside")
	siblingPath := rootPath + "-x"
	for _, path := range []string{outsidePath, siblingPath} {
		if err := os.MkdirAll(filepath.Join(path, "victim"), 0o755); err != nil {
			testingObject.Fatalf("create outside fixture %s: %v", path, err)
		}
	}

	testCases := []struct {
		name string
		path string
	}{
		{name: "absolute outside root", path: outsidePath},
		{name: "sibling prefix", path: siblingPath},
	}
	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			if _, err := server.listDirectory(testCase.path); CodeOf(err) != ErrorCodeInvalidPath {
				testingObject.Fatalf("listDirectory() error = %v, want invalid_path", err)
			}
			if _, err := server.createDirectory(testCase.path, "created"); CodeOf(err) != ErrorCodeInvalidPath {
				testingObject.Fatalf("createDirectory() error = %v, want invalid_path", err)
			}
			if err := server.deleteDirectory(filepath.Join(testCase.path, "victim")); CodeOf(err) != ErrorCodeInvalidPath {
				testingObject.Fatalf("deleteDirectory() error = %v, want invalid_path", err)
			}
			if _, err := os.Lstat(filepath.Join(testCase.path, "created")); !os.IsNotExist(err) {
				testingObject.Fatalf("outside folder was created: %v", err)
			}
			if _, err := os.Stat(filepath.Join(testCase.path, "victim")); err != nil {
				testingObject.Fatalf("outside victim was touched: %v", err)
			}
		})
	}
}

// TestServerRefusesSymbolicLinkParentComponents covers every directory action.
//
// A parent link into an outside directory cannot be listed, created beneath, or
// deleted through, and the outside target remains byte-for-byte untouched.
//
// Since: UNRELEASED
func TestServerRefusesSymbolicLinkParentComponents(testingObject *testing.T) {
	server, rootPath := newDirectoryFilesystemTestServer(testingObject)
	outsidePath := filepath.Join(filepath.Dir(rootPath), "outside")
	if err := os.MkdirAll(filepath.Join(outsidePath, "victim"), 0o755); err != nil {
		testingObject.Fatalf("create outside victim: %v", err)
	}
	linkedParentPath := filepath.Join(rootPath, "linked-parent")
	if err := os.Symlink(outsidePath, linkedParentPath); err != nil {
		testingObject.Fatalf("create parent symlink: %v", err)
	}

	if _, err := server.listDirectory(filepath.Join(linkedParentPath, "victim")); CodeOf(err) != ErrorCodeInvalidPath {
		testingObject.Fatalf("list through parent symlink = %v, want invalid_path", err)
	}
	if _, err := server.createDirectory(linkedParentPath, "created"); CodeOf(err) != ErrorCodeInvalidPath {
		testingObject.Fatalf("create through parent symlink = %v, want invalid_path", err)
	}
	if err := server.deleteDirectory(filepath.Join(linkedParentPath, "victim")); CodeOf(err) != ErrorCodeInvalidPath {
		testingObject.Fatalf("delete through parent symlink = %v, want invalid_path", err)
	}
	if _, err := os.Lstat(filepath.Join(outsidePath, "created")); !os.IsNotExist(err) {
		testingObject.Fatalf("outside folder was created: %v", err)
	}
	if _, err := os.Stat(filepath.Join(outsidePath, "victim")); err != nil {
		testingObject.Fatalf("outside victim was removed: %v", err)
	}
}

// TestServerRejectsParentSymlinkSwapsAfterResolution reproduces the reviewed race.
//
// Each operation validates a real parent, then the hook swaps it for an outside
// symlink before the descriptor walk; no operation reaches the outside directory.
//
// Since: UNRELEASED
func TestServerRejectsParentSymlinkSwapsAfterResolution(testingObject *testing.T) {
	operations := []struct {
		name string
		run  func(*Server, string) error
	}{
		{
			name: "list",
			run: func(server *Server, parentPath string) error {
				_, err := server.listDirectory(parentPath)

				return err
			},
		},
		{
			name: "create",
			run: func(server *Server, parentPath string) error {
				_, err := server.createDirectory(parentPath, "created")

				return err
			},
		},
		{
			name: "delete",
			run: func(server *Server, parentPath string) error {
				return server.deleteDirectory(filepath.Join(parentPath, "victim"))
			},
		},
	}

	for _, operation := range operations {
		testingObject.Run(operation.name, func(testingObject *testing.T) {
			server, rootPath := newDirectoryFilesystemTestServer(testingObject)
			parentPath := filepath.Join(rootPath, "parent")
			originalParentPath := filepath.Join(rootPath, "parent-original")
			outsidePath := filepath.Join(filepath.Dir(rootPath), "outside")
			for _, path := range []string{
				filepath.Join(parentPath, "victim"),
				filepath.Join(outsidePath, "victim"),
			} {
				if err := os.MkdirAll(path, 0o755); err != nil {
					testingObject.Fatalf("create race fixture %s: %v", path, err)
				}
			}

			server.afterDirectoryResolution = func(string) {
				server.afterDirectoryResolution = nil
				if err := os.Rename(parentPath, originalParentPath); err != nil {
					testingObject.Fatalf("move validated parent: %v", err)
				}
				if err := os.Symlink(outsidePath, parentPath); err != nil {
					testingObject.Fatalf("swap parent for symlink: %v", err)
				}
			}

			err := operation.run(server, parentPath)
			if CodeOf(err) != ErrorCodeInvalidPath ||
				err.Error() != "Symbolic links cannot be used as download locations." {
				testingObject.Fatalf("operation error = %v, want symbolic-link invalid_path", err)
			}
			if _, err := os.Lstat(filepath.Join(outsidePath, "created")); !os.IsNotExist(err) {
				testingObject.Fatalf("outside folder was created: %v", err)
			}
			if _, err := os.Stat(filepath.Join(outsidePath, "victim")); err != nil {
				testingObject.Fatalf("outside victim was removed: %v", err)
			}
			if _, err := os.Stat(filepath.Join(originalParentPath, "victim")); err != nil {
				testingObject.Fatalf("original victim was removed: %v", err)
			}
		})
	}
}

// TestServerMarksCappedChildScansAsHavingSubfolders checks conservative metadata.
//
// Reaching the configurable per-child entry cap leaves the presence of a real
// subfolder unknown, so the response keeps the expand chevron available.
//
// Since: UNRELEASED
func TestServerMarksCappedChildScansAsHavingSubfolders(testingObject *testing.T) {
	previousLimit := maximumDirectoryEntriesScanned
	maximumDirectoryEntriesScanned = 2
	testingObject.Cleanup(func() {
		maximumDirectoryEntriesScanned = previousLimit
	})

	server, rootPath := newDirectoryFilesystemTestServer(testingObject)
	childPath := filepath.Join(rootPath, "capped")
	if err := os.Mkdir(childPath, 0o755); err != nil {
		testingObject.Fatalf("create capped child: %v", err)
	}
	for index := 0; index < maximumDirectoryEntriesScanned; index++ {
		name := fmt.Sprintf("file-%d", index)
		if err := os.WriteFile(filepath.Join(childPath, name), []byte("content"), 0o644); err != nil {
			testingObject.Fatalf("create capped fixture %s: %v", name, err)
		}
	}

	directory, err := server.listDirectory(rootPath)
	if err != nil {
		testingObject.Fatalf("list capped fixture: %v", err)
	}
	entry := directoryEntryByName(testingObject, directory, "capped")
	if entry.Empty || !entry.HasSubfolders || !entry.Readable || !entry.Checked {
		testingObject.Fatalf("capped entry = %#v, want conservative subfolders", entry)
	}
}

// TestServerUsesEmptinessProbeAfterAggregateBudget checks request accounting.
//
// The first child consumes the total scan budget; the later nonempty child receives
// one probe and conservatively reports possible subfolders without a full scan.
//
// Since: UNRELEASED
func TestServerUsesEmptinessProbeAfterAggregateBudget(testingObject *testing.T) {
	previousLimit := maximumListingEntriesScanned
	maximumListingEntriesScanned = 1
	testingObject.Cleanup(func() {
		maximumListingEntriesScanned = previousLimit
	})

	server, rootPath := newDirectoryFilesystemTestServer(testingObject)
	for _, name := range []string{"first", "second"} {
		childPath := filepath.Join(rootPath, name)
		if err := os.Mkdir(childPath, 0o755); err != nil {
			testingObject.Fatalf("create %s child: %v", name, err)
		}
		if err := os.WriteFile(filepath.Join(childPath, "file"), []byte("content"), 0o644); err != nil {
			testingObject.Fatalf("create %s content: %v", name, err)
		}
	}

	directory, err := server.listDirectory(rootPath)
	if err != nil {
		testingObject.Fatalf("list aggregate-budget fixture: %v", err)
	}
	first := directoryEntryByName(testingObject, directory, "first")
	second := directoryEntryByName(testingObject, directory, "second")
	if first.Empty || first.HasSubfolders || !first.Checked {
		testingObject.Fatalf("fully scanned first entry = %#v", first)
	}
	if second.Empty || !second.HasSubfolders || !second.Checked {
		testingObject.Fatalf("probed second entry = %#v", second)
	}
}

// TestServerMarksChildrenUncheckedAfterTimeBudget checks the deadline state.
//
// A zero test limit deterministically expires before child inspection, leaving the
// folder visible with conservative metadata and Checked false.
//
// Since: UNRELEASED
func TestServerMarksChildrenUncheckedAfterTimeBudget(testingObject *testing.T) {
	previousDuration := maximumDirectoryListingDuration
	maximumDirectoryListingDuration = 0
	testingObject.Cleanup(func() {
		maximumDirectoryListingDuration = previousDuration
	})

	server, rootPath := newDirectoryFilesystemTestServer(testingObject)
	if err := os.Mkdir(filepath.Join(rootPath, "timed-out"), 0o755); err != nil {
		testingObject.Fatalf("create timed-out child: %v", err)
	}

	directory, err := server.listDirectory(rootPath)
	if err != nil {
		testingObject.Fatalf("list timed-out fixture: %v", err)
	}
	entry := directoryEntryByName(testingObject, directory, "timed-out")
	if entry.Checked || entry.Empty || !entry.HasSubfolders || entry.Readable {
		testingObject.Fatalf("timed-out entry = %#v, want unchecked conservative facts", entry)
	}
}

// TestServerOmitsNonUTF8DirectoryNames protects JSON round trips.
//
// A real child whose byte name is not valid UTF-8 remains on disk but never enters
// the controller response that the API must encode as JSON.
//
// Since: UNRELEASED
func TestServerOmitsNonUTF8DirectoryNames(testingObject *testing.T) {
	server, rootPath := newDirectoryFilesystemTestServer(testingObject)
	invalidName := string([]byte{'i', 'n', 'v', 'a', 'l', 'i', 'd', 0xff})
	invalidPath := filepath.Join(rootPath, invalidName)
	if err := os.Mkdir(invalidPath, 0o755); err != nil {
		if errors.Is(err, unix.EILSEQ) {
			testingObject.Skip("host filesystem rejects non-UTF-8 names; Linux exercises this fixture")
		}
		testingObject.Fatalf("create non-UTF-8 child: %v", err)
	}
	if err := os.Mkdir(filepath.Join(rootPath, "valid"), 0o755); err != nil {
		testingObject.Fatalf("create valid child: %v", err)
	}

	directory, err := server.listDirectory(rootPath)
	if err != nil {
		testingObject.Fatalf("list non-UTF-8 fixture: %v", err)
	}
	if len(directory.Directories) != 1 || directory.Directories[0].Name != "valid" {
		testingObject.Fatalf("listed directories = %#v, want only valid", directory.Directories)
	}
	if _, err := os.Stat(invalidPath); err != nil {
		testingObject.Fatalf("non-UTF-8 child was touched: %v", err)
	}
}

// TestServerListsAndDeletesTrailingSpaceDirectoryNames checks minimal deletion names.
//
// Existing folders with trailing spaces remain listable and deletable even though the
// stricter folder-creation validator would refuse creating that name through the API.
//
// Since: UNRELEASED
func TestServerListsAndDeletesTrailingSpaceDirectoryNames(testingObject *testing.T) {
	server, rootPath := newDirectoryFilesystemTestServer(testingObject)
	name := "Season 1 "
	path := filepath.Join(rootPath, name)
	if err := os.Mkdir(path, 0o755); err != nil {
		testingObject.Fatalf("create trailing-space child: %v", err)
	}

	directory, err := server.listDirectory(rootPath)
	if err != nil {
		testingObject.Fatalf("list trailing-space child: %v", err)
	}
	entry := directoryEntryByName(testingObject, directory, name)
	if entry.Path != path || !entry.Checked || !entry.Empty {
		testingObject.Fatalf("trailing-space entry = %#v", entry)
	}
	if err := server.deleteDirectory(path); err != nil {
		testingObject.Fatalf("delete trailing-space child: %v", err)
	}
	if _, err := os.Lstat(path); !os.IsNotExist(err) {
		testingObject.Fatalf("trailing-space child still exists: %v", err)
	}
}

// TestDeleteDirectoryErrorMapsReadOnlyStorage checks the controller code.
//
// EROFS remains distinguishable from ordinary permission errors so the API can
// provide the storage-specific 403 guidance required by the public contract.
//
// Since: UNRELEASED
func TestDeleteDirectoryErrorMapsReadOnlyStorage(testingObject *testing.T) {
	err := deleteDirectoryError(unix.EROFS)
	if CodeOf(err) != ErrorCodeReadOnly {
		testingObject.Fatalf("deleteDirectoryError(EROFS) = %v, want read_only", err)
	}
}

// directoryEntryByName returns one controller entry or fails the test.
//
// Listing-cost tests use this helper so their assertions stay independent from
// unrelated siblings and retain stable failure output.
//
// Since: UNRELEASED
func directoryEntryByName(
	testingObject *testing.T,
	directory Directory,
	name string,
) DirectoryEntry {
	testingObject.Helper()

	for _, entry := range directory.Directories {
		if entry.Name == name {
			return entry
		}
	}

	testingObject.Fatalf("directory %q missing from %#v", name, directory.Directories)

	return DirectoryEntry{}
}

// newDirectoryFilesystemTestServer creates an isolated direct-operation server.
func newDirectoryFilesystemTestServer(testingObject *testing.T) (*Server, string) {
	testingObject.Helper()

	temporaryDirectory := testingObject.TempDir()
	rootPath := filepath.Join(temporaryDirectory, "data")
	transmissionRootPath := filepath.Join(temporaryDirectory, "transmission")
	runtimePath := filepath.Join(temporaryDirectory, "runtime")
	for _, path := range []string{rootPath, transmissionRootPath, runtimePath} {
		if err := os.MkdirAll(path, 0o755); err != nil {
			testingObject.Fatalf("create server path %s: %v", path, err)
		}
	}

	server, err := NewServer(ServerConfig{
		RootPath:             rootPath,
		TransmissionRootPath: transmissionRootPath,
		SocketPath:           filepath.Join(runtimePath, "directory.sock"),
		MarkerPath:           filepath.Join(runtimePath, "directory.ready"),
		Logger:               slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	if err != nil {
		testingObject.Fatalf("create direct-operation server: %v", err)
	}

	return server, rootPath
}

// assertDirectoryMetadata compares the bounded listing facts for one child.
//
// Ordinary fixtures must be readable and checked in addition to matching the expected
// emptiness and real-subfolder values.
//
// Since: UNRELEASED
func assertDirectoryMetadata(
	testingObject *testing.T,
	entry DirectoryEntry,
	wantEmpty bool,
	wantSubfolders bool,
) {
	testingObject.Helper()

	if entry.Name == "" || !entry.Readable || !entry.Checked || entry.Empty != wantEmpty ||
		entry.HasSubfolders != wantSubfolders {
		testingObject.Fatalf(
			"entry = %#v, want empty %t and hasSubfolders %t",
			entry,
			wantEmpty,
			wantSubfolders,
		)
	}
}

// waitForSocket waits briefly for the asynchronous Unix listener to publish.
//
// Failure reports the exact socket path so local-protocol startup regressions remain
// straightforward to diagnose.
func waitForSocket(
	testingObject *testing.T,
	socketPath string,
	serveErrors <-chan error,
) {
	testingObject.Helper()

	for attempt := 0; attempt < 100; attempt++ {
		if _, err := os.Stat(socketPath); err == nil {
			return
		}
		select {
		case err := <-serveErrors:
			testingObject.Fatalf("directory server startup: %v", err)
		default:
		}

		time.Sleep(10 * time.Millisecond)
	}

	testingObject.Fatalf("directory socket was not created: %s", socketPath)
}
