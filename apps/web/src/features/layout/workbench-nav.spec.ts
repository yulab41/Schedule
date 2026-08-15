import { describe, expect, it } from 'vitest';

import {
  getDesktopNavItems,
  getFocusOrder,
  getPrimaryMobileNavItems,
  getSecondaryMobileNavItems,
  getVisibleNavItems,
  getWorkbenchPageTitle,
  workbenchNavItems,
} from './workbench-nav.js';

describe('Workbench navigation', () => {
  it('shows every workbench entry on the desktop sidebar', () => {
    expect(getDesktopNavItems('owner').map((item) => item.id)).toEqual(
      workbenchNavItems.map((item) => item.id),
    );
  });

  it('assigns a strongly typed icon to every navigation entry', () => {
    expect(workbenchNavItems.map(({ icon, id }) => [id, icon])).toEqual([
      ['calendar', 'calendar'],
      ['groups', 'groups'],
      ['manual', 'manual'],
      ['backfill', 'backfill'],
      ['leave', 'leave'],
      ['swap', 'swap'],
      ['duty', 'duty'],
      ['events', 'events'],
      ['notifications', 'notifications'],
      ['statistics', 'statistics'],
      ['members', 'members'],
      ['config', 'config'],
    ]);
  });

  it('hides administrator-only entries for ordinary members', () => {
    const memberIds = getDesktopNavItems('member').map((item) => item.id);
    expect(memberIds).not.toContain('manual');
    expect(memberIds).not.toContain('config');
    expect(memberIds).toContain('calendar');
    expect(memberIds).toContain('statistics');
  });

  it('keeps the mobile bottom bar to four primary entries and a drawer', () => {
    expect(getPrimaryMobileNavItems('owner').map((item) => item.id)).toEqual([
      'calendar',
      'leave',
      'swap',
      'duty',
    ]);
    expect(getSecondaryMobileNavItems('owner').map((item) => item.id)).toEqual([
      'groups',
      'manual',
      'backfill',
      'events',
      'notifications',
      'statistics',
      'members',
      'config',
    ]);
    expect(getSecondaryMobileNavItems('member').map((item) => item.id)).not.toContain('config');
  });

  it('keeps keyboard focus order identical to the visual order', () => {
    const visible = getDesktopNavItems('administrator');
    expect(getFocusOrder(visible)).toEqual(visible.map((item) => item.id));
    const primary = getPrimaryMobileNavItems('administrator');
    expect(getFocusOrder(primary)).toEqual(primary.map((item) => item.id));
  });

  it('hides the event center from members and keeps it for administrators', () => {
    const memberIds = getVisibleNavItems('member').map((item) => item.id);
    const administratorIds = getVisibleNavItems('administrator').map((item) => item.id);
    expect(memberIds).not.toContain('events');
    expect(administratorIds).toContain('events');
  });

  it('limits guests to calendar and group management', () => {
    expect(getVisibleNavItems('guest').map((item) => item.id)).toEqual(['calendar', 'groups']);
  });

  it('uses the active workflow name in the compact application header', () => {
    expect(getWorkbenchPageTitle('calendar')).toBe('工作台');
    expect(getWorkbenchPageTitle('leave')).toBe('请假与审批');
    expect(getWorkbenchPageTitle('swap')).toBe('换班');
    expect(getWorkbenchPageTitle('duty')).toBe('加扣班');
    expect(getWorkbenchPageTitle('groups')).toBe('群组管理');
  });
});
