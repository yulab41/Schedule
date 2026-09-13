import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pageRoot = 'src/subpackages/insights/pages/exports';
const panelRoot = 'src/subpackages/insights/components/exports-panel';

describe('Feedback16 export Page artifact lineage', () => {
  it('keeps a native-only direct Page shell and complete lazy panel resources', () => {
    for (const file of [
      `${pageRoot}/index.ts`,
      `${pageRoot}/index.json`,
      `${pageRoot}/index.wxml`,
      `${pageRoot}/index.wxss`,
      `${panelRoot}/controller.ts`,
      `${panelRoot}/initial-data.ts`,
      `${panelRoot}/index.ts`,
      `${panelRoot}/index.json`,
      `${panelRoot}/index.wxml`,
      `${panelRoot}/index.wxss`,
    ]) {
      expect(existsSync(file), file).toBe(true);
    }
    const pageTemplate = readFileSync(`${pageRoot}/index.wxml`, 'utf8');
    expect(pageTemplate).toContain('panelReady');
    expect(pageTemplate).toContain('导出排班与统计');
    expect(pageTemplate).toContain('<exports-panel');
    expect(pageTemplate).not.toContain(
      '<include src="../../components/exports-panel/index.wxml" />',
    );

    const page = readFileSync(`${pageRoot}/index.ts`, 'utf8');
    expect(page).toContain('Page({');
    expect(page).toContain("recordPageStartupStage('page-load')");
    expect(page).toContain("recordPageStartupStage('page-ready')");
    expect(page).toContain("recordPageStartupStage('page-show')");
    expect(page).toContain("recordPageStartupStage('panel-mount-requested')");
    expect(page).not.toContain("import('../../components/exports-panel/controller.js')");
    expect(page).toContain('startupError');
    expect(page).not.toContain('data: controller.data');

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
      `${builtPanelRoot}/index.js`,
      `${builtPanelRoot}/index.json`,
      `${builtPanelRoot}/index.wxml`,
      `${builtPanelRoot}/index.wxss`,
    ]) {
      expect(existsSync(file), file).toBe(true);
    }
    const builtPageTemplate = readFileSync(`${builtPageRoot}/index.wxml`, 'utf8');
    expect(builtPageTemplate).toContain('panelReady');
    expect(builtPageTemplate).toContain('导出排班与统计');
    expect(builtPageTemplate).toContain('<exports-panel');
    expect(builtPageTemplate).not.toContain(
      '<include src="../../components/exports-panel/index.wxml" />',
    );
    const builtPage = readFileSync(`${builtPageRoot}/index.js`, 'utf8');
    expect(builtPage).toContain('panel-mount-requested');
    expect(builtPage).toContain('module-registered');
    const builtPanelTemplate = readFileSync(`${builtPanelRoot}/index.wxml`, 'utf8');
    const builtPanelConfig = JSON.parse(readFileSync(`${builtPanelRoot}/index.json`, 'utf8'));
    for (const tag of ['ui-toast', 'ui-alert', 'ui-button', 'ui-loading']) {
      expect(builtPanelTemplate).toContain(`<${tag}`);
      expect(builtPanelConfig.usingComponents[tag]).toBe(`/components/ui/${tag}/index`);
    }
  });
});
