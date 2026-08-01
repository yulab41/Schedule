import { describe, expect, it } from 'vitest';

import { getBusinessDates } from './cursor.js';
import { generateRotation } from './generate.js';
import type { RotationGenerationInput } from './types.js';

const input: RotationGenerationInput = {
  endDate: '2029-01-01',
  rules: [
    {
      defaultShiftType: {
        crossesMidnight: false,
        endTime: '08:00',
        id: 'night',
        isEnabled: true,
        startTime: '00:00',
      },
      members: [{ isActive: true, membershipId: 'a', position: 1 }],
      requiredMembersPerDay: 1,
      rotationStartDate: '2028-12-31',
      scheduleRoleId: 'primary',
      startingMembershipId: 'a',
    },
  ],
  startDate: '2028-12-31',
};

describe('rotation date boundaries', () => {
  it('includes both endpoints across a calendar-year boundary', () => {
    expect(getBusinessDates('2028-12-31', '2029-01-01')).toEqual(['2028-12-31', '2029-01-01']);
    expect(generateRotation(input).assignments).toMatchObject([
      {
        businessDate: '2028-12-31',
        endsAt: new Date('2028-12-31T00:00:00.000Z'),
        startsAt: new Date('2028-12-30T16:00:00.000Z'),
      },
      {
        businessDate: '2029-01-01',
        endsAt: new Date('2029-01-01T00:00:00.000Z'),
        startsAt: new Date('2028-12-31T16:00:00.000Z'),
      },
    ]);
  });

  it('rejects a malformed date range and dates before the rotation anchor', () => {
    expect(() => getBusinessDates('2028-02-30', '2028-03-01')).toThrow('valid YYYY-MM-DD');
    expect(() =>
      generateRotation({
        ...input,
        endDate: '2028-12-30',
        startDate: '2028-12-30',
      }),
    ).toThrow('cannot precede the rotation start date');
  });
});
