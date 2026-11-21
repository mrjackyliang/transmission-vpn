import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  notificationServiceIssue,
  notificationServiceValues,
} from '../src/web/notification-services.ts';

describe('notification dialog', () => {
  it('clears a reselected placeholder and validates it on submit', () => {
    expect(notificationServiceValues('')).toEqual({});

    expect(notificationServiceValues('email')).toMatchObject({
      port: '587',
      security: 'starttls',
    });

    expect(notificationServiceIssue('', false)).toBe('');

    expect(notificationServiceIssue('', true)).toBe('Choose a service.');

    return;
  });

  return;
});
