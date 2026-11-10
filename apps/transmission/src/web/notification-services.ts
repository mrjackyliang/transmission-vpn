import type {
  Web_Notifications_Field,
  Web_Notifications_Service,
  Web_Notifications_ServiceDefinition,
} from '@/types/web/notifications.d.ts';

// The services a destination can use, in the order the dialog offers them, with the
// fields each one needs. Secret fields are never shown again after they're saved.

/**
 * Notification Services.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const notificationServices: Web_Notifications_ServiceDefinition[] = [
  {
    fields: [
      {
        key: 'url',
        kind: 'url',
        label: 'Topic URL',
        placeholder: 'e.g. https://ntfy.sh/my-alerts',
        secret: false,
      },
      {
        hint: 'Only for topics that need a token.',
        key: 'token',
        kind: 'password',
        label: 'Access token',
        optional: true,
        secret: true,
      },
    ],
    key: 'ntfy',
    label: 'ntfy',
  },
  {
    fields: [
      {
        hint: 'Set the context\'s interpreter to {interpreter}.',
        key: 'url',
        kind: 'url',
        label: 'Context URL',
        placeholder: 'e.g. https://alerts.ntfy.example.com',
        secret: false,
      },
      {
        hint: 'Only for contexts that need a token.',
        key: 'token',
        kind: 'password',
        label: 'Context token',
        optional: true,
        secret: true,
      },
    ],
    key: 'ntfy-reverse-proxy',
    label: 'Reverse Proxy for ntfy',
  },
  {
    fields: [
      {
        hint: 'From @BotFather, like 123456:ABC-DEF.',
        key: 'botToken',
        kind: 'password',
        label: 'Bot token',
        secret: true,
      },
      {
        hint: 'A user, group, or channel the bot can post to.',
        key: 'chatId',
        kind: 'text',
        label: 'Chat ID',
        placeholder: 'e.g. -1001234567890',
        secret: false,
      },
    ],
    key: 'telegram',
    label: 'Telegram',
  },
  {
    fields: [{
      hint: 'From the channel\'s Integrations settings.',
      key: 'webhookUrl',
      kind: 'password',
      label: 'Webhook URL',
      placeholder: 'e.g. https://discord.com/api/webhooks/…',
      secret: true,
    }],
    key: 'discord',
    label: 'Discord',
  },
  {
    fields: [{
      hint: 'From an incoming webhook in your Slack app.',
      key: 'webhookUrl',
      kind: 'password',
      label: 'Webhook URL',
      placeholder: 'e.g. https://hooks.slack.com/services/…',
      secret: true,
    }],
    key: 'slack',
    label: 'Slack',
  },
  {
    fields: [
      {
        key: 'url',
        kind: 'url',
        label: 'Server URL',
        placeholder: 'e.g. https://gotify.example.com',
        secret: false,
      },
      {
        hint: 'The token of an application you made in Gotify.',
        key: 'token',
        kind: 'password',
        label: 'App token',
        secret: true,
      },
    ],
    key: 'gotify',
    label: 'Gotify',
  },
  {
    fields: [
      {
        key: 'userKey',
        kind: 'password',
        label: 'User key',
        secret: true,
      },
      {
        hint: 'The API token of an application you made in Pushover.',
        key: 'appToken',
        kind: 'password',
        label: 'App token',
        secret: true,
      },
    ],
    key: 'pushover',
    label: 'Pushover',
  },
  {
    fields: [
      {
        key: 'homeserverUrl',
        kind: 'url',
        label: 'Homeserver URL',
        placeholder: 'e.g. https://matrix.example.com',
        secret: false,
      },
      {
        hint: 'Use the !room:server room ID. Room aliases that start with # are not accepted.',
        key: 'roomId',
        kind: 'text',
        label: 'Room ID',
        placeholder: 'e.g. !room:example.com',
        secret: false,
      },
      {
        key: 'accessToken',
        kind: 'password',
        label: 'Access token',
        secret: true,
      },
    ],
    key: 'matrix',
    label: 'Matrix',
  },
  {
    fields: [
      {
        key: 'host',
        kind: 'text',
        label: 'SMTP server',
        placeholder: 'e.g. smtp.example.com',
        secret: false,
      },
      {
        defaultValue: '587',
        key: 'port',
        kind: 'number',
        label: 'Port',
        secret: false,
      },
      {
        defaultValue: 'starttls',
        key: 'security',
        kind: 'select',
        label: 'Security',
        options: [
          {
            label: 'STARTTLS',
            value: 'starttls',
          },
          {
            label: 'TLS',
            value: 'tls',
          },
          {
            label: 'None',
            value: 'none',
          },
        ],
        secret: false,
      },
      {
        hint: 'Leave blank if the server doesn\'t need a login.',
        key: 'username',
        kind: 'text',
        label: 'Username',
        secret: false,
      },
      {
        key: 'password',
        kind: 'password',
        label: 'Password',
        optional: true,
        secret: true,
      },
      {
        key: 'from',
        kind: 'email',
        label: 'From',
        placeholder: 'e.g. alerts@example.com',
        secret: false,
      },
      {
        hint: 'Separate more than one address with commas.',
        key: 'to',
        kind: 'text',
        label: 'To',
        placeholder: 'e.g. you@example.com',
        secret: false,
      },
    ],
    key: 'email',
    label: 'Email',
  },
  {
    fields: [
      {
        hint: 'The notify URL of your Apprise API server, with its config key.',
        key: 'url',
        kind: 'password',
        label: 'Apprise URL',
        placeholder: 'e.g. http://apprise:8000/notify/alerts',
        secret: true,
      },
      {
        hint: 'Only for a stateless Apprise server. Separate them with spaces.',
        key: 'urls',
        kind: 'password',
        label: 'Service URLs',
        optional: true,
        secret: true,
      },
    ],
    key: 'apprise',
    label: 'Apprise',
  },
  {
    fields: [
      {
        hint: 'Gets the alert as JSON in a POST request.',
        key: 'url',
        kind: 'password',
        label: 'URL',
        placeholder: 'e.g. https://hooks.example.com/alerts',
        secret: true,
      },
      {
        hint: 'Sent as a Bearer token, if the endpoint needs one.',
        key: 'token',
        kind: 'password',
        label: 'Bearer token',
        optional: true,
        secret: true,
      },
    ],
    key: 'webhook',
    label: 'Webhook',
  },
];

// findNotificationService returns a service's definition, falling back to ntfy for
// a value the console doesn't know yet.

/**
 * Notification Services - Finds notification service.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const findNotificationService = (service: Web_Notifications_Service): Web_Notifications_ServiceDefinition => (
  notificationServices.find((definition: Web_Notifications_ServiceDefinition): boolean => definition['key'] === service) ?? notificationServices[0]!
);

// defaultValues gives a service's fields their starting values, like port 587 for email.

/**
 * Notification Services - Default values.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const defaultValues = (service: Web_Notifications_Service): Record<string, string> => Object.fromEntries(
  findNotificationService(service)['fields'].map((field: Web_Notifications_Field): [string, string] => [
    field['key'],
    field['defaultValue'] ?? '',
  ]),
);

/**
 * Notification Services - Values for selection.
 *
 * Clears service-specific fields for the placeholder and otherwise returns
 * only the selected service's configured defaults.
 *
 * @param {Web_Notifications_Service | ''} service - Service.
 *
 * @returns {Record<string, string>}
 *
 * @since 2.0.0
 */
export const notificationServiceValues = (
  service: Web_Notifications_Service | '',
): Record<string, string> => (service === '') ? {} : defaultValues(service);

/**
 * Notification Services - Required issue.
 *
 * Shows the required choice only after the owner submits the blank service.
 * Server-provided field issues continue through the shared API error path.
 *
 * @param {Web_Notifications_Service | ''} service   - Service.
 * @param {boolean}                        attempted - Attempted.
 *
 * @returns {string}
 *
 * @since 2.0.0
 */
export const notificationServiceIssue = (
  service: Web_Notifications_Service | '',
  attempted: boolean,
): string => (attempted && service === '') ? 'Choose a service.' : '';
