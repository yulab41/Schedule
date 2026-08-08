import { describe, expect, it } from 'vitest';

import {
  groupCatalogEntrySchema,
  groupCatalogRelationSchema,
  groupRoleSchema,
  updateGroupNameRequestSchema,
} from './groups.js';

describe('group membership contracts', () => {
  it('accepts guest in the role enum', () => {
    expect(groupRoleSchema.safeParse('guest').success).toBe(true);
  });

  it('rejects unknown catalog relations', () => {
    expect(groupCatalogRelationSchema.safeParse('banned').success).toBe(false);
  });

  it('rejects extra fields in catalog entries', () => {
    expect(
      groupCatalogEntrySchema.safeParse({
        id: 'g1',
        name: '内科',
        relation: 'none',
        groupCode: '1234',
      }).success,
    ).toBe(false);
  });

  it('rejects empty group names in update requests', () => {
    expect(updateGroupNameRequestSchema.safeParse({ name: '  ' }).success).toBe(false);
  });
});
