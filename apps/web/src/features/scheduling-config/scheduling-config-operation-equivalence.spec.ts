import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('P8 Web scheduling configuration mutation equivalence', () => {
  it('delegates every configuration mutation through the shared write client', () => {
    const client = readFileSync(new URL('../../api/client.ts', import.meta.url), 'utf8');
    expect(client).toContain('createSchedulingConfigWriteClient');
    expect(client).toContain(
      'const schedulingConfigWriteClient = createSchedulingConfigWriteClient(sharedClientTransport)',
    );
    for (const method of [
      'createScheduleRole',
      'replaceScheduleRoleMembers',
      'reorderRotationMembers',
      'updateRotationRule',
      'deleteScheduleRole',
      'createShiftType',
      'updateShiftType',
      'deleteShiftType',
    ]) {
      expect(client).toContain(`return schedulingConfigWriteClient.${method}(`);
    }
  });

  it('freezes retries in the production configuration write surface', () => {
    const source = readFileSync(new URL('./SchedulingConfigPanel.vue', import.meta.url), 'utf8');
    expect(source).toContain('resolveWorkflowOperationAttempt');
    expect(source).toContain('operationAttempts');
    expect(source).toContain('crypto.randomUUID');
    expect(source).toContain('expectedRulesVersion: config.value.rulesVersion');
    expect(source).toContain('expectedRoleVersion: role.version');
    expect(source).toContain('expectedRotationRuleVersion: role.rotationRule.version');
    expect(source).toContain('expectedVersion: shiftType.version');
  });
});
