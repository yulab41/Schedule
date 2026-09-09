import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
describe('feedback7 group layout boundaries', () => {
  it('renders member editors outside the scrolling document and dissolves at the bottom', () => {
    const wxml = read('subpackages/organization/components/group-settings-panel/index.wxml');
    expect(wxml.includes('当前群组操作')).toBe(false);
    expect(wxml.includes('wx:if="{{managementInfo}}"')).toBe(false);
    expect(wxml.indexOf('<ui-sheet')).toBeGreaterThan(wxml.indexOf('</scroll-view>'));
    expect(wxml.indexOf('bindtap="handleDissolveGroup"')).toBeGreaterThan(
      wxml.indexOf('contact-disclosure-card'),
    );
  });
  it('shares the existing transient feedback timer for management messages', () => {
    const ts = read('subpackages/organization/components/group-settings-panel/controller.ts');
    expect(ts.includes('showManagementFeedback')).toBe(true);
  });
});
