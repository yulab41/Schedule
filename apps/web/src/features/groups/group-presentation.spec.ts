import { describe, expect, it } from 'vitest';

import { getGroupRoleLabel, splitGroupCode } from './group-presentation.js';

describe('group presentation', () => {
  it('keeps every group code digit visible, including leading zeroes', () => {
    expect(splitGroupCode('0472')).toEqual(['0', '4', '7', '2']);
    expect(splitGroupCode(undefined)).toEqual([]);
  });

  it('uses the existing role vocabulary in the identity band', () => {
    expect(getGroupRoleLabel('owner')).toBe('群主');
    expect(getGroupRoleLabel('administrator')).toBe('管理员');
    expect(getGroupRoleLabel('member')).toBe('成员');
    expect(getGroupRoleLabel('guest')).toBe('访客');
  });
});
