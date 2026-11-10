//go:build linux

package controller

import (
	"fmt"
	"syscall"

	"github.com/mrjackyliang/transmission-vpn/apps/transmission/control-api/internal/directdial"
)

// markSocket puts the controller's mark on one socket before it connects.
//
// The firewall lets only marked packets leave over the container's own network, and
// the controller is the only process with the capability to set the mark.
func markSocket(_ string, _ string, rawConnection syscall.RawConn) error {
	var markError error
	if err := rawConnection.Control(func(descriptor uintptr) {
		markError = syscall.SetsockoptInt(
			int(descriptor),
			syscall.SOL_SOCKET,
			syscall.SO_MARK,
			directdial.Mark,
		)
	}); err != nil {
		return fmt.Errorf("reach the socket to mark it: %w", err)
	}
	if markError != nil {
		return fmt.Errorf("mark the controller's socket: %w", markError)
	}

	return nil
}
