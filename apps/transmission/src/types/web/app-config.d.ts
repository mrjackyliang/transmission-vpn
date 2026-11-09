import type { Web_Api_Scope } from '@/types/web/api.d.ts';

/**
 * App Config - Token scope.
 *
 * @since UNRELEASED
 */
export type Web_AppConfig_TokenScope = {
  description: string;
  endpoints?: string[];
  id: Web_Api_Scope;
  includes?: Web_Api_Scope;
};

/**
 * App Config.
 *
 * @since UNRELEASED
 */
export type Web_AppConfig = {
  appName: string;
  brandMarkUrl: string;
  brandName: string;
  claimCodeHint: string;
  recoveryCodeFileName: string;
  roleLabels: Record<string, string>;
  securityLabel: string;
  securitySurfaceName: string;
  storageKeys: {
    theme: string;
  };
  tokenDefaultScopes: Web_Api_Scope[];
  tokenNamePlaceholder: string;
  tokenScopes: Web_AppConfig_TokenScope[];
};
