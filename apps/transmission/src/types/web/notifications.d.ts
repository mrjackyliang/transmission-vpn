/**
 * Notifications.
 *
 * @since 2.0.0
 */
export type Web_Notifications_Service = 'apprise' | 'discord' | 'email' | 'gotify' | 'matrix' | 'ntfy' | 'ntfy-reverse-proxy' | 'pushover' | 'slack' | 'telegram' | 'webhook';

/**
 * Notifications.
 *
 * @since 2.0.0
 */
export type Web_Notifications_FieldKind = 'email' | 'number' | 'password' | 'select' | 'text' | 'url';

/**
 * Notifications.
 *
 * @since 2.0.0
 */
export type Web_Notifications_FieldOption = {
  label: string;
  value: string;
};

/**
 * Notifications.
 *
 * @since 2.0.0
 */
export type Web_Notifications_Field = {
  defaultValue?: string;
  hint?: string;
  key: string;
  kind: Web_Notifications_FieldKind;
  label: string;
  optional?: boolean;
  options?: Web_Notifications_FieldOption[];
  placeholder?: string;
  secret: boolean;
};

/**
 * Notifications.
 *
 * @since 2.0.0
 */
export type Web_Notifications_ServiceDefinition = {
  fields: Web_Notifications_Field[];
  key: Web_Notifications_Service;
  label: string;
};

/**
 * Notifications.
 *
 * @since 2.0.0
 */
export type Web_Notifications_Event = {
  defaultEnabled: boolean;
  description: string;
  key: string;
  label: string;
};

/**
 * Notifications.
 *
 * @since 2.0.0
 */
export type Web_Notifications_Target = {
  createdAt: string;
  events: string[];
  id: string;
  lastAttemptAt: string | null;
  lastError: string | null;
  lastErrorDetails?: string | null;
  name: string;
  secrets: Record<string, true>;
  secretsMissing: string[];
  service: Web_Notifications_Service;
  settings: Record<string, string>;
  updatedAt: string;
};

/**
 * Notifications.
 *
 * @since 2.0.0
 */
export type Web_Notifications_CreateInput = {
  events: string[];
  name: string;
  service: Web_Notifications_Service;
  settings: Record<string, string>;
};

/**
 * Notifications.
 *
 * @since 2.0.0
 */
export type Web_Notifications_UpdateInput = {
  clearSecrets: string[];
  events: string[];
  name: string;
  settings: Record<string, string>;
};

/**
 * Notifications.
 *
 * @since 2.0.0
 */
export type Web_Notifications_TestResult = {
  delivered: boolean;
  message?: string | undefined;
};

/**
 * Notifications.
 *
 * @since 2.0.0
 */
export type Web_Notifications_ViewProps = {
  interpreter: string;
  onChange?: (() => void) | undefined;
};

/**
 * Notifications.
 *
 * @since 2.0.0
 */
export type Web_Notifications_DialogProps = {
  events: Web_Notifications_Event[];
  interpreter: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  open: boolean;
  target: Web_Notifications_Target | null;
};
