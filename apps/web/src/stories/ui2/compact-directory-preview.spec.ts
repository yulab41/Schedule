import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('compact directory review preview', () => {
  it('keeps the production directory data source while removing decorative copy', () => {
    const preview = readSource('./CompactDirectoryPreview.vue');

    expect(preview).toContain('UnifiedDirectoryView');
    expect(preview).not.toContain('.directory-page-heading > div:first-child');
    expect(preview).not.toContain('.directory-wayfinding::before');
    expect(preview).not.toContain('.wayfinding-header span');
    expect(preview).toContain('role="status"');
  });

  it('exposes mobile, desktop, and confirmed profile preview stories without writes', () => {
    const stories = readSource('./CompactDirectoryPreview.stories.ts');

    expect(stories).toContain('CompactMobile');
    expect(stories).toContain('CompactDesktop');
    expect(stories).toContain('MyProfilePreview');
    expect(stories).toContain('DefaultPasswordModal');
    expect(stories).not.toContain('fetch(');
  });
});
