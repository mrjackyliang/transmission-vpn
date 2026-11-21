import type { Web_Api_WebProxyState } from '@/types/web/api.d.ts';

/**
 * Proxy Transition.
 *
 * @since 2.0.0
 */
export type Web_ProxyTransition_ProxyTransitionStatus_RequestedEnabled = boolean;
export type Web_ProxyTransition_ProxyTransitionStatus_ReportedState = Web_Api_WebProxyState;
export type Web_ProxyTransition_ProxyTransitionStatus_ElapsedMilliseconds = number;
export type Web_ProxyTransition_ProxyTransitionStatus_Returns = 'busy' | 'settled' | 'timed-out';
export type Web_ProxyTransition_ProxyTransitionStatus_Settled = boolean;

/**
 * Proxy Transition.
 *
 * @since 2.4.1
 */
export type Web_ProxyTransition_ProxyTransitionTimeoutMilliseconds = number;
