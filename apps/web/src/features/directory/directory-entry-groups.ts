import type { DirectoryContactMethod, DirectoryEntry } from '@schedule/contracts';
import { directoryEntryKindLabels } from '@schedule/contracts';

import { getDirectoryEntryPath, getDirectoryEntryTitle } from './directory-presentation.js';

export interface DirectoryEntryDisplayGroup {
  readonly contacts: readonly DirectoryContactMethod[];
  readonly entries: readonly DirectoryEntry[];
  readonly id: string;
}

function normalizeNumber(value: string | undefined): string {
  return value?.replace(/[^+\d]/g, '') ?? '';
}

function contactToken(contact: DirectoryContactMethod): string {
  return [
    contact.type,
    normalizeNumber(contact.fullNumber),
    normalizeNumber(contact.internalExtension),
  ].join(':');
}

function contactSetSignature(entry: DirectoryEntry): string | undefined {
  if (entry.contacts.length === 0) return undefined;
  return entry.contacts.map(contactToken).toSorted().join('|');
}

function unique<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

export function groupDirectoryEntriesByContact(
  entries: readonly DirectoryEntry[],
): readonly DirectoryEntryDisplayGroup[] {
  const groups: Array<{
    contacts: readonly DirectoryContactMethod[];
    entries: DirectoryEntry[];
    id: string;
  }> = [];
  const groupsBySignature = new Map<string, (typeof groups)[number]>();

  for (const entry of entries) {
    const signature = contactSetSignature(entry);
    const existing = signature === undefined ? undefined : groupsBySignature.get(signature);
    if (existing !== undefined) {
      existing.entries.push(entry);
      continue;
    }

    const group = { contacts: entry.contacts, entries: [entry], id: entry.id };
    groups.push(group);
    if (signature !== undefined) groupsBySignature.set(signature, group);
  }

  return groups;
}

export function getDirectoryGroupTitle(group: DirectoryEntryDisplayGroup): string {
  return unique(group.entries.map(getDirectoryEntryTitle)).join(' / ');
}

export function getDirectoryGroupContexts(group: DirectoryEntryDisplayGroup): readonly string[] {
  return unique(
    group.entries
      .map((entry) => {
        const title = getDirectoryEntryTitle(entry);
        const path = getDirectoryEntryPath(entry).join(' › ');
        const location = [
          entry.building,
          entry.floor,
          entry.room === title ? undefined : entry.room,
        ]
          .filter((value): value is string => value !== undefined)
          .join(' · ');
        return [path, location].filter((value) => value.length > 0).join(' · ');
      })
      .filter((value) => value.length > 0),
  );
}

export function getDirectoryGroupNotes(group: DirectoryEntryDisplayGroup): string | undefined {
  const notes = unique(
    group.entries
      .map((entry) => entry.notes)
      .filter((value): value is string => value !== undefined && value.length > 0),
  );
  return notes.length === 0 ? undefined : notes.join('；');
}

export function getDirectoryGroupKindLabel(group: DirectoryEntryDisplayGroup): string {
  const kinds = unique(group.entries.map((entry) => entry.entryKind));
  return kinds.length === 1 ? directoryEntryKindLabels[kinds[0]!] : '多类型';
}
