import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calendarApiGoldenResponse } from '@schedule/client-core/testing';
import { createShiftEventCards } from '../src/features/workbench/shift-event-model.ts';
import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const appRoot = process.cwd();

function readSource(relativePath) {
  return readFileSync(path.join(appRoot, 'src', relativePath), 'utf8');
}

describe('EXP-FEAT-002 shift event records', () => {
  let definition;

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens the real assignment event sheet from both detail views', () => {
    const template = readSource('pages/workbench/index.wxml');
    const pageSource = readSource('pages/workbench/index.ts');
    const eventModel = readSource('features/workbench/shift-event-model.ts');
    const eventTemplate = readSource('components/shift-event-records/index.wxml');
    const pageConfig = JSON.parse(readSource('pages/workbench/index.json'));

    expect(
      template.match(/class="event-action"[\s\S]*?bindtap="handleOpenShiftEvents"/gu),
    ).toHaveLength(2);
    expect(template.match(/data-assignment-id="\{\{row\.key\}\}"/gu)).toHaveLength(2);
    expect(template).toContain('visible="{{shiftEventSheetOpen}}"');
    expect(template).toContain('title="班次事件记录"');
    expect(template).toContain('bind:close="handleShiftEventClose"');
    expect(template).toContain('<shift-event-records');
    expect(template).toContain('shiftEventChangeChain');
    expect(pageConfig.usingComponents['shift-event-records']).toBe(
      '/components/shift-event-records/index',
    );
    expect(eventTemplate).toContain("state === 'loading'");
    expect(eventTemplate).toContain("state === 'empty'");
    expect(eventTemplate).toContain("state === 'error'");
    expect(eventTemplate).toContain('bindtap="handleRetry"');
    expect(pageSource).toContain('createRuntimeInsightsReadClient');
    expect(pageSource).toContain('listEvents');
    expect(pageSource).toContain('shiftId: assignment.id');
    expect(eventModel).toContain('buildEventTimelineItems');
    expect(eventModel).toContain('buildEventNarrative');
    expect(eventModel).toContain('extractEventChanges');
    expect(pageSource).toContain('getShiftEventChangeChain');
    expect(pageSource).not.toContain('handleUnavailable');
  });

  it('maps the Web event timeline rules without exposing raw event data', () => {
    const assignment = calendarApiGoldenResponse.assignments[0];
    const cards = createShiftEventCards(
      [
        eventRecord('event-later', '2026-08-22T03:00:00.000Z'),
        eventRecord('event-earlier', '2026-08-21T03:00:00.000Z'),
        eventRecord('event-swap', '2026-08-23T03:00:00.000Z', {
          afterData: {
            initiatorAssignment: { actualMemberName: '李医生' },
            initiatorAssignmentId: 'assignment-1',
            initiatorMemberName: '王医生',
          },
          beforeData: {
            initiatorAssignment: { plannedMemberName: '张医生' },
            initiatorAssignmentId: 'assignment-1',
            initiatorMemberName: '王医生',
          },
          eventType: 'swap_completed',
          objectId: 'swap-1',
          objectType: 'swap_request',
        }),
      ],
      assignment,
    );

    expect(cards.map((card) => card.id)).toEqual(['event-earlier', 'event-later', 'event-swap']);
    expect(cards[0]).toMatchObject({
      eventTone: 'neutral',
      eventTypeLabel: '人工调整班次',
      occurredAtLabel: '2026-08-21 11:00',
      narrative: '人工调整班次：值班人员由 张医生 改为 李医生。',
    });
    expect(cards[0]).not.toHaveProperty('beforeData');
    expect(cards[0]).not.toHaveProperty('afterData');
    expect(cards[2]?.narrative).toContain('由 王医生 发起');
  });

  it('loads only the selected shift, handles empty records, and clears on close', async () => {
    const request = vi.fn((options) => {
      expect(options.url).toContain('/groups/group-1/events');
      expect(options.url).toContain('shiftId=assignment-1');
      options.success({ data: { events: [], nextCursor: undefined }, statusCode: 200 });
    });
    vi.stubGlobal('wx', createWx(request));
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    const page = pageFor(definition);
    page.calendar = { ...calendarApiGoldenResponse };
    page.data.currentGroupId = 'group-1';
    page.data.toolAccess = { ...page.data.toolAccess, insights: true };

    definition.handleOpenShiftEvents.call(page, tapFor('assignment-1'));
    expect(page.data).toMatchObject({
      shiftEventSheetOpen: true,
      shiftEventState: 'loading',
      shiftEventCards: [],
    });
    await vi.waitFor(() => expect(page.data.shiftEventState).toBe('empty'));
    expect(request).toHaveBeenCalledTimes(1);

    definition.handleShiftEventClose.call(page);
    expect(page.data).toMatchObject({
      shiftEventCards: [],
      shiftEventMeta: '',
      shiftEventSheetOpen: false,
      shiftEventState: 'closed',
    });
  });

  it('does not issue an event read for a user without insights access', async () => {
    const request = vi.fn();
    vi.stubGlobal('wx', createWx(request));
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    const page = pageFor(definition);
    page.calendar = { ...calendarApiGoldenResponse };
    page.data.currentGroupId = 'group-1';
    page.data.toolAccess = { ...page.data.toolAccess, insights: false };

    definition.handleOpenShiftEvents.call(page, tapFor('assignment-1'));

    expect(request).not.toHaveBeenCalled();
    expect(page.data).toMatchObject({
      announcement: '当前账号无权查看事件记录。',
      shiftEventSheetOpen: false,
      shiftEventState: 'closed',
    });
  });

  it('drops stale responses and retries a failed read', async () => {
    const pending = new Map();
    let attempt = 0;
    const request = vi.fn((options) => {
      attempt += 1;
      if (attempt <= 3) {
        options.fail(new Error('offline'));
        return;
      }
      const shiftId = new URL(options.url).searchParams.get('shiftId');
      pending.set(shiftId, options);
    });
    vi.stubGlobal('wx', createWx(request));
    await import('../src/pages/workbench/index.ts');
    await enableTestClientCapabilities();
    const page = pageFor(definition);
    const secondAssignment = {
      ...calendarApiGoldenResponse.assignments[0],
      businessDate: '2026-08-23',
      id: 'assignment-2',
    };
    page.calendar = {
      ...calendarApiGoldenResponse,
      assignments: [calendarApiGoldenResponse.assignments[0], secondAssignment],
    };
    page.data.currentGroupId = 'group-1';
    page.data.toolAccess = { ...page.data.toolAccess, insights: true };

    definition.handleOpenShiftEvents.call(page, tapFor('assignment-1'));
    await vi.waitFor(() => expect(page.data.shiftEventState).toBe('error'));
    expect(page.data.shiftEventErrorMessage).toBe('网络连接失败，请稍后重试。');

    definition.handleShiftEventRetry.call(page);
    await vi.waitFor(() => expect(pending.has('assignment-1')).toBe(true));
    definition.handleOpenShiftEvents.call(page, tapFor('assignment-2'));
    await vi.waitFor(() => expect(pending.has('assignment-2')).toBe(true));

    pending.get('assignment-1').success({
      data: { events: [eventRecord('stale-event', '2026-08-22T03:00:00.000Z')] },
      statusCode: 200,
    });
    pending.get('assignment-2').success({
      data: { events: [eventRecord('current-event', '2026-08-23T03:00:00.000Z')] },
      statusCode: 200,
    });
    await vi.waitFor(() => expect(page.data.shiftEventState).toBe('ready'));

    expect(page.data.shiftEventCards.map((card) => card.id)).toEqual(['current-event']);
    expect(page.data.shiftEventMeta).toContain('2026-08-23');
  });
});

function eventRecord(id, occurredAt, overrides = {}) {
  return {
    affectedMembershipIds: ['membership-1'],
    affectedShiftIds: ['assignment-1'],
    afterData: { actualMemberName: '李医生' },
    beforeData: { actualMemberName: '张医生' },
    eventStatus: 'completed',
    eventType: 'assignment_manually_updated',
    groupId: 'group-1',
    id,
    objectType: 'shift_assignment',
    occurredAt,
    operationId: `operation-${id}`,
    ...overrides,
  };
}

function tapFor(assignmentId) {
  return { currentTarget: { dataset: { assignmentId } } };
}

function pageFor(pageDefinition) {
  return {
    ...pageDefinition,
    calendar: undefined,
    data: structuredClone(pageDefinition.data),
    setData(patch, callback) {
      Object.assign(this.data, patch);
      callback?.();
    },
  };
}

function createWx(request) {
  const storage = new Map([
    [
      'schedule.wechat.session',
      {
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        profile: { id: 'user-1', realName: '林医生', version: 1 },
        token: 'test-token',
      },
    ],
  ]);
  return {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop', version: 'test' } }),
    getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
    getStorageSync: (key) => storage.get(key),
    getWindowInfo: () => ({
      safeArea: { bottom: 844, height: 820, left: 0, right: 390, top: 24, width: 390 },
      screenHeight: 844,
      statusBarHeight: 24,
      windowHeight: 844,
      windowWidth: 390,
    }),
    request,
    setStorageSync: (key, value) => storage.set(key, value),
  };
}
