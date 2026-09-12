// Browser geometry with production CSS and ViewModel; not native Skyline acceptance.
/* global document, getComputedStyle */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const root = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const mini = path.join(root, 'apps/miniprogram');
const output = path.join(root, 'runtime/audit/feedback12/layout');
execFileSync('git', ['check-ignore', output], { cwd: root });
mkdirSync(output, { recursive: true });
await build({
  entryPoints: [path.join(mini, 'src/features/workbench/workbench-model.ts')],
  outfile: path.join(output, 'model.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { createWorkbenchViewModel } = await import(
  pathToFileURL(path.join(output, 'model.mjs')).href
);
const codes = ['电脑', 'D', 'A', 'P', 'N', 'NP'];
const colors = ['#475569', '#475569', '#0f766e', '#c2410c', '#4c1d95', '#9f1239'];
const assignments = codes.flatMap((code, i) =>
  Array.from({ length: i === 2 ? 4 : i === 1 ? 2 : 1 }, (_, slot) => ({
    id: code + slot,
    businessDate: '2026-09-12',
    shiftTypeId: code,
    shiftTypeName: code + '班',
    shiftTypeAbbreviation: code,
    shiftTypeColor: colors[i],
    shiftTypeTextColor: '#ffffff',
    slotPosition: slot + 1,
    actualMembershipId: 'm' + slot,
    plannedMembershipId: 'm' + slot,
    actualMemberName: slot === 3 ? '欧阳晓甲' : '测试人员甲',
    startsAt: '2026-09-12T08:00:00+08:00',
    endsAt: '2026-09-12T17:30:00+08:00',
    schedulePeriodId: 'period',
    scheduleRoleId: 'nurse',
    scheduleRoleName: '护士排班',
    changeMarkers: slot === 2 ? ['swap'] : [],
  })),
);
const calendar = {
  assignments: assignments.flatMap((a) =>
    Array.from({ length: 7 }, (_, d) => ({
      ...a,
      id: a.id + '-' + d,
      businessDate: `2026-09-${String(d + 7).padStart(2, '0')}`,
    })),
  ),
  businessMonth: '2026-09',
  groupId: 'fixture',
  members: [],
  roles: [],
  shiftTypes: codes.map((code, i) => ({
    id: code,
    name: code + '班',
    abbreviation: code,
    color: colors[i],
    textColor: '#ffffff',
    isAllDay: false,
    crossesMidnight: false,
  })),
};
const view = createWorkbenchViewModel(
  calendar,
  { dates: [] },
  '2026-09-12',
  '2026-09',
  '2026-09-07',
  undefined,
  '2026-09-12',
  {
    nursePreset: true,
    effectiveMonthShiftTypeId: '电脑',
    now: new Date('2026-09-12T12:30:00+08:00'),
  },
);
const read = (f) => readFileSync(path.join(mini, 'src', f), 'utf8');
const css = (f) =>
  read(f)
    .replace(/@import[^;]+;/gu, '')
    .replace(/^page\s*\{/gmu, 'body {')
    .replace(/\bview\b/gu, 'div')
    .replace(/\btext\b(?=\s*[:{,.>])/gu, 'span')
    .replace(/\bimage\b/gu, 'img');
const tokens = readFileSync(path.join(root, 'packages/ui-tokens/src/tokens.wxss'), 'utf8').replace(
  /^page\s*\{/u,
  ':root {',
);
const icon =
  'data:image/svg+xml;base64,' +
  Buffer.from(read('assets/icons/ui-phone-success.svg')).toString('base64');
const state = (d) => `<span class="duty-work-state is-${d.dutyState}">${d.dutyStateLabel}</span>`;
const details = `<div class="selected-date-details"><div class="detail-heading"><div class="detail-date-copy"><span>选中日期</span><span class="detail-date-value">9月12日 周六</span></div></div><div class="duty-group-grid">${view.selectedDetails.map((g) => `<div class="shift-detail-card"><div class="shift-detail-accent" style="background:${g.shiftColor}"></div><div class="shift-card-heading"><span class="shift-code" style="color:${g.shiftColor};background:${g.shiftTint}">${g.shiftAbbreviation}</span><div class="shift-heading-copy"><span class="shift-name">${g.shiftName}</span><span class="shift-time">${g.timeRange}</span></div>${state(g)}</div>${g.defaultCollapsed ? '' : `<div class="grouped-staff-list">${g.rows.map((r) => `<div class="staff-duty-row"><div class="staff-duty-heading"><div class="staff-name-button"><div class="staff-name-copy"><span class="staff-name">${r.name}</span><span class="staff-role">${r.role}</span></div><img class="detail-phone-icon" src="${icon}"></div><span class="duty-status is-${r.status}">${r.statusLabel}</span></div></div>`).join('')}</div>`}</div>`).join('')}</div></div>`;
const week = `<div class="week-calendar"><div class="calendar-navigation"><div class="calendar-heading"><span>9月第2周</span><span>2026年9月7日 – 9月13日</span></div></div><div class="week-day-row">${'一二三四五六日'
  .split('')
  .map((d) => `<span>${d}</span>`)
  .join(
    '',
  )}</div><div class="week-swiper" style="height:${view.weekPanels[1].height}px"><div class="week-day-grid">${view.weekPanels[1].days.map((d) => `<div class="week-day"><div class="week-day-content"><div class="week-date-line"><span class="day-number">${d.day}</span></div>${d.shiftGroups.map((g) => `<div class="week-shift-group" style="background:${g.tint}"><div class="week-group-title"><span class="week-shift-badge" style="background:${g.color};color:${g.textColor}">${g.abbreviation}</span></div>${g.duties.map((r) => `<div class="week-duty-item"><span class="week-duty-name">${r.name}</span>${r.markers.length ? `<div class="week-duty-badges"><span class="week-change-badge">换</span></div>` : ''}</div>`).join('')}</div>`).join('')}</div></div>`).join('')}</div></div></div>${details}`;
const month = `<div class="month-preview">${view.monthPanels[1].cells.map((c) => `<div style="width:14.285714%;height:62px;border:1px solid #e4e9ee"><div class="calendar-cell"><span class="date-number">${c.day}</span>${c.shiftAbbreviation ? `<div class="month-shift-line"><span class="month-shift-badge" style="${c.shiftBadgeStyle}">${c.shiftAbbreviation}</span></div><div class="month-duty-line"><span class="month-person">测试人员甲</span><span class="month-person-count">+3</span></div>` : ''}</div></div>`).join('')}</div>${details}`;
const list = `<div class="list-day-card"><div class="list-day-heading"><span class="list-date-label">09-12 周六</span></div>${view.listPanels[1].days
  .find((d) => d.businessDate === '2026-09-12')
  .duties.map(
    (d) =>
      `<div class="list-duty-item"><div class="list-duty-accent" style="background:${d.shiftColor}"></div><div class="list-duty-copy"><div class="list-duty-name-line"><span class="list-duty-name">${d.name}</span></div><span class="list-duty-details">${d.details}</span></div><span class="duty-work-state list-work-state is-${d.dutyState}">${d.dutyStateLabel}</span><div class="list-call-action"><img src="${icon}"></div></div>`,
  )
  .join('')}</div>`;
const browser = await chromium.launchPersistentContext(path.join(output, 'browser-profile'), {
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  env: { ...process.env, TEMP: output, TMP: output },
});
const results = [];
try {
  for (const width of [390, 320])
    for (const [mode, html] of [
      ['month', month],
      ['week', week],
      ['list', list],
    ]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.setViewportSize({ width, height: 844 });
      const content = `<!doctype html><meta charset="utf-8"><style>${tokens}${css('pages/workbench/index.wxss')}${mode === 'month' ? css('components/calendar/calendar-cell/index.wxss') : ''}body{margin:0;height:auto;background:#f4f8fb}span{display:inline-block}img{display:block}.workbench-content{height:auto}.month-preview{display:flex;flex-wrap:wrap;margin-bottom:12px}.month-preview>div{box-sizing:border-box}.week-day-content{width:100%}</style><div class="workbench-content">${html}</div>`;
      await page.setContent(content);
      const geometry = await page.evaluate(() => {
        const rect = (n) => n.getBoundingClientRect();
        const weekly = [...document.querySelectorAll('.week-day-content')].map(
          (n) => rect(n).height,
        );
        if (weekly.length)
          document.querySelector('.week-swiper').style.height =
            Math.ceil(Math.max(...weekly) + 8) + 'px';
        return {
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          weekClipped: [...document.querySelectorAll('.week-day-content')].some(
            (n) => rect(n).bottom > rect(document.querySelector('.week-swiper')).bottom + 1,
          ),
          stateClipped: [...document.querySelectorAll('.shift-card-heading .duty-work-state')].some(
            (n) =>
              rect(n).right > rect(n.closest('.shift-detail-card')).right ||
              rect(n).left < rect(n.parentElement).left + rect(n.parentElement).width / 2,
          ),
          countClipped: [...document.querySelectorAll('.month-person-count')].some(
            (n) => rect(n).right > rect(n.closest('.calendar-cell')).right,
          ),
          phoneGaps: [...document.querySelectorAll('.list-work-state')].map(
            (n) => rect(n.nextElementSibling).left - rect(n).right,
          ),
          badgeColors: [...document.querySelectorAll('.week-shift-badge')].map(
            (n) => getComputedStyle(n).backgroundColor,
          ),
        };
      });
      assert.equal(geometry.overflow, false, `${mode}/${width} horizontal overflow`);
      assert.equal(geometry.weekClipped, false);
      assert.equal(geometry.stateClipped, false);
      assert.equal(geometry.countClipped, false);
      assert.ok(geometry.phoneGaps.every((g) => g >= 12));
      assert.ok(geometry.badgeColors.every((c) => c !== 'rgba(0, 0, 0, 0)'));
      await page.screenshot({ path: path.join(output, `${mode}-${width}.png`), fullPage: true });
      results.push({ width, mode, ...geometry });
      await page.close();
    }
} finally {
  await browser.close();
}
writeFileSync(path.join(output, 'geometry.json'), JSON.stringify(results, null, 2));
console.log('feedback12 production CSS geometry passed: 390/320 month/week/list');
