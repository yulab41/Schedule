import type { SchedulePublicationHistoryItemLike } from '../schedule-publication.js';

export interface SchedulePublicationGoldenHistoryItem extends SchedulePublicationHistoryItemLike {
  readonly createdAt: string;
}

export const schedulePublicationGoldenCurrentMonth = '2026-08';
export const schedulePublicationGoldenBusinessDate = '2026-08-22';

export const schedulePublicationGoldenHistory = [
  historyItem({
    applyEndDate: '2026-09-12',
    businessMonth: '2026-09',
    id: 'draft-range-september',
    operationId: 'operation-range',
    revision: 2,
    status: 'draft',
  }),
  historyItem({
    applyStartDate: '2026-08-13',
    businessMonth: '2026-08',
    id: 'draft-range-august',
    operationId: 'operation-range',
    revision: 1,
    status: 'draft',
  }),
  historyItem({
    businessMonth: '2026-10',
    id: 'draft-standalone-october',
    revision: 1,
    scheduleRoleId: 'role-2',
    scheduleRoleName: '二线',
    status: 'draft',
  }),
  historyItem({
    applyEndDate: '',
    applyStartDate: '',
    businessMonth: '2026-12',
    id: 'draft-empty-operation',
    operationId: '',
    revision: 1,
    status: 'draft',
  }),
  historyItem({
    applyStartDate: '2026-08-01',
    businessMonth: '2026-08',
    id: 'published-current-started',
    revision: 3,
    status: 'published',
    version: 4,
  }),
  historyItem({
    businessMonth: '2026-08',
    id: 'archived-current-replaced',
    revision: 2,
    status: 'replaced',
  }),
  historyItem({
    businessMonth: '2026-08',
    id: 'pending-current',
    revision: 6,
    status: 'pending_publication',
  }),
  historyItem({
    businessMonth: '2026-08',
    id: 'archived-current-withdrawn',
    revision: 5,
    status: 'withdrawn',
  }),
  historyItem({
    businessMonth: '2026-08',
    id: 'past-current',
    revision: 4,
    status: 'past',
  }),
  historyItem({
    businessMonth: '2026-07',
    id: 'published-july',
    revision: 1,
    status: 'published',
  }),
  historyItem({
    businessMonth: '2026-09',
    id: 'published-september',
    revision: 1,
    status: 'published',
  }),
  historyItem({
    applyStartDate: '2026-08-22',
    businessMonth: '2026-08',
    id: 'published-current-today',
    revision: 1,
    scheduleRoleId: 'role-2',
    scheduleRoleName: '二线',
    status: 'published',
  }),
  historyItem({
    applyStartDate: '',
    businessMonth: '2026-08',
    id: 'published-current-empty-start',
    revision: 1,
    scheduleRoleId: 'role-3',
    scheduleRoleName: '三线',
    status: 'published',
  }),
] as const satisfies readonly SchedulePublicationGoldenHistoryItem[];

function historyItem(
  input: Omit<
    SchedulePublicationGoldenHistoryItem,
    'createdAt' | 'scheduleRoleId' | 'scheduleRoleName' | 'version'
  > &
    Partial<
      Pick<
        SchedulePublicationGoldenHistoryItem,
        'createdAt' | 'scheduleRoleId' | 'scheduleRoleName' | 'version'
      >
    >,
): SchedulePublicationGoldenHistoryItem {
  return {
    createdAt: '2026-08-22T03:00:00.000Z',
    scheduleRoleId: 'role-1',
    scheduleRoleName: '一线',
    version: 1,
    ...input,
  } as SchedulePublicationGoldenHistoryItem;
}
