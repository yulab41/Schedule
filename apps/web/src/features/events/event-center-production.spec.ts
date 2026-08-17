import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('production event center timeline', () => {
  it('replaces the event table with date-grouped timeline cards', () => {
    const source = readSource('../../views/events/EventCenterView.vue');

    expect(source).toContain('buildEventDateGroups(events.value)');
    expect(source).toContain('class="event-date-group"');
    expect(source).toContain('class="event-timeline-list"');
    expect(source).toContain('class="timeline-event-card"');
    expect(source).not.toContain('<table class="event-table">');
  });

  it('supports global date folding, per-date folding, and per-event detail expansion', () => {
    const source = readSource('../../views/events/EventCenterView.vue');

    expect(source).toContain('toggleAllDates');
    expect(source).toContain('toggleDateGroup(dateGroup.businessDate)');
    expect(source).toContain('toggleEventDetails(event.id)');
    expect(source).toContain("allDatesCollapsed ? '展开全部日期' : '折叠全部日期'");
    expect(source).toContain("isDateCollapsed(dateGroup.businessDate) ? '展开' : '折叠'");
    expect(source).toContain("isEventExpanded(event.id) ? '收起详情' : '展开详情'");
  });
});
