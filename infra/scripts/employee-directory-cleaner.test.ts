import { describe, expect, it } from 'vitest';

import { cleanEmployeeDirectoryRecords, classifyPhone } from './employee-directory-cleaner.js';

describe('employee directory cleaner', () => {
  it('keeps only exact eleven-digit full numbers and six-digit extensions', () => {
    expect(classifyPhone('13800138000')).toBe('full');
    expect(classifyPhone('123456')).toBe('extension');
    expect(classifyPhone('1380013800')).toBeUndefined();
    expect(classifyPhone('138001380000')).toBeUndefined();
    expect(classifyPhone('138-0013-8000')).toBeUndefined();
  });

  it('removes invalid and duplicate fields, retaining identified employees without a phone', () => {
    const result = cleanEmployeeDirectoryRecords([
      {
        姓名: '林恩宇',
        层级: '医院/行政/办公室',
        移动电话: '13800138000',
        移动电话1: '123456',
        移动电话2: '123456',
      },
      {
        姓名: '林恩宇',
        层级: '医院/行政/办公室',
        移动电话: '13800138000',
        移动电话1: '123456',
      },
      {
        姓名: '无电话员工',
        employeeCode: 'h0002',
        层级: '医院/行政/办公室',
        移动电话: '12345',
        移动电话1: 'abc',
      },
      {
        姓名: '张三',
        crawl_path: ['医院', '临床', '一科'],
        移动电话: '13900139000',
      },
    ]);

    expect(result.records).toEqual([
      {
        level: '医院/行政/办公室',
        levelPath: ['医院', '行政', '办公室'],
        name: '林恩宇',
        phones: [
          { kind: 'full', sourceField: '移动电话', value: '13800138000' },
          { kind: 'extension', sourceField: '移动电话1', value: '123456' },
        ],
      },
      {
        employeeCode: 'h0002',
        level: '医院/行政/办公室',
        levelPath: ['医院', '行政', '办公室'],
        name: '无电话员工',
        phones: [],
      },
      {
        level: '医院/临床/一科',
        levelPath: ['医院', '临床', '一科'],
        name: '张三',
        phones: [{ kind: 'full', sourceField: '移动电话', value: '13900139000' }],
      },
    ]);
    expect(result.stats).toMatchObject({
      duplicateFieldCount: 1,
      duplicateRecordCount: 1,
      droppedWithoutIdentityCount: 0,
      retainedWithoutValidPhoneCount: 1,
      inputRecordCount: 4,
      invalidFieldCount: 2,
      outputRecordCount: 3,
      validExtensionCount: 2,
      validFullPhoneCount: 3,
    });
  });

  it('does not create duplicate employee entries when a contact-bearing row exists', () => {
    const withoutPhone = { 姓名: '测试职工', 层级: '医院/手术室' };
    const withPhone = { ...withoutPhone, 移动电话: '123456' };
    const withoutIdentity = { 层级: '医院/手术室' };
    for (const rows of [
      [withPhone, withoutPhone],
      [withoutPhone, withPhone],
    ]) {
      const result = cleanEmployeeDirectoryRecords([...rows, withoutIdentity]);
      expect(result.records).toHaveLength(1);
      expect(result.records[0]?.phones).toHaveLength(1);
      expect(result.stats).toMatchObject({
        droppedWithoutIdentityCount: 1,
        retainedWithoutValidPhoneCount: 0,
        outputRecordCount: 1,
      });
    }
  });

  it('keeps distinct verified codes for equal names in the same department', () => {
    const identity = { 姓名: '同名职工', 层级: '医院/手术室' };
    const result = cleanEmployeeDirectoryRecords([
      { ...identity, employeeCode: 'd0001', 移动电话: '123456' },
      { ...identity, employeeCode: 'd0002' },
      { ...identity, employeeCode: 'd0003' },
    ]);
    expect(result.records.map((entry) => entry.employeeCode)).toEqual(['d0001', 'd0002', 'd0003']);
  });

  it('strips boundary noise from display fields while preserving meaningful punctuation', () => {
    const result = cleanEmployeeDirectoryRecords([
      {
        姓名: '李杰.',
        层级: '汕大肿瘤医院/行政后勤类科室/院长办公室./内科一区(呼吸淋巴及血液肿瘤内科)',
        移动电话: '13602790063',
      },
    ]);

    expect(result.records[0]).toMatchObject({
      name: '李杰',
      levelPath: [
        '汕大肿瘤医院',
        '行政后勤类科室',
        '院长办公室',
        '内科一区(呼吸淋巴及血液肿瘤内科)',
      ],
    });
  });

  it('carries a source job title through cleaning', () => {
    const result = cleanEmployeeDirectoryRecords([
      {
        姓名: '李杰',
        层级: '汕大肿瘤医院/行政后勤类科室/行政领导',
        jobTitle: '院长',
        移动电话: '13602790063',
      },
    ]);

    expect(result.records[0]).toMatchObject({ name: '李杰', jobTitle: '院长' });
  });
});
