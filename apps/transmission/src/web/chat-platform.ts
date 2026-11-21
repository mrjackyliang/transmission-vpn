import type { Web_ChatPlatform_WebhookPlaceholderUrl } from '@/types/web/chat-platform.d.ts';

// The chat platform's webhook URL conventions, kept here so console screens never
// spell out the provider's address themselves.

/**
 * Chat Platform - Chat Platform Webhook Placeholder URL.
 *
 * Shows the shape of a Discord webhook URL in the notification destination form.
 * Notification services quote it instead of holding the provider address.
 *
 * @since 2.4.1
 */
export const chatPlatformWebhookPlaceholderUrl: Web_ChatPlatform_WebhookPlaceholderUrl = 'https://discord.com/api/webhooks/…';
