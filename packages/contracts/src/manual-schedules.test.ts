import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { MAX_MANUAL_CELLS, MAX_MANUAL_DAYS, MAX_MANUAL_MEMBERS } from './manual-schedule-limits.js';
import {
  applyManualScheduleTemplateRequestSchema,
  createManualScheduleTemplateRequestSchema,
  manualApplyPreviewSchema,
  manualScheduleTemplateCellSchema,
  manualScheduleTemplateSchema,
  previewManualTemplateApplyRequestSchema,
  updateManualScheduleTemplateRequestSchema,
} from './manual-schedules.js';

function maximumTemplateRequest() {
  const membershipIds = Array.from({ length: MAX_MANUAL_MEMBERS }, () => randomUUID());
  const shiftTypeId = randomUUID();
  const cells = Array.from({ length: MAX_MANUAL_DAYS }, (_, dayIndex) =>
    membershipIds.map((membershipId) => ({
      cycleDay: dayIndex + 1,
      membershipId,
      shiftTypeId,
    })),
  ).flat();

  expect(cells).toHaveLength(MAX_MANUAL_CELLS);
  return {
    cells,
    cycleDays: MAX_MANUAL_DAYS,
    membershipIds,
    scheduleRoleId: randomUUID(),
    startDate: '2026-08-01',
  };
}

describe('manual schedule input contracts', () => {
  it('accepts the exact 20-member, 30-day, 600-cell template boundary', () => {
    const request = maximumTemplateRequest();

    expect(createManualScheduleTemplateRequestSchema.safeParse(request).success).toBe(true);
    expect(
      updateManualScheduleTemplateRequestSchema.safeParse({ ...request, expectedVersion: 1 })
        .success,
    ).toBe(true);
  });

  it('rejects 21 members, 31 days, and 601 cells at the contract boundary', () => {
    const request = maximumTemplateRequest();

    expect(
      createManualScheduleTemplateRequestSchema.safeParse({
        ...request,
        membershipIds: [...request.membershipIds, randomUUID()],
      }).success,
    ).toBe(false);
    expect(
      createManualScheduleTemplateRequestSchema.safeParse({
        ...request,
        cycleDays: MAX_MANUAL_DAYS + 1,
      }).success,
    ).toBe(false);
    expect(
      createManualScheduleTemplateRequestSchema.safeParse({
        ...request,
        cells: [...request.cells, request.cells[0] as (typeof request.cells)[number]],
      }).success,
    ).toBe(false);
  });

  it('accepts 30 inclusive apply days and rejects 31 days or invalid dates', () => {
    const previewBase = {
      endDate: '2026-01-30',
      expectedRulesVersion: 1,
      startDate: '2026-01-01',
    };
    expect(previewManualTemplateApplyRequestSchema.safeParse(previewBase).success).toBe(true);
    expect(
      applyManualScheduleTemplateRequestSchema.safeParse({
        ...previewBase,
        operationId: randomUUID(),
      }).success,
    ).toBe(true);

    expect(
      previewManualTemplateApplyRequestSchema.safeParse({
        ...previewBase,
        endDate: '2026-01-31',
      }).success,
    ).toBe(false);
    expect(
      previewManualTemplateApplyRequestSchema.safeParse({
        ...previewBase,
        startDate: '2026-02-29',
      }).success,
    ).toBe(false);
    expect(
      applyManualScheduleTemplateRequestSchema.safeParse({
        ...previewBase,
        endDate: '2026-01-31',
        operationId: randomUUID(),
      }).success,
    ).toBe(false);
  });

  it('enforces the same day boundary on template and preview responses', () => {
    const template = {
      cells: [],
      cycleDays: MAX_MANUAL_DAYS,
      groupId: 'group-1',
      id: 'template-1',
      members: [],
      scheduleRoleId: 'role-1',
      scheduleRoleName: '一线',
      startDate: '2026-01-01',
      version: 1,
    };
    expect(manualScheduleTemplateSchema.safeParse(template).success).toBe(true);
    expect(
      manualScheduleTemplateSchema.safeParse({
        ...template,
        cycleDays: MAX_MANUAL_DAYS + 1,
      }).success,
    ).toBe(false);
    expect(
      manualScheduleTemplateCellSchema.safeParse({
        currentShiftTypeConfigurationVersion: 1,
        cycleDay: MAX_MANUAL_DAYS + 1,
        isShiftTypeEnabled: true,
        isStale: false,
        membershipId: 'membership-1',
        shiftTypeAbbreviation: '全',
        shiftTypeColor: '#1F5AA6',
        shiftTypeConfigurationVersion: 1,
        shiftTypeId: 'shift-1',
        shiftTypeName: '全天班',
        shiftTypeTextColor: '#FFFFFF',
      }).success,
    ).toBe(false);

    const preview = {
      applyEndDate: '2026-01-30',
      applyStartDate: '2026-01-01',
      assignments: [],
      conflicts: [],
      continuousDutyWarnings: [],
      cycleDays: MAX_MANUAL_DAYS,
      rulesVersion: 1,
      scheduleRoleId: 'role-1',
      scheduleRoleName: '一线',
      statistics: {
        assignmentCount: 0,
        byRole: [],
        byShiftType: [],
        countedAssignmentCount: 0,
        vacancyCount: 0,
      },
      templateId: 'template-1',
      templateVersion: 1,
      vacancies: [],
    };
    expect(manualApplyPreviewSchema.safeParse(preview).success).toBe(true);
    expect(
      manualApplyPreviewSchema.safeParse({ ...preview, applyEndDate: '2026-01-31' }).success,
    ).toBe(false);
    expect(
      manualApplyPreviewSchema.safeParse({ ...preview, cycleDays: MAX_MANUAL_DAYS + 1 }).success,
    ).toBe(false);
  });

  it('rejects relationally inconsistent template responses', () => {
    const member = {
      currentMemberScheduleRoleVersion: 1,
      isAvailable: true,
      isStale: false,
      memberScheduleRoleVersion: 1,
      membershipId: 'membership-1',
      realName: '张医生',
    };
    const cell = {
      currentShiftTypeConfigurationVersion: 1,
      cycleDay: 1,
      isShiftTypeEnabled: true,
      isStale: false,
      membershipId: member.membershipId,
      shiftTypeAbbreviation: '全',
      shiftTypeColor: '#1F5AA6',
      shiftTypeConfigurationVersion: 1,
      shiftTypeId: 'shift-1',
      shiftTypeName: '全天班',
      shiftTypeTextColor: '#FFFFFF',
    };
    const template = {
      cells: [cell],
      cycleDays: 1,
      groupId: 'group-1',
      id: 'template-1',
      members: [member],
      scheduleRoleId: 'role-1',
      scheduleRoleName: '一线',
      startDate: '2026-01-01',
      version: 1,
    };

    expect(manualScheduleTemplateSchema.safeParse(template).success).toBe(true);
    expect(
      manualScheduleTemplateSchema.safeParse({
        ...template,
        cells: [{ ...cell, membershipId: 'membership-2' }],
      }).success,
    ).toBe(false);
    expect(
      manualScheduleTemplateSchema.safeParse({
        ...template,
        cells: [{ ...cell, cycleDay: 2 }],
      }).success,
    ).toBe(false);
    expect(
      manualScheduleTemplateSchema.safeParse({ ...template, cells: [cell, cell] }).success,
    ).toBe(false);
    expect(
      manualScheduleTemplateSchema.safeParse({ ...template, members: [member, member] }).success,
    ).toBe(false);
  });
});
