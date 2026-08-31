import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('Mini test-tools visual golden', () => {
  it('covers 390, 320 and large-text states with the safety/build strip visible', () => {
    const preview = read('./TestToolsPreview.vue');
    const stories = read('./TestToolsPreview.stories.ts');

    expect(stories).toContain('export const Ready390');
    expect(stories).toContain('export const Ready320');
    expect(stories).toContain("viewport: 'mobile320'");
    expect(stories).toContain('export const LargeText390');
    expect(preview).toContain('内存有界 · 已脱敏');
    expect(preview).toContain('最终以小米 14 体验版为准');
    expect(preview).toContain('@media (max-width: 340px)');
    expect(preview).toContain('overflow-x: hidden');
    expect(preview).toContain('通讯录性能诊断');
    expect(preview).toContain('复制最近 10 次');
    expect(preview).toContain('setData 3 次');
  });

  it('uses only synthetic, already-redacted diagnostic content', () => {
    const preview = read('./TestToolsPreview.vue');

    expect(preview).toContain('/api/groups/:value/calendar');
    expect(preview).not.toMatch(/138\d{8}|Bearer\s|Authorization:|openid=/iu);
  });
});
