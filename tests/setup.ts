import { VitestSetup } from '@cbnventures/nova/toolkit';
import { afterEach, beforeEach, vi } from 'vitest';

/** Setup. */
VitestSetup.register({
  afterEach,
  beforeEach,
  vi,
});
