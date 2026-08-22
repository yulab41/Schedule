import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('P2 shared manual transition boundary', () => {
  it('uses presentation-core while preserving the incremental Mini matrix adapter', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    );
    const source = readFileSync(
      new URL('../src/pages/manual-matrix-poc/index.ts', import.meta.url),
      'utf8',
    );
    const buildTools = readFileSync(new URL('./build-tools.mjs', import.meta.url), 'utf8');

    expect(packageJson.dependencies?.['@schedule/presentation-core']).toBe('workspace:*');
    expect(source).toContain("from '@schedule/presentation-core'");
    expect(source).toContain('resolveManualCellMutation');
    expect(source).toContain("mode: 'replace'");
    expect(source).toContain('resolveManualSelection');
    expect(source).toContain('ManualCellMutation<ManualMatrixCellAssignment>');
    expect(source).not.toContain('interface ManualMatrixUndoEntry');
    expect(buildTools).toContain("'@schedule/presentation-core': PRESENTATION_CORE_ENTRY");
  });
});
