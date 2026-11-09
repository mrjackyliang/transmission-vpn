import type {
  Web_PasswordStrength_Result,
  Web_PasswordStrength_Score,
  Web_PasswordStrength_Span,
  Web_PasswordStrength_SpanKind,
} from '@/types/web/password-strength.d.ts';

// The shortest password the server accepts.

/**
 * Password Strength - Minimum password length.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const minimumPasswordLength: number = 12;

// Words and names people often build passwords from, matched after letter swaps are undone.

/**
 * Password Strength - Common words.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const commonWords: string[] = [
  'access',
  'admin',
  'baseball',
  'batman',
  'charlie',
  'cheese',
  'computer',
  'default',
  'discord',
  'docker',
  'dragon',
  'football',
  'freedom',
  'guest',
  'hello',
  'hockey',
  'hunter',
  'iloveyou',
  'internet',
  'jennifer',
  'jordan',
  'killer',
  'letmein',
  'login',
  'love',
  'master',
  'michael',
  'money',
  'monkey',
  'mustang',
  'ninja',
  'outpost',
  'pass',
  'passwd',
  'password',
  'passwort',
  'pfsense',
  'pokemon',
  'princess',
  'qwerty',
  'root',
  'secret',
  'shadow',
  'soccer',
  'spring',
  'starwars',
  'stonker',
  'summer',
  'sunshine',
  'superman',
  'test',
  'transmission',
  'trustno',
  'user',
  'welcome',
  'whatever',
  'winter',
];

// Keys and letters people type in order, checked forwards and backwards.

/**
 * Password Strength - Ordered rows.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const orderedRows: string[] = [
  'abcdefghijklmnopqrstuvwxyz',
  '01234567890',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
];

// Digits and symbols that stand in for letters, such as p@ssw0rd.

/**
 * Password Strength - Letter swaps.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const letterSwaps: Record<string, string> = {
  '!': 'i',
  '$': 's',
  '+': 't',
  '0': 'o',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
};

// Guesses each kind of pattern is worth, in bits; far fewer than random characters.

/**
 * Password Strength - Pattern bits.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const patternBits: Record<Web_PasswordStrength_SpanKind, number> = {
  hint: 4,
  repeat: 5,
  sequence: 5,
  word: 10,
  year: 7,
};

/**
 * Password Strength - Labels.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const labels: string[] = [
  'Too short',
  'Weak',
  'Fair',
  'Good',
  'Strong',
];

// shortestRepeat returns the chunk a password repeats, such as "abc" for "abcabcabc".

/**
 * Password Strength - Shortest repeat.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const shortestRepeat = (value: string): string => {
  for (let size = 1; size <= value.length / 2; size += 1) {
    if (value.length % size === 0 && value.slice(0, size).repeat(value.length / size) === value) {
      return value.slice(0, size);
    }
  }

  return value;
};

// undoSwaps turns digits and symbols back into the letters they stand for; "1" can be i or l.

/**
 * Password Strength - Undo swaps.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const undoSwaps = (value: string, one: string): string => Array.from(value, (character: string): string => {
  if (character === '1') {
    return one;
  }

  return letterSwaps[character] ?? character;
}).join('');

// findSpans lists every weak pattern in the password. Spans may overlap.

/**
 * Password Strength - Finds spans.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const findSpans = (value: string, hints: string[]): Web_PasswordStrength_Span[] => {
  const lower: string = value.toLowerCase();
  const spans: Web_PasswordStrength_Span[] = [];

  /**
   * Password Strength - Add.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const add = (start: number, end: number, kind: Web_PasswordStrength_SpanKind): void => {
    spans.push({
      bits: patternBits[kind],
      end,
      kind,
      start,
      text: value.slice(start, end),
    });
  };

  /**
   * Password Strength - Adds every.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const addEvery = (haystack: string, needle: string, kind: Web_PasswordStrength_SpanKind): void => {
    let index: number = haystack.indexOf(needle);

    while (index !== -1) {
      add(index, index + needle.length, kind);
      index = haystack.indexOf(needle, index + 1);
    }
  };

  for (const variant of [
    lower,
    undoSwaps(lower, 'i'),
    undoSwaps(lower, 'l'),
  ]) {
    for (const word of commonWords) {
      addEvery(variant, word, 'word');
    }
  }

  for (const hint of hints) {
    const needle: string = hint.trim().toLowerCase();

    if (needle.length >= 3) {
      addEvery(lower, needle, 'hint');
    }
  }

  for (const row of orderedRows) {
    for (const line of [
      row,
      Array.from(row).reverse().join(''),
    ]) {
      let start: number = 0;

      while (start < lower.length) {
        const position: number = line.indexOf(lower.charAt(start));
        let length: number = 1;

        while (position !== -1 && start + length < lower.length && line.charAt(position + length) === lower.charAt(start + length)) {
          length += 1;
        }

        if (length >= 3) {
          add(start, start + length, 'sequence');
        }

        start += (length >= 3) ? length : 1;
      }
    }
  }

  let runStart: number = 0;

  for (let index = 1; index <= value.length; index += 1) {
    if (index === value.length || value.charAt(index) !== value.charAt(runStart)) {
      if (index - runStart >= 3) {
        add(runStart, index, 'repeat');
      }

      runStart = index;
    }
  }

  for (const match of value.matchAll(/(?:19|20)\d\d/gu)) {
    add(match.index, match.index + 4, 'year');
  }

  return spans;
};

// poolSize counts the characters a guesser tries for each character no pattern explains.

/**
 * Password Strength - Pool size.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const poolSize = (value: string): number => {
  let size: number = 0;

  if (/[a-z]/u.test(value)) {
    size += 26;
  }

  if (/[A-Z]/u.test(value)) {
    size += 26;
  }

  if (/\d/u.test(value)) {
    size += 10;
  }

  if (/[^a-zA-Z\d]/u.test(value)) {
    size += 33;
  }

  return Math.max(size, 10);
};

// adviceFor names the first weakness found, or how to get to strong.

/**
 * Password Strength - Advice for.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const adviceFor = (spans: Web_PasswordStrength_Span[], repeated: boolean, score: Web_PasswordStrength_Score): string => {
  if (score === 4) {
    return '';
  }

  const word: Web_PasswordStrength_Span | undefined = spans.find((span: Web_PasswordStrength_Span): boolean => span['kind'] === 'word');
  const kinds: Set<Web_PasswordStrength_SpanKind> = new Set(spans.map((span: Web_PasswordStrength_Span): Web_PasswordStrength_SpanKind => span['kind']));

  if (word !== undefined) {
    return `Avoid common words like "${word['text']}".`;
  }

  if (kinds.has('hint')) {
    return 'Avoid using your username.';
  }

  if (kinds.has('sequence')) {
    return 'Avoid runs like "1234" or "qwerty".';
  }

  if (kinds.has('repeat') || repeated) {
    return 'Avoid repeated characters.';
  }

  if (kinds.has('year')) {
    return 'Avoid years and dates.';
  }

  return (score === 3) ? 'A few more characters would make it strong.' : 'Add another word or a few more characters.';
};

// checkPasswordStrength estimates how hard a password is to guess, from 0 (too short) to 4.
// Common words, names, runs, repeats, years, and the hints (such as the username) count far
// less than random characters. Every app uses the same rules, so the meters agree.

/**
 * Password Strength - Checks password strength.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
export const checkPasswordStrength = (password: string, hints: string[] = []): Web_PasswordStrength_Result => {
  if (password.length < minimumPasswordLength) {
    return {
      advice: '',
      label: labels[0] ?? '',
      score: 0,
    };
  }

  const unit: string = shortestRepeat(password);
  const repeated: boolean = unit !== password;
  const spans: Web_PasswordStrength_Span[] = findSpans(unit, hints).sort((left: Web_PasswordStrength_Span, right: Web_PasswordStrength_Span): number => ((right['end'] - right['start']) - (left['end'] - left['start'])) || (left['start'] - right['start']));
  const chosen: Web_PasswordStrength_Span[] = [];

  // Longer patterns win, and each character belongs to one pattern at most.
  for (const span of spans) {
    if (chosen.every((other: Web_PasswordStrength_Span): boolean => span['end'] <= other['start'] || span['start'] >= other['end'])) {
      chosen.push(span);
    }
  }

  const covered: number = chosen.reduce((total: number, span: Web_PasswordStrength_Span): number => total + (span['end'] - span['start']), 0);
  const bits: number = ((unit.length - covered) * Math.log2(poolSize(unit)))
    + chosen.reduce((total: number, span: Web_PasswordStrength_Span): number => total + span['bits'], 0)
    + ((repeated) ? 3 : 0);
  let score: Web_PasswordStrength_Score = 4;

  if (bits < 40) {
    score = 1;
  } else if (bits < 60) {
    score = 2;
  } else if (bits < 80) {
    score = 3;
  }

  return {
    advice: adviceFor(chosen, repeated, score),
    label: labels[score] ?? '',
    score,
  };
};
