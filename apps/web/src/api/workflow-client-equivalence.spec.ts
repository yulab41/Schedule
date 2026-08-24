import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Web workflow client-core delegation', () => {
  it('routes every workflow family through the shared transport', () => {
    const source = readFileSync(new URL('./client.ts', import.meta.url), 'utf8');
    expect(source).toContain('createWorkflowClient');
    expect(source).toContain('const workflowClient = createWorkflowClient(sharedClientTransport)');
    for (const method of [
      'createLeaveRequest',
      'approveLeaveRequest',
      'createSwapRequest',
      'acceptSwapRequest',
      'createDutyAdjustmentRequest',
      'acceptDutyAdjustment',
      'updateGroupSwapSettings',
      'updateGroupDutyAdjustmentSettings',
    ]) {
      expect(source).toContain(`return workflowClient.${method}(`);
    }
  });
});
