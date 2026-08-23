import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

const productionSources = [
  new URL('../src/index.ts', import.meta.url),
  new URL('../src/calendar.ts', import.meta.url),
  new URL('../src/manual-schedule.ts', import.meta.url),
  new URL('../src/past-schedule-backfill.ts', import.meta.url),
  new URL('../src/schedule-publication.ts', import.meta.url),
];

describe('presentation-core runtime boundary', () => {
  it('stays free of framework, transport, schema, Node, DOM, and database imports', () => {
    const source = productionSources
      .map((url) => readFileSync(fileURLToPath(url), 'utf8'))
      .join('\n');

    for (const forbidden of [
      '@schedule/contracts',
      '@schedule/database',
      '@schedule/scheduling-domain',
      'node:',
      'pinia',
      'vue',
      'vue-router',
      'zod',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/\b(?:document|fetch|localStorage|window|ResizeObserver)\b/u);
  });

  it('bundles for a browser runtime without pulling an external dependency graph', async () => {
    const result = await build({
      bundle: true,
      entryPoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
      format: 'esm',
      metafile: true,
      platform: 'browser',
      target: 'es2020',
      write: false,
    });
    const output = result.outputFiles[0]?.text ?? '';
    expect(output.length).toBeGreaterThan(0);
    expect(output).not.toMatch(/\b(?:document|fetch|localStorage|window|ResizeObserver)\b/u);
    expect(Object.keys(result.metafile.inputs).sort()).toEqual(
      [
        'packages/presentation-core/src/calendar.ts',
        'packages/presentation-core/src/index.ts',
        'packages/presentation-core/src/manual-schedule.ts',
        'packages/presentation-core/src/past-schedule-backfill.ts',
        'packages/presentation-core/src/schedule-publication.ts',
      ].sort(),
    );
  });
});
