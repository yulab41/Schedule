import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

function expectAll(source, fragments) {
  for (const fragment of fragments) expect(source).toContain(fragment);
}

describe('P9/P10 final automatic state audit', () => {
  it('keeps every P9 panel lifecycle, capability, and large-text boundary explicit', () => {
    const panels = [
      {
        controller: 'src/subpackages/insights/components/visitor-access-panel/controller.ts',
        template: 'src/subpackages/insights/components/visitor-access-panel/index.wxml',
      },
      {
        controller: 'src/subpackages/insights/components/insights-dashboard-panel/controller.ts',
        template: 'src/subpackages/insights/components/insights-dashboard-panel/index.wxml',
      },
      {
        controller: 'src/subpackages/insights/components/notifications-panel/controller.ts',
        template: 'src/subpackages/insights/components/notifications-panel/index.wxml',
      },
      {
        controller: 'src/subpackages/insights/components/exports-panel/controller.ts',
        template: 'src/subpackages/insights/components/exports-panel/index.wxml',
      },
    ];

    for (const panel of panels) {
      const controller = read(panel.controller);
      const template = read(panel.template);
      expectAll(controller, [
        'ClientCapabilityDisabledError',
        'detached',
        'fontSizeSetting',
        'requireClientCapability',
      ]);
      expect(template).toContain("largeText ? 'is-large-text' : ''");
      expect(template).toContain("state === 'disabled'");
      expect(template).toContain("state === 'error'");
      expect(template).toContain("state === 'loading'");
    }

    const download = read('src/platform/secure-download.ts');
    expectAll(download, ["requireClientCapability('insights')", 'Authorization']);
    expect(download).not.toContain('visitorKey');
    expect(download).not.toContain('token=');
  });

  it('keeps P10 directory/profile/workbench role and state boundaries explicit', () => {
    const directoryController = read(
      'src/subpackages/organization/components/directory-panel/controller.ts',
    );
    const directoryTemplate = read(
      'src/subpackages/organization/components/directory-panel/index.wxml',
    );
    const profileController = read('src/components/profile-panel/controller.ts');
    const profileTemplate = read('src/components/profile-panel/index.wxml');
    const profileStyles = read('src/components/profile-panel/index.wxss');
    const workbench = read('src/pages/workbench/index.ts');

    expectAll(directoryController, [
      'ClientCapabilityDisabledError',
      'detached',
      'fontSizeSetting',
      "requireClientCapability('organization')",
    ]);
    expectAll(directoryTemplate, [
      "largeText ? 'is-large-text' : ''",
      "pane.state === 'disabled'",
      'pane.errorMessage',
      'pane.facetsLoading',
      'pane.searching',
    ]);
    expectAll(profileController, ["mode: 'missing'", "mode: 'ready'"]);
    expectAll(profileTemplate, ['个人中心', 'canUnbindWechat']);
    expectAll(profileStyles, ['.is-large-text', 'white-space: normal']);
    expectAll(workbench, [
      'isDeveloperAdmin',
      'canManageScheduleTools',
      '当前账号无权访问此工具。',
      '页面暂时无法打开，请稍后重试。',
    ]);
  });

  it('records the user-approved automatic acceptance policy for implemented P7-P10 slices', () => {
    const manifest = read('docs/design/page-golden-manifest.md');
    expect(manifest).toContain('本轮人工复核豁免');
    expect(manifest).toContain('P9 `insights`/`externalMessages` 已按授权开启');
    for (const phase of [
      'P7',
      'P8-B',
      'P9-A2',
      'P9-A4',
      'P9-A5',
      'P9-A6',
      'P9-A7',
      'P9-A8',
      'P9-A9',
      'P9-A10',
      'P9-A11',
      'P10-A2/A3',
      'P10-A4',
    ]) {
      const row = manifest.split('\n').find((line) => line.startsWith(`| ${phase} `));
      expect(row).toBeDefined();
      expect(row).toContain('自动 verifier 已通过');
      expect(row).not.toContain('待人工');
    }
  });
});
