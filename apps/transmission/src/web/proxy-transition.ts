import type {
  Web_ProxyTransition_ProxyTransitionStatus_ElapsedMilliseconds,
  Web_ProxyTransition_ProxyTransitionStatus_ReportedState,
  Web_ProxyTransition_ProxyTransitionStatus_RequestedEnabled,
  Web_ProxyTransition_ProxyTransitionStatus_Returns,
  Web_ProxyTransition_ProxyTransitionStatus_Settled,
  Web_ProxyTransition_ProxyTransitionTimeoutMilliseconds,
} from '@/types/web/proxy-transition.d.ts';

/**
 * Proxy Transition - Proxy Transition Timeout Milliseconds.
 *
 * Bounds how long a switch can remain locked while runtime state catches up.
 * Both proxy cards use the same recovery window and timeout wording.
 *
 * @since 2.0.0
 */
export const proxyTransitionTimeoutMilliseconds: Web_ProxyTransition_ProxyTransitionTimeoutMilliseconds = 15_000;

/**
 * Proxy Transition - Proxy Transition Status.
 *
 * Compares the requested switch value with observed runtime state. The access
 * page uses the result to keep slow switches locked without hiding failures.
 *
 * @param {Web_ProxyTransition_ProxyTransitionStatus_RequestedEnabled}    requestedEnabled    - Requested enabled.
 * @param {Web_ProxyTransition_ProxyTransitionStatus_ReportedState}       reportedState       - Reported state.
 * @param {Web_ProxyTransition_ProxyTransitionStatus_ElapsedMilliseconds} elapsedMilliseconds - Elapsed milliseconds.
 *
 * @returns {Web_ProxyTransition_ProxyTransitionStatus_Returns}
 *
 * @since 2.0.0
 */
export const proxyTransitionStatus = (
  requestedEnabled: Web_ProxyTransition_ProxyTransitionStatus_RequestedEnabled,
  reportedState: Web_ProxyTransition_ProxyTransitionStatus_ReportedState,
  elapsedMilliseconds: Web_ProxyTransition_ProxyTransitionStatus_ElapsedMilliseconds,
): Web_ProxyTransition_ProxyTransitionStatus_Returns => {
  let settled: Web_ProxyTransition_ProxyTransitionStatus_Settled = reportedState === 'off';
  if (requestedEnabled === true) {
    settled = reportedState === 'listening' || reportedState === 'waiting-for-vpn';
  }
  if (settled === true) {
    return 'settled';
  }

  return (elapsedMilliseconds >= proxyTransitionTimeoutMilliseconds) ? 'timed-out' : 'busy';
};
