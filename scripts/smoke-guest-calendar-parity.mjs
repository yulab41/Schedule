import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { calendarApiGoldenResponse } from '../packages/client-core/dist/testing/calendar-api-golden.js';

// Synthetic responses only; telephone clicks are intercepted before browser navigation.
const output = new URL('../runtime/smoke/visitor-parity-details/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.SMOKE_BROWSER_PATH ??
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
let revoked = false;
let eventUnavailable = true;
const reads = [];
const groupId = '11111111-1111-4111-8111-111111111111';
const key = 'a'.repeat(32);
const month = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 7);
await page.route('**/api/**', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (!url.pathname.startsWith('/api/')) return route.continue();
  const path = url.pathname.replace(/^\/api/, '');
  reads.push(path);
  let data;
  let status = 200;
  if (path === '/guest/groups/resolve') data = { groupId, groupName: '合成访客测试群' };
  else if (path === '/guest/holidays')
    data = { year: Number(url.searchParams.get('year')), dates: [], confirmed: true };
  else if (path === `/guest/groups/${groupId}/calendar`) {
    if (revoked) {
      status = 403;
      data = { error: { code: 'FORBIDDEN', message: '访问已撤销', requestId: 'synthetic' } };
    } else {
      const calendar = structuredClone(calendarApiGoldenResponse);
      const businessMonth = url.searchParams.get('businessMonth');
      calendar.groupId = groupId;
      calendar.businessMonth = businessMonth;
      calendar.assignments = calendar.assignments.map((row) => ({
        ...row,
        id: `${businessMonth}-shift`,
        businessDate: `${businessMonth}-22`,
        startsAt: `${businessMonth}-22T08:00:00+08:00`,
        endsAt: `${businessMonth}-23T08:00:00+08:00`,
      }));
      calendar.members[1].mobilePhone = '13800000000';
      calendar.members[1].shortPhone = '1234';
      data = { calendar, groupName: '合成访客测试群' };
    }
  } else if (/^\/guest\/groups\/[^/]+\/calendar\/shifts\/[^/]+\/events$/.test(path)) {
    if (eventUnavailable)
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'SERVICE_UNAVAILABLE', message: '事件暂不可用', requestId: 'synthetic' },
        }),
      });
    const shiftId = path.split('/').at(-2);
    const next = url.searchParams.has('cursor');
    data = {
      events: [
        {
          id: next ? 'event-2' : 'event-1',
          groupId,
          affectedMembershipIds: ['membership-2'],
          affectedShiftIds: [shiftId],
          beforeData: { actualMemberName: '张医生' },
          afterData: { actualMemberName: '李医生' },
          eventStatus: 'completed',
          eventType: 'assignment_manually_updated',
          objectType: 'shift_assignment',
          operationId: next ? 'operation-2' : 'operation-1',
          occurredAt: `2026-08-${next ? '22' : '21'}T03:00:00.000Z`,
        },
      ],
      ...(next ? {} : { nextCursor: 'next' }),
    };
  } else {
    status = 401;
    data = {
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'synthetic', requestId: 'synthetic' },
    };
  }
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
});
try {
  await page.goto(`${process.env.SMOKE_BASE_URL ?? 'http://localhost:5173'}/guest?vkey=${key}`, {
    waitUntil: 'networkidle',
  });
  await page
    .locator(`.calendar-swipe-panel[aria-hidden="false"] [data-date="${month}-22"]`)
    .click();
  await page.locator('.selected-date-details .staff-name-button').click();
  const phones = await page
    .locator('.phone-split-actions a')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  assert.deepEqual(phones.sort(), ['tel:1234', 'tel:13800000000']);
  await page.evaluate(() => {
    window.syntheticPhoneClicks = 0;
    document.addEventListener(
      'click',
      (event) => {
        if (event.target.closest('a[href^="tel:"]')) {
          event.preventDefault();
          window.syntheticPhoneClicks++;
        }
      },
      true,
    );
  });
  await page.locator('a[href="tel:1234"]').click();
  assert.equal(await page.evaluate(() => window.syntheticPhoneClicks), 1);
  await page.locator('.selected-date-details .event-action').click();
  await page.locator('.assignment-events-error').waitFor({ timeout: 3000 });
  eventUnavailable = false;
  await page.getByRole('button', { name: '重试读取', exact: true }).click();
  await page.getByText('人工调整班次：值班人员由 张医生 改为 李医生。').first().waitFor();
  assert.equal(reads.filter((path) => path.includes('/events')).length, 3);
  await page.screenshot({
    path: new URL('guest-events.png', output).pathname.replace(/^\/(\w:)/, '$1'),
    fullPage: true,
  });
  // Escape closes the shared sheet; switching views keeps the shared filtering model.
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '周', exact: true }).click();
  await page.locator('.week-calendar-card').waitFor();
  await page.getByRole('tab', { name: '列表', exact: true }).click();
  await page.locator('.list-view').waitFor();
  revoked = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByText('访问已撤销').waitFor();
  assert.equal(await page.locator('a[href^="tel:"]').count(), 0);
  assert.equal(await page.locator('.event-timeline').count(), 0);
  revoked = false;
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await page.locator('.list-view').waitFor();
  assert.equal(
    reads.some((path) => /^\/groups\//.test(path)),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS: anonymous calendar phones, simulated dial, event pagination, three views, revocation and retry; no member API requests.',
  );
} catch (error) {
  console.log(
    JSON.stringify({ reads, errors, body: (await page.locator('body').innerText()).slice(0, 800) }),
  );
  throw error;
} finally {
  await context.close();
  await browser.close();
}
