import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../../migrations/0048_manual_schedule_limits.sql',
  import.meta.url,
);
const journal = readFileSync(
  new URL('../../../migrations/meta/_journal.json', import.meta.url),
  'utf8',
);
const schema = readFileSync(new URL('../src/schema/manual-schedules.ts', import.meta.url), 'utf8');

describe('P5 manual schedule database limits', () => {
  it('registers a fail-closed migration before tightening active row checks', () => {
    expect(existsSync(migrationUrl)).toBe(true);
    if (!existsSync(migrationUrl)) return;

    const migration = readFileSync(migrationUrl, 'utf8');
    expect(journal).toContain('0048_manual_schedule_limits');
    expect(migration).toContain("SIGNAL SQLSTATE '45000'");
    expect(migration).toContain('`template`.`deleted_at` IS NULL');
    expect(migration).toContain('`template`.`cycle_days` NOT BETWEEN 1 AND 30');
    expect(migration).toContain('HAVING COUNT(*) > 20');
    expect(migration).toContain('HAVING COUNT(*) > 600');
    expect(migration).toContain('`cell`.`cycle_day` NOT BETWEEN 1 AND 30');
    expect(migration.indexOf("SIGNAL SQLSTATE '45000'")).toBeLessThan(
      migration.indexOf('DROP CHECK `manual_schedule_templates_cycle_days_check`'),
    );
    expect(migration).not.toMatch(/\b(DELETE|UPDATE)\s+`manual_schedule/iu);
    expect(migration).not.toContain('LEAST(');
  });

  it('keeps soft-deleted legacy rows while enforcing thirty active days', () => {
    expect(existsSync(migrationUrl)).toBe(true);
    if (!existsSync(migrationUrl)) return;

    const migration = readFileSync(migrationUrl, 'utf8');
    expect(migration).toContain(
      'CHECK (`deleted_at` IS NOT NULL OR `cycle_days` BETWEEN 1 AND 30)',
    );
    expect(migration).toContain('CHECK (`deleted_at` IS NOT NULL OR `cycle_day` BETWEEN 1 AND 30)');
    expect(schema).toContain("'manual_schedule_templates_cycle_days_check'");
    expect(schema).toContain("'manual_schedule_cells_cycle_day_check'");
    expect(schema).toContain('between 1 and 30');
  });
});
