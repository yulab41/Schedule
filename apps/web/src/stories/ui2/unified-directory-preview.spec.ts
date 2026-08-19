import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('unified directory Storybook proposal', () => {
  it('keeps the two original directory modes behind one accessible switcher', () => {
    const preview = source('../../views/directory/UnifiedDirectoryView.vue');

    expect(preview).toContain('role="tablist"');
    expect(preview).toContain('role="tab"');
    expect(preview).toContain('科室');
    expect(preview).toContain('人员');
    expect(preview).toContain('<KeepAlive>');
    expect(preview).toContain(':key="activeDirectory"');
    expect(preview).toContain("directoryKind: 'internal'");
    expect(preview).toContain("directoryKind: 'employee'");
    expect(preview).toContain('InternalDirectoryView');
  });

  it('ships isolated mobile and desktop Storybook states with synthetic data', () => {
    const stories = source('./UnifiedDirectoryPreview.stories.ts');

    expect(stories).toContain("from '../../views/directory/UnifiedDirectoryView.vue'");
    expect(stories).toContain('internalDataSource');
    expect(stories).toContain('employeeDataSource');
    expect(stories).toContain('DepartmentMobile390');
    expect(stories).toContain('PeopleMobile390');
    expect(stories).toContain('Desktop1280');
    expect(stories).toContain("initialDirectory: 'employee'");
    expect(stories).toContain("groupCode: '0001'");
    expect(stories).not.toContain('138027');
  });

  it('uses one restrained signature surface with keyboard and reduced-motion support', () => {
    const preview = source('../../views/directory/UnifiedDirectoryView.vue');

    expect(preview).toContain('aria-selected');
    expect(preview).toContain('@keydown.left.prevent');
    expect(preview).toContain('@keydown.right.prevent');
    expect(preview).toContain(':focus-visible');
    expect(preview).toContain('@media (prefers-reduced-motion: reduce)');
    expect(preview).toContain('--directory-accent: #0a66d5');
    expect(preview).toMatch(/\.directory-mode-tab\s*{[^}]*min-height:\s*44px/s);
  });
});
