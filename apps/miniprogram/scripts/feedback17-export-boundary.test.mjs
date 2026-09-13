import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const pageRoot = path.join(sourceRoot, 'subpackages', 'insights', 'pages', 'exports');

describe('Feedback17 export page native startup boundary', () => {
  it('keeps the registered Page template native-only before the business panel mounts', () => {
    const template = readFileSync(path.join(pageRoot, 'index.wxml'), 'utf8');
    const config = JSON.parse(readFileSync(path.join(pageRoot, 'index.json'), 'utf8'));

    expect(template).not.toContain('<include src="../../components/exports-panel/index.wxml" />');
    expect(template).toContain('class="exports-root"');
    expect(template).toContain('class="exports-panel-host"');
    expect(template).toContain('wx:if="{{!panelAttached}}"');
    expect(template).toContain('<exports-panel');
    expect(config.usingComponents).toEqual({
      'exports-panel': '/subpackages/insights/components/exports-panel/index',
    });
    expect(template).not.toMatch(/<ui-(?:alert|button|loading|toast)\b/u);
  });

  it('does not execute runtime imports before Page registration', () => {
    const page = readFileSync(path.join(pageRoot, 'index.ts'), 'utf8');
    const registrationOffset = page.indexOf('Page(');
    expect(registrationOffset).toBeGreaterThan(0);
    expect(page.slice(0, registrationOffset)).not.toMatch(/^import\s+(?!type\b)/mu);
    expect(page).toContain("recordPageStartupStage('module-registered')");
    expect(page).toContain("recordPageStartupStage('panel-mount-requested')");
    expect(page).toContain("recordPageStartupStage('panel-component-attached')");
    expect(page).toContain('panelAttached');
  });

  it('exposes a component attached event for the page boundary diagnosis', () => {
    const component = readFileSync(
      path.join(sourceRoot, 'subpackages', 'insights', 'components', 'exports-panel', 'index.ts'),
      'utf8',
    );
    expect(component).toContain("triggerEvent('startupready')");
  });

  it('renders a bounded startup trace in the test-tools report', () => {
    const testTools = readFileSync(
      path.join(sourceRoot, 'subpackages', 'diagnostics', 'pages', 'test-tools', 'index.ts'),
      'utf8',
    );
    const template = readFileSync(
      path.join(sourceRoot, 'subpackages', 'diagnostics', 'pages', 'test-tools', 'index.wxml'),
      'utf8',
    );
    expect(testTools).toContain('[导出页启动边界]');
    expect(template).toContain('导出页启动边界');
  });
});
