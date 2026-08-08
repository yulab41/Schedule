import { describe, expect, it } from 'vitest';

import { hasDuplicateRosterName, parseRosterNames } from './roster-input.js';

describe('roster input', () => {
  it('trims pasted lines and excludes blank names', () => {
    expect(parseRosterNames(' Zhang San\n\n  Li Si  \r\n')).toEqual(['Zhang San', 'Li Si']);
  });

  it('detects duplicate pending names before submitting the roster', () => {
    expect(hasDuplicateRosterName(['Zhang San', 'Li Si', 'Zhang San'])).toBe(true);
    expect(hasDuplicateRosterName(['Zhang San', 'Li Si'])).toBe(false);
  });
});
