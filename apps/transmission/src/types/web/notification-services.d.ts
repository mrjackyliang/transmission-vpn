import type {
  Web_Notifications_Service,
  Web_Notifications_ServiceDefinition,
} from '@/types/web/notifications.d.ts';

/**
 * Notification Services.
 *
 * @since 2.4.1
 */
export type Web_NotificationServices_DefaultValues_Service = Web_Notifications_Service;
export type Web_NotificationServices_DefaultValues_Returns = Record<string, string>;

/**
 * Notification Services.
 *
 * @since 2.4.1
 */
export type Web_NotificationServices_FindNotificationService_Service = Web_Notifications_Service;
export type Web_NotificationServices_FindNotificationService_Returns = Web_Notifications_ServiceDefinition;

/**
 * Notification Services.
 *
 * @since 2.4.1
 */
export type Web_NotificationServices_NotificationServiceIssue_Service = Web_Notifications_Service | '';
export type Web_NotificationServices_NotificationServiceIssue_Attempted = boolean;
export type Web_NotificationServices_NotificationServiceIssue_Returns = string;

/**
 * Notification Services.
 *
 * @since 2.4.1
 */
export type Web_NotificationServices_NotificationServiceValues_Service = Web_Notifications_Service | '';
export type Web_NotificationServices_NotificationServiceValues_Returns = Record<string, string>;

/**
 * Notification Services.
 *
 * @since 2.4.1
 */
export type Web_NotificationServices_NotificationServices = Web_Notifications_ServiceDefinition[];
