import { describe, expect, it } from 'vitest';

import { isJobName, jobNames, jobRunners } from './runner.js';

describe('runJob dispatch', () => {
  it('covers every declared job name exactly once without a fallback', () => {
    expect(Object.keys(jobRunners).sort()).toEqual([...jobNames].sort());
  });

  it('provides a runner factory for every job name', () => {
    for (const jobName of jobNames) {
      expect(typeof jobRunners[jobName], jobName).toBe('function');
    }
  });

  it('recognizes every derived job name and rejects unknown values', () => {
    for (const jobName of jobNames) {
      expect(isJobName(jobName), jobName).toBe(true);
    }
    expect(isJobName('unknown-job')).toBe(false);
    expect(isJobName('')).toBe(false);
  });
});
