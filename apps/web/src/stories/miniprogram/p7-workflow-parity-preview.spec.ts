import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('P7 workflow parity Storybook golden', () => {
  it('renders the four production workflow panels instead of a simplified duplicate', () => {
    const preview = read('./P7WorkflowParityPreview.vue');
    const storybookPreview = read('../../../.storybook/preview.ts');
    const homeView = read('../../views/HomeView.vue');
    const leavePanel = read('../../features/leaves/LeavePanel.vue');

    expect(preview).toContain('../../views/HomeView.vue');
    expect(preview).toContain('<HomeView');
    for (const productionComponent of ['LeavePanel', 'SwapPanel', 'DutyAdjustmentPanel']) {
      expect(homeView).toContain(`import ${productionComponent}`);
      expect(homeView).toContain(`<${productionComponent}`);
    }
    expect(leavePanel).toContain("import LeaveApprovalDialog from './LeaveApprovalDialog.vue'");
    expect(leavePanel).toContain('<LeaveApprovalDialog');
    expect(leavePanel).toContain(':min="todayDate"');
    expect(leavePanel).toContain(':min="endDateMin"');
    expect(storybookPreview).toContain('setup((app) => {');
    expect(storybookPreview).toContain('app.use(TDesign)');
    expect(preview).not.toContain('class="workflow-card"');
  });

  it('freezes every role, surface, workflow status, failure, and 320 boundary', () => {
    const fixtures = read('./p7-workflow-parity-fixtures.ts');
    const stories = read('./P7WorkflowParityPreview.stories.ts');

    for (const status of [
      'pending',
      'approved',
      'rejected',
      'pending_target',
      'pending_approval',
      'completed',
      'cancelled',
      'revoked',
    ]) {
      expect(fixtures).toContain(`'${status}'`);
    }
    for (const surface of [
      'list',
      'create',
      'approval',
      'preview',
      'conflict',
      'direct',
      'empty',
      'error',
      'loading',
    ]) {
      expect(stories).toContain(`surface: '${surface}'`);
    }
    for (const role of ["role: 'member'", "role: 'owner'"]) {
      expect(stories).toContain(role);
    }
    for (const story of [
      'LeaveMember390',
      'LeaveCreate390',
      'LeaveApprovalConflict390',
      'LeaveEmpty320',
      'LeaveError320',
      'LeaveLoading320',
      'SwapMemberStates390',
      'SwapCreatePreview390',
      'SwapAdminStates390',
      'SwapDirect320',
      'SwapEmpty320',
      'SwapError320',
      'SwapLoading320',
      'DutyMemberStates390',
      'DutyCreateConflict390',
      'DutyAdminStates390',
      'DutyDirect320',
      'DutyEmpty320',
      'DutyError320',
      'DutyLoading320',
    ]) {
      expect(stories).toContain(`export const ${story}`);
    }
    expect(stories).toContain("title: 'Miniprogram Parity/P7 Workflow Parity'");
    expect(stories.match(/viewport: 'mobile320'/gu)).toHaveLength(11);
  });

  it('keeps the production leave reflow preview action at the 44px touch boundary', () => {
    const approval = read('../../features/leaves/LeaveApprovalDialog.vue');

    expect(approval).toContain('class="strategy-preview-action"');
    expect(approval).toMatch(
      /\.strategy-preview-action[^}]*min-height:\s*var\(--ui-touch-target-minimum\)/su,
    );
  });

  it('registers the exact P7 story ids and fixture states in the golden manifest', () => {
    const manifest = read('../../../../miniprogram/docs/design/page-golden-manifest.md');

    expect(manifest).toContain('miniprogram-parity-p7-workflow-parity--leave-member-390');
    expect(manifest).toContain('miniprogram-parity-p7-workflow-parity--leave-empty-320');
    expect(manifest).toContain('miniprogram-parity-p7-workflow-parity--swap-direct-320');
    expect(manifest).toContain('miniprogram-parity-p7-workflow-parity--duty-error-320');
    expect(manifest).toContain('390 全状态已固化');
    expect(manifest).toContain('320 边界已固化');
  });
});
