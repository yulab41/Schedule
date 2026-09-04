import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../../..');

function read(relativePath) {
  return readFileSync(resolve(repositoryRoot, relativePath), 'utf8');
}

describe('EXP-ICON-004 shared icon contract', () => {
  it('has one canonical catalog for priority geometry and motion', () => {
    const catalogPath = resolve(repositoryRoot, 'packages/ui-icons/src/catalog.ts');
    const motionPath = resolve(repositoryRoot, 'packages/ui-icons/src/motion.ts');

    expect(existsSync(catalogPath)).toBe(true);
    expect(existsSync(motionPath)).toBe(true);

    const catalog = read('packages/ui-icons/src/catalog.ts');
    const motion = read('packages/ui-icons/src/motion.ts');
    for (const key of [
      'calendar',
      'calendar-check',
      'directory',
      'groups',
      'swap',
      'profile',
      'bell',
      'manual',
      'backfill',
      'leave',
      'duty',
      'config',
      'events',
      'statistics',
      'export',
      'filter',
      'locate',
      'phone',
      'search',
      'close',
      'history',
      'star',
      'star-filled',
      'lock',
      'chevron-left',
      'chevron-right',
    ]) {
      expect(catalog).toContain(`'${key}'`);
    }
    for (const field of [
      'sourceRef',
      'licenseRef',
      'sourceSha',
      'viewBox',
      'lineCap',
      'lineJoin',
    ]) {
      expect(catalog).toContain(field);
    }
    for (const field of ['durationMs', 'delayMs', 'easing', 'iterationCount', 'reducedMotion']) {
      expect(motion).toContain(field);
    }
  });

  it('uses the shared Web icon adapter instead of page-local path copies', () => {
    expect(read('apps/web/src/features/layout/WorkbenchNavIcon.vue')).toContain('SharedIcon');
    expect(read('apps/web/src/components/LucideMinimalActionIcon.vue')).toContain('SharedIcon');
  });

  it('uses semantic generated assets for every visible workbench tool entry', () => {
    const workbench = read('apps/miniprogram/src/pages/workbench/index.wxml');
    for (const asset of [
      'ui-groups.svg',
      'ui-manual.svg',
      'ui-backfill.svg',
      'ui-leave.svg',
      'ui-duty.svg',
      'ui-config.svg',
      'ui-events.svg',
      'ui-export.svg',
    ]) {
      expect(workbench).toContain(`/assets/icons/${asset}`);
    }
  });

  it('keeps priority controls on generated assets rather than CSS/text approximations', () => {
    const workbench = read('apps/miniprogram/src/pages/workbench/index.wxml');
    const directory = read(
      'apps/miniprogram/src/subpackages/organization/components/directory-panel/index.wxml',
    );
    const identity = read('apps/miniprogram/src/pages/identity/index.wxml');

    for (const asset of ['ui-filter-top.svg', 'ui-filter-middle.svg', 'ui-filter-bottom.svg']) {
      expect(workbench).toContain(`/assets/icons/${asset}`);
    }
    expect(workbench).toContain('/assets/icons/ui-close.svg');
    expect(directory).toContain('/assets/icons/ui-department.svg');
    expect(directory).toContain('/assets/icons/ui-people-primary.svg');
    expect(directory).toContain('/assets/icons/ui-people-secondary.svg');
    expect(identity).toContain('/assets/icons/ui-lock.svg');
  });
});
