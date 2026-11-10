//go:build !linux

package controller

import (
	"errors"
	"syscall"
)

// markSocket fails outside Linux, which is the only place the controller runs.
func markSocket(_ string, _ string, _ syscall.RawConn) error {
	return errors.New("marking a socket needs Linux")
}
