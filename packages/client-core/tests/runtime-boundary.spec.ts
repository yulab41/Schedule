import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

const productionSources = [
  new URL('../src/index.ts', import.meta.url),
  new URL('../src/calendar-client.ts', import.meta.url),
  new URL('../src/endpoint.ts', import.meta.url),
  new URL('../src/error.ts', import.meta.url),
  new URL('../src/json-decoder.ts', import.meta.url),
  new URL('../src/manual-schedule-client.ts', import.meta.url),
  new URL('../src/generated/calendar-schemas.ts', import.meta.url),
];

describe('client-core runtime boundary', () => {
  it('stays free of platform, framework, schema-runtime, Node, DOM, and database imports', () => {
    const source = productionSources
      .map((url) => readFileSync(fileURLToPath(url), 'utf8'))
      .join('\n');
    for (const forbidden of ['@schedule/database', 'node:', 'pinia', 'vue', 'vue-router', 'zod']) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toMatch(
      /\b(?:document|fetch|localStorage|navigator|process|window|wx|XMLHttpRequest)\b/u,
    );
  });

  it('bundles for a browser runtime without pulling contracts or another dependency graph', async () => {
    const result = await build({
      bundle: true,
      entryPoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
      format: 'esm',
      metafile: true,
      platform: 'browser',
      target: 'es2020',
      write: false,
    });
    expect(result.outputFiles[0]?.text.length ?? 0).toBeGreaterThan(0);
    const bundledInputs = Object.keys(result.metafile.inputs).map(normalizeBundledInput).sort();
    expect(bundledInputs).toEqual(
      [
        'packages/client-core/src/calendar-client.ts',
        'packages/client-core/src/endpoint.ts',
        'packages/client-core/src/error.ts',
        'packages/client-core/src/generated/calendar-schemas.ts',
        'packages/client-core/src/index.ts',
        'packages/client-core/src/json-decoder.ts',
        'packages/client-core/src/manual-schedule-client.ts',
        'packages/client-core/src/schedule-publication-client.ts',
        'packages/contracts/src/manual-schedule-limits.ts',
      ].sort(),
    );
  });
});

function normalizeBundledInput(input: string): string {
  const normalized = input.replaceAll('\\', '/');
  for (const marker of ['packages/client-core/', 'packages/contracts/']) {
    const markerIndex = normalized.lastIndexOf(marker);
    if (markerIndex >= 0) return normalized.slice(markerIndex);
  }
  if (normalized.startsWith('src/')) return `packages/client-core/${normalized}`;
  if (normalized.startsWith('../contracts/')) {
    return `packages/contracts/${normalized.slice('../contracts/'.length)}`;
  }
  return normalized;
}
