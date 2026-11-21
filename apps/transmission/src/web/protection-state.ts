import type {
  Web_ProtectionState_DescribeProtection_EnabledCount,
  Web_ProtectionState_DescribeProtection_ProtectedCount,
  Web_ProtectionState_DescribeProtection_Protection,
  Web_ProtectionState_DescribeProtection_Returns,
  Web_ProtectionState_DescribeProtection_Snapshot,
  Web_ProtectionState_DescribeProtection_TroubledConnection,
  Web_ProtectionState_DescribeProtection_TroubledState,
  Web_ProtectionState_DescribeProtection_VpnNoun,
  Web_ProtectionState_DisplayProtectionState_Returns,
  Web_ProtectionState_DisplayProtectionState_Snapshot,
  Web_ProtectionState_DisplayProtectionState_Status,
  Web_ProtectionState_DisplayProtectionState_Vpn,
  Web_ProtectionState_DisplayProtectionState_VpnState,
} from '@/types/web/protection-state.d.ts';

// displayProtectionState overlays the VPN controller's transitional state on the
// appliance's fail-closed protection state. The latter intentionally remains blocked
// while a connection is being established, so it cannot name those transitions itself.

/**
 * Protection State - Display Protection State.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_ProtectionState_DisplayProtectionState_Snapshot} snapshot - Snapshot.
 *
 * @returns {Web_ProtectionState_DisplayProtectionState_Returns}
 *
 * @since 2.0.0
 */
export const displayProtectionState = (snapshot: Web_ProtectionState_DisplayProtectionState_Snapshot): Web_ProtectionState_DisplayProtectionState_Returns => {
  const vpn: Web_ProtectionState_DisplayProtectionState_Vpn = (snapshot !== null) ? snapshot['vpn'] : undefined;
  const vpnState: Web_ProtectionState_DisplayProtectionState_VpnState = (vpn !== undefined) ? vpn['state'].toLowerCase() : '';

  if (vpnState === 'connecting' || vpnState === 'reconnecting') {
    return vpnState;
  }

  const status: Web_ProtectionState_DisplayProtectionState_Status = (snapshot !== null) ? snapshot['status'] : undefined;

  return (status !== undefined) ? status['protectionState'].toLowerCase() : 'blocked';
};

/**
 * Protection State - Describe Protection.
 *
 * Reduces the appliance's connection state to the label, detail, and tone used
 * by the shared shell's desktop status card and phone status pill.
 *
 * @param {Web_ProtectionState_DescribeProtection_Snapshot} snapshot - Snapshot.
 *
 * @returns {Web_ProtectionState_DescribeProtection_Returns}
 *
 * @since 2.0.0
 */
export const describeProtection = (
  snapshot: Web_ProtectionState_DescribeProtection_Snapshot,
): Web_ProtectionState_DescribeProtection_Returns => {
  if (snapshot === null) {
    return {
      detail: 'Waiting for status…',
      label: 'Connecting',
      tone: 'connecting',
    };
  }

  const protection: Web_ProtectionState_DescribeProtection_Protection = snapshot['protection'];
  const enabledCount: Web_ProtectionState_DescribeProtection_EnabledCount = protection['enabledCount'];
  const protectedCount: Web_ProtectionState_DescribeProtection_ProtectedCount = protection['protectedCount'];

  if (enabledCount > 0 && protectedCount === enabledCount) {
    const vpnNoun: Web_ProtectionState_DescribeProtection_VpnNoun = (protectedCount === 1) ? 'VPN' : 'VPNs';

    return {
      detail: 'All connections are protected',
      label: `${protectedCount} ${vpnNoun} protected`,
      tone: 'protected',
    };
  }

  if (protectedCount > 0) {
    const troubledConnection: Web_ProtectionState_DescribeProtection_TroubledConnection = snapshot['connections'].find((connection) => (
      connection['enabled'] === true && connection['state'] !== 'protected'
    ));
    const troubledState: Web_ProtectionState_DescribeProtection_TroubledState = (troubledConnection !== undefined) ? troubledConnection['state'] : 'blocked';

    return {
      detail: (troubledConnection === undefined) ? 'One or more connections need attention' : `${troubledConnection['name']} is ${troubledState}`,
      label: `${protectedCount} of ${enabledCount} VPNs protected`,
      tone: 'partial',
    };
  }

  return {
    detail: 'Torrent traffic is blocked',
    label: 'No VPN protected',
    tone: 'blocked',
  };
};
