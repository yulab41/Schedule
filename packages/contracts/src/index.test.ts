import { describe, expect, it } from 'vitest';

import { workspaceName } from './index.js';

describe('workspace contract', () => {
  it('exposes the workspace name', () => {
    expect(workspaceName).toBe('medical-staff-scheduling-system');
  });
});
