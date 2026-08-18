import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('hospital directory Storybook preview', () => {
  it('renders the production directory component with synthetic data', () => {
    const stories = source('./InternalDirectoryPreview.stories.ts');

    expect(stories).toContain("from '../../views/directory/InternalDirectoryView.vue'");
    expect(stories).toContain('SyntheticDirectoryDataSource');
    expect(stories).toContain('Mobile390');
    expect(stories).toContain('Desktop1280');
    expect(stories).toContain('mobile390');
    expect(stories).toContain('desktop1280');
    expect(stories).toContain("subunit: '手术室护士站'");
    expect(stories).toContain("subunit: '护士值班房'");
    expect(stories).toContain('buildings: []');
    expect(stories).toContain('lookupDirectoryEntries');
    expect(stories).not.toContain('138027');
  });

  it('preserves search, linked hierarchy, accessibility, and dial behavior in the production view', () => {
    const view = source('../../views/directory/InternalDirectoryView.vue');

    expect(view).toContain('搜索科室、姓名、拼音或号码');
    expect(view).toContain('院区导览');
    expect(view).toContain('ResponsiveSheet');
    expect(view).toContain('getCompatibleDirectoryFacetOptions');
    expect(view).toContain('updateDirectoryFilterSelection');
    expect(view).toContain('groupDirectoryEntriesByContact');
    expect(view).toContain("'is-merged': entryGroup.entries.length > 1");
    expect(view.indexOf('class="filter-sheet-toolbar"')).toBeLessThan(
      view.indexOf('class="directory-filter-grid"'),
    );
    expect(view).toContain('aria-pressed');
    expect(view).toContain("canDialDirectoryNumber(contact.type, 'extension')");
    expect(view).toContain('getSafeInternalExtension(contact)');
    expect(view).toMatch(/\.directory-dial-action\s*{[^}]*min-height:\s*44px/s);
    expect(view).toMatch(/\.contact-method\s*{[^}]*min-height:\s*44px/s);
    expect(view).not.toContain('class="number-row"');
    expect(view).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
