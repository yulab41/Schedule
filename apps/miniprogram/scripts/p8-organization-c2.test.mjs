import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P8-C-2 native scheduling configuration', () => {
  it('registers one native scheduling configuration page and More entry', () => {
    const app = JSON.parse(read('src/app.json'));
    const page = read('src/subpackages/organization/components/scheduling-config-panel/index.wxml');
    const workbench = read('src/pages/workbench/index.wxml');

    expect(app.subpackages).toContainEqual({
      root: 'subpackages/organization',
      pages: [
        'pages/group-settings/index',
        'pages/scheduling-config/index',
        'pages/invite-visitor/index',
      ],
    });
    expect(page).toContain('班种');
    expect(page).toContain('岗位成员');
    expect(page).toContain('轮转规则');
    expect(workbench).toContain('handleOpenSchedulingConfig');
  });

  it('uses shared scheduling read/write clients with organization capability and versions', () => {
    const runtime = read('src/platform/client-core-calendar.ts');
    const controller = read(
      'src/subpackages/organization/components/scheduling-config-panel/controller.ts',
    );

    expect(runtime).toContain('createRuntimeSchedulingConfigWriteClient');
    expect(runtime).toContain('createSchedulingConfigWriteClient');
    expect(controller).toContain('createRuntimeOrganizationReadClient');
    expect(controller).toContain('createRuntimeSchedulingConfigWriteClient');
    expect(controller).toContain("requireClientCapability('organization')");
    expect(controller).toContain('operationId');
    expect(controller).toContain('expectedRulesVersion');
    expect(controller).toContain('expectedRotationRuleVersion');
  });

  it('does not persist scheduling drafts, credentials, or visitor material', () => {
    const controller = read(
      'src/subpackages/organization/components/scheduling-config-panel/controller.ts',
    );

    expect(controller).not.toContain('wx.setStorageSync');
    expect(controller).not.toContain('visitorKey');
    expect(controller).not.toContain('rawTicket');
    expect(controller).toContain('organizationEnabled');
  });
});
