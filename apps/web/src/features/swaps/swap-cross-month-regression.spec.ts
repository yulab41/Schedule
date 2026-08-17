import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const panelSource = readFileSync(
  fileURLToPath(new URL('./SwapPanel.vue', import.meta.url)),
  'utf8',
);

function functionBody(name: string, nextName: string): string {
  const start = panelSource.indexOf(`function ${name}`);
  const end = panelSource.indexOf(`function ${nextName}`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return panelSource.slice(start, end);
}

describe('cross-month swap forms', () => {
  it('keeps independent months for both member and administrator swap sides', () => {
    expect(panelSource).toContain('const myAssignmentMonth = ref(getCurrentBusinessMonth())');
    expect(panelSource).toContain('const targetAssignmentMonth = ref(getCurrentBusinessMonth())');
    expect(panelSource).toContain('const adminInitiatorMonth = ref(getCurrentBusinessMonth())');
    expect(panelSource).toContain('const adminTargetMonth = ref(getCurrentBusinessMonth())');
    expect(panelSource).not.toContain('const businessMonth = ref(getCurrentBusinessMonth())');

    expect(panelSource).toContain('我的班次月份');
    expect(panelSource).toContain('对方班次月份');
    expect(panelSource).toContain('成员一月份');
    expect(panelSource).toContain('成员二月份');
  });

  it('clears only the changed side assignment and the existing preview', () => {
    const myMonthChange = functionBody(
      'onMyAssignmentMonthChange',
      'onTargetAssignmentMonthChange',
    );
    expect(myMonthChange).toContain("selectedMyAssignmentId.value = ''");
    expect(myMonthChange).toContain('preview.value = undefined');
    expect(myMonthChange).not.toContain('selectedTargetAssignmentId.value');

    const targetMonthChange = functionBody(
      'onTargetAssignmentMonthChange',
      'onAdminInitiatorMonthChange',
    );
    expect(targetMonthChange).toContain("selectedTargetAssignmentId.value = ''");
    expect(targetMonthChange).toContain('preview.value = undefined');
    expect(targetMonthChange).not.toContain('selectedMyAssignmentId.value');

    const adminInitiatorMonthChange = functionBody(
      'onAdminInitiatorMonthChange',
      'onAdminTargetMonthChange',
    );
    expect(adminInitiatorMonthChange).toContain("adminInitiatorAssignmentId.value = ''");
    expect(adminInitiatorMonthChange).toContain('adminPreview.value = undefined');
    expect(adminInitiatorMonthChange).not.toContain('adminTargetAssignmentId.value');

    const adminTargetMonthChange = functionBody('onAdminTargetMonthChange', 'onTargetChange');
    expect(adminTargetMonthChange).toContain("adminTargetAssignmentId.value = ''");
    expect(adminTargetMonthChange).toContain('adminPreview.value = undefined');
    expect(adminTargetMonthChange).not.toContain('adminInitiatorAssignmentId.value');
  });

  it('keeps the original weekday option renderer without adding shift times', () => {
    expect(panelSource).toContain('createAssignmentOption,');
    expect(panelSource).toContain('return createAssignmentOption(assignment);');
    expect(panelSource).not.toContain('formatSwapAssignmentOption');
  });
});
