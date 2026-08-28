import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('Mini Profile Web 1:1 native contract', () => {
  it('renders the approved seven sections in the Web Production order', () => {
    const template = read('src/components/profile-panel/index.wxml');
    const labels = ['个人中心', '值班概览', '值班节奏', '下一班', '账户设置', '退出登录'];
    const positions = labels.map((label) => template.indexOf(label));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(template).toContain('微信小程序身份');
    expect(template).toContain('微信头像');
    expect(template).toContain('修改登录密码');
    expect(template).toContain('查看完整统计');
    expect(template).toContain('打开排班日历');
    expect(template).not.toContain('切换登录方式');
    expect(template).not.toContain('资料版本');
    expect(template).not.toContain('个人资料只用于当前账号展示');
  });

  it('keeps the dark next-duty card as the only visual signature and reflows at 320/large text', () => {
    const styles = read('src/components/profile-panel/index.wxss');
    expect(styles).toContain('.profile-next-duty');
    expect(styles).toContain('linear-gradient(145deg, #183552, #10263e)');
    expect(styles).toContain('.profile-stat-list');
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
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
