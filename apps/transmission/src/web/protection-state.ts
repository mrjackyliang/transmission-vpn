import type { Web_Api_LiveSnapshot } from '@/types/web/api.d.ts';
import type { Web_Components_Protection } from '@/types/web/components.d.ts';

// displayProtectionState overlays the VPN controller's transitional state on the
// appliance's fail-closed protection state. The latter intentionally remains blocked
// while a connection is being established, so it cannot name those transitions itself.

/**
 * Protection State - Display protection state.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const displayProtectionState = (snapshot: Web_Api_LiveSnapshot | null): string => {
  const vpnState: string = snapshot?.vpn?.state.toLowerCase() ?? '';
  if (vpnState === 'connecting' || vpnState === 'reconnecting') {
    return vpnState;
  }

  return snapshot?.status?.protectionState.toLowerCase() ?? 'blocked';
};

/**
 * Protection State - Describe protection.
 *
 * Reduces the appliance's connection state to the label, detail, and tone used
 * by the shared shell's desktop status card and phone status pill.
 *
 * @param {Web_Api_LiveSnapshot | null} snapshot - Snapshot.
 *
 * @returns {Web_Components_Protection}
 *
 * @since 2.0.0
 */
export const describeProtection = (
  snapshot: Web_Api_LiveSnapshot | null,
): Web_Components_Protection => {
  if (snapshot === null) {
    return {
      detail: 'Waiting for status…',
      label: 'Connecting',
      tone: 'connecting',
    };
  }

  const protection = snapshot['protection'];
  const enabledCount: number = protection['enabledCount'];
  const protectedCount: number = protection['protectedCount'];

  if (enabledCount > 0 && protectedCount === enabledCount) {
    return {
      detail: 'All connections are protected',
      label: `${protectedCount} ${(protectedCount === 1) ? 'VPN' : 'VPNs'} protected`,
      tone: 'protected',
    };
  }

  if (protectedCount > 0) {
    const troubledConnection = snapshot['connections'].find((connection): boolean => (
      connection['enabled'] && connection['state'] !== 'protected'
    ));
    const troubledState: string = troubledConnection?.['state'] ?? 'blocked';

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
