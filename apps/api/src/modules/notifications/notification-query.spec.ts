import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';

import { buildUnreadCountCondition } from './notification-query.js';

const dialect = new MySqlDialect();

describe('notification unread count scope', () => {
  it('keeps the global query global and adds the requested group to the scoped query', () => {
    const globalQuery = dialect.sqlToQuery(buildUnreadCountCondition('user-1'));
    const groupQuery = dialect.sqlToQuery(buildUnreadCountCondition('user-1', 'group-1'));

    expect(globalQuery.sql).toContain('`notifications`.`recipient_user_id` = ?');
    expect(globalQuery.sql).not.toContain('`notifications`.`group_id` = ?');
    expect(globalQuery.params).toEqual(['user-1', 0]);
    expect(groupQuery.sql).toContain('`notifications`.`group_id` = ?');
    expect(groupQuery.params).toEqual(['user-1', 0, 'group-1']);
  });
});
