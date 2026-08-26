import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P8 organization component registration', () => {
  it('registers every page-mounted organization panel as a native Component', () => {
    const panels = [
      ['scheduling-config-panel', 'createSchedulingConfigPanelControllerDefinition'],
      ['platform-accounts-panel', 'createPlatformAccountsPanelControllerDefinition'],
      ['invite-visitor-panel', 'createInviteVisitorPanelControllerDefinition'],
    ];

    for (const [panel, factory] of panels) {
      const sourcePath = `src/subpackages/organization/components/${panel}/index.ts`;
      expect(existsSync(path.join(appRoot, sourcePath))).toBe(true);
      const source = read(sourcePath);
      expect(source).toContain(`from './controller.js'`);
      expect(source).toContain(`Component(${factory}())`);
      const controller = read(`src/subpackages/organization/components/${panel}/controller.ts`);
      expect(controller).toContain('lifetimes:');
      expect(controller).toContain('attached(');
      expect(controller).not.toMatch(/\n    onLoad\(/u);
      expect(controller).not.toMatch(/\n    onShow\(/u);
    }
  });

  it('keeps the page JSON component names aligned with the registered files', () => {
    for (const page of ['scheduling-config', 'platform-accounts', 'invite-visitor']) {
      const pageJson = JSON.parse(read(`src/subpackages/organization/pages/${page}/index.json`));
      const componentNames = Object.keys(pageJson.usingComponents ?? {});
      expect(componentNames).toContain(`${page}-panel`);
    }
  });
});
