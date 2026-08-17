import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('scheduling configuration interactions', () => {
  it('updates a shift enabled switch without replacing the whole configuration page', () => {
    const source = readSource('./SchedulingConfigPanel.vue');
    const toggleFlow = source.slice(
      source.indexOf('async function updateShiftEnabled'),
      source.indexOf('async function deleteRole'),
    );

    expect(toggleFlow).toContain('const savedShiftType = await api.updateShiftType(');
    expect(toggleFlow).toContain('applySavedShiftType(savedShiftType);');
    expect(toggleFlow).not.toContain('saveShift(');
    expect(toggleFlow).not.toContain('loadConfig(');
  });
});
