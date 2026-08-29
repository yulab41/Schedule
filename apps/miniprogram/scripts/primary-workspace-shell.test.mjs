import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const miniRoot = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(miniRoot, relativePath), 'utf8');
}

describe('primary workspace persistent shell', () => {
  it('keeps one header and one bottom nav outside a five-item tap-only Skyline swiper', () => {
    const template = read('src/pages/workbench/index.wxml');
    const controller = read('src/pages/workbench/index.ts');
    const buildInfo = read('src/platform/build-info.ts');
    const styles = read('src/pages/workbench/index.wxss');

    expect(template.match(/class="workbench-shell-header"/gu)).toHaveLength(1);
    expect(template.match(/class="bottom-nav"/gu)).toHaveLength(1);
    expect(template.match(/class="workspace-swiper-item"/gu)).toHaveLength(5);
    expect(template.match(/hidden="\{\{activeWorkspace !== '/gu)).toHaveLength(5);
    expect(template).toContain('class="workspace-swiper"');
    expect(template).toContain('current="{{activeWorkspaceIndex}}"');
    expect(template).toContain('cache-extent="4"');
    expect(template).toContain('<horizontal-drag-gesture-handler');
    expect(template).toContain('native-view="swiper"');
    expect(template).toContain('worklet:should-accept-gesture="shouldPrimaryWorkspaceRespond"');
    expect(template).not.toContain('scroll-with-animation="{{false}}"');
    expect(template).toContain('duration="0"');
    expect(template).toMatch(
      /<swiper\s+class="workspace-swiper"\s+style="\{\{workspaceViewportStyle\}\}"/u,
    );
    expect(styles).toMatch(/\.workspace-swiper\s*\{[^}]*position:\s*absolute;/su);
    expect(template.indexOf('class="workbench-shell-header"')).toBeLessThan(
      template.indexOf('class="workspace-swiper"'),
    );
    expect(template.indexOf('class="workspace-swiper"')).toBeLessThan(
      template.indexOf('class="bottom-nav"'),
    );
    expect(controller).toContain(
      "const PRIMARY_WORKSPACES = ['calendar', 'directory', 'swap', 'profile', 'more']",
    );
    expect(controller).toContain('activeWorkspaceIndex: 0');
    expect(controller).toContain('workspaceMounted:');
    expect(controller).toContain('workspaceReady:');
    expect(controller).toContain('workspacePreloadQueue:');
    expect(controller).toContain('workspaceViewportStyle:');
    expect(controller).toContain('windowInfo.windowHeight - shellHeaderHeight - bottomNavHeight');
    expect(controller).toContain('shouldPrimaryWorkspaceRespond(');
    expect(template).toContain('wx:if="{{workspaceMounted.directory}}"');
    expect(template).toContain('group-id="{{canOpenGroupSettings ? currentGroupId : \'\'}}"');
    expect(template).toContain('wx:if="{{workspaceMounted.swap}}"');
    expect(template).toContain('group-id="{{toolAccess.leave ? currentGroupId : \'\'}}"');
    expect(controller).toContain('canPreloadWorkspace(');
    expect(buildInfo).toContain('primaryWorkspaceSwipeEnabled: false');
  });

  it('uses a dedicated single-lifecycle Profile workspace instead of the failed Page adapter', () => {
    const componentRoot = path.join(miniRoot, 'src', 'components', 'profile-workspace');

    expect(existsSync(path.join(componentRoot, 'index.ts'))).toBe(true);
    expect(existsSync(path.join(componentRoot, 'index.wxml'))).toBe(true);
    expect(existsSync(path.join(componentRoot, 'index.wxss'))).toBe(true);
    const source = read('src/components/profile-workspace/index.ts');
    const template = read('src/pages/workbench/index.wxml');
    expect(source).toContain('created(');
    expect(source).toContain('attached(');
    expect(source).toContain('detached(');
    expect(source).toContain("triggerEvent?.('workspaceready')");
    expect(source).not.toContain('pageLifetimes');
    expect(source).not.toContain('createProfilePanelControllerDefinition(true)');
    expect(source).toContain('instance.__active = instance.properties.active');
    expect(source).toContain('refreshRevision');
    expect(source).not.toContain(
      'if (instance.properties.active && !instance.__active) controller.onShow.call(instance)',
    );
    expect(template).toContain('<profile-workspace');
    expect(template).not.toContain('<profile-panel');
    expect(read('src/components/profile-panel/index.wxml')).toContain(
      '<ui-sheet\n  wx:if="{{passwordSheetOpen}}"',
    );
  });

  it('exposes low-cardinality Workspace F diagnostics in the shared Test Center', () => {
    const template = read('src/pages/gesture-probe/index.wxml');
    const controller = read('src/pages/gesture-probe/index.ts');
    for (const copy of [
      'F 区',
      '五入口工作台',
      '挂载',
      '就绪',
      '预载队列',
      '手势锁',
      'attached 次数',
      '请求触发',
      '重复 ready',
    ]) {
      expect(template).toContain(copy);
    }
    expect(controller).toContain('workspaceProbe');
    expect(controller).toContain('workspaceProbeAttached');
    expect(controller).toContain('workspaceProbeRequests');
    expect(controller).toContain('handleWorkspaceStress');
  });
});
