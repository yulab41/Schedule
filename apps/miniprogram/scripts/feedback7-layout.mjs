// Desktop CSS geometry only; this is not Skyline or physical-device acceptance.
/* global document, getComputedStyle, window */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const mini = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(mini, '../..');
const output = path.join(root, 'runtime/audit/feedback7');
execFileSync('git', ['check-ignore', output], { cwd: root });
mkdirSync(output, { recursive: true });
const read = (file) => readFileSync(path.join(mini, 'src', file), 'utf8');
const css = (file) =>
  read(file)
    .replace(/@import[^;]+;/gu, '')
    .replace(/^page\s*\{/gmu, 'body {')
    .replace(/\bview\b/gu, 'div')
    .replace(/\btext\b(?=\s*[:{,.>])/gu, 'span')
    .replace(/\bimage\b/gu, 'img');
const tokens = readFileSync(path.join(root, 'packages/ui-tokens/src/tokens.wxss'), 'utf8').replace(
  /^page\s*\{/u,
  ':root {',
);
const executablePath = [
  process.env['SMOKE_BROWSER_PATH'],
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((file) => file && existsSync(file));
assert.ok(executablePath);
const browser = await chromium.launchPersistentContext(path.join(output, 'browser-profile'), {
  headless: true,
  executablePath,
  env: { ...process.env, TEMP: output, TMP: output },
});
const page = await browser.newPage();
const results = [];
const field = (label, value) =>
  `<div class="workflow-picker-root"><div class="workflow-picker-trigger is-field"><div class="workflow-picker-trigger-copy"><span class="workflow-picker-field-label">${label}</span><span class="workflow-picker-trigger-value">${value}</span></div><div class="workflow-picker-chevron">⌄</div></div></div>`;
try {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const reset =
      'body{margin:0;height:auto;overflow:auto;font-family:Arial,"Microsoft YaHei",sans-serif}ui-button{display:block}';
    await page.setContent(
      `<style>${tokens}${css('subpackages/scheduling/pages/manual/index.wxss')}${css('components/ui/ui-selector/index.wxss')}${reset}</style><div class="manual-page-content"><div class="section-card template-context"><div class="section-heading"><div><span class="section-kicker">模板</span><span class="section-title">7日循环模板</span></div></div><div class="template-selector">${field('排班模板', '新建模板')}</div><div class="field-grid"><div class="role-field">${field('排班岗位', '一线')}</div><div class="date-field">${field('开始日期', '2026-11-01')}</div><div class="cycle-field field-control"><span>周期天数</span><span class="field-value">7 天</span></div><div class="members-field">${field('值班人员', '6 人')}</div></div></div><div class="matrix-section"><div class="section-kicker">班种与矩阵</div><div class="palette-buttons"><div class="palette-button" style="background:#267c70;color:white">全天班</div></div></div><div class="draft-section" style="margin-top:12px"><div class="draft-section-title">排班草稿</div><div class="draft-row"><div class="draft-summary"><span class="draft-primary">2026-11-01 至 2026-11-30</span><span>草稿 #3 · 一线</span><span class="month-chip">2026-11</span></div><div class="web-row-actions"><div class="web-button is-outline">预览</div><div class="web-button is-primary">发布整个排班</div><div class="web-button is-danger-text">删除草稿</div></div></div></div></div>`,
    );
    const manual = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('.workflow-picker-trigger,.cycle-field')].map(
        (node) => node.getBoundingClientRect().height,
      );
      const role = document.querySelector('.role-field').getBoundingClientRect();
      const date = document.querySelector('.date-field').getBoundingClientRect();
      const button = getComputedStyle(document.querySelector('.palette-button'));
      return {
        boxes,
        roleTop: role.top,
        dateTop: date.top,
        roleWidth: role.width,
        dateWidth: date.width,
        padding: [button.paddingTop, button.paddingRight, button.paddingBottom, button.paddingLeft],
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    assert.equal(manual.boxes.length, 5);
    assert.ok(manual.boxes.every((height) => height === 58));
    assert.equal(manual.roleTop, manual.dateTop);
    assert.ok(manual.dateWidth > manual.roleWidth);
    assert.equal(new Set(manual.padding).size, 1);
    assert.equal(manual.overflow, false);
    await page.screenshot({ path: path.join(output, `manual-${width}.png`), fullPage: true });
    await page.setContent(
      `<style>${tokens}${css('subpackages/organization/components/group-settings-panel/index.wxss')}${reset}</style><div class="page-content"><div class="group-card member-management-card"><div class="group-card-header member-card-header"><div><span>群组成员</span><span class="card-subtitle">6 位成员</span></div><div class="web-button compact-button is-primary">添加预设成员</div></div><div class="group-card-body member-card-list"><div class="member-management-row"><div style="padding:14px 12px 4px;font-weight:bold">成员甲 <span style="color:#0666d5">成员</span></div><div class="member-row-actions"><div class="web-button compact-button">修改</div><div class="web-button compact-button is-danger">删除</div><div class="web-button compact-button">设为管理员</div></div></div></div></div><div class="calendar-preference-section" style="margin-top:12px"><span class="preference-title">群组日历默认设置</span><div class="web-button is-primary">保存群组默认</div></div><div class="group-dissolve-action"><div class="web-button is-danger">解散群组</div></div></div>`,
    );
    const group = await page.evaluate(() => {
      const action = document.querySelector('.member-row-actions');
      const last = action.lastElementChild.getBoundingClientRect();
      const rect = action.getBoundingClientRect();
      return {
        rightGap: rect.right - last.right,
        padding: [...document.querySelectorAll('.web-button')].map((node) => {
          const s = getComputedStyle(node);
          return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft];
        }),
        height: document.querySelector('.member-management-row').getBoundingClientRect().height,
      };
    });
    assert.equal(group.rightGap, 10);
    assert.ok(group.padding.every((values) => new Set(values).size === 1));
    assert.ok(group.height < 120);
    await page.screenshot({ path: path.join(output, `group-${width}.png`), fullPage: true });
    const largeGroup = await page.evaluate(() => {
      document.body.className = 'group-settings-page is-large-text';
      const actions = document.querySelector('.member-row-actions');
      return {
        direction: getComputedStyle(actions).flexDirection,
        alignment: getComputedStyle(actions).justifyContent,
        padding: [...document.querySelectorAll('.web-button')].map((node) => {
          const style = getComputedStyle(node);
          return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
        }),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    assert.equal(largeGroup.direction, 'row');
    assert.equal(largeGroup.alignment, 'flex-end');
    assert.ok(largeGroup.padding.every((values) => new Set(values).size === 1));
    assert.equal(largeGroup.overflow, false);
    await page.screenshot({ path: path.join(output, `group-large-${width}.png`), fullPage: true });
    await page.setContent(
      `<style>${tokens}${css('subpackages/organization/components/scheduling-config-panel/index.wxss')}${reset}</style><div class="role-card"><div class="role-heading"><div><span class="role-title">一线</span></div><ui-button>删除岗位</ui-button></div><div class="role-section"><span>参与成员</span><div class="role-member-row"><div class="member-choice is-selected"><div class="choice-mark">✓</div><span>成员甲</span></div></div></div></div>`,
    );
    const role = await page.evaluate(() => ({
      direction: getComputedStyle(document.querySelector('.role-heading')).flexDirection,
      icons: [...document.querySelectorAll('.order-icon')].map((node) => [node.width, node.height]),
      height: document.querySelector('.role-member-row').getBoundingClientRect().height,
    }));
    assert.equal(role.direction, 'row');
    assert.equal(role.icons.length, 0);
    assert.ok(role.height < 60);
    await page.screenshot({ path: path.join(output, `roles-${width}.png`), fullPage: true });
    results.push({ width, manual, group, largeGroup, role });
  }
  writeFileSync(path.join(output, 'geometry.json'), JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify({ ok: true, evidence: 'desktop CSS geometry only', output, results }, null, 2),
  );
} finally {
  await browser.close();
}
