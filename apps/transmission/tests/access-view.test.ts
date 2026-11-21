import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  proxyLoginsHintPattern,
  rpcLoginsHintPattern,
} from '../src/web/regex.ts';

import type {
  Tests_Web_AccessView_AccessViewModule,
  Tests_Web_AccessView_Markup,
  Tests_Web_AccessView_Props,
  Tests_Web_AccessView_Unavailable,
  Tests_Web_AccessView_Unavailable_Returns,
  Tests_Web_AccessView_WebProxy,
} from '../src/types/tests/web/access-view.test.d.ts';

afterEach(() => {
  vi.unstubAllGlobals();

  return;
});

describe('Access view', () => {
  it('shows one no-login helper for each enabled proxy', async () => {
    const accessViewModule: Tests_Web_AccessView_AccessViewModule = await vi.importActual<Tests_Web_AccessView_AccessViewModule>('../src/web/access-view.tsx');

    vi.stubGlobal('window', { location: { hostname: 'localhost' } });

    const webProxy: Tests_Web_AccessView_WebProxy = {
      enabled: true,
      logins: [],
      port: 8_088,
      state: 'listening',
    };
    const unavailable: Tests_Web_AccessView_Unavailable = (): Tests_Web_AccessView_Unavailable_Returns => Promise.reject(new Error('Not called while rendering.'));
    const props: Tests_Web_AccessView_Props = {
      connections: [],
      onCreateRPCLogin: unavailable,
      onCreateToken: unavailable,
      onCreateWebProxyLogin: unavailable,
      onDeleteRPCLogin: async () => undefined,
      onDeleteWebProxyLogin: async () => undefined,
      onOpenVPN: () => undefined,
      onRefreshWebProxy: async () => webProxy,
      onRevokeToken: async () => undefined,
      onToggleRPC: async () => undefined,
      onToggleWebProxy: async () => webProxy,
      onUpdateRPCLogin: unavailable,
      onUpdateToken: async () => undefined,
      onUpdateWebProxyLogin: unavailable,
      rpcEnabled: true,
      rpcLogins: [],
      tokens: [],
      webProxy,
    };

    const markup: Tests_Web_AccessView_Markup = renderToStaticMarkup(createElement(accessViewModule['AccessView'], props));

    expect(markup.match(new RegExp(rpcLoginsHintPattern, 'gu'))).toHaveLength(1);

    expect(markup.match(new RegExp(proxyLoginsHintPattern, 'gu'))).toHaveLength(1);

    expect(markup).not.toContain('On, but nobody can sign in until you add a login.');

    expect(markup).not.toContain('On, but nobody can use the proxy until you add a login.');

    return;
  });

  return;
});
