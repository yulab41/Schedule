import { describe, expect, it } from 'vitest';

import { normalizeClientIp } from './visitor-access-log.js';

describe('visitor access IP normalization', () => {
  it('keeps canonical IPv4/IPv6 and unwraps IPv4-mapped addresses', () => {
    expect(normalizeClientIp('203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeClientIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeClientIp('2001:DB8::1')).toBe('2001:db8::1');
  });

  it('stores no arbitrary, multi-hop, or empty text as an IP', () => {
    expect(normalizeClientIp('not-an-ip')).toBeUndefined();
    expect(normalizeClientIp('198.51.100.1, 203.0.113.7')).toBeUndefined();
    expect(normalizeClientIp('')).toBeUndefined();
    expect(normalizeClientIp(undefined)).toBeUndefined();
  });
});
