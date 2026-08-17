import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const componentPath = join(sourceRoot, 'components', 'TemporalPicker.vue');

function vueSources(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return vueSources(path);
    return extname(entry.name) === '.vue' ? [readFileSync(path, 'utf8')] : [];
  });
}

describe('production temporal picker', () => {
  it('uses the approved accessible month, date, and time interaction language', () => {
    expect(existsSync(componentPath)).toBe(true);
    const component = readFileSync(componentPath, 'utf8');

    expect(component).toContain("type TemporalPickerKind = 'month' | 'date' | 'time'");
    expect(component).toContain('role="dialog"');
    expect(component).toContain('role="listbox"');
    expect(component).toContain('class="month-wheel"');
    expect(component).toContain('class="date-grid"');
    expect(component).toContain('class="time-wheel"');
    expect(component).toContain('prefers-reduced-motion: reduce');
    expect(component).toContain("emit('change', value)");
  });

  it('replaces production native month, date, and time controls without touching datetime-local', () => {
    const productionSources = [
      ...vueSources(join(sourceRoot, 'features')),
      ...vueSources(join(sourceRoot, 'views')),
    ].join('\n');

    expect(productionSources).not.toMatch(/type=["'](?:month|date|time)["']/);
    expect(productionSources).toContain('type="datetime-local"');
    expect(productionSources).toContain('<TemporalPicker');
  });
});
