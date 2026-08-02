import { describe, expect, it } from 'vitest';

import {
  getDesktopNavItems,
  getFocusOrder,
  getPrimaryMobileNavItems,
  getSecondaryMobileNavItems,
  workbenchNavItems,
} from './workbench-nav.js';

describe('Workbench navigation', () => {
  it('shows every workbench entry on the desktop sidebar', () => {
    expect(getDesktopNavItems('owner').map((item) => item.id)).toEqual(
      workbenchNavItems.map((item) => item.id),
    );
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
      'manual',
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
});
