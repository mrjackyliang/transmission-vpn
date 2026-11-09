import type { Web_Api_WebProxyState } from '@/types/web/api.d.ts';

/**
 * Proxy Transition.
 *
 * @since UNRELEASED
 */
export type Web_ProxyTransition_Status_RequestedEnabled = boolean;
export type Web_ProxyTransition_Status_ReportedState = Web_Api_WebProxyState;
export type Web_ProxyTransition_Status_ElapsedMilliseconds = number;
export type Web_ProxyTransition_Status_Returns = 'busy' | 'settled' | 'timed-out';
