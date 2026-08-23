import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

const previewSource = readFileSync(
  fileURLToPath(new URL('./P5SchedulingClosurePreview.vue', import.meta.url)),
  'utf8',
);
const storiesSource = readFileSync(
  fileURLToPath(new URL('./P5SchedulingClosurePreview.stories.ts', import.meta.url)),
  'utf8',
);

describe('P5 scheduling closure golden preview', () => {
  it('uses the shared bounded manual schedule contract without a business API', () => {
    expect(previewSource).toContain("from '@schedule/contracts/manual-schedule-limits'");
    expect(previewSource).toContain('MAX_MANUAL_MEMBERS');
    expect(previewSource).toContain('MAX_MANUAL_DAYS');
    expect(previewSource).toContain('MAX_MANUAL_CELLS');
    expect(previewSource).toContain('<ManualGrid');
    expect(previewSource).not.toContain('createApiClient');
    expect(previewSource).not.toContain('localAuth');
  });

  it('covers the full P5 visual state matrix before native implementation', () => {
    for (const state of [
      'editor',
      'maximum',
      'preview',
      'risk',
      'release',
      'release-blocked',
      'release-delete',
      'release-republish',
      'release-withdraw',
      'backfill',
      'phone-consent',
    ]) {
      expect(previewSource).toContain(`'${state}'`);
    }
    expect(previewSource).toContain('排班交接轨');
    expect(previewSource).toContain('确认后才会生效并留下“排班补录”事件记录');
    expect(previewSource).toContain('管理员不能代替成员授权');
    expect(previewSource).toContain('范围变化后必须重新生成预览');
  });

  it('mirrors the Web mobile draft and publication-history structure', () => {
    expect(previewSource).toContain('class="web-parity-page manual-release-page"');
    expect(previewSource).toContain('<h2>手动排班</h2>');
    expect(previewSource).toContain('<h3>排班草稿</h3>');
    expect(previewSource).toContain('发布整个排班');
    expect(previewSource).toContain('删除草稿');
    expect(previewSource).toContain('<h3>排班发布记录</h3>');
    expect(previewSource).toContain('当前已发布');
    expect(previewSource).toContain('撤销发布');
    expect(previewSource).toContain('<summary>已归档（1）</summary>');
    expect(previewSource).toContain('重新发布');
    expect(previewSource).not.toContain('version-timeline');
  });

  it('covers every dangerous publication confirmation before native implementation', () => {
    expect(previewSource).toContain('发布范围包含已有已发布排班的月份，请确认覆盖发布。');
    expect(previewSource).toContain('覆盖已发布排班（替换同岗位同月份的旧排班）');
    expect(previewSource).toContain('撤销当前排班');
    expect(previewSource).toContain('重新发布归档排班');
    expect(previewSource).toContain('我已了解已过日期不可修改，确认发布');
    expect(previewSource).toContain('删除排班草稿');
    expect(previewSource).toContain('role="dialog"');
    expect(previewSource).toContain('aria-modal="true"');
  });

  it('mirrors the Web mobile past-schedule editor with a real MonthGrid', () => {
    expect(previewSource).toContain(
      "import MonthGrid from '../../features/calendar/MonthGrid.vue'",
    );
    expect(previewSource).toContain('class="web-parity-page past-schedule-view"');
    expect(previewSource).toContain('仅管理员与群主可进入');
    expect(previewSource).toContain('class="controls"');
    expect(previewSource).toContain('class="palette-section"');
    expect(previewSource).toContain('class="paint-status is-ready"');
    expect(previewSource).toContain('待确认补录（{{ backfillPending.length }}）');
    expect(previewSource).toContain('清空草稿');
    expect(previewSource).toContain('<MonthGrid');
    expect(previewSource).toContain(':invert-past-colors="true"');
    expect(previewSource).toContain('<h3>最近补录记录</h3>');
    expect(previewSource).not.toContain('原子补录批次');
  });

  it('uses the Web mobile cell toggle interaction without a standalone undo button', () => {
    expect(previewSource).toContain('applyManualCellMutation');
    expect(previewSource).toContain('resolveManualCellMutation');
    expect(previewSource).toContain("mode: 'toggle'");
    expect(previewSource).not.toContain('applyShiftToCell');
    expect(previewSource).not.toContain('undoStack');
    expect(previewSource).not.toContain('class="quiet-action"');
    expect(previewSource).not.toContain('@click="undo"');
  });

  it('places phone consent inside group settings instead of scheduling', () => {
    expect(previewSource).toContain("activeState === 'phone-consent'");
    expect(previewSource).toContain("? '群组管理'");
    expect(previewSource).toContain('class="web-parity-page group-setup-panel"');
    expect(previewSource).toContain('<p>协作身份</p>');
    expect(previewSource).toContain('<h2>群组管理</h2>');
    expect(previewSource).toContain('<span>当前工作群组</span>');
    expect(previewSource).toContain('class="group-card contact-consent-card"');
    expect(previewSource).toContain('class="preference-scope is-personal"');
    expect(previewSource).toContain('允许本群组显示完整手机号');
    expect(previewSource).toContain('v-if="isSchedulingState" class="handoff-rail"');
    expect(storiesSource).toContain('8 · 群组设置 / 手机号同意 · 390×844');
  });

  it('publishes 390 and 320 review stories with safe touch and narrow-screen rules', () => {
    for (const story of [
      'Editor390',
      'Editor320',
      'Maximum390',
      'Preview390',
      'RiskBlocked390',
      'Release390',
      'ReleaseBlocked390',
      'ReleaseWithdraw390',
      'ReleaseRepublish390',
      'ReleaseDelete390',
      'ReleaseRepublish320',
      'Backfill390',
      'PhoneConsent390',
    ]) {
      expect(storiesSource).toContain(`export const ${story}`);
    }
    expect(previewSource).toContain('min-height: 44px');
    expect(previewSource).toContain('@media (max-width: 340px)');
    expect(previewSource).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
