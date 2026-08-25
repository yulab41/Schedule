import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('P8 scheduling configuration mutation contracts', () => {
  it('requires operation ids and group rules versions on every configuration mutation', () => {
    const source = readFileSync(new URL('./scheduling-config.ts', import.meta.url), 'utf8');
    for (const typeName of [
      'CreateScheduleRoleRequest',
      'ReplaceScheduleRoleMembersRequest',
      'ReorderRotationMembersRequest',
      'UpdateRotationRuleRequest',
      'ScheduleRoleVersionMutationRequest',
      'CreateShiftTypeRequest',
      'UpdateShiftTypeRequest',
      'ShiftTypeVersionMutationRequest',
    ]) {
      expect(source).toMatch(
        new RegExp(
          `export interface ${typeName}[\\s\\S]*?readonly expectedRulesVersion: number;[\\s\\S]*?readonly operationId: string;[\\s\\S]*?\\n\\}`,
          'u',
        ),
      );
    }
  });

  it('requires role, rotation-rule, and shift-type entity versions where they can be stale', () => {
    const source = readFileSync(new URL('./scheduling-config.ts', import.meta.url), 'utf8');
    for (const typeName of [
      'ReplaceScheduleRoleMembersRequest',
      'ReorderRotationMembersRequest',
      'UpdateRotationRuleRequest',
    ]) {
      expect(source).toMatch(
        new RegExp(
          `export interface ${typeName}[\\s\\S]*?readonly expectedRoleVersion: number;[\\s\\S]*?readonly expectedRotationRuleVersion: number;[\\s\\S]*?\\n\\}`,
          'u',
        ),
      );
    }
    for (const typeName of [
      'ScheduleRoleVersionMutationRequest',
      'UpdateShiftTypeRequest',
      'ShiftTypeVersionMutationRequest',
    ]) {
      expect(source).toMatch(
        new RegExp(
          `export interface ${typeName}[\\s\\S]*?readonly expectedVersion: number;[\\s\\S]*?\\n\\}`,
          'u',
        ),
      );
    }
  });
});
