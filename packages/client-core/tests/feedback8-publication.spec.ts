import { describe, expect, it } from 'vitest';
import {
  scheduleGenerationPreviewDecoder,
  schedulePublicationEndpoints,
} from '../src/schedule-publication-client.js';

describe('feedback8 stored draft wire contract', () => {
  it('decodes the complete stored-assignment response, including vacancies and warnings', () => {
    const assignment = {
      businessDate: '2026-11-01',
      startsAt: '2026-11-01T00:00:00.000Z',
      endsAt: '2026-11-02T00:00:00.000Z',
      plannedMemberId: 'member',
      plannedMemberName: '测试成员',
      scheduleRoleId: 'role',
      scheduleRoleName: '一线',
      shiftTypeId: 'shift',
      shiftTypeName: '全天班',
      shiftTypeAbbreviation: '全',
      shiftTypeColor: '#267d70',
      slotPosition: 1,
    };
    const preview = {
      assignments: [assignment],
      businessMonth: '2026-11',
      rulesVersion: 1,
      scheduleRoleIds: ['role'],
      statistics: {
        assignmentCount: 1,
        countedAssignmentCount: 1,
        vacancyCount: 0,
        byRole: [
          {
            assignmentCount: 1,
            countedAssignmentCount: 1,
            scheduleRoleId: 'role',
            scheduleRoleName: '一线',
            vacancyCount: 0,
          },
        ],
        byShiftType: [
          {
            assignmentCount: 1,
            countedAssignmentCount: 1,
            shiftTypeId: 'shift',
            shiftTypeName: '全天班',
            shiftTypeAbbreviation: '全',
          },
        ],
      },
      continuousDutyWarnings: [],
      hardConflicts: [],
      vacancies: [],
    };
    expect(scheduleGenerationPreviewDecoder.safeDecode(preview)).toEqual({
      success: true,
      data: preview,
    });
    expect(
      scheduleGenerationPreviewDecoder.safeDecode({
        ...preview,
        assignments: [{ ...assignment, surprise: true }],
      }).success,
    ).toBe(false);
  });
  it('provides valid JSON for native DELETE requests without changing the idempotency key', () => {
    const input = { groupId: 'group', schedulePeriodId: 'period', operationId: 'operation' };
    const endpoint = schedulePublicationEndpoints.deleteDraft;
    expect(JSON.stringify(endpoint.body?.(input))).toBe('{}');
    expect(endpoint.idempotencyKey?.(input)).toBe('operation');
    expect(endpoint.decoder.safeDecode('')).toEqual({ success: true, data: undefined });
  });
});
