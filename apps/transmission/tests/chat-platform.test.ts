import {
  describe,
  expect,
  it,
} from 'vitest';

import { chatPlatformWebhookPlaceholderUrl } from '../src/web/chat-platform.ts';
import { findNotificationService } from '../src/web/notification-services.ts';

describe('chat platform console helper', () => {
  it('keeps the Discord webhook placeholder text', () => {
    expect(chatPlatformWebhookPlaceholderUrl).toBe('https://discord.com/api/webhooks/…');

    expect(findNotificationService('discord')['fields']).toMatchObject([{
      key: 'webhookUrl',
      placeholder: 'e.g. https://discord.com/api/webhooks/…',
    }]);

    return;
  });

  return;
});
