import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pageShells = [
  ['visitor-access', 'visitor-access-panel'],
  ['insights', 'insights-dashboard-panel'],
  ['notifications', 'notifications-panel'],
  ['exports', 'exports-panel'],
  ['notification-settings', 'notifications-panel'],
];

describe('P9 native page shells', () => {
  it('keeps Android P9 custom components out of required-components selective injection', () => {
    const appConfig = JSON.parse(readFileSync(path.join(appRoot, 'src', 'app.json'), 'utf8'));

    expect(appConfig).not.toHaveProperty('lazyCodeLoading');
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
});
