import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('P2 shared manual transition boundary', () => {
  it('uses presentation-core while preserving the incremental Mini matrix adapter', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    );
    const source = readFileSync(
      new URL('../src/subpackages/scheduling/pages/manual/index.ts', import.meta.url),
      'utf8',
    );
    const buildTools = readFileSync(new URL('./build-tools.mjs', import.meta.url), 'utf8');

    expect(packageJson.dependencies?.['@schedule/presentation-core']).toBe('workspace:*');
    expect(source).toContain("from '@schedule/presentation-core'");
    // The production editor delegates toggle/location/undo bookkeeping to presentation-core
    // instead of keeping its own mutation implementation.
    expect(source).toContain('resolveManualCellMutation');
    expect(source).toContain('applyManualCellMutation');
    expect(source).toContain('resolveManualSelection');
    expect(source).toContain("mode: 'toggle'");
    expect(source).not.toContain('interface ManualMatrixUndoEntry');
    expect(buildTools).toContain("'@schedule/presentation-core': PRESENTATION_CORE_ENTRY");
  });
});
