import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

import { describe, expect, it } from 'vitest';

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

describe('repository test and shell policy', () => {
  it('excludes generated and external worktrees from root Vitest discovery', () => {
    const config = read('vitest.config.ts');

    expect(config).toContain('configDefaults');
    for (const pattern of [
      'runtime/**',
      'src/**',
      '**/.artifacts/**',
      'apps/miniprogram/scripts/**',
    ]) {
      expect(config).toContain(`'${pattern}'`);
    }
  });

  it('provides one correctly rooted Mini test command', () => {
    const rootPackage = JSON.parse(read('package.json'));
    const miniPackage = JSON.parse(read('apps/miniprogram/package.json'));

    expect(miniPackage.scripts.test).toBe('vitest run --dir scripts --fileParallelism=false');
    expect(rootPackage.scripts['miniprogram:test']).toBe(
      'pnpm --filter @schedule/miniprogram test',
    );
    expect(rootPackage.scripts.verify).toContain('pnpm miniprogram:test');
  });

  it('forces LF for tracked text and fail-fast PowerShell verification', () => {
    expect(read('.gitattributes')).toContain('* text=auto eol=lf');
    const verification = read('docs/testing/verification.md');
    expect(verification).toContain('$PSNativeCommandUseErrorActionPreference = $true');
    expect(verification).toContain("$ErrorActionPreference = 'Stop'");
  });
});
