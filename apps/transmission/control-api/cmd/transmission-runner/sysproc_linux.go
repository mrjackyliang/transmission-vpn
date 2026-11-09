//go:build linux

package main

import "syscall"

// childProcessAttributes keeps the daemon in its own group and ties it to the runner.
func childProcessAttributes() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{
		Setpgid:   true,
		Pdeathsig: syscall.SIGTERM,
	}
}
