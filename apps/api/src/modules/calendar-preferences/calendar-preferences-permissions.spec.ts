import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const service = read('./calendar-preferences-service.ts');
const routes = read('./calendar-preferences-routes.ts');

describe('calendar preference permissions and validation', () => {
  it('allows members to read/update themselves and restricts group defaults to schedulers', () => {
    expect(service).toContain("'viewScheduleConfiguration'");
    expect(service).toContain("'manageScheduleConfiguration'");
    expect(service).toContain("authorization.membership.role === 'administrator'");
  });

  it('validates enabled same-group shift types and strict request contracts', () => {
    expect(service).toContain('eq(shiftTypes.groupId, groupId)');
    expect(service).toContain('eq(shiftTypes.isEnabled, 1)');
    expect(routes).toContain('updateGroupCalendarDefaultsSchema');
    expect(routes).toContain('updateMemberCalendarPreferencesSchema');
  });
});

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}
