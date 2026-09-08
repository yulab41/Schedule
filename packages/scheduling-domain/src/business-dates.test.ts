import { describe, expect, it } from 'vitest';
import { getBusinessDates } from './business-dates.js';
describe('business date ranges', () => {
  it('includes endpoints across a year', () => {
    expect(getBusinessDates('2028-12-31', '2029-01-01')).toEqual(['2028-12-31', '2029-01-01']);
  });
  it('rejects invalid and reversed dates', () => {
    expect(() => getBusinessDates('2028-02-30', '2028-03-01')).toThrow('valid YYYY-MM-DD');
    expect(() => getBusinessDates('2028-03-02', '2028-03-01')).toThrow('cannot precede');
  });
});
