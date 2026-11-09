package directorybrowser

import (
	"errors"
	"fmt"
)

// ProtocolVersion is the exact API-to-directory-controller contract version.
//
// Both processes ship together, but explicit versioning makes a mismatched local
// component fail closed instead of interpreting filesystem requests incorrectly.
//
// Since: UNRELEASED
const ProtocolVersion = 3

const (
	// ErrorCodeAlreadyExists identifies a requested directory that already exists.
	ErrorCodeAlreadyExists = "already_exists"

	// ErrorCodeBusy identifies a directory that the filesystem cannot remove in place.
	//
	// The deletion contract uses this code for mount points and other folders whose
	// filesystem refuses removal even when their contents appear empty.
	//
	// Since: UNRELEASED
	ErrorCodeBusy = "busy"

	// ErrorCodeInternal identifies an unexpected controller failure.
	ErrorCodeInternal = "internal"

	// ErrorCodeInvalidName identifies a folder name that cannot be created safely.
	ErrorCodeInvalidName = "invalid_name"

	// ErrorCodeInvalidPath identifies a path outside the approved root or through a symlink.
	ErrorCodeInvalidPath = "invalid_path"

	// ErrorCodeFileTooLarge identifies a torrent metainfo file over the fixed read cap.
	ErrorCodeFileTooLarge = "file_too_large"

	// ErrorCodeNotDirectory identifies an existing path that is not a directory.
	ErrorCodeNotDirectory = "not_directory"

	// ErrorCodeNotEmpty identifies a directory that still contains an entry.
	//
	// Callers map this rejection to the non-recursive picker message instead of
	// exposing the operating system's unlink error to the browser.
	//
	// Since: UNRELEASED
	ErrorCodeNotEmpty = "not_empty"

	// ErrorCodeNotFound identifies a directory that does not exist.
	ErrorCodeNotFound = "not_found"

	// ErrorCodePermissionDenied identifies a filesystem permission failure.
	ErrorCodePermissionDenied = "permission_denied"

	// ErrorCodeReadOnly identifies storage that refuses directory removal.
	//
	// Delete callers use this distinct code to explain that the mounted data
	// storage must be made writable before the folder can be removed.
	//
	// Since: UNRELEASED
	ErrorCodeReadOnly = "read_only"
)

// Request is one narrow directory operation sent over the local Unix socket.
//
// The contract intentionally has no generic filesystem action, recursive
// operation, or caller-controlled root path. Its only file read is torrent metainfo,
// and its only deletion removes one empty folder.
//
// Since: UNRELEASED
type Request struct {
	Version int    `json:"version"`
	Action  string `json:"action"`
	Path    string `json:"path"`
	Name    string `json:"name,omitempty"`
}

// DirectoryEntry describes one immediate child directory available for navigation.
//
// Files and symbolic links never enter this response, keeping the UI focused on safe
// destination selection beneath the configured storage root.
//
// Since: UNRELEASED
type DirectoryEntry struct {
	Name          string `json:"name"`
	Path          string `json:"path"`
	Empty         bool   `json:"empty"`
	HasSubfolders bool   `json:"hasSubfolders"`
	Readable      bool   `json:"readable"`
	MountPoint    bool   `json:"mountPoint"`

	// Checked reports whether the listing opened this child before its deadline.
	//
	// False keeps timed-out children visible with conservative facts while letting
	// the API apply the dedicated unchecked deletion rule.
	//
	// Since: UNRELEASED
	Checked bool `json:"checked"`
}

// Directory describes one browsable directory and its immediate children.
//
// ParentPath is omitted at the approved root so clients cannot navigate above it.
type Directory struct {
	Path        string           `json:"path"`
	ParentPath  string           `json:"parentPath,omitempty"`
	Directories []DirectoryEntry `json:"directories"`
}

// Response reports the result of one directory-controller operation.
//
// Error codes remain stable for HTTP mapping while messages are safe to show in the
// first-party interface.
//
// Since: UNRELEASED
type Response struct {
	OK        bool       `json:"ok"`
	Directory *Directory `json:"directory,omitempty"`

	// Entry carries the result of one exact inspect action.
	//
	// Keeping it separate from Directory prevents DELETE preflight from requiring a
	// synthetic parent listing or scanning unrelated siblings.
	//
	// Since: UNRELEASED
	Entry     *DirectoryEntry `json:"entry,omitempty"`
	Torrent   []byte          `json:"torrent,omitempty"`
	ErrorCode string          `json:"errorCode,omitempty"`
	Error     string          `json:"error,omitempty"`
}

// OperationError is a stable, display-safe rejection from the directory controller.
//
// API handlers inspect Code to select an HTTP status without depending on brittle
// message text or exposing operating-system error details.
type OperationError struct {
	Code    string
	Message string
}

// Error implements the error interface for a rejected directory operation.
//
// A fallback protects callers from accidentally returning an empty error message.
func (operationError *OperationError) Error() string {
	if operationError.Message == "" {
		return "The directory operation failed."
	}

	return operationError.Message
}

// CodeOf returns a stable directory-controller code when one is available.
//
// Transport and unexpected failures intentionally return an empty code so the HTTP
// layer can distinguish controller availability from a validated rejection.
func CodeOf(err error) string {
	var operationError *OperationError
	if errors.As(err, &operationError) {
		return operationError.Code
	}

	return ""
}

// newOperationError constructs one stable controller rejection.
//
// Central construction keeps internal filesystem details out of response messages.
func newOperationError(code string, format string, values ...any) *OperationError {
	return &OperationError{
		Code:    code,
		Message: fmt.Sprintf(format, values...),
	}
}
