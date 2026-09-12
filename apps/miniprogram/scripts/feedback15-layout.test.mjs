// @vitest-environment jsdom
/* global document, innerWidth, getComputedStyle */
// Real WXML and controller data rendered through simulate; browser geometry is not Skyline proof.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import simulate from 'miniprogram-simulate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { calendarApiGoldenResponse } from '@schedule/client-core/testing';

const read = (file) => readFileSync(path.join(process.cwd(), 'src', file), 'utf8');
const evidence = process.env.SCHEDULE_FEEDBACK15_LAYOUT;
const htmlCompatible = (source) =>
  source.replace(/<([\w-]+)((?:"[^"]*"|'[^']*'|[^'">])*)\/>/gu, '<$1$2></$1>');
const css = (file) =>
  read(file)
    .replace(/@import[^;]+;/gu, '')
    .replace(/\bview\b(?=\s*[:{,.>])/gu, 'wx-view')
    .replace(/\btext\b(?=\s*[:{,.>])/gu, 'wx-text');
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe.runIf(!!evidence)('feedback15 real-template browser geometry', () => {
  it('checks actual month rows, week content, today markers and role/notification controls at 390 and 320', async () => {
    execFileSync('git', ['check-ignore', evidence]);
    mkdirSync(evidence, { recursive: true });
    const tokens = readFileSync(
      path.resolve('../../packages/ui-tokens/src/tokens.wxss'),
      'utf8',
    ).replace(/^page\s*\{/u, ':root {');
    let pageDefinition, cellDefinition;
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('Page', (value) => {
      pageDefinition = value;
    });
    vi.stubGlobal('Component', (value) => {
      cellDefinition = value;
    });
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
    });
    await import('../src/pages/workbench/index.ts');
    await import('../src/components/calendar/calendar-cell/index.ts');
    const cell = simulate.load({
      ...cellDefinition,
      template: read('components/calendar/calendar-cell/index.wxml'),
    });
    const sample = calendarApiGoldenResponse.assignments[0];
    const codes = ['电脑', 'D', 'A', 'P', 'N', 'NP'];
    const calendar = {
      ...calendarApiGoldenResponse,
      groupId: 'fixture',
      assignments: codes.flatMap((code, i) =>
        Array.from({ length: i === 2 ? 5 : 2 }, (_, slot) => ({
          ...sample,
          id: code + slot,
          businessDate: '2026-09-20',
          shiftTypeId: code,
          shiftTypeName: code + '班',
          shiftTypeAbbreviation: code,
          actualMemberName: slot === 4 ? '欧阳测试甲' : '测试甲',
          slotPosition: slot + 1,
        })),
      ),
      shiftTypes: codes.map((code) => ({
        ...calendarApiGoldenResponse.shiftTypes[0],
        id: code,
        name: code + '班',
        abbreviation: code,
        isAllDay: false,
      })),
    };
    const page = {
      ...pageDefinition,
      data: {
        ...structuredClone(pageDefinition.data),
        currentGroupId: 'fixture',
        currentGroupName: '头颈外科护士',
        viewMode: 'month',
        businessMonth: '2026-09',
        selectedDate: '2026-09-20',
        weekStart: '2026-09-14',
      },
      isVisible: false,
      monthRingSlot: 1,
      calendar,
      holidays: {
        year: 2026,
        confirmed: true,
        dates: [{ date: '2026-09-20', holidayName: '国庆补班', isWorkday: true, isOffDay: false }],
      },
      _groupMonthShiftTypeId: '电脑',
      setData(patch, callback) {
        Object.assign(this.data, patch);
        callback?.();
      },
    };
    pageDefinition.onResize.call(page);
    expect(page.data.monthPanels.every((panel) => panel.rowHeight === 62)).toBe(true);
    // Explicitly paint both 1- and 2-digit today labels to check shared marker geometry.
    page.data.monthPanels[1].cells = page.data.monthPanels[1].cells.map((c) => ({
      ...c,
      isToday: ['01', '12'].includes(c.day),
      day: c.day === '01' ? '1' : c.day,
    }));
    const hostFor = (id, properties) => {
      const component = simulate.render(id, properties);
      const host = document.createElement('div');
      document.body.append(host);
      component.attach(host);
      return { component, host };
    };
    const monthTemplate = read('components/calendar/calendar-month/index.wxml');
    const monthId = simulate.load({
      template: monthTemplate,
      usingComponents: { 'calendar-cell': cell },
      data: {
        ...page.data,
        panels: page.data.monthPanels,
        viewportHeight: page.data.gridHeight,
        shadow: true,
        swiperCurrent: 1,
      },
    });
    const month = hostFor(monthId);
    month.host.querySelectorAll('.calendar-slide-panel').forEach((node, i) => {
      if (i !== 1) node.style.display = 'none';
    });
    const parsed = document.createElement('div');
    parsed.innerHTML = read('pages/workbench/index.wxml');
    const weekTemplate = parsed.querySelector('.week-calendar').outerHTML;
    const week = hostFor(
      simulate.load({
        template: weekTemplate,
        data: { ...page.data, weekGridHeight: page.data.weekGridHeight },
      }),
    );
    week.host.querySelectorAll('wx-swiper-item').forEach((node, i) => {
      if (i !== 1) node.style.display = 'none';
    });
    const roleParsed = document.createElement('div');
    roleParsed.innerHTML = htmlCompatible(
      read('subpackages/organization/components/scheduling-config-panel/index.wxml'),
    );
    const roleData = {
      roleCards: [{ id: 'role', name: '护士排班', members: [] }],
      roleEditId: 'role',
      roleEditName: '护士排班',
      roleEditError: '',
      roleEditBusy: false,
      canManage: true,
      managementState: 'ready',
    };
    await import('../src/components/ui/ui-button/index.ts');
    const button = simulate.load({
      ...cellDefinition,
      template: read('components/ui/ui-button/index.wxml'),
      usingComponents: { 'ui-loading': simulate.load({ template: '<view></view>' }) },
    });
    const roles = hostFor(
      simulate.load({
        template:
          roleParsed.querySelector('.role-card').outerHTML +
          read('subpackages/organization/components/scheduling-config-panel/index.wxml').match(
            /<root-portal[\s\S]*<\/root-portal>/u,
          )[0],
        data: roleData,
        usingComponents: { 'ui-button': button },
      }),
    );
    const inputMirror = document.createElement('input');
    inputMirror.value = roleData.roleEditName;
    inputMirror.setAttribute('value', roleData.roleEditName);
    inputMirror.style.cssText =
      'width:100%;height:100%;border:0;padding:0;background:transparent;font:inherit;color:inherit';
    roles.host.querySelector('.role-edit-input').replaceChildren(inputMirror);
    const notifyParsed = document.createElement('div');
    notifyParsed.innerHTML = read('subpackages/insights/components/notifications-panel/index.wxml');
    const notifications = hostFor(
      simulate.load({
        template: notifyParsed.querySelector('.subscription-buttons').outerHTML,
        data: {
          subscriptionButtonLabel: '继续授权剩余2类',
          templateConfigured: true,
          busy: false,
          subscriptionResults: [
            { kind: 'dutyReminder', label: '值班提醒', statusLabel: '本次已授权' },
          ],
        },
        usingComponents: { 'ui-button': button },
      }),
    );
    const browser = await chromium.launchPersistentContext(path.join(evidence, 'browser-profile'), {
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      headless: true,
      env: { ...process.env, TEMP: evidence, TMP: evidence },
    });
    const results = [];
    try {
      for (const width of [390, 320]) {
        const browserPage = await browser.newPage();
        await browserPage.setViewportSize({ width, height: 844 });
        for (const [mode, host, styles] of [
          [
            'month',
            month.host,
            css('components/calendar/calendar-month/index.wxss') +
              css('components/calendar/calendar-cell/index.wxss'),
          ],
          ['week', week.host, css('pages/workbench/index.wxss')],
          [
            'role',
            roles.host,
            css('subpackages/organization/components/scheduling-config-panel/index.wxss'),
          ],
          [
            'notifications',
            notifications.host,
            css('subpackages/insights/components/notifications-panel/index.wxss'),
          ],
        ]) {
          await browserPage.setContent(
            `<meta charset="utf-8"><style>${tokens}${styles}${css('styles/calendar-date-marker.wxss')}${css('components/ui/ui-button/index.wxss')}body{margin:0;padding:12px;box-sizing:border-box;font-family:Arial,'Microsoft YaHei',sans-serif;background:#f4f8fb}wx-view,wx-swiper,wx-swiper-item,wx-root-portal{display:block}wx-text{display:inline}wx-swiper-item{height:100%}.role-edit-input{display:block}</style>${host.innerHTML}`,
          );
          if (mode === 'week')
            await browserPage.evaluate(() => {
              const heights = [
                ...document.querySelectorAll('.week-panel-current .week-day-content'),
              ].map((node) => node.getBoundingClientRect().height);
              document.querySelector('.week-swiper').style.height =
                Math.ceil(Math.max(112, ...heights.map((height) => height + 28))) + 'px';
            });
          const metrics = await browserPage.evaluate(() => {
            const rect = (node) => node.getBoundingClientRect();
            const visible = (nodes) => [...nodes].filter((node) => rect(node).height > 0);
            const grids = visible(document.querySelectorAll('.month-grid'));
            const viewport = document.querySelector('.calendar-motion-viewport');
            const days = visible(document.querySelectorAll('.week-day'));
            return {
              overflow: document.documentElement.scrollWidth > innerWidth,
              monthGap:
                viewport && grids.length ? rect(viewport).height - rect(grids[0]).height : 0,
              rowHeights: visible(document.querySelectorAll('.calendar-cell-slot')).map(
                (node) => rect(node).height,
              ),
              bottomGap: days.length
                ? Math.min(
                    ...days.map(
                      (day) =>
                        rect(day).bottom - rect(day.querySelector('.week-day-content')).bottom,
                    ),
                  )
                : 24,
              markers: visible(document.querySelectorAll('.calendar-date-marker.is-today')).map(
                (node) => {
                  const box = rect(node),
                    text = rect(node.querySelector('.calendar-date-text'));
                  return {
                    dx: Math.abs(text.left + text.width / 2 - box.left - box.width / 2),
                    dy: Math.abs(text.top + text.height / 2 - box.top - box.height / 2),
                  };
                },
              ),
              workdays: visible(document.querySelectorAll('.is-workday')).map((node) => ({
                label: node.textContent,
                color: getComputedStyle(node).backgroundColor,
              })),
            };
          });
          expect(metrics.overflow, `${mode}/${width}`).toBe(false);
          expect(Math.abs(metrics.monthGap)).toBeLessThan(1);
          expect(metrics.rowHeights.every((height) => height === 62)).toBe(true);
          expect(Math.abs(metrics.bottomGap - 24)).toBeLessThan(1);
          expect(metrics.markers.every(({ dx, dy }) => dx < 0.1 && dy < 0.1)).toBe(true);
          if (mode === 'role') {
            const controls = await browserPage
              .locator('.role-actions .ui-button')
              .evaluateAll((nodes) =>
                nodes.map((node) => {
                  const box = node.getBoundingClientRect();
                  return { left: box.left, right: box.right, top: box.top };
                }),
              );
            expect(controls).toHaveLength(2);
            expect(controls[0].right).toBeLessThan(controls[1].left);
            expect(controls[0].top).toBe(controls[1].top);
            expect(await browserPage.locator('.role-edit-actions .ui-button').count()).toBe(2);
          }
          if (mode === 'month' || mode === 'week') expect(metrics.workdays).toHaveLength(1);
          await browserPage.screenshot({
            path: path.join(evidence, `${mode}-${width}.png`),
            fullPage: true,
          });
          results.push({ mode, width, ...metrics });
        }
        await browserPage.close();
      }
    } finally {
      await browser.close();
      [month, week, roles, notifications].forEach(({ component }) => component.detach());
    }
    writeFileSync(path.join(evidence, 'geometry.json'), JSON.stringify(results, null, 2));
  }, 60000);
});
