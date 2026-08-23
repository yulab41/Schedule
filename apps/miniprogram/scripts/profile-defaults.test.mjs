import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function readPackage() {
  return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
}

describe('Mini Program environment defaults', () => {
  it('uses production for default build, preview, verification, and experience upload commands', () => {
    const scripts = readPackage().scripts;

    expect(scripts.build).toContain('--profile=production');
    expect(scripts['ci:dry-run']).toContain('--profile=production');
    expect(scripts.preview).toContain('--profile=production');
    expect(scripts['upload:experience']).toContain('--profile=production');
    expect(scripts.verify).toContain('--profile=production');
  });

  it('retains an explicit staging build command without using it for experience uploads', () => {
    const scripts = readPackage().scripts;

    expect(scripts['build:staging']).toContain('--profile=staging');
    expect(scripts['upload:experience']).not.toContain('--profile=staging');
  });
});
