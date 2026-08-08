import { describe, expect, it } from 'vitest';

import {
  getDesktopNavItems,
  getFocusOrder,
  getVisibleNavItems,
  workbenchNavItems,
} from './workbench-nav.js';

describe('Workbench navigation', () => {
  it('shows every workbench entry for owners', () => {
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

  it('keeps keyboard focus order identical to the visual order', () => {
    const visible = getDesktopNavItems('administrator');
    expect(getFocusOrder(visible)).toEqual(visible.map((item) => item.id));
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
});
