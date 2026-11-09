//go:build !linux

package main

import "syscall"

// childProcessAttributes preserves process-group behavior on development platforms.
func childProcessAttributes() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{Setpgid: true}
}
