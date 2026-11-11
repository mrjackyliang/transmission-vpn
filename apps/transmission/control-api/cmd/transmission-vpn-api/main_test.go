package main

import (
	"errors"
	"fmt"
	"net"
	"os"
	"syscall"
	"testing"
)

// controllerDialError builds the error chain a restore returns when the controller's
// socket cannot be dialed.
func controllerDialError(errno syscall.Errno) error {
	dialError := &net.OpError{
		Op:  "dial",
		Net: "unix",
		Err: os.NewSyscallError("connect", errno),
	}

	return fmt.Errorf(
		"read VPN controller status before restoring %q: %w",
		"vpc-1",
		fmt.Errorf("connect to VPN controller: %w", dialError),
	)
}

// TestControllerStarting separates a controller that is still starting from real
// restore failures, which keep their warning.
func TestControllerStarting(testingObject *testing.T) {
	testCases := []struct {
		name string
		err  error
		want bool
	}{
		{name: "missing socket", err: controllerDialError(syscall.ENOENT), want: true},
		{name: "nobody listening", err: controllerDialError(syscall.ECONNREFUSED), want: true},
		{
			name: "joined with another connection's failure",
			err:  errors.Join(errors.New("provider outage"), controllerDialError(syscall.ENOENT)),
			want: true,
		},
		{name: "permission denied", err: controllerDialError(syscall.EACCES), want: false},
		{name: "not a dial failure", err: errors.New("read VPN connection: database is locked"), want: false},
		{
			name: "missing file outside a dial",
			err:  fmt.Errorf("read profile: %w", os.NewSyscallError("open", syscall.ENOENT)),
			want: false,
		},
		{name: "no error", err: nil, want: false},
	}

	for _, testCase := range testCases {
		testingObject.Run(testCase.name, func(testingObject *testing.T) {
			if got := controllerStarting(testCase.err); got != testCase.want {
				testingObject.Fatalf("controllerStarting() = %t, want %t", got, testCase.want)
			}
		})
	}
}
