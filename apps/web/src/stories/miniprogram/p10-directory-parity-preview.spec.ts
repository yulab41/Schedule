import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('P10 directory parity Storybook golden', () => {
  it('keeps the production directory component isolated from network data', () => {
    const preview = read('./P10DirectoryParityPreview.vue');
    expect(preview).toContain('InternalDirectoryView');
    expect(preview).toContain('storybook-p10-directory');
    expect(preview).not.toContain('createApiClient');
    expect(preview).not.toContain('localAuth');
    expect(preview).toContain('示例号码');
  });

  it('covers ready, loading, empty, error, disabled and large-text states', () => {
    const preview = read('./P10DirectoryParityPreview.vue');
    const stories = read('./P10DirectoryParityPreview.stories.ts');
    for (const name of [
      'InternalReady390',
      'InternalReady320',
      'EmployeeReady390',
      'LargeText390',
      'Loading320',
      'Empty390',
      'Error320',
      'Disabled390',
      'HalfFilterSheet390',
      'HalfFilterSheet320',
    ]) {
      expect(stories).toContain(`export const ${name}`);
    }
    expect(stories).toContain("viewport: 'mobile320'");
    expect(stories).toContain('largeText: true');
    expect(preview).toContain('class="native-filter-sheet"');
    expect(preview).toContain('height: 50vh');
    expect(preview).toContain('min-height: 0');
    expect(preview).toContain('overflow-y: auto');
  });
});
