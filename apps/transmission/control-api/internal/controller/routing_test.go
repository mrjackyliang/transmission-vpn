package controller

import (
	"context"
	"errors"
	"strings"
	"testing"
)

// TestPermanentSlotRoutingCommands verifies the fixed address, rule, and fallback.
func TestPermanentSlotRoutingCommands(testingObject *testing.T) {
	commands := []string{}
	run := func(_ context.Context, _ string, arguments ...string) ([]byte, error) {
		command := strings.Join(arguments, " ")
		commands = append(commands, command)
		if command == "-4 rule show priority 1003" {
			return []byte("1003: from 10.68.3.2 lookup 1003\n"), nil
		}

		return nil, nil
	}
	if err := installPermanentSlotRouting(
		context.Background(),
		run,
		"/sbin/ip",
		3,
	); err != nil {
		testingObject.Fatalf("install permanent slot routing: %v", err)
	}
	want := []string{
		"-4 address replace 198.18.3.1/32 dev lo",
		"-4 rule show priority 1003",
		"-4 rule del priority 1003",
		"-4 rule add from 198.18.3.1/32 lookup 1003 priority 1003",
		"-4 route replace unreachable default metric 4294967295 table 1003",
	}
	if strings.Join(commands, "\n") != strings.Join(want, "\n") {
		testingObject.Fatalf("commands = %v, want %v", commands, want)
	}
}

// TestPermanentSlotRoutingIsIdempotent retains one already-correct source rule.
func TestPermanentSlotRoutingIsIdempotent(testingObject *testing.T) {
	commands := []string{}
	run := func(_ context.Context, _ string, arguments ...string) ([]byte, error) {
		command := strings.Join(arguments, " ")
		commands = append(commands, command)
		if command == "-4 rule show priority 1000" {
			return []byte("1000: from 198.18.0.1 lookup 1000\n"), nil
		}

		return nil, nil
	}
	if err := installPermanentSlotRouting(
		context.Background(),
		run,
		"/sbin/ip",
		0,
	); err != nil {
		testingObject.Fatalf("repeat permanent slot routing: %v", err)
	}
	joined := strings.Join(commands, "\n")
	if strings.Contains(joined, "rule del") || strings.Contains(joined, "rule add") {
		testingObject.Fatalf("correct permanent rule was replaced:\n%s", joined)
	}
}

// TestSessionRouteLifecyclePreservesPermanentPolicy rejects broad table teardown.
func TestSessionRouteLifecyclePreservesPermanentPolicy(testingObject *testing.T) {
	commands := []string{}
	run := func(_ context.Context, _ string, arguments ...string) ([]byte, error) {
		command := strings.Join(arguments, " ")
		commands = append(commands, command)
		if strings.Contains(command, "route del") {
			return []byte("RTNETLINK answers: No such process"), errors.New("exit status 2")
		}

		return nil, nil
	}
	if err := installSessionRoute(
		context.Background(),
		run,
		"/sbin/ip",
		"wg3",
		3,
	); err != nil {
		testingObject.Fatalf("install session route: %v", err)
	}
	if err := removeSessionRoute(
		context.Background(),
		run,
		"/sbin/ip",
		"wg3",
		3,
	); err != nil {
		testingObject.Fatalf("remove session route: %v", err)
	}
	want := []string{
		"-4 route replace default dev wg3 metric 0 table 1003",
		"-4 route del default dev wg3 metric 0 table 1003",
	}
	if strings.Join(commands, "\n") != strings.Join(want, "\n") {
		testingObject.Fatalf("session commands = %v, want %v", commands, want)
	}
}
