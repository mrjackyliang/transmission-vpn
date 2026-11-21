import {
  digitPattern,
  lowercaseLetterPattern,
  symbolPattern,
  uppercaseLetterPattern,
  yearPattern,
} from '@/web/regex.js';

import type {
  Web_PasswordStrength_AdviceFor_Kinds,
  Web_PasswordStrength_AdviceFor_Repeated,
  Web_PasswordStrength_AdviceFor_Returns,
  Web_PasswordStrength_AdviceFor_Score,
  Web_PasswordStrength_AdviceFor_Spans,
  Web_PasswordStrength_AdviceFor_Word,
  Web_PasswordStrength_CheckPasswordStrength_Bits,
  Web_PasswordStrength_CheckPasswordStrength_Chosen,
  Web_PasswordStrength_CheckPasswordStrength_Covered,
  Web_PasswordStrength_CheckPasswordStrength_Hints,
  Web_PasswordStrength_CheckPasswordStrength_LengthDifference,
  Web_PasswordStrength_CheckPasswordStrength_Password,
  Web_PasswordStrength_CheckPasswordStrength_Repeated,
  Web_PasswordStrength_CheckPasswordStrength_Returns,
  Web_PasswordStrength_CheckPasswordStrength_Score,
  Web_PasswordStrength_CheckPasswordStrength_Spans,
  Web_PasswordStrength_CheckPasswordStrength_Unit,
  Web_PasswordStrength_CommonWords,
  Web_PasswordStrength_FindSpans_Add,
  Web_PasswordStrength_FindSpans_Add_End,
  Web_PasswordStrength_FindSpans_Add_Kind,
  Web_PasswordStrength_FindSpans_Add_Returns,
  Web_PasswordStrength_FindSpans_Add_Start,
  Web_PasswordStrength_FindSpans_AddEvery,
  Web_PasswordStrength_FindSpans_AddEvery_Haystack,
  Web_PasswordStrength_FindSpans_AddEvery_Index,
  Web_PasswordStrength_FindSpans_AddEvery_Kind,
  Web_PasswordStrength_FindSpans_AddEvery_Needle,
  Web_PasswordStrength_FindSpans_AddEvery_Returns,
  Web_PasswordStrength_FindSpans_Hints,
  Web_PasswordStrength_FindSpans_Length,
  Web_PasswordStrength_FindSpans_Lower,
  Web_PasswordStrength_FindSpans_Needle,
  Web_PasswordStrength_FindSpans_Position,
  Web_PasswordStrength_FindSpans_Returns,
  Web_PasswordStrength_FindSpans_RunStart,
  Web_PasswordStrength_FindSpans_Spans,
  Web_PasswordStrength_FindSpans_Start,
  Web_PasswordStrength_FindSpans_Value,
  Web_PasswordStrength_Labels,
  Web_PasswordStrength_LetterSwaps,
  Web_PasswordStrength_MinimumPasswordLength,
  Web_PasswordStrength_OrderedRows,
  Web_PasswordStrength_PatternBits,
  Web_PasswordStrength_PoolSize_Returns,
  Web_PasswordStrength_PoolSize_Size,
  Web_PasswordStrength_PoolSize_Value,
  Web_PasswordStrength_ShortestRepeat_Returns,
  Web_PasswordStrength_ShortestRepeat_Value,
  Web_PasswordStrength_UndoSwaps_One,
  Web_PasswordStrength_UndoSwaps_Returns,
  Web_PasswordStrength_UndoSwaps_Value,
} from '@/types/web/password-strength.d.ts';

// The shortest password the server accepts.

/**
 * Password Strength - Minimum Password Length.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const minimumPasswordLength: Web_PasswordStrength_MinimumPasswordLength = 12;

// Words and names people often build passwords from, matched after letter swaps are undone.

/**
 * Password Strength - Common Words.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const commonWords: Web_PasswordStrength_CommonWords = [
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
 * Password Strength - Ordered Rows.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const orderedRows: Web_PasswordStrength_OrderedRows = [
  'abcdefghijklmnopqrstuvwxyz',
  '01234567890',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
];

// Digits and symbols that stand in for letters, such as p@ssw0rd.

/**
 * Password Strength - Letter Swaps.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const letterSwaps: Web_PasswordStrength_LetterSwaps = {
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
 * Password Strength - Pattern Bits.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const patternBits: Web_PasswordStrength_PatternBits = {
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
const labels: Web_PasswordStrength_Labels = [
  'Too short',
  'Weak',
  'Fair',
  'Good',
  'Strong',
];

// shortestRepeat returns the chunk a password repeats, such as "abc" for "abcabcabc".

/**
 * Password Strength - Shortest Repeat.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_PasswordStrength_ShortestRepeat_Value} value - Value.
 *
 * @returns {Web_PasswordStrength_ShortestRepeat_Returns}
 *
 * @since 2.0.0
 */
const shortestRepeat = (value: Web_PasswordStrength_ShortestRepeat_Value): Web_PasswordStrength_ShortestRepeat_Returns => {
  for (let size = 1; size <= value.length / 2; size += 1) {
    if (value.length % size === 0 && value.slice(0, size).repeat(value.length / size) === value) {
      return value.slice(0, size);
    }
  }

  return value;
};

// undoSwaps turns digits and symbols back into the letters they stand for; "1" can be i or l.

/**
 * Password Strength - Undo Swaps.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_PasswordStrength_UndoSwaps_Value} value - Value.
 * @param {Web_PasswordStrength_UndoSwaps_One}   one   - One.
 *
 * @returns {Web_PasswordStrength_UndoSwaps_Returns}
 *
 * @since 2.0.0
 */
const undoSwaps = (value: Web_PasswordStrength_UndoSwaps_Value, one: Web_PasswordStrength_UndoSwaps_One): Web_PasswordStrength_UndoSwaps_Returns => {
  return Array.from(value, (character) => {
    if (character === '1') {
      return one;
    }

    return letterSwaps[character] ?? character;
  }).join('');
};

// findSpans lists every weak pattern in the password. Spans may overlap.

/**
 * Password Strength - Find Spans.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_PasswordStrength_FindSpans_Value} value - Value.
 * @param {Web_PasswordStrength_FindSpans_Hints} hints - Hints.
 *
 * @returns {Web_PasswordStrength_FindSpans_Returns}
 *
 * @since 2.0.0
 */
const findSpans = (value: Web_PasswordStrength_FindSpans_Value, hints: Web_PasswordStrength_FindSpans_Hints): Web_PasswordStrength_FindSpans_Returns => {
  const lower: Web_PasswordStrength_FindSpans_Lower = value.toLowerCase();
  const spans: Web_PasswordStrength_FindSpans_Spans = [];

  /**
   * Password Strength - Add.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_PasswordStrength_FindSpans_Add_Start} start - Start.
   * @param {Web_PasswordStrength_FindSpans_Add_End}   end   - End.
   * @param {Web_PasswordStrength_FindSpans_Add_Kind}  kind  - Kind.
   *
   * @returns {Web_PasswordStrength_FindSpans_Add_Returns}
   *
   * @since 2.0.0
   */
  const add: Web_PasswordStrength_FindSpans_Add = (start: Web_PasswordStrength_FindSpans_Add_Start, end: Web_PasswordStrength_FindSpans_Add_End, kind: Web_PasswordStrength_FindSpans_Add_Kind): Web_PasswordStrength_FindSpans_Add_Returns => {
    spans.push({
      bits: patternBits[kind],
      end,
      kind,
      start,
      text: value.slice(start, end),
    });

    return;
  };

  /**
   * Password Strength - Add Every.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_PasswordStrength_FindSpans_AddEvery_Haystack} haystack - Haystack.
   * @param {Web_PasswordStrength_FindSpans_AddEvery_Needle}   needle   - Needle.
   * @param {Web_PasswordStrength_FindSpans_AddEvery_Kind}     kind     - Kind.
   *
   * @returns {Web_PasswordStrength_FindSpans_AddEvery_Returns}
   *
   * @since 2.0.0
   */
  const addEvery: Web_PasswordStrength_FindSpans_AddEvery = (haystack: Web_PasswordStrength_FindSpans_AddEvery_Haystack, needle: Web_PasswordStrength_FindSpans_AddEvery_Needle, kind: Web_PasswordStrength_FindSpans_AddEvery_Kind): Web_PasswordStrength_FindSpans_AddEvery_Returns => {
    let index: Web_PasswordStrength_FindSpans_AddEvery_Index = haystack.indexOf(needle);

    while (index !== -1) {
      add(index, index + needle.length, kind);

      index = haystack.indexOf(needle, index + 1);
    }

    return;
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
    const needle: Web_PasswordStrength_FindSpans_Needle = hint.trim().toLowerCase();

    if (needle.length >= 3) {
      addEvery(lower, needle, 'hint');
    }
  }

  for (const row of orderedRows) {
    for (const line of [
      row,
      Array.from(row).reverse().join(''),
    ]) {
      let start: Web_PasswordStrength_FindSpans_Start = 0;

      while (start < lower.length) {
        const position: Web_PasswordStrength_FindSpans_Position = line.indexOf(lower.charAt(start));
        let length: Web_PasswordStrength_FindSpans_Length = 1;

        while (
          position !== -1
          && start + length < lower.length
          && line.charAt(position + length) === lower.charAt(start + length)
        ) {
          length += 1;
        }

        if (length >= 3) {
          add(start, start + length, 'sequence');
        }

        start += (length >= 3) ? length : 1;
      }
    }
  }

  let runStart: Web_PasswordStrength_FindSpans_RunStart = 0;

  for (let index = 1; index <= value.length; index += 1) {
    if (index === value.length || value.charAt(index) !== value.charAt(runStart)) {
      if (index - runStart >= 3) {
        add(runStart, index, 'repeat');
      }

      runStart = index;
    }
  }

  for (const match of value.matchAll(new RegExp(yearPattern, 'gu'))) {
    add(match.index, match.index + 4, 'year');
  }

  return spans;
};

// poolSize counts the characters a guesser tries for each character no pattern explains.

/**
 * Password Strength - Pool Size.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_PasswordStrength_PoolSize_Value} value - Value.
 *
 * @returns {Web_PasswordStrength_PoolSize_Returns}
 *
 * @since 2.0.0
 */
const poolSize = (value: Web_PasswordStrength_PoolSize_Value): Web_PasswordStrength_PoolSize_Returns => {
  let size: Web_PasswordStrength_PoolSize_Size = 0;

  if (new RegExp(lowercaseLetterPattern, 'u').test(value) === true) {
    size += 26;
  }

  if (new RegExp(uppercaseLetterPattern, 'u').test(value) === true) {
    size += 26;
  }

  if (new RegExp(digitPattern, 'u').test(value) === true) {
    size += 10;
  }

  if (new RegExp(symbolPattern, 'u').test(value) === true) {
    size += 33;
  }

  return Math.max(size, 10);
};

// adviceFor names the first weakness found, or how to get to strong.

/**
 * Password Strength - Advice For.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_PasswordStrength_AdviceFor_Spans}    spans    - Spans.
 * @param {Web_PasswordStrength_AdviceFor_Repeated} repeated - Repeated.
 * @param {Web_PasswordStrength_AdviceFor_Score}    score    - Score.
 *
 * @returns {Web_PasswordStrength_AdviceFor_Returns}
 *
 * @since 2.0.0
 */
const adviceFor = (spans: Web_PasswordStrength_AdviceFor_Spans, repeated: Web_PasswordStrength_AdviceFor_Repeated, score: Web_PasswordStrength_AdviceFor_Score): Web_PasswordStrength_AdviceFor_Returns => {
  if (score === 4) {
    return '';
  }

  const word: Web_PasswordStrength_AdviceFor_Word = spans.find((span) => span['kind'] === 'word');
  const kinds: Web_PasswordStrength_AdviceFor_Kinds = new Set(spans.map((span) => span['kind']));

  if (word !== undefined) {
    return `Avoid common words like "${word['text']}".`;
  }

  if (kinds.has('hint') === true) {
    return 'Avoid using your username.';
  }

  if (kinds.has('sequence') === true) {
    return 'Avoid runs like "1234" or "qwerty".';
  }

  if (kinds.has('repeat') === true || repeated === true) {
    return 'Avoid repeated characters.';
  }

  if (kinds.has('year') === true) {
    return 'Avoid years and dates.';
  }

  return (score === 3) ? 'A few more characters would make it strong.' : 'Add another word or a few more characters.';
};

// checkPasswordStrength estimates how hard a password is to guess, from 0 (too short) to 4.
// Common words, names, runs, repeats, years, and the hints (such as the username) count far
// less than random characters. Every app uses the same rules, so the meters agree.

/**
 * Password Strength - Check Password Strength.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_PasswordStrength_CheckPasswordStrength_Password} password - Password.
 * @param {Web_PasswordStrength_CheckPasswordStrength_Hints}    [hints]  - Hints.
 *
 * @returns {Web_PasswordStrength_CheckPasswordStrength_Returns}
 *
 * @since 2.0.0
 */
export const checkPasswordStrength = (password: Web_PasswordStrength_CheckPasswordStrength_Password, hints: Web_PasswordStrength_CheckPasswordStrength_Hints = []): Web_PasswordStrength_CheckPasswordStrength_Returns => {
  if (password.length < minimumPasswordLength) {
    return {
      advice: '',
      label: labels[0] ?? '',
      score: 0,
    };
  }

  const unit: Web_PasswordStrength_CheckPasswordStrength_Unit = shortestRepeat(password);
  const repeated: Web_PasswordStrength_CheckPasswordStrength_Repeated = unit !== password;
  const spans: Web_PasswordStrength_CheckPasswordStrength_Spans = findSpans(unit, hints).sort((left, right) => {
    const lengthDifference: Web_PasswordStrength_CheckPasswordStrength_LengthDifference = (right['end'] - right['start']) - (left['end'] - left['start']);

    if (lengthDifference !== 0) {
      return lengthDifference;
    }

    return left['start'] - right['start'];
  });
  const chosen: Web_PasswordStrength_CheckPasswordStrength_Chosen = [];

  // Longer patterns win, and each character belongs to one pattern at most.
  for (const span of spans) {
    if (chosen.every((other) => span['end'] <= other['start'] || span['start'] >= other['end']) === true) {
      chosen.push(span);
    }
  }

  const covered: Web_PasswordStrength_CheckPasswordStrength_Covered = chosen.reduce((total, span) => total + (span['end'] - span['start']), 0);
  const bits: Web_PasswordStrength_CheckPasswordStrength_Bits = ((unit.length - covered) * Math.log2(poolSize(unit)))
    + chosen.reduce((total, span) => total + span['bits'], 0)
    + ((repeated === true) ? 3 : 0);
  let score: Web_PasswordStrength_CheckPasswordStrength_Score = 4;

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
