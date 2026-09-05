import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const read = (file) => readFileSync(path.join(root, file), 'utf8');

describe('Mini directory reuses the accepted green phone source', () => {
  it('keeps one consumed phone asset without changing canonical phone geometry', () => {
    const catalog = read('packages/ui-icons/src/catalog.ts');
    const assets = catalog.slice(catalog.indexOf('export const miniAssetEntries'));
    expect(assets).toContain(
      "{ fileKey: 'phone-success', sourceKey: 'phone', colorRole: 'success' }",
    );
    expect(assets).not.toMatch(/fileKey: 'phone'/u);
    expect(catalog).toContain('const phone = tdesign(');
  });

  it('uses the same generated asset at both real call sites', () => {
    const card = read(
      'apps/miniprogram/src/subpackages/organization/components/directory-entry-card/index.wxml',
    );
    const workbench = read('apps/miniprogram/src/pages/workbench/index.wxml');
    expect(card).toContain('/assets/icons/ui-phone-success.svg');
    expect(workbench).toContain('/assets/icons/ui-phone-success.svg');
    expect(card).not.toMatch(/\/assets\/icons\/(?:web-[^"']*phone[^"']*|ui-phone)\.svg/u);
    expect(card).toContain('bindtap="handleCall"');
    expect(card).toContain('animatingNumberId === number.id');
  });

  it('preserves the directory phone animation on the shared success asset', () => {
    const parity = read('packages/ui-icons/src/parity.ts');
    const motion = parity.slice(parity.indexOf('const motionByFileKey'));
    expect(motion).toContain("'phone-success': 'phone'");
    expect(read('packages/ui-icons/src/platform-bindings.ts')).toContain(
      "motion('.phone-icon.is-animating', 'phone', 'phone-body'",
    );
  });
});
