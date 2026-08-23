import type {
  AppliedManualScheduleTemplateResult,
  ManualApplyPreview,
  ManualScheduleTemplate,
  SchedulingConfig,
} from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createManualScheduleClient,
  manualApplyPreviewDecoder,
  manualScheduleEndpoints,
  manualScheduleTemplateDecoder,
  schedulingConfigDecoder,
  type ClientTransport,
} from '../src/index.js';

const groupId = '11111111-1111-4111-8111-111111111111';
const templateId = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';

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
const decodedTemplate = {
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
const decodedPreview = {
  applyEndDate: '2026-01-30',
  applyStartDate: '2026-01-01',
  assignments: [],
  conflicts: [],
  continuousDutyWarnings: [],
  cycleDays: 1,
  rulesVersion: 7,
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

describe('manual schedule client', () => {
  it('describes the bounded template and preview endpoints without a platform runtime', () => {
    expect(manualScheduleEndpoints.config.method).toBe('GET');
    expect(manualScheduleEndpoints.config.path({ groupId })).toBe(
      `/groups/${groupId}/scheduling-config`,
    );
    expect(manualScheduleEndpoints.templates.method).toBe('GET');
    expect(manualScheduleEndpoints.templates.path({ groupId })).toBe(
      `/groups/${groupId}/manual-schedule-templates`,
    );
    expect(
      manualScheduleEndpoints.preview.path({
        groupId,
        request: { expectedRulesVersion: 7 },
        templateId,
      }),
    ).toBe(`/groups/${groupId}/manual-schedule-templates/${templateId}/apply-preview`);
    expect(
      manualScheduleEndpoints.preview.body({
        groupId,
        request: { expectedRulesVersion: 7 },
        templateId,
      }),
    ).toEqual({ expectedRulesVersion: 7 });
  });

  it('keeps the apply operation id in both the body and idempotency header descriptor', () => {
    const input = {
      groupId,
      request: { expectedRulesVersion: 7, operationId, publishMode: 'draft' as const },
      templateId,
    };
    expect(manualScheduleEndpoints.apply.body(input)).toEqual(input.request);
    expect(manualScheduleEndpoints.apply.idempotencyKey?.(input)).toBe(operationId);
  });

  it('preserves endpoint receivers and request counts through the shared service', async () => {
    const config = {
      groupMembers: [],
      roles: [],
      rulesVersion: 7,
      shiftTypes: [],
    } as SchedulingConfig;
    const template = { id: templateId } as ManualScheduleTemplate;
    const preview = { templateId } as ManualApplyPreview;
    const applied = { operationId, templateId } as AppliedManualScheduleTemplateResult;
    const responses = new Map([
      ['manual-schedule.config', config],
      ['manual-schedule.templates', [template]],
      ['manual-schedule.create-template', template],
      ['manual-schedule.preview', preview],
      ['manual-schedule.apply', applied],
    ]);
    const transport: ClientTransport = {
      request: vi.fn((endpoint) => Promise.resolve(responses.get(endpoint.id) as never)),
    };
    const client = createManualScheduleClient(transport);

    await expect(client.getConfig(groupId)).resolves.toBe(config);
    await expect(client.listTemplates(groupId)).resolves.toEqual([template]);
    await expect(
      client.createTemplate(groupId, {
        cells: [],
        cycleDays: 1,
        membershipIds: [groupId],
        scheduleRoleId: groupId,
        startDate: '2026-08-23',
      }),
    ).resolves.toBe(template);
    await expect(client.preview(groupId, templateId, { expectedRulesVersion: 7 })).resolves.toBe(
      preview,
    );
    await expect(
      client.apply(groupId, templateId, {
        expectedRulesVersion: 7,
        operationId,
        publishMode: 'draft',
      }),
    ).resolves.toBe(applied);
    expect(transport.request).toHaveBeenCalledTimes(5);
  });

  it('rejects relationally inconsistent template responses after structural decoding', () => {
    expect(manualScheduleTemplateDecoder.safeDecode(decodedTemplate).success).toBe(true);
    expect(
      manualScheduleTemplateDecoder.safeDecode({ ...decodedTemplate, startDate: '2026-02-29' })
        .success,
    ).toBe(false);
    expect(
      manualScheduleTemplateDecoder.safeDecode({
        ...decodedTemplate,
        cells: [{ ...cell, membershipId: 'membership-2' }],
      }).success,
    ).toBe(false);
    expect(
      manualScheduleTemplateDecoder.safeDecode({
        ...decodedTemplate,
        cells: [{ ...cell, cycleDay: 2 }],
      }).success,
    ).toBe(false);
    expect(
      manualScheduleTemplateDecoder.safeDecode({ ...decodedTemplate, cells: [cell, cell] }).success,
    ).toBe(false);
    expect(
      manualScheduleTemplateDecoder.safeDecode({ ...decodedTemplate, members: [member, member] })
        .success,
    ).toBe(false);
  });

  it('accepts a 30-day preview response and rejects a 31-day response', () => {
    expect(manualApplyPreviewDecoder.safeDecode(decodedPreview).success).toBe(true);
    expect(
      manualApplyPreviewDecoder.safeDecode({ ...decodedPreview, applyEndDate: '2026-01-31' })
        .success,
    ).toBe(false);
    expect(
      manualApplyPreviewDecoder.safeDecode({
        ...decodedPreview,
        vacancies: [
          {
            assignmentBusinessKey: 'vacancy-1',
            businessDate: '2026-02-30',
            code: 'NO_ELIGIBLE_MEMBER',
            scheduleRoleId: 'role-1',
            slotPosition: 1,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('requires an integer rules version at the platform decoder boundary', () => {
    const config = { groupMembers: [], roles: [], rulesVersion: 7, shiftTypes: [] };
    expect(schedulingConfigDecoder.safeDecode(config).success).toBe(true);
    expect(schedulingConfigDecoder.safeDecode({ ...config, rulesVersion: 7.5 }).success).toBe(
      false,
    );
    const missingRulesVersion = { groupMembers: [], roles: [], shiftTypes: [] };
    expect(schedulingConfigDecoder.safeDecode(missingRulesVersion).success).toBe(false);
  });
});
