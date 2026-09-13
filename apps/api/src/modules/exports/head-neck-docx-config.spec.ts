import { afterEach, describe, expect, it, vi } from 'vitest';

import { getHeadNeckDocxConfig, readHeadNeckDocxConfig } from './head-neck-docx-config.js';

const ids = Array.from(
  { length: 6 },
  (_, index) => `0000000${index + 1}-0000-4000-8000-00000000000${index + 1}`,
);
const [groupId, firstOne, firstTwo, roleId] = ids as [string, string, string, string];

afterEach(() => vi.unstubAllEnvs());

describe('head-neck DOCX configuration', () => {
  it('accepts one exact group, first-duty IDs and fixed display-name mappings', () => {
    vi.stubEnv(
      'HEAD_NECK_DOCX_EXPORT_CONFIG',
      JSON.stringify({
        groupId,
        firstDutyMembershipIds: [firstOne, firstTwo],
        firstDutyRoleId: roleId,
        secondDutyNameByFirstMembershipId: { [firstOne]: 'Second A', [firstTwo]: 'Second B' },
        thirdDutyNames: ['Third A', 'Third B'],
      }),
    );
    expect(getHeadNeckDocxConfig(groupId)?.thirdDutyNames).toEqual(['Third A', 'Third B']);
    expect(getHeadNeckDocxConfig(firstOne)).toBeUndefined();
  });

  it('fails closed for malformed or incomplete configuration', () => {
    vi.stubEnv('HEAD_NECK_DOCX_EXPORT_CONFIG', '{bad');
    expect(readHeadNeckDocxConfig()).toBeUndefined();
    vi.stubEnv(
      'HEAD_NECK_DOCX_EXPORT_CONFIG',
      JSON.stringify({
        groupId,
        firstDutyMembershipIds: [firstOne],
        firstDutyRoleId: roleId,
        secondDutyNameByFirstMembershipId: {},
        thirdDutyNames: ['Third A', 'Third B'],
      }),
    );
    expect(readHeadNeckDocxConfig()).toBeUndefined();
    vi.stubEnv(
      'HEAD_NECK_DOCX_EXPORT_CONFIG',
      JSON.stringify({
        groupId,
        firstDutyMembershipIds: [firstOne],
        firstDutyRoleId: roleId,
        secondDutyNameByFirstMembershipId: { [firstOne]: ' ' },
        thirdDutyNames: ['Third A', 'Third B'],
      }),
    );
    expect(readHeadNeckDocxConfig()).toBeUndefined();
  });
});
