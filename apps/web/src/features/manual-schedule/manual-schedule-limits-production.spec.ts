import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

const editorSource = readFileSync(
  fileURLToPath(new URL('../../views/schedules/ManualScheduleView.vue', import.meta.url)),
  'utf8',
);
const applyDialogSource = readFileSync(
  fileURLToPath(new URL('./ApplyTemplateDialog.vue', import.meta.url)),
  'utf8',
);

describe('P5 manual schedule production limits', () => {
  it('caps the editor at the shared member, day, and cell limits', () => {
    expect(editorSource).toContain("from '@schedule/contracts/manual-schedule-limits'");
    expect(editorSource).toContain('getManualTemplateLimitError({');
    expect(editorSource).toContain(':max="MAX_MANUAL_DAYS"');
    expect(editorSource).toContain('membershipIds.length >= MAX_MANUAL_MEMBERS');
    expect(editorSource).toContain('staleSelectedMembers');
    expect(editorSource).toContain('失效成员（可移除）');
    expect(editorSource).not.toContain('max="31"');
  });

  it('blocks preview and apply outside the shared thirty-day inclusive range', () => {
    expect(applyDialogSource).toContain("from '@schedule/contracts/manual-schedule-limits'");
    expect(applyDialogSource).toContain('getManualApplyRangeError(');
    expect(applyDialogSource).toContain('rangeErrorMessage.value !== undefined');
    expect(applyDialogSource).toContain(':max="maximumEndDate"');
    expect(applyDialogSource).toContain('最多 ${MAX_MANUAL_DAYS} 天');
    expect(applyDialogSource).toContain('watch(manualApplyRangeFingerprint');
    expect(applyDialogSource).toContain('previewRangeFingerprint.value !==');
    expect(applyDialogSource).toContain('resetPreviewState');
    expect(applyDialogSource).toContain('if (hasBlockers.value && !acknowledgeBlockers.value)');
  });
});
