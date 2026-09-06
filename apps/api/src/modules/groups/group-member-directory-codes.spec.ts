import { describe, expect, it, vi } from 'vitest';
import type { DatabaseTransaction } from '@schedule/database';
import { MySqlDialect } from 'drizzle-orm/mysql-core';

import {
  completePublicPhone,
  readMemberEmployeeCodes,
  resolveUniqueEmployeeCodes,
} from './group-member-directory-codes.js';

const member = { membershipId: 'synthetic-member', realName: '示例甲', mobilePhone: '13900000001' };
const row = { realName: member.realName, mobilePhone: member.mobilePhone, employeeCode: 'D0001' };

describe('group member employee codes from disclosed directory identity', () => {
  it('keeps a unique exact name and phone match and leading zeroes', () => {
    expect(resolveUniqueEmployeeCodes(member, [row, row])).toEqual(['D0001']);
    expect(resolveUniqueEmployeeCodes(member, [{ ...row, employeeCode: '0001' }])).toEqual([
      '0001',
    ]);
  });
  it('does not infer identity from a shared name or phone, missing code, or conflicting codes', () => {
    for (const rows of [
      [{ ...row, mobilePhone: '13900000002' }],
      [{ ...row, realName: '示例乙' }],
      [row, { ...row, employeeCode: 'D0002' }],
      [row, { ...row, employeeCode: null }],
    ])
      expect(resolveUniqueEmployeeCodes(member, rows)).toBeUndefined();
  });
  it.each([undefined, '', '139 **** 0001', '0001', '13900000001x'])(
    'rejects hidden or incomplete number %s',
    (mobilePhone) => {
      expect(completePublicPhone(mobilePhone)).toBeUndefined();
      expect(resolveUniqueEmployeeCodes({ ...member, mobilePhone }, [row])).toBeUndefined();
    },
  );
  it('does no query for hidden numbers and batches all eligible members in one restricted query', async () => {
    let query: ReturnType<MySqlDialect['sqlToQuery']> | undefined;
    const chain = {
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      where: vi.fn((where) => {
        query = new MySqlDialect().sqlToQuery(where);
        return Promise.resolve([row]);
      }),
    };
    const select = vi.fn(() => chain);
    const transaction = { select } as unknown as DatabaseTransaction;
    expect(
      await readMemberEmployeeCodes(transaction, [{ ...member, mobilePhone: undefined }], false),
    ).toEqual(new Map());
    expect(select).not.toHaveBeenCalled();
    expect(
      await readMemberEmployeeCodes(
        transaction,
        [member, { ...member, membershipId: 'second' }],
        false,
      ),
    ).toEqual(
      new Map([
        ['synthetic-member', ['D0001']],
        ['second', ['D0001']],
      ]),
    );
    expect(select).toHaveBeenCalledTimes(1);
    expect(query?.params).toEqual(['employee', 'published', 'person', '13900000001', 'member']);
    expect(query?.sql).toContain('`visibility`');
  });
});
