import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pageRoot = 'src/subpackages/insights/pages/exports';
const panelRoot = 'src/subpackages/insights/components/exports-panel';

describe('Feedback16 export Page artifact lineage', () => {
  it('keeps the direct Page, include, panel resources, and component registrations complete', () => {
    for (const file of [
      `${pageRoot}/index.ts`,
      `${pageRoot}/index.json`,
      `${pageRoot}/index.wxml`,
      `${pageRoot}/index.wxss`,
      `${panelRoot}/controller.ts`,
      `${panelRoot}/index.ts`,
      `${panelRoot}/index.json`,
      `${panelRoot}/index.wxml`,
      `${panelRoot}/index.wxss`,
    ]) {
      expect(existsSync(file), file).toBe(true);
    }
    expect(readFileSync(`${pageRoot}/index.wxml`, 'utf8').trim()).toBe(
      '<include src="../../components/exports-panel/index.wxml" />',
    );

    const page = readFileSync(`${pageRoot}/index.ts`, 'utf8');
    expect(page).toContain('Page({');
    expect(page).toContain("recordExportRenderStage('page-load')");
    expect(page).toContain("recordExportRenderStage('page-ready')");
    expect(page).toContain("recordExportRenderStage('page-show')");
    expect(page).toContain('controller.lifetimes.attached.call(this)');

    const componentTemplate = readFileSync(`${panelRoot}/index.wxml`, 'utf8');
    const componentConfig = JSON.parse(readFileSync(`${panelRoot}/index.json`, 'utf8'));
    for (const tag of ['ui-toast', 'ui-alert', 'ui-button', 'ui-loading']) {
      expect(componentTemplate).toContain(`<${tag}`);
      expect(componentConfig.usingComponents[tag]).toBe(`/components/ui/${tag}/index`);
    }

    const builtPageRoot = 'dist/subpackages/insights/pages/exports';
    const builtPanelRoot = 'dist/subpackages/insights/components/exports-panel';
    for (const file of [
      `${builtPageRoot}/index.js`,
      `${builtPageRoot}/index.json`,
      `${builtPageRoot}/index.wxml`,
      `${builtPageRoot}/index.wxss`,
      `${builtPanelRoot}/index.json`,
      `${builtPanelRoot}/index.wxml`,
      `${builtPanelRoot}/index.wxss`,
    ]) {
      expect(existsSync(file), file).toBe(true);
    }
    expect(readFileSync(`${builtPageRoot}/index.wxml`, 'utf8').trim()).toBe(
      '<include src="../../components/exports-panel/index.wxml" />',
    );
    const builtPage = readFileSync(`${builtPageRoot}/index.js`, 'utf8');
    expect(builtPage).toContain('exports:page-onload');
    expect(builtPage).toContain('exports:page-ready');
    const builtPanelTemplate = readFileSync(`${builtPanelRoot}/index.wxml`, 'utf8');
    const builtPanelConfig = JSON.parse(readFileSync(`${builtPanelRoot}/index.json`, 'utf8'));
    for (const tag of ['ui-toast', 'ui-alert', 'ui-button', 'ui-loading']) {
      expect(builtPanelTemplate).toContain(`<${tag}`);
      expect(builtPanelConfig.usingComponents[tag]).toBe(`/components/ui/${tag}/index`);
    }
  });
});
