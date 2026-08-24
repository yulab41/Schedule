import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Web workflow operation attempt delegation', () => {
  it('freezes ambiguous create and mutation submissions in every production panel', () => {
    for (const relativePath of [
      '../leaves/LeavePanel.vue',
      '../leaves/LeaveApprovalDialog.vue',
      '../swaps/SwapPanel.vue',
      '../duty-adjustments/DutyAdjustmentPanel.vue',
    ]) {
      const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
      expect(source).toContain('resolveWorkflowOperationAttempt');
      expect(source).toContain('operationAttempts');
      expect(source).toContain('operationAttempts.delete(');
    }
  });
});
