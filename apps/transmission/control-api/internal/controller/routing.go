package controller

import (
	"context"
	"fmt"
	"net/netip"
	"strconv"
	"strings"
)

const (
	minimumConnectionSlot    = 0
	maximumConnectionSlot    = 63
	firstRoutingTable        = 1000
	resolverRouteProtocol    = "211"
	maximumUnreachableMetric = "4294967295"
)

// networkCommandRunner executes one direct networking command without a shell.
//
// Drivers replace it in tests so route ownership can be asserted without requiring
// network privileges or mutating the host routing policy.
type networkCommandRunner func(
	ctx context.Context,
	name string,
	arguments ...string,
) ([]byte, error)

// connectionRoutingTable maps one durable slot to its private route table and rule.
func connectionRoutingTable(slot int) int {
	return firstRoutingTable + slot
}

// connectionLocalAddress returns the fixed source address owned by one slot.
//
// The closed slot range is validated at every external boundary. Internal lifecycle
// code can therefore use this deterministic mapping without another failure path.
func connectionLocalAddress(slot int) string {
	return fmt.Sprintf("198.18.%d.1", slot)
}

// installPermanentSlotRouting makes one slot fail closed before any tunnel starts.
//
// The loopback address, source rule, and unreachable fallback survive connection
// changes. Existing correct state is retained, while an obsolete E2 rule at the same
// priority is replaced without touching any other slot.
func installPermanentSlotRouting(
	ctx context.Context,
	run networkCommandRunner,
	ipPath string,
	slot int,
) error {
	if slot < minimumConnectionSlot || slot > maximumConnectionSlot {
		return fmt.Errorf(
			"VPN connection slot must be between %d and %d",
			minimumConnectionSlot,
			maximumConnectionSlot,
		)
	}

	table := strconv.Itoa(connectionRoutingTable(slot))
	localPrefix := connectionLocalAddress(slot) + "/32"
	if output, err := run(
		ctx,
		ipPath,
		"-4",
		"address",
		"replace",
		localPrefix,
		"dev",
		"lo",
	); err != nil {
		return fmt.Errorf(
			"install VPN slot %d loopback address: %w: %s",
			slot,
			err,
			strings.TrimSpace(string(output)),
		)
	}

	ruleOutput, err := run(ctx, ipPath, "-4", "rule", "show", "priority", table)
	if err != nil {
		return fmt.Errorf(
			"inspect VPN slot %d source rule: %w: %s",
			slot,
			err,
			strings.TrimSpace(string(ruleOutput)),
		)
	}
	ruleLines := nonemptyLines(string(ruleOutput))
	if !containsPermanentSlotRule(ruleLines, localPrefix, table) || len(ruleLines) != 1 {
		for range ruleLines {
			output, deleteError := run(ctx, ipPath, "-4", "rule", "del", "priority", table)
			if deleteError != nil && !missingNetworkState(output, deleteError) {
				return fmt.Errorf(
					"replace VPN slot %d source rule: %w: %s",
					slot,
					deleteError,
					strings.TrimSpace(string(output)),
				)
			}
		}

		if output, addError := run(
			ctx,
			ipPath,
			"-4",
			"rule",
			"add",
			"from",
			localPrefix,
			"lookup",
			table,
			"priority",
			table,
		); addError != nil {
			return fmt.Errorf(
				"install VPN slot %d source rule: %w: %s",
				slot,
				addError,
				strings.TrimSpace(string(output)),
			)
		}
	}

	if output, err := run(
		ctx,
		ipPath,
		"-4",
		"route",
		"replace",
		"unreachable",
		"default",
		"metric",
		maximumUnreachableMetric,
		"table",
		table,
	); err != nil {
		return fmt.Errorf(
			"install VPN slot %d unreachable route: %w: %s",
			slot,
			err,
			strings.TrimSpace(string(output)),
		)
	}

	return nil
}

// installSessionRoute adds only the usable default for a live tunnel.
//
// The permanent unreachable route remains underneath this metric-zero route, so a
// removed or failed tunnel cannot make slot traffic fall through to the main table.
func installSessionRoute(
	ctx context.Context,
	run networkCommandRunner,
	ipPath string,
	interfaceName string,
	slot int,
) error {
	if slot < minimumConnectionSlot || slot > maximumConnectionSlot {
		return fmt.Errorf(
			"VPN connection slot must be between %d and %d",
			minimumConnectionSlot,
			maximumConnectionSlot,
		)
	}

	table := strconv.Itoa(connectionRoutingTable(slot))
	if output, err := run(
		ctx,
		ipPath,
		"-4",
		"route",
		"replace",
		"default",
		"dev",
		interfaceName,
		"metric",
		"0",
		"table",
		table,
	); err != nil {
		return fmt.Errorf(
			"add VPN routing table %s: %w: %s",
			table,
			err,
			strings.TrimSpace(string(output)),
		)
	}

	return nil
}

// removeSessionRoute removes one tunnel default without changing permanent slot state.
//
// Missing state is harmless during restart cleanup. The loopback address, source rule,
// and unreachable route remain installed for the controller's lifetime.
func removeSessionRoute(
	ctx context.Context,
	run networkCommandRunner,
	ipPath string,
	interfaceName string,
	slot int,
) error {
	if slot < minimumConnectionSlot || slot > maximumConnectionSlot {
		return fmt.Errorf(
			"VPN connection slot must be between %d and %d",
			minimumConnectionSlot,
			maximumConnectionSlot,
		)
	}

	table := strconv.Itoa(connectionRoutingTable(slot))
	output, err := run(
		ctx,
		ipPath,
		"-4",
		"route",
		"del",
		"default",
		"dev",
		interfaceName,
		"metric",
		"0",
		"table",
		table,
	)
	if err != nil && !missingNetworkState(output, err) {
		return fmt.Errorf(
			"remove VPN routing table %s default: %w: %s",
			table,
			err,
			strings.TrimSpace(string(output)),
		)
	}

	return nil
}

// containsPermanentSlotRule checks one ip-rule listing for the exact slot selector.
func containsPermanentSlotRule(lines []string, localPrefix string, table string) bool {
	localAddress := strings.TrimSuffix(localPrefix, "/32")
	for _, line := range lines {
		fields := strings.Fields(strings.ReplaceAll(line, ":", " "))
		fromAddress := ""
		lookupTable := ""
		for index := 0; index+1 < len(fields); index++ {
			switch fields[index] {
			case "from":
				fromAddress = fields[index+1]
			case "lookup":
				lookupTable = fields[index+1]
			}
		}
		if (fromAddress == localPrefix || fromAddress == localAddress) && lookupTable == table {
			return true
		}
	}

	return false
}

// nonemptyLines returns trimmed command-output records without blank entries.
func nonemptyLines(output string) []string {
	lines := []string{}
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			lines = append(lines, line)
		}
	}

	return lines
}

// validProviderAddress normalizes the tunnel address used only for status and SNAT.
func validProviderAddress(address string) (string, error) {
	parsedAddress, err := netip.ParseAddr(address)
	if err != nil || !parsedAddress.Is4() {
		return "", fmt.Errorf("tunnel address is not IPv4: %s", address)
	}

	return parsedAddress.Unmap().String(), nil
}

// missingNetworkState identifies idempotent iproute2 cleanup failures.
func missingNetworkState(output []byte, err error) bool {
	if err == nil {
		return false
	}

	message := strings.ToLower(string(output) + " " + err.Error())

	return strings.Contains(message, "no such file") ||
		strings.Contains(message, "no such process") ||
		strings.Contains(message, "cannot find") ||
		strings.Contains(message, "not found")
}
