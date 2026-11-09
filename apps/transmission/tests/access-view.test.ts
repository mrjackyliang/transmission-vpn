import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ComponentType } from 'react';

import type { Web_Api_WebProxy } from '../src/types/web/api.d.ts';
import type { Web_Components_AccessView_Props } from '../src/types/web/components.d.ts';

type AccessViewModule = {
  AccessView: ComponentType<Web_Components_AccessView_Props>
};

afterEach((): void => {
  vi.unstubAllGlobals();
});

describe('Access view', (): void => {
  it('shows one no-login helper for each enabled proxy', async (): Promise<void> => {
    const accessViewModule: AccessViewModule = await vi.importActual<AccessViewModule>('../src/web/access-view.tsx');
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    const webProxy: Web_Api_WebProxy = {
      enabled: true,
      logins: [],
      port: 8_088,
      state: 'listening',
    };
    const unavailable = async (): Promise<never> => {
      throw new Error('Not called while rendering.');
    };
    const props: Web_Components_AccessView_Props = {
      connections: [],
      onCreateRPCLogin: unavailable,
      onCreateToken: unavailable,
      onCreateWebProxyLogin: unavailable,
      onDeleteRPCLogin: async (): Promise<void> => undefined,
      onDeleteWebProxyLogin: async (): Promise<void> => undefined,
      onOpenVPN: (): void => undefined,
      onRefreshWebProxy: async (): Promise<Web_Api_WebProxy> => webProxy,
      onRevokeToken: async (): Promise<void> => undefined,
      onToggleRPC: async (): Promise<void> => undefined,
      onToggleWebProxy: async (): Promise<Web_Api_WebProxy> => webProxy,
      onUpdateRPCLogin: unavailable,
      onUpdateToken: async (): Promise<void> => undefined,
      onUpdateWebProxyLogin: unavailable,
      rpcEnabled: true,
      rpcLogins: [],
      tokens: [],
      webProxy,
    };

    const markup: string = renderToStaticMarkup(createElement(accessViewModule['AccessView'], props));

    expect(markup.match(/Add a login before remote apps can sign in\./gu)).toHaveLength(1);
    expect(markup.match(/Add a login before anyone can use the proxy\./gu)).toHaveLength(1);
    expect(markup).not.toContain('On, but nobody can sign in until you add a login.');
    expect(markup).not.toContain('On, but nobody can use the proxy until you add a login.');
  });
});
