import type {
  Web_Api_Administrator,
  Web_Api_LiveSnapshot,
  Web_Api_Provider,
  Web_Api_SettingsSnapshot,
  Web_Api_Token,
  Web_Api_TorrentDetail,
  Web_Api_VpnProfile,
} from '@/types/web/api.d.ts';

import type { Web_Components_View } from '@/types/web/components.d.ts';

/**
 * App.
 *
 * @since 2.0.0
 */
export type Web_App_Phase = 'loading' | 'claim' | 'login' | 'application';

/**
 * App.
 *
 * @since 2.0.0
 */
export type Web_App_RemovedSecretAction = {
  label: string;
  view: Web_Components_View;
};

/**
 * App.
 *
 * @since 2.0.0
 */
export type Web_App_Workspace = {
  activeView: Web_Components_View;
  administrator: Web_Api_Administrator | null;
  liveSnapshot: Web_Api_LiveSnapshot | null;
  providers: Web_Api_Provider[];
  settings: Web_Api_SettingsSnapshot | null;
  tokens: Web_Api_Token[];
  torrentDetail: Web_Api_TorrentDetail | null;
  vpnProfiles: Web_Api_VpnProfile[];
};
