import type { DirectoryEntry } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import { groupDirectoryEntriesByContact } from './directory-entry-groups.js';
import {
  getDirectoryPreferenceEntryIds,
  getDirectoryPriorityGroups,
  isDirectoryGroupFavorite,
  parseDirectoryPreferences,
  recordDirectoryUse,
  toggleDirectoryFavorite,
} from './directory-preferences.js';

function entry(id: string, number: string, name: string): DirectoryEntry {
  return {
    campus: { code: 'main', name: '本部院区' },
    contacts: [
      {
        displayOrder: 0,
        fullNumber: number,
        id: id.replace('20000000', '10000000'),
        isPrimary: true,
        type: 'voice',
      },
    ],
    displayOrder: 1,
    entryKind: 'service',
    id,
    subunit: name,
  };
}

const first = entry('20000000-0000-4000-8000-000000000001', '0754-00000001', '护士站');
const duplicate = entry('20000000-0000-4000-8000-000000000002', '0754 0000 0001', '值班房');
const second = entry('20000000-0000-4000-8000-000000000003', '0754-00000002', '药房');
const [mergedGroup, secondGroup] = groupDirectoryEntriesByContact([first, duplicate, second]);

describe('directory favorites and frequent contacts', () => {
  it('favorites and unfavorites every entry in a merged contact group', () => {
    const favorite = toggleDirectoryFavorite(parseDirectoryPreferences(undefined), mergedGroup!);
    expect(isDirectoryGroupFavorite(favorite, mergedGroup!)).toBe(true);
    expect(getDirectoryPreferenceEntryIds(favorite)).toEqual([first.id, duplicate.id]);

    const unfavorite = toggleDirectoryFavorite(favorite, mergedGroup!);
    expect(isDirectoryGroupFavorite(unfavorite, mergedGroup!)).toBe(false);
    expect(getDirectoryPreferenceEntryIds(unfavorite)).toEqual([]);
  });

  it('keeps only ids and bounded usage metadata in persistent JSON', () => {
    const used = recordDirectoryUse(parseDirectoryPreferences(undefined), secondGroup!, 1000);
    const parsed = parseDirectoryPreferences(JSON.stringify(used));

    expect(parsed.usageByEntryId[second.id]).toEqual({ count: 1, lastUsedAt: 1000 });
    expect(JSON.stringify(parsed)).not.toContain('0754');
    expect(JSON.stringify(parsed)).not.toContain('药房');
  });

  it('shows favorites first and frequent groups without duplicating favorites', () => {
    const favorite = toggleDirectoryFavorite(parseDirectoryPreferences(undefined), mergedGroup!);
    const used = recordDirectoryUse(favorite, secondGroup!, 2000);
    const priority = getDirectoryPriorityGroups(used, [mergedGroup!, secondGroup!]);

    expect(priority.favorites.map((group) => group.id)).toEqual([mergedGroup!.id]);
    expect(priority.frequent.map((group) => group.id)).toEqual([secondGroup!.id]);
  });
});
