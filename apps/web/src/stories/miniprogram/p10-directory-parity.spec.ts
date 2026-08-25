import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('P10 directory parity golden', () => {
  it('reuses the production unified directory and synthetic sources', () => {
    const stories = source('./P10DirectoryParity.stories.ts');

    expect(stories).toContain("title: 'Miniprogram Parity/P10 Directory'");
    expect(stories).toContain("from '../../views/directory/UnifiedDirectoryView.vue'");
    expect(stories).toContain("from '../ui2/UnifiedDirectoryPreview.stories'");
    expect(stories).toContain("name: '1 · 科室通讯录 · 390px'");
    expect(stories).toContain("name: '3 · 科室通讯录 · 320px'");
    expect(stories).toContain("globals: { viewport: 'desktop1280' }");
  });

  it('keeps synthetic directory data separate from production numbers', () => {
    const stories = source('../ui2/UnifiedDirectoryPreview.stories.ts');

    expect(stories).toContain('export const internalDataSource');
    expect(stories).toContain('export const employeeDataSource');
    expect(stories).not.toContain('138027');
    expect(stories).not.toContain('13800138000');
  });
});
