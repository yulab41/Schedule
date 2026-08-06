import { describe, expect, it } from 'vitest';

import { jobNames, jobRunners } from './runner.js';

describe('runJob dispatch', () => {
  it('covers every declared job name exactly once without a fallback', () => {
    expect(Object.keys(jobRunners).sort()).toEqual([...jobNames].sort());
  });

  it('provides a runner factory for every job name', () => {
    for (const jobName of jobNames) {
      expect(typeof jobRunners[jobName], jobName).toBe('function');
    }
  });
});
