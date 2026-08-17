import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('compact scheduling configuration', () => {
  it('keeps shift rows compact and expands editing only on demand', () => {
    const source = readSource('./SchedulingConfigPanel.vue');

    expect(source).toContain('class="shift-type-row"');
    expect(source).toContain('editingShiftId === shiftType.id');
    expect(source).toContain('class="edit-row-button"');
    expect(source).toContain('class="compact-shift-editor"');
    expect(source).toContain('class="time-range-control"');
  });

  it('uses the shared notification-style switch instead of checkbox controls', () => {
    const source = readSource('./SchedulingConfigPanel.vue');
    const switchSource = readSource('../../components/CompactSwitch.vue');

    expect(source).toContain('CompactSwitch');
    expect(source).not.toContain('type="checkbox"');
    expect(switchSource).toContain('role="switch"');
    expect(switchSource).toMatch(/\.compact-switch\s*{[^}]*width:\s*52px;[^}]*height:\s*30px;/s);
    expect(switchSource).toMatch(/\.switch-hit-area\s*{[^}]*min-height:\s*44px;/s);
  });

  it('offers five preset circles plus a custom palette and HEX editor', () => {
    const source = readSource('./ShiftColorPicker.vue');

    expect(source).toContain("'#0A66D5'");
    expect(source).toContain("'#287D70'");
    expect(source).toContain("'#4C5BD4'");
    expect(source).toContain("'#9A6A13'");
    expect(source).toContain("'#C33D56'");
    expect(source).toContain('custom-color-trigger');
    expect(source).not.toContain('type="color"');
    expect(source).toContain('class="color-spectrum"');
    expect(source).toContain('type="range"');
    expect(source).toContain('--picker-hue');
    expect(source).toContain('class="spectrum-cursor"');
    expect(source).toContain('HEX');
    expect(source).toContain('请输入 #RRGGBB');
    expect(source).not.toContain("content: '+'");
    expect(source).toMatch(
      /\.custom-color-trigger::after\s*{[^}]*background:[^}]*linear-gradient/s,
    );
  });
});
