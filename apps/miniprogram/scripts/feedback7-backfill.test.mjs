import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
describe('feedback7 backfill and role layout', () => {
  it('removes the persistent success alert and vertically centers native input without vertical padding', () => {
    expect(
      read('subpackages/scheduling/pages/backfill/index.wxml').includes('tone="success"'),
    ).toBe(false);
    const css = read('subpackages/scheduling/pages/backfill/index.wxss');
    const input = css.match(/\.reason-field input\s*\{([^}]+)\}/u)[1];
    expect(input.includes('padding: 0 10px')).toBe(true);
    expect(input.includes('line-height: 44px')).toBe(true);
  });
  it('removes retired ordering actions and keeps member selection with a horizontal role header', () => {
    const css = read('subpackages/organization/components/scheduling-config-panel/index.wxss');
    const wxml = read('subpackages/organization/components/scheduling-config-panel/index.wxml');
    expect(wxml.includes('handleMoveRoleMember')).toBe(false);
    expect(wxml.includes('order-actions')).toBe(false);
    expect(wxml.includes('handleToggleRoleMember')).toBe(true);
    expect(/\.role-heading\s*\{[^}]*flex-direction: row/u.test(css)).toBe(true);
  });
});
