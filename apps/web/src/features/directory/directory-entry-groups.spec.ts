import type { DirectoryContactMethod, DirectoryEntry } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  getDirectoryGroupContexts,
  getDirectoryGroupEmployeeCodes,
  getDirectoryGroupNotes,
  getDirectoryGroupTitle,
  groupDirectoryEntriesByContact,
} from './directory-entry-groups.js';

function contact(
  id: string,
  overrides: Partial<DirectoryContactMethod> = {},
): DirectoryContactMethod {
  return {
    displayOrder: 0,
    fullNumber: '0754-00000003',
    id,
    internalExtension: '6401',
    isPrimary: true,
    type: 'voice',
    ...overrides,
  };
}

function entry(
  id: string,
  subunit: string,
  contacts: readonly DirectoryContactMethod[],
  overrides: Partial<DirectoryEntry> = {},
): DirectoryEntry {
  return {
    building: '住院楼',
    campus: { code: 'main', name: '本部院区' },
    contacts,
    department: '手术中心',
    displayOrder: 1,
    entryKind: 'service',
    floor: '3楼',
    id,
    room: subunit,
    section: '住院诊疗区',
    subunit,
    ...overrides,
  };
}

describe('directory contact display groups', () => {
  it('merges entries whose complete contact method sets are identical while preserving every title and context', () => {
    const groups = groupDirectoryEntriesByContact([
      entry(
        '20000000-0000-4000-8000-000000000011',
        '手术室护士站',
        [contact('10000000-0000-4000-8000-000000000011', { label: '护士站' })],
        { notes: '白班' },
      ),
      entry(
        '20000000-0000-4000-8000-000000000012',
        '护士值班房',
        [
          contact('10000000-0000-4000-8000-000000000012', {
            fullNumber: '0754 0000 0003',
            isPrimary: false,
            label: '值班房',
          }),
        ],
        { notes: '夜班' },
      ),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.entries).toHaveLength(2);
    expect(getDirectoryGroupTitle(groups[0]!)).toBe('手术室护士站 / 护士值班房');
    expect(getDirectoryGroupContexts(groups[0]!)).toEqual([
      '本部院区 › 住院诊疗区 › 手术中心 · 住院楼 · 3楼',
    ]);
    expect(getDirectoryGroupNotes(groups[0]!)).toBe('白班；夜班');
  });

  it('does not merge partial matches, different number types, or entries without contacts', () => {
    const groups = groupDirectoryEntriesByContact([
      entry('20000000-0000-4000-8000-000000000021', '护士站', [
        contact('10000000-0000-4000-8000-000000000021'),
      ]),
      entry('20000000-0000-4000-8000-000000000022', '护士值班房', [
        contact('10000000-0000-4000-8000-000000000022', { internalExtension: '6402' }),
      ]),
      entry('20000000-0000-4000-8000-000000000023', '传真室', [
        contact('10000000-0000-4000-8000-000000000023', { type: 'fax' }),
      ]),
      entry('20000000-0000-4000-8000-000000000024', '无号码甲', []),
      entry('20000000-0000-4000-8000-000000000025', '无号码乙', []),
    ]);

    expect(groups).toHaveLength(5);
    expect(groups.every((group) => group.entries.length === 1)).toBe(true);
  });

  it('hides the employee hospital root from employee result contexts', () => {
    const groups = groupDirectoryEntriesByContact([
      entry(
        '20000000-0000-4000-8000-000000000026',
        '病房',
        [contact('10000000-0000-4000-8000-000000000026')],
        {
          campus: { code: 'employee-hospital', name: '汕大肿瘤医院' },
          contactName: '李杰',
        },
      ),
    ]);

    expect(getDirectoryGroupContexts(groups[0]!)).toEqual([
      '住院诊疗区 › 手术中心 › 病房 · 住院楼 · 3楼 · 病房',
    ]);
  });

  it('keeps employee codes available on merged display groups', () => {
    const groups = groupDirectoryEntriesByContact([
      entry(
        '20000000-0000-4000-8000-000000000027',
        '甲处',
        [contact('10000000-0000-4000-8000-000000000027')],
        { employeeCode: 'd0001' },
      ),
      entry(
        '20000000-0000-4000-8000-000000000028',
        '乙处',
        [contact('10000000-0000-4000-8000-000000000028')],
        { employeeCode: 'g0002' },
      ),
    ]);

    expect(getDirectoryGroupEmployeeCodes(groups[0]!)).toEqual(['d0001', 'g0002']);
  });

  it('treats contact order and formatting as presentation details, not different contact sets', () => {
    const voice = contact('10000000-0000-4000-8000-000000000031');
    const mobile = contact('10000000-0000-4000-8000-000000000032', {
      displayOrder: 1,
      fullNumber: '130-0000-0000',
      internalExtension: '6403',
      type: 'mobile',
    });
    const groups = groupDirectoryEntriesByContact([
      entry('20000000-0000-4000-8000-000000000031', '麻醉准备间', [voice, mobile]),
      entry('20000000-0000-4000-8000-000000000032', '麻醉值班间', [
        { ...mobile, displayOrder: 0, id: '10000000-0000-4000-8000-000000000033' },
        {
          ...voice,
          displayOrder: 1,
          fullNumber: '(0754) 0000-0003',
          id: '10000000-0000-4000-8000-000000000034',
        },
      ]),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.contacts).toEqual([voice, mobile]);
  });
});
