import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  checkPasswordStrength,
  minimumPasswordLength,
} from '../src/web/password-strength.ts';

describe('password strength', (): void => {
  it('asks for the minimum length first', (): void => {
    expect(minimumPasswordLength).toBe(12);
    expect(checkPasswordStrength('eleven char')).toEqual({
      advice: '',
      label: 'Too short',
      score: 0,
    });
  });

  it('rates common words, runs, repeats, and the username as weak', (): void => {
    expect(checkPasswordStrength('password1234')).toEqual({
      advice: 'Avoid common words like "password".',
      label: 'Weak',
      score: 1,
    });
    expect(checkPasswordStrength('P@ssw0rd2026!')['score']).toBe(1);
    expect(checkPasswordStrength('qwertyuiop12')['advice']).toBe('Avoid runs like "1234" or "qwerty".');
    expect(checkPasswordStrength('aaaaaaaaaaaa')['advice']).toBe('Avoid repeated characters.');
    expect(checkPasswordStrength('jacky2026jacky', ['jacky'])['advice']).toBe('Avoid using your username.');
  });

  it('rates random characters and long passphrases higher', (): void => {
    expect(checkPasswordStrength('kT9#xP2$mQ7!')).toEqual({
      advice: 'A few more characters would make it strong.',
      label: 'Good',
      score: 3,
    });
    expect(checkPasswordStrength('kT9#xP2$mQ7!w')['label']).toBe('Strong');
    expect(checkPasswordStrength('correct horse battery staple')['score']).toBe(4);
  });
});
