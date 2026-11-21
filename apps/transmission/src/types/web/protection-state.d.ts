import type {
  Web_Api_LiveSnapshot,
  Web_Api_LiveVpnConnection,
  Web_Api_Status,
  Web_Api_VpnProtection,
  Web_Api_VpnStatus,
} from '@/types/web/api.d.ts';
import type { Web_Components_Protection } from '@/types/web/components.d.ts';

/**
 * Protection State.
 *
 * @since 2.4.1
 */
export type Web_ProtectionState_DescribeProtection_Snapshot = Web_Api_LiveSnapshot | null;
export type Web_ProtectionState_DescribeProtection_Returns = Web_Components_Protection;
export type Web_ProtectionState_DescribeProtection_Protection = Web_Api_VpnProtection;
export type Web_ProtectionState_DescribeProtection_EnabledCount = number;
export type Web_ProtectionState_DescribeProtection_ProtectedCount = number;
export type Web_ProtectionState_DescribeProtection_VpnNoun = string;
export type Web_ProtectionState_DescribeProtection_TroubledConnection = Web_Api_LiveVpnConnection | undefined;
export type Web_ProtectionState_DescribeProtection_TroubledState = string;

/**
 * Protection State.
 *
 * @since 2.4.1
 */
export type Web_ProtectionState_DisplayProtectionState_Snapshot = Web_Api_LiveSnapshot | null;
export type Web_ProtectionState_DisplayProtectionState_Returns = string;
export type Web_ProtectionState_DisplayProtectionState_Vpn = Web_Api_VpnStatus | undefined;
export type Web_ProtectionState_DisplayProtectionState_VpnState = string;
export type Web_ProtectionState_DisplayProtectionState_Status = Web_Api_Status | undefined;
