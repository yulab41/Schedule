import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pageShells = [
  ['insights', 'insights-dashboard-panel'],
  ['notifications', 'notifications-panel'],
  ['exports', 'exports-panel'],
  ['notification-settings', 'notifications-panel'],
];
const diagnosticBoundaries = [
  ['visitor-access', 'visitor-access-panel'],
  ['insights', 'insights-dashboard-panel'],
  ['exports', 'exports-panel'],
];

describe('P9 native page shells', () => {
  it('keeps the compiler-required Skyline component injection mode explicit', () => {
    const appConfig = JSON.parse(readFileSync(path.join(appRoot, 'src', 'app.json'), 'utf8'));

    expect(appConfig.lazyCodeLoading).toBe('requiredComponents');
  });

  it.each(pageShells)(
    'gives %s a definite Skyline viewport and sizes its mounted %s host',
    (pageName, componentName) => {
      const pageRoot = path.join(appRoot, 'src', 'subpackages', 'insights', 'pages', pageName);
      const config = JSON.parse(readFileSync(path.join(pageRoot, 'index.json'), 'utf8'));
      const template = readFileSync(path.join(pageRoot, 'index.wxml'), 'utf8');
      const styles = readFileSync(path.join(pageRoot, 'index.wxss'), 'utf8');

      expect(config).toMatchObject({
        disableScroll: true,
        navigationStyle: 'custom',
        renderer: 'skyline',
      });
      expect(config.usingComponents?.[componentName]).toBe(
        `/subpackages/insights/components/${componentName}/index`,
      );
      expect(template).toContain(`<${componentName}`);
      expect(styles).toMatch(/page\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/su);
      expect(styles).toMatch(
        new RegExp(`${componentName}\\s*\\{[^}]*display:\\s*block;[^}]*height:\\s*100%;`, 'su'),
      );
    },
  );

  it.each(diagnosticBoundaries)(
    'records anonymous %s page and %s component boundaries before another fix',
    (pageName, componentName) => {
      const pageSource = readFileSync(
        path.join(appRoot, 'src', 'subpackages', 'insights', 'pages', pageName, 'index.ts'),
        'utf8',
      );
      const controllerSource = readFileSync(
        path.join(
          appRoot,
          'src',
          'subpackages',
          'insights',
          'components',
          componentName,
          'controller.ts',
        ),
        'utf8',
      );

      expect(pageSource).toContain(`recordMiniTelemetryBoundary('${pageName}:page-onload')`);
      expect(controllerSource).toContain(
        `recordMiniTelemetryBoundary('${pageName}:component-attached')`,
      );
    },
  );

  it('mounts visitor access through a direct Page include while keeping the other controls intact', () => {
    const pageRoot = path.join(
      appRoot,
      'src',
      'subpackages',
      'insights',
      'pages',
      'visitor-access',
    );
    const config = JSON.parse(readFileSync(path.join(pageRoot, 'index.json'), 'utf8'));
    const source = readFileSync(path.join(pageRoot, 'index.ts'), 'utf8');
    const template = readFileSync(path.join(pageRoot, 'index.wxml'), 'utf8');
    const styles = readFileSync(path.join(pageRoot, 'index.wxss'), 'utf8');

    expect(source).toContain('createVisitorAccessPanelControllerDefinition');
    expect(source).toContain('controller.lifetimes.attached.call(this)');
    expect(config.usingComponents).not.toHaveProperty('visitor-access-panel');
    expect(config.usingComponents).toMatchObject({
      'ui-alert': '/components/ui/ui-alert/index',
      'ui-button': '/components/ui/ui-button/index',
      'ui-loading': '/components/ui/ui-loading/index',
    });
    expect(template.trim()).toBe(
      '<include src="../../components/visitor-access-panel/index.wxml" />',
    );
    expect(styles).toMatch(
      /@import\s+['"]\.\.\/\.\.\/components\/visitor-access-panel\/index\.wxss['"];/u,
    );
  });
});
