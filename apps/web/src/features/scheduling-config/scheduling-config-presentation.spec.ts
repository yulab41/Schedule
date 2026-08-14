import { describe, expect, it } from 'vitest';

import { getSchedulingConfigurationOverview } from './scheduling-config-presentation.js';

describe('scheduling configuration presentation', () => {
  it('summarizes roles, enabled shifts, and uniquely assigned members without changing config', () => {
    const overview = getSchedulingConfigurationOverview({
      groupMembers: [
        { membershipId: 'member-a' },
        { membershipId: 'member-b' },
        { membershipId: 'member-c' },
      ],
      roles: [
        { members: [{ membershipId: 'member-a' }, { membershipId: 'member-b' }] },
        { members: [{ membershipId: 'member-b' }] },
      ],
      shiftTypes: [{ isEnabled: true }, { isEnabled: false }, { isEnabled: true }],
    });

    expect(overview.status).toBe('established');
    expect(overview.statusLabel).toBe('基础配置已建立');
    expect(overview.steps.map((step) => [step.label, step.value, step.isComplete])).toEqual([
      ['排班岗位', '2 项', true],
      ['启用班种', '2 项', true],
      ['已配置成员', '2 / 3 位', true],
    ]);
  });

  it('describes incomplete foundations without claiming the schedule is ready', () => {
    const overview = getSchedulingConfigurationOverview({
      groupMembers: [{ membershipId: 'member-a' }],
      roles: [],
      shiftTypes: [{ isEnabled: false }],
    });

    expect(overview.status).toBe('incomplete');
    expect(overview.statusLabel).toBe('还有基础配置待完善');
    expect(overview.steps.every((step) => !step.isComplete)).toBe(true);
  });
});
