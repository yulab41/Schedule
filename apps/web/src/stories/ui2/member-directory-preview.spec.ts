import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('member directory Storybook preview', () => {
  it('presents an Apple-style contact directory with an explicit self edit action', () => {
    const preview = readSource('./MemberDirectoryPreview.vue');

    expect(preview).toContain('class="self-contact-card"');
    expect(preview).toContain('我的资料');
    expect(preview).toContain('长号');
    expect(preview).toContain('短号');
    expect(preview).toContain('>修改<');
    expect(preview).toContain('font-variant-numeric: tabular-nums');
    expect(preview).toContain('ResponsiveSheet');
    expect(preview).not.toContain('class="persistent-contact-form"');
  });

  it('keeps administrator actions subordinate and exposes the required review states', () => {
    const preview = readSource('./MemberDirectoryPreview.vue');
    const stories = readSource('./MemberDirectoryPreview.stories.ts');

    expect(preview).toContain("viewerRole === 'administrator'");
    expect(preview).toContain("viewerRole === 'developer'");
    expect(preview).toContain('member-secondary-action');
    expect(stories).toContain('OrdinaryMember390');
    expect(stories).toContain('Administrator390');
    expect(stories).toContain('DeveloperDesktop1280');
    expect(stories).toContain('MissingNumber320');
    expect(stories).toContain('EditSheet390');
    expect(stories).toContain('SavedState390');
    expect(stories).toContain("viewport: 'mobile320'");
    expect(stories).toContain("viewport: 'mobile390'");
    expect(stories).toContain("viewport: 'desktop1280'");
  });

  it('defines visible focus and reduced-motion behavior for interactive preview controls', () => {
    const preview = readSource('./MemberDirectoryPreview.vue');

    expect(preview).toMatch(/:focus-visible\s*{[^}]*outline:/s);
    expect(preview).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
