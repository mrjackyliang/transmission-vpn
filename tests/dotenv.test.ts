import { registerDotenvSuite } from '@cbnventures/nova/rules/vitest';
import * as vitest from 'vitest';

/** Dotenv. */
registerDotenvSuite({
  vitest,
  enable: 'all',
});
