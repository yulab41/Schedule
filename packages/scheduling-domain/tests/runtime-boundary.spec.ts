import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

import { createDomainSummary } from '../src/index.js';

describe('scheduling-domain runtime boundary', () => {
  it('keeps the existing API health summary', () => {
    expect(createDomainSummary()).toBe('medical-staff-scheduling-system domain is ready.');
  });

  it('bundles through only the approved Zod-free contracts leaves', async () => {
    const result = await build({
      bundle: true,
      entryPoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
      format: 'esm',
      metafile: true,
      platform: 'browser',
      target: 'es2020',
      write: false,
    });
    const inputs = Object.keys(result.metafile.inputs).sort();
    expect(inputs.filter((input) => input.includes('packages/contracts/'))).toEqual([
      'packages/contracts/src/manual-schedule-limits.ts',
      'packages/contracts/src/workspace-name.ts',
    ]);
    expect(inputs.some((input) => input.includes('/zod/'))).toBe(false);
    expect(inputs).not.toContain('packages/contracts/src/index.ts');
  });
});
