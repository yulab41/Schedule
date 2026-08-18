import type { DirectoryContactMethod, DirectoryEntry, DirectoryQuery } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  canDialDirectoryNumber,
  getDirectoryEntryLocation,
  getDirectoryEntryPath,
  getDirectoryEntryTitle,
  getDirectoryNumberLabel,
  getSafeInternalExtension,
  hasActiveDirectoryCriteria,
  toDirectoryDialHref,
  toDirectoryQuery,
} from './directory-presentation.js';

const entry: DirectoryEntry = {
  building: '门诊楼',
  campus: { code: 'main', name: '本部院区' },
  contacts: [],
  department: '医务科',
  displayOrder: 1,
  entryKind: 'department',
  floor: '5楼',
  id: '11111111-1111-4111-8111-111111111111',
  room: '502室',
  section: '行政管理',
  subunit: '病案室',
};

function contact(
  type: DirectoryContactMethod['type'],
  overrides: Partial<DirectoryContactMethod> = {},
): DirectoryContactMethod {
  return {
    displayOrder: 0,
    fullNumber: '0754-00000000',
    id: '22222222-2222-4222-8222-222222222222',
    isPrimary: true,
    type,
    ...overrides,
  };
}

describe('directory presentation rules', () => {
  it('treats only a nonblank search or a selected filter as an active directory query', () => {
    expect(hasActiveDirectoryCriteria('', {})).toBe(false);
    expect(hasActiveDirectoryCriteria('   ', {})).toBe(false);
    expect(hasActiveDirectoryCriteria('病案', {})).toBe(true);
    expect(hasActiveDirectoryCriteria('', { department: '病案科' })).toBe(true);
  });

  it('makes mobile long and short numbers dialable, but never a landline short number', () => {
    expect(canDialDirectoryNumber('mobile', 'full')).toBe(true);
    expect(canDialDirectoryNumber('mobile', 'extension')).toBe(true);
    expect(canDialDirectoryNumber('voice', 'full')).toBe(true);
    expect(canDialDirectoryNumber('voice', 'extension')).toBe(false);
    expect(canDialDirectoryNumber('fax', 'full')).toBe(false);
  });

  it('accepts only a three-to-six digit internal extension at the final display boundary', () => {
    expect(getSafeInternalExtension(contact('mobile', { internalExtension: '6128' }))).toBe('6128');
    expect(
      getSafeInternalExtension({
        ...contact('voice'),
        internalExtension: '1234567' as DirectoryContactMethod['internalExtension'],
      }),
    ).toBeUndefined();
  });

  it('normalizes dial links and uses explicit number labels', () => {
    expect(toDirectoryDialHref('+86 (754) 0000-0000')).toBe('tel:+8675400000000');
    expect(getDirectoryNumberLabel('mobile', 'full')).toBe('手机长号');
    expect(getDirectoryNumberLabel('mobile', 'extension')).toBe('手机短号');
    expect(getDirectoryNumberLabel('voice', 'full')).toBe('固定电话');
    expect(getDirectoryNumberLabel('voice', 'extension')).toBe('院内短号');
  });

  it('builds a scan-friendly title, hierarchy path, and location', () => {
    expect(getDirectoryEntryTitle(entry)).toBe('病案室');
    expect(getDirectoryEntryPath(entry)).toEqual(['本部院区', '行政管理', '医务科']);
    expect(getDirectoryEntryLocation(entry)).toBe('门诊楼 · 5楼 · 502室');
  });

  it('builds independent filters without requiring a campus or parent category', () => {
    const query = toDirectoryQuery(' 病案 ', {
      department: undefined,
      floor: '5楼',
      subunit: '病案室',
    });

    expect(query).toEqual<DirectoryQuery>({
      floor: '5楼',
      pageSize: 30,
      q: '病案',
      subunit: '病案室',
    });
    expect(query).not.toHaveProperty('campusCode');
    expect(query).not.toHaveProperty('section');
  });
});
