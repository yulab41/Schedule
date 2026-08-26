import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

function readApp() {
  return JSON.parse(read('src/app.json'));
}

describe('P8/P9/P10 golden manifest coherence', () => {
  it('keeps every implemented P8/P9/P10 native route registered in app.json', () => {
    const app = readApp();
    const routes = new Set(app.pages);
    for (const subpackage of app.subpackages) {
      for (const page of subpackage.pages) routes.add(`${subpackage.root}/${page}`);
    }

    for (const route of [
      'subpackages/organization/pages/group-settings/index',
      'subpackages/organization/pages/scheduling-config/index',
      'subpackages/organization/pages/invite-visitor/index',
      'subpackages/organization/pages/platform-accounts/index',
      'subpackages/insights/pages/visitor-access/index',
      'subpackages/insights/pages/insights/index',
      'subpackages/insights/pages/notifications/index',
      'subpackages/insights/pages/exports/index',
      'subpackages/insights/pages/notification-settings/index',
      'subpackages/organization/pages/directory/index',
      'pages/profile/index',
    ]) {
      expect(routes).toContain(route);
    }
  });

  it('does not report implemented P9 shared boundaries as missing native pages', () => {
    const manifest = read('docs/design/page-golden-manifest.md');
    for (const phase of ['P9-A4', 'P9-A5', 'P9-A6', 'P9-A8', 'P9-A9']) {
      const row = manifest.split('\n').find((line) => line.trimStart().startsWith(`| ${phase}`));
      expect(row).toBeDefined();
      expect(row).not.toContain('原生页面待实现');
    }
  });

  it('does not report the implemented P8 organization pages as a future step', () => {
    const manifest = read('docs/design/page-golden-manifest.md');
    const row = manifest.split('\n').find((line) => line.trimStart().startsWith('| P8-B'));
    expect(row).toBeDefined();
    expect(row).toContain('原生页面已实现');
    expect(row).not.toContain('待用户确认后进入原生页面');
  });
});
