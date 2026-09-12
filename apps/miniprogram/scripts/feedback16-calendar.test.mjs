import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  calendarApiGoldenResponse,
  holidayApiGoldenResponse,
} from '@schedule/client-core/testing';
import {
  createWorkbenchViewModel,
  mergeCalendarShiftTypes,
} from '../src/features/workbench/workbench-model.ts';

describe('Feedback16 calendar stability', () => {
  it('hides an all-day badge in an adjacent cell even when the active month is empty', () => {
    const source = calendarApiGoldenResponse.assignments[0];
    const adjacent = {
      ...source,
      businessDate: '2026-11-30',
      id: 'adjacent-all-day',
      shiftTypeId: 'all-day',
      shiftTypeAbbreviation: '全',
    };
    const activeCalendar = {
      ...calendarApiGoldenResponse,
      assignments: [],
      businessMonth: '2026-12',
      shiftTypes: [],
    };
    const adjacentCalendar = {
      ...calendarApiGoldenResponse,
      assignments: [adjacent],
      businessMonth: '2026-11',
      shiftTypes: calendarApiGoldenResponse.shiftTypes.map((shiftType) => ({
        ...shiftType,
        id: 'all-day',
        abbreviation: '全',
        isAllDay: true,
      })),
    };
    const merged = {
      ...activeCalendar,
      assignments: [adjacent],
      shiftTypes: mergeCalendarShiftTypes(activeCalendar, [activeCalendar, adjacentCalendar]),
    };
    const view = createWorkbenchViewModel(
      merged,
      holidayApiGoldenResponse,
      '2026-12-01',
      '2026-12',
      '2026-11-30',
    );

    const cell = view.monthPanels[1].cells.find((candidate) => candidate.businessDate === '2026-11-30');
    expect(cell).toMatchObject({ shiftAbbreviation: '', shiftBadgeStyle: '', person: '李医生' });
  });

  describe('week height writes', () => {
    let definition;

    beforeEach(async () => {
      vi.resetModules();
      vi.stubGlobal('Page', (value) => {
        definition = value;
      });
      vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
      vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
      vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
      vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
      vi.stubGlobal('wx', {
        getStorageSync: () => undefined,
        getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, statusBarHeight: 24 }),
        getMenuButtonBoundingClientRect: () => ({
          left: 290,
          right: 380,
          top: 26,
          bottom: 58,
          width: 90,
          height: 32,
        }),
        nextTick: vi.fn(),
        createSelectorQuery: vi.fn(),
      });
      await import('../src/pages/workbench/index.ts');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('computes the week height without scheduling a post-render measurement', () => {
      const page = {
        ...definition,
        data: {
          ...structuredClone(definition.data),
          currentGroupId: 'group-1',
          currentGroupName: '头颈外科护士',
          viewMode: 'week',
          businessMonth: '2026-09',
          selectedDate: '2026-09-07',
          weekStart: '2026-09-07',
        },
        calendar: calendarApiGoldenResponse,
        holidays: holidayApiGoldenResponse,
        isVisible: true,
        requestOwnerId: undefined,
        monthResources: new Map(),
        setData(patch, callback) {
          Object.assign(this.data, patch);
          callback?.();
        },
      };
      definition.onResize.call(page);

      expect(page.data.weekGridHeight).toBeGreaterThanOrEqual(112);
      expect(wx.nextTick).not.toHaveBeenCalled();
      expect(wx.createSelectorQuery).not.toHaveBeenCalled();
    });
  });
});
