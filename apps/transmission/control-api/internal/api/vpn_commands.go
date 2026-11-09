package api

import (
	"context"
	"errors"
	"sync"
)

// ErrVPNRestoreDeferred reports that the startup restore stepped aside for an
// administrator's VPN change and should try again later.
var ErrVPNRestoreDeferred = errors.New("an administrator's VPN change is running")

// vpnCommandGate serializes commands only where their controller state overlaps.
//
// Commands for different connections may run together. A global create, delete, or
// default change blocks new commands and waits for existing commands and restores.
// Administrator work cancels an overlapping background restore before waiting for it.
type vpnCommandGate struct {
	mutex       sync.Mutex
	condition   *sync.Cond
	global      bool
	commands    map[string]struct{}
	restores    map[string]context.CancelFunc
	restoreRuns map[string]struct{}
}

// begin retains the legacy all-connections claim used by focused gate tests.
func (gate *vpnCommandGate) begin() (func(), bool) {
	return gate.beginGlobal()
}

// beginGlobal claims all connections and waits for active per-connection work.
func (gate *vpnCommandGate) beginGlobal() (func(), bool) {
	gate.lock()
	if gate.global {
		gate.mutex.Unlock()

		return nil, false
	}
	gate.global = true
	for _, cancel := range gate.restores {
		cancel()
	}
	for len(gate.commands) > 0 || len(gate.restoreRuns) > 0 {
		gate.condition.Wait()
	}
	gate.mutex.Unlock()

	return func() {
		gate.lock()
		gate.global = false
		gate.condition.Broadcast()
		gate.mutex.Unlock()
	}, true
}

// beginConnection claims one connection without blocking unrelated changes.
func (gate *vpnCommandGate) beginConnection(connectionID string) (func(), bool) {
	gate.lock()
	if gate.global {
		gate.mutex.Unlock()

		return nil, false
	}
	if _, running := gate.commands[connectionID]; running {
		gate.mutex.Unlock()

		return nil, false
	}
	gate.commands[connectionID] = struct{}{}
	if cancel := gate.restores[connectionID]; cancel != nil {
		cancel()
	}
	for {
		if _, running := gate.restoreRuns[connectionID]; !running {
			break
		}
		gate.condition.Wait()
	}
	gate.mutex.Unlock()

	return func() {
		gate.lock()
		delete(gate.commands, connectionID)
		gate.condition.Broadcast()
		gate.mutex.Unlock()
	}, true
}

// beginRestore retains the single-connection signature used by earlier tests.
func (gate *vpnCommandGate) beginRestore(ctx context.Context) (context.Context, func(), bool) {
	return gate.beginConnectionRestore(ctx, "")
}

// beginConnectionRestore claims one connection for a background restore.
func (gate *vpnCommandGate) beginConnectionRestore(
	ctx context.Context,
	connectionID string,
) (context.Context, func(), bool) {
	gate.lock()
	if gate.global {
		gate.mutex.Unlock()

		return nil, nil, false
	}
	if _, running := gate.commands[connectionID]; running {
		gate.mutex.Unlock()

		return nil, nil, false
	}
	if _, running := gate.restoreRuns[connectionID]; running {
		gate.mutex.Unlock()

		return nil, nil, false
	}

	restoreContext, cancel := context.WithCancel(ctx)
	gate.restores[connectionID] = cancel
	gate.restoreRuns[connectionID] = struct{}{}
	gate.mutex.Unlock()

	return restoreContext, func() {
		gate.lock()
		delete(gate.restores, connectionID)
		delete(gate.restoreRuns, connectionID)
		gate.condition.Broadcast()
		gate.mutex.Unlock()
		cancel()
	}, true
}

// running reports whether any administrator VPN change is in progress.
func (gate *vpnCommandGate) running() bool {
	gate.lock()
	defer gate.mutex.Unlock()

	return gate.global || len(gate.commands) > 0
}

// globalRunning reports whether an all-connections change owns the gate.
func (gate *vpnCommandGate) globalRunning() bool {
	gate.lock()
	defer gate.mutex.Unlock()

	return gate.global
}

// connectionRunning reports whether a connection or global change is in progress.
func (gate *vpnCommandGate) connectionRunning(connectionID string) bool {
	gate.lock()
	defer gate.mutex.Unlock()

	_, running := gate.commands[connectionID]

	return gate.global || running
}

func (gate *vpnCommandGate) lock() {
	gate.mutex.Lock()
	if gate.condition == nil {
		gate.condition = sync.NewCond(&gate.mutex)
		gate.commands = map[string]struct{}{}
		gate.restores = map[string]context.CancelFunc{}
		gate.restoreRuns = map[string]struct{}{}
	}
}
