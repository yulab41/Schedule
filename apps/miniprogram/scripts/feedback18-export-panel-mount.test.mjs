// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';

import simulate from 'miniprogram-simulate';
import { afterEach, describe, expect, it } from 'vitest';

const pageTemplate = readFileSync(
  path.resolve('src/subpackages/insights/pages/exports/index.wxml'),
  'utf8',
);

describe('Feedback18 export panel mount boundary', () => {
  afterEach(() => {
    globalThis.document.body.replaceChildren();
  });

  it('keeps the page fallback while a custom panel mounts and handles its startup event', () => {
    const childId = simulate.load({
      template: '<view class="synthetic-panel">panel</view>',
      lifetimes: {
        attached() {
          this.triggerEvent('startupready');
        },
      },
    });
    const pageId = simulate.load({
      template: pageTemplate,
      usingComponents: { 'exports-panel': childId },
      data: {
        groupId: 'group-1',
        largeText: false,
        panelAttached: false,
        panelReady: false,
        startupError: '',
        viewportClass: '',
        shellHeaderStyle: 'height:84px;',
        pageScrollStyle: 'height:calc(100% - 84px);',
      },
      methods: {
        handlePanelStartupReady() {
          this.setData({ panelAttached: true });
        },
        handleBack() {},
      },
    });
    const page = simulate.render(pageId);
    page.attach(globalThis.document.body);

    expect(page.querySelector('.page-state-card')).toBeTruthy();
    expect(page.querySelector('.synthetic-panel')).toBeUndefined();

    page.setData({ panelReady: true });
    expect(page.querySelector('.exports-panel-host')?.dom.innerHTML).toContain('synthetic-panel');
    expect(page.instance.data.panelAttached).toBe(true);
  });
});
