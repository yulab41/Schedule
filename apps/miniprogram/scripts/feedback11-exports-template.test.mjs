// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import simulate from 'miniprogram-simulate';
import { afterEach, describe, expect, it } from 'vitest';

const template = readFileSync(
  path.resolve('src/subpackages/insights/components/exports-panel/index.wxml'),
  'utf8',
);
const leaf = simulate.load({
  template: '<view>{{label}}{{title}}{{message}}</view>',
  properties: {
    label: String,
    title: String,
    message: String,
  },
});
const id = simulate.load({
  template,
  usingComponents: {
    'ui-toast': leaf,
    'ui-loading': leaf,
    'ui-alert': leaf,
    'ui-button': leaf,
  },
  data: {
    state: 'loading',
    roleOptions: [{ id: '', label: '全部岗位' }],
    roleIndex: 0,
    memberOptions: [{ id: '', label: '全部成员' }],
    memberIndex: 0,
    exportType: 'schedule',
    periodType: 'month',
    periodLabel: '2026年9月',
  },
});
let component;
afterEach(() => {
  component?.detach();
});
describe('feedback11 actual export WXML state tree', () => {
  it.each(['loading', 'idle', 'error', 'disabled', 'waiting', 'ready', 'downloaded'])(
    'keeps a visible header and content nodes in %s',
    (state) => {
      component = simulate.render(id);
      component.attach(globalThis.document.body);
      component.setData({ state, statusLabel: 'fixture', errorMessage: 'fixture' });
      expect(component.dom.textContent).toContain('导出排班与统计');
      expect(component.querySelector('.exports-scroll')).toBeTruthy();
      if (state === 'idle') expect(component.dom.textContent).toContain('导出 CSV');
    },
  );
});
