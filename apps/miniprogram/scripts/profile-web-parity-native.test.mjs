import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('Mini Profile UX-CLEANUP-10 native contract', () => {
  it('renders the approved identity, overview, next duty, pulse, account and logout order', () => {
    const template = read('src/components/profile-panel/index.wxml');
    const labels = [
      'class="profile-identity-card"',
      'class="profile-stats-card"',
      'class="profile-next-duty"',
      'class="profile-pulse-card"',
      'class="profile-account-card"',
      'class="profile-actions"',
    ];
    const positions = labels.map((label) => template.indexOf(label));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(template).toContain('微信小程序身份');
    expect(template).not.toContain('微信头像');
    expect(template).not.toContain('个人中心');
    expect(template).toContain('{{initial}}');
    expect(template).toContain('修改登录密码');
    expect(template).toContain('查看完整统计');
    expect(template).toContain('打开排班日历');
    expect(template).not.toContain('切换登录方式');
    expect(template).not.toContain('资料版本');
    expect(template).not.toContain('个人资料只用于当前账号展示');
  });

  it('shares the overview white surface and keeps 320px/large-text reflow', () => {
    const styles = read('src/components/profile-panel/index.wxss');
    expect(styles).toContain('.profile-next-duty');
    expect(styles).not.toContain('linear-gradient(145deg, #183552, #10263e)');
    expect(styles).toMatch(
      /\.profile-stats-card,\s*\.profile-next-duty\s*\{[^}]*radial-gradient[^}]*var\(--ui-color-surface\)/su,
    );
    expect(styles).toMatch(
      /\.profile-next-duty\s*\{[^}]*color:\s*var\(--ui-color-text-primary\)/su,
    );
    expect(styles).toMatch(
      /\.profile-inline-action\s*\{[^}]*margin-left:\s*auto;[^}]*margin-right:\s*0;/su,
    );
    expect(styles).toContain('.profile-stat-list');
    expect(styles).toMatch(/\.profile-stat-list\s*\{[^}]*display:\s*flex;/su);
    expect(styles).toMatch(/\.profile-stat\s*\{[^}]*flex:\s*1;/su);
    expect(styles).toMatch(
      /\.is-large-text \.profile-stat-list\s*\{[^}]*flex-direction:\s*column;/su,
    );
    expect(styles).toContain('.is-large-text');
    expect(styles).toContain('min-height: 44px');
    expect(styles).toContain('calc(96px + env(safe-area-inset-bottom))');
  });

  it('passes the current group explicitly and wires statistics/calendar events', () => {
    const component = read('src/components/profile-panel/index.ts');
    const workbench = read('src/pages/workbench/index.wxml');
    expect(component).toContain('groupId');
    expect(component).toContain('handleGroupChange');
    expect(workbench).toContain('group-id="{{currentGroupId}}"');
    expect(workbench).toContain('bind:openstatistics="handleProfileOpenStatistics"');
    expect(workbench).toContain('bind:opencalendar="handleCalendarNav"');
  });
});
