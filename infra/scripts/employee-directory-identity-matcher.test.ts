import { describe, expect, it } from 'vitest';

import {
  matchEmployeeDirectoryRecords,
  parseEmployeeIdentityText,
} from './employee-directory-identity-matcher.js';
import type { CleanEmployeeDirectoryRecord } from './employee-directory-cleaner.js';

function record(name: string, levelPath: readonly string[]): CleanEmployeeDirectoryRecord {
  return {
    level: levelPath.join('/'),
    levelPath,
    name,
    phones: [{ sourceField: '移动电话', value: '13800138000', kind: 'full' }],
  };
}

describe('employee identity matching', () => {
  it('parses concatenated name, employee code and department records', () => {
    const parsed = parseEmployeeIdentityText('李甲(d0001)[内科一区]1234信息科测试()[信息科]9999');

    expect(parsed.records).toEqual([
      { department: '内科一区', employeeCode: 'd0001', name: '李甲', sourcePhone: '1234' },
    ]);
    expect(parsed.emptyCodeSourceCount).toBe(1);
  });

  it('prefers department matches and maps repeated directory rows by unique name', () => {
    const result = matchEmployeeDirectoryRecords(
      [
        record('李甲', ['医院', '临床', '内科一区']),
        record('李甲', ['医院', '临床', '内科一区护士站']),
        record('王乙', ['医院', '行政']),
      ],
      [
        { department: '内科一区', employeeCode: 'd0001', name: '李甲', sourcePhone: '1234' },
        { department: '人事科', employeeCode: 'g0002', name: '王乙', sourcePhone: '5678' },
      ],
    );

    expect(result.records.map((item) => item.employeeCode)).toEqual(['d0001', 'd0001', 'g0002']);
    expect(result.records).toHaveLength(3);
    expect(result.report.matchedByDepartmentCount).toBe(1);
    expect(result.report.matchedByNameOnlyCount).toBe(2);
    expect(result.report.unmatchedCurrentRecordCount).toBe(0);
  });

  it('leaves ambiguous and missing identities unset for manual review', () => {
    const result = matchEmployeeDirectoryRecords(
      [record('重名', ['医院', '科室']), record('未知', ['医院', '科室'])],
      [
        { department: '甲科', employeeCode: 'd0001', name: '重名', sourcePhone: '1' },
        { department: '乙科', employeeCode: 'd0002', name: '重名', sourcePhone: '2' },
      ],
    );

    expect(result.records.every((item) => item.employeeCode === undefined)).toBe(true);
    expect(result.report.ambiguousCurrentRecordCount).toBe(1);
    expect(result.report.unmatchedCurrentRecordCount).toBe(1);
    expect(result.report.unmatchedCurrentRecords).toEqual([
      {
        candidateCodes: ['d0001', 'd0002'],
        level: '医院/科室',
        name: '重名',
        reason: 'ambiguous',
      },
      { candidateCodes: [], level: '医院/科室', name: '未知', reason: 'not_found' },
    ]);
  });
});
