import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('calendar badge density', () => {
  it('uses the same compact desktop geometry for holidays, makeup days, shifts, and changes', () => {
    const month = source('./MonthGrid.vue');
    const week = source('./WeekGrid.vue');
    const duty = source('./DutyCell.vue');
    const change = source('./ChangeBadge.vue');

    for (const css of [month, week]) {
      expect(css).toMatch(
        /\.holiday-tag\s*{[^}]*height:\s*16px;[^}]*padding:\s*0 3px;[^}]*font-size:\s*9px;[^}]*line-height:\s*1;/s,
      );
    }
    expect(duty).toMatch(
      /\.shift-badge\s*{[^}]*height:\s*16px;[^}]*padding:\s*0 3px;[^}]*font-size:\s*9px;[^}]*line-height:\s*1;/s,
    );
    expect(change).toMatch(
      /\.change-marker\s*{[^}]*height:\s*16px;[^}]*padding:\s*0 3px;[^}]*font-size:\s*9px;[^}]*line-height:\s*1;/s,
    );
  });

  it('keeps every mobile calendar badge at the same fourteen-pixel capsule height', () => {
    const month = source('./MonthGrid.vue');
    const week = source('./WeekGrid.vue');

    for (const css of [month, week]) {
      expect(css).toMatch(
        /@media \(max-width: 640px\)[\s\S]*?:deep\(\.shift-badge\),[\s\S]*?:deep\(\.change-marker\)\s*{[^}]*height:\s*14px;[^}]*padding:\s*0 2px;[^}]*font-size:\s*8px;[^}]*line-height:\s*1;/s,
      );
      expect(css).toMatch(
        /@media \(max-width: 640px\)[\s\S]*?\.holiday-tag\s*{[^}]*height:\s*14px;[^}]*padding:\s*0 2px;[^}]*font-size:\s*8px;[^}]*line-height:\s*1;/s,
      );
    }
  });
});
