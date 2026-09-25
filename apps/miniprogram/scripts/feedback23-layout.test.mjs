import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const miniRoot = new URL('../src/', import.meta.url);
const read = (name) => readFileSync(new URL(name, miniRoot), 'utf8');

describe('Feedback23 layout parity', () => {
  it('keeps all export selectors inside the same padded field boundary', () => {
    const template = read('subpackages/insights/components/exports-panel/index.wxml');
    const styles = read('subpackages/insights/components/exports-panel/index.wxss');
    expect(template.match(/class="selector-field"/gu)).toHaveLength(3);
    expect(styles).toMatch(/\.selector-field\s*\{[^}]*padding:\s*0 12px;/su);
    expect(styles).toMatch(/\.selector-field\s*\{[^}]*min-width:\s*0;/su);
    expect(styles).not.toContain('.workflow-picker-trigger');
  });

  it('renders guest week duties through the same tinted shift groups as members', () => {
    const guest = read('pages/guest/guest.wxml');
    const member = read('components/calendar/calendar-week-panel/index.wxml');
    expect(read('pages/workbench/index.wxml')).toContain('<calendar-week-panel');
    for (const contract of [
      'wx:for="{{day.shiftGroups}}"',
      'class="week-shift-group"',
      'style="background:{{shiftGroup.tint}}"',
      'wx:for="{{shiftGroup.duties}}"',
    ]) {
      expect(member).toContain(contract);
      expect(guest).toContain(contract);
    }
    expect(guest).not.toContain(
      'style="color:{{duty.shiftTextColor}};background:{{duty.shiftColor}}"',
    );
  });

  it('keeps guest duty state, collapse, and adaptive week height aligned with members', () => {
    const guest = read('pages/guest/guest.wxml');
    const member = read('pages/workbench/index.wxml');
    for (const contract of [
      'style="height:{{weekGridHeight}}px"',
      'catchtap="handleShiftCardToggle"',
      'aria-expanded="{{shiftCardExpansion.expanded[group.key]}}"',
      'wx:if="{{shiftCardExpansion.expanded[group.key]}}"',
      'class="duty-work-state is-{{group.dutyState}}"',
      '{{group.dutyStateLabel}}',
    ]) {
      expect(member).toContain(contract);
      expect(guest).toContain(contract);
    }

    const controller = read('pages/guest/guest.ts');
    expect(controller).toContain('reconcileShiftCardExpansion(');
    expect(controller).toContain('toggleShiftCardExpansion(');
    expect(controller).toContain('Math.max(112, (view.weekPanels[1]?.height ?? 112) + 20)');
  });
});
