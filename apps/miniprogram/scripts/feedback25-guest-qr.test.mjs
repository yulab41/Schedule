import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = (path) => readFileSync(`${root}/${path}`, 'utf8');

describe('Feedback25 guest calendar and visitor QR', () => {
  it('uses the member 62px row height in every guest month panel', () => {
    const guest = source('src/pages/guest/guest.ts');
    expect(guest).toContain('view.monthPanels.map((panel) => ({ ...panel, rowHeight: 62 }))');
  });

  it('renders the same list duty-state field as the member calendar', () => {
    const guest = source('src/pages/guest/guest.wxml');
    const member = source('src/pages/workbench/index.wxml');
    const stateMarkup = 'class="duty-work-state list-work-state is-{{duty.dutyState}}"';
    expect(member).toContain(stateMarkup);
    expect(guest).toContain(stateMarkup);
  });

  it('keeps the complete guest list body structurally identical to the member list body', () => {
    const extract = (value) => {
      const marker = "viewMode === 'list'}}\">";
      const start = value.indexOf(marker);
      const end = value.indexOf('</block>', start);
      return value
        .slice(start, end)
        .replace(/\s+/gu, ' ')
        .replace(/\s+>/gu, '>')
        .replace(/>\s+</gu, '><')
        .trim();
    };
    expect(extract(source('src/pages/guest/guest.wxml'))).toBe(
      extract(source('src/pages/workbench/index.wxml')),
    );
  });

  it('keeps the member calendar implementation untouched while documenting allowed guest differences', () => {
    const design = source(
      '../../docs/superpowers/specs/2026-09-13-feedback25-guest-calendar-qr-performance-design.md',
    );
    expect(design).toContain('允许差异仅限访客标题、返回登录按钮、权限控制和成员工作台外壳');
  });

  it('uses persistent QR assets and parallel release/trial generation', () => {
    const service = source('../api/src/modules/groups/visitor-key-service.ts');
    const schema = source('../../packages/database/src/schema/index.ts');
    expect(schema).toContain("mysqlTable(\n  'group_visitor_qr_assets'");
    expect(service).toContain('Promise.all');
    expect(service).toContain('groupVisitorQrAssets');
    expect(service).toContain('if (stored?.visitorKey === visitorKey)');
    expect(service).not.toContain('QR_CACHE_TTL_MS');
  });

  it('renames rotation copy to refresh while retaining immediate old-code invalidation', () => {
    const template = source(
      'src/subpackages/organization/components/invite-visitor-panel/index.wxml',
    );
    const controller = source(
      'src/subpackages/organization/components/invite-visitor-panel/controller.ts',
    );
    expect(template).not.toContain('轮换访客码');
    expect(template).toContain('刷新访客码');
    expect(controller).toContain('访客码已刷新，旧入口立即失效。');
  });
});
