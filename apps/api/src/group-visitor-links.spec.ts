import { describe, expect, it } from 'vitest';
import { parseVisitorLinkArguments } from './group-visitor-links.js';

describe('visitor link operator command', () => {
  const first = '00000000-0000-4000-8000-000000000001',
    second = '00000000-0000-4000-8000-000000000002';
  it('requires exact names for read-only inspection and reviewed IDs/version for mutation', () => {
    expect(parseVisitorLinkArguments(['inspect', '医生群', '护士群'])).toEqual({
      action: 'inspect',
      first: '医生群',
      second: '护士群',
    });
    expect(parseVisitorLinkArguments(['enable', first, second, '0', 'operator'])).toMatchObject({
      action: 'enable',
      expectedVersion: 0,
    });
    expect(parseVisitorLinkArguments(['disable', first, second, '2', 'operator'])).toMatchObject({
      action: 'disable',
      expectedVersion: 2,
    });
  });
  it.each([
    [],
    ['enable', '医生群', '护士群', '0', 'operator'],
    ['enable', first, second, '-1', 'operator'],
    ['enable', first, second, '', 'operator'],
    ['enable', first, second, '1'],
    ['inspect', '医生群', '护士群', 'enable'],
  ])('rejects incomplete or ambiguous arguments %j', (...args) => {
    expect(() => parseVisitorLinkArguments(args)).toThrow('用法');
  });
});
