import * as schema from '@schedule/database';
import { getTableConfig, type AnyMySqlTable } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';

import { groupRecycleDeleteSteps } from './group-recycle.js';

const IsDrizzleTable = Symbol.for('drizzle:IsDrizzleTable');

describe('group recycle delete plan', () => {
  it('covers every table transitively linked to groups by foreign keys', () => {
    const tables = Object.values(schema).filter(
      (value) => typeof value === 'object' && value !== null && IsDrizzleTable in value,
    ) as unknown as AnyMySqlTable[];
    const tableName = (table: AnyMySqlTable): string => getTableConfig(table).name;
    const childrenByParent = new Map<string, string[]>();

    for (const table of tables) {
      for (const foreignKey of getTableConfig(table).foreignKeys) {
        const reference = foreignKey.reference();
        const parentName = tableName(reference.foreignTable);
        const children = childrenByParent.get(parentName) ?? [];
        children.push(tableName(table));
        childrenByParent.set(parentName, children);
      }
    }

    const reachable = new Set<string>();
    const pending = ['groups'];
    while (pending.length > 0) {
      const current = pending.pop() as string;
      for (const child of childrenByParent.get(current) ?? []) {
        if (!reachable.has(child)) {
          reachable.add(child);
          pending.push(child);
        }
      }
    }

    const coveredTables = new Set(groupRecycleDeleteSteps.map((step) => step.table));
    const missing = [...reachable].filter((table) => !coveredTables.has(table)).sort();
    expect(missing).toEqual([]);

    const order = new Map(
      groupRecycleDeleteSteps.map((step, index) => [step.table, index] as const),
    );
    for (const table of tables) {
      const childName = tableName(table);
      if (!reachable.has(childName)) {
        continue;
      }
      for (const foreignKey of getTableConfig(table).foreignKeys) {
        const parentName = tableName(foreignKey.reference().foreignTable);
        const childIndex = order.get(childName) ?? -1;
        const parentIndex = order.get(parentName) ?? Number.MAX_SAFE_INTEGER;
        expect(
          childIndex,
          `child ${childName} must be deleted before parent ${parentName}`,
        ).toBeLessThan(parentIndex);
      }
    }

    expect(groupRecycleDeleteSteps.at(-1)?.table).toBe('groups');
  });
});
