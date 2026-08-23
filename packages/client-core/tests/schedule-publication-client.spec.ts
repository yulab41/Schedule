import type {
  CalendarReadModel,
  PublishSchedulePeriodBatchResult,
  PublishSchedulePeriodResult,
  ScheduleChangeImpactPreview,
  ScheduleGenerationPreview,
  SchedulePeriodHistoryItem,
  SchedulePeriodMutationResult,
} from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createSchedulePublicationClient,
  schedulePublicationEndpoints,
  schedulePeriodHistoryListDecoder,
  type ClientTransport,
} from '../src/index.js';

const groupId = '11111111-1111-4111-8111-111111111111';
const schedulePeriodId = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';

describe('schedule publication client', () => {
  it('describes history, preview, impact, calendar, and dangerous write endpoints', () => {
    expect(schedulePublicationEndpoints.history.path({ groupId })).toBe(
      `/groups/${groupId}/schedule-periods/history`,
    );
    expect(
      schedulePublicationEndpoints.changeImpact.path({
        action: 'withdraw',
        groupId,
        schedulePeriodId,
      }),
    ).toBe(`/groups/${groupId}/schedules/${schedulePeriodId}/change-impact?action=withdraw`);
    expect(schedulePublicationEndpoints.periodCalendar.path({ groupId, schedulePeriodId })).toBe(
      `/groups/${groupId}/calendar/periods/${schedulePeriodId}`,
    );
    expect(schedulePublicationEndpoints.deleteDraft.method).toBe('DELETE');
  });

  it('keeps every dangerous write operation id in both body and header descriptors', () => {
    const publishInput = {
      groupId,
      request: { expectedVersion: 2, operationId, replacePublished: true as const },
      schedulePeriodId,
    };
    expect(schedulePublicationEndpoints.publish.body?.(publishInput)).toEqual(publishInput.request);
    expect(schedulePublicationEndpoints.publish.idempotencyKey?.(publishInput)).toBe(operationId);

    const batchInput = {
      groupId,
      request: { operationId, schedulePeriodIds: [schedulePeriodId] },
    };
    expect(schedulePublicationEndpoints.publishBatch.body?.(batchInput)).toEqual(
      batchInput.request,
    );
    expect(schedulePublicationEndpoints.publishBatch.idempotencyKey?.(batchInput)).toBe(
      operationId,
    );

    const withdrawInput = {
      groupId,
      request: { expectedVersion: 2, operationId },
      schedulePeriodId,
    };
    expect(schedulePublicationEndpoints.withdraw.body?.(withdrawInput)).toEqual(
      withdrawInput.request,
    );
    expect(schedulePublicationEndpoints.withdraw.idempotencyKey?.(withdrawInput)).toBe(operationId);

    const deleteInput = { groupId, operationId, schedulePeriodId };
    expect(schedulePublicationEndpoints.deleteDraft.idempotencyKey?.(deleteInput)).toBe(
      operationId,
    );
  });

  it('preserves endpoint receivers and request counts through the shared service', async () => {
    const history = [{ id: schedulePeriodId }] as SchedulePeriodHistoryItem[];
    const preview = { businessMonth: '2026-08' } as ScheduleGenerationPreview;
    const impact = { action: 'withdraw' } as ScheduleChangeImpactPreview;
    const calendar = { businessMonth: '2026-08' } as CalendarReadModel;
    const batch = { periods: [] } as PublishSchedulePeriodBatchResult;
    const published = { period: { id: schedulePeriodId } } as PublishSchedulePeriodResult;
    const withdrawn = { period: { id: schedulePeriodId } } as SchedulePeriodMutationResult;
    const responses = new Map<string, unknown>([
      ['schedule-publication.history', history],
      ['schedule-publication.draft-preview', preview],
      ['schedule-publication.change-impact', impact],
      ['schedule-publication.period-calendar', calendar],
      ['schedule-publication.publish-batch', batch],
      ['schedule-publication.publish', published],
      ['schedule-publication.withdraw', withdrawn],
      ['schedule-publication.delete-draft', undefined],
    ]);
    const transport: ClientTransport = {
      request: vi.fn((endpoint) => Promise.resolve(responses.get(endpoint.id) as never)),
    };
    const client = createSchedulePublicationClient(transport);

    await expect(client.listHistory(groupId)).resolves.toBe(history);
    await expect(client.getDraftPreview(groupId, schedulePeriodId)).resolves.toBe(preview);
    await expect(client.previewChangeImpact(groupId, schedulePeriodId, 'withdraw')).resolves.toBe(
      impact,
    );
    await expect(client.getPeriodCalendar(groupId, schedulePeriodId)).resolves.toBe(calendar);
    await expect(
      client.publishBatch(groupId, { operationId, schedulePeriodIds: [schedulePeriodId] }),
    ).resolves.toBe(batch);
    await expect(
      client.publish(groupId, schedulePeriodId, { expectedVersion: 2, operationId }),
    ).resolves.toBe(published);
    await expect(
      client.withdraw(groupId, schedulePeriodId, { expectedVersion: 2, operationId }),
    ).resolves.toBe(withdrawn);
    await expect(
      client.deleteDraft(groupId, schedulePeriodId, operationId),
    ).resolves.toBeUndefined();
    expect(transport.request).toHaveBeenCalledTimes(8);
  });

  it('fails closed on malformed history records', () => {
    const historyItem = {
      businessMonth: '2026-08',
      createdAt: '2026-08-23T00:00:00.000Z',
      id: schedulePeriodId,
      revision: 1,
      scheduleRoleId: 'role-1',
      scheduleRoleName: '一线',
      status: 'draft',
      version: 1,
    };
    expect(schedulePeriodHistoryListDecoder.safeDecode([historyItem]).success).toBe(true);
    expect(
      schedulePeriodHistoryListDecoder.safeDecode([{ ...historyItem, status: 'unknown' }]).success,
    ).toBe(false);
    expect(
      schedulePeriodHistoryListDecoder.safeDecode([{ ...historyItem, businessMonth: '2026-8' }])
        .success,
    ).toBe(false);
  });
});
