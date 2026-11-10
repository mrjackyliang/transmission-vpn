import type {
  Web_ProxyTransition_Status_ElapsedMilliseconds,
  Web_ProxyTransition_Status_ReportedState,
  Web_ProxyTransition_Status_RequestedEnabled,
  Web_ProxyTransition_Status_Returns,
} from '@/types/web/proxy-transition.d.ts';

/**
 * Proxy Transition - Timeout milliseconds.
 *
 * Bounds how long a switch can remain locked while runtime state catches up.
 * Both proxy cards use the same recovery window and timeout wording.
 *
 * @since 2.0.0
 */
export const proxyTransitionTimeoutMilliseconds: number = 15_000;

/**
 * Proxy Transition - Status.
 *
 * Compares the requested switch value with observed runtime state. The access
 * page uses the result to keep slow switches locked without hiding failures.
 *
 * @param {Web_ProxyTransition_Status_RequestedEnabled}    requestedEnabled    - Requested enabled.
 * @param {Web_ProxyTransition_Status_ReportedState}       reportedState       - Reported state.
 * @param {Web_ProxyTransition_Status_ElapsedMilliseconds} elapsedMilliseconds - Elapsed milliseconds.
 *
 * @returns {Web_ProxyTransition_Status_Returns}
 *
 * @since 2.0.0
 */
export const proxyTransitionStatus = (
  requestedEnabled: Web_ProxyTransition_Status_RequestedEnabled,
  reportedState: Web_ProxyTransition_Status_ReportedState,
  elapsedMilliseconds: Web_ProxyTransition_Status_ElapsedMilliseconds,
): Web_ProxyTransition_Status_Returns => {
  let settled: boolean = reportedState === 'off';
  if (requestedEnabled) {
    settled = reportedState === 'listening' || reportedState === 'waiting-for-vpn';
  }
  if (settled) {
    return 'settled';
  }

  return (elapsedMilliseconds >= proxyTransitionTimeoutMilliseconds) ? 'timed-out' : 'busy';
};
