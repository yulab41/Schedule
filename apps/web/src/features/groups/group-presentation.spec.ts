import { describe, expect, it } from 'vitest';

import { getGroupRoleLabel } from './group-presentation.js';

describe('group presentation', () => {
  it('uses the existing role vocabulary in the identity band', () => {
    expect(getGroupRoleLabel('owner')).toBe('群主');
    expect(getGroupRoleLabel('administrator')).toBe('管理员');
    expect(getGroupRoleLabel('member')).toBe('成员');
    expect(getGroupRoleLabel('guest')).toBe('访客');
  });
});
