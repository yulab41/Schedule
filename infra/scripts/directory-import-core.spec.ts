import { describe, expect, it } from 'vitest';

import {
  buildDirectoryImportPlan,
  parseDirectoryImportArgs,
  validateDirectoryManifest,
} from './directory-import-core.js';

const documentHash = 'a'.repeat(64);

interface SyntheticContact extends Record<string, unknown> {
  fullNumber: string;
}

interface SyntheticEntry extends Record<string, unknown> {
  contacts: SyntheticContact[];
  entryKey: string;
  sourceLocator: string;
}

interface SyntheticDocument extends Record<string, unknown> {
  sha256: string;
}

interface SyntheticManifest extends Record<string, unknown> {
  documents: SyntheticDocument[];
  entries: SyntheticEntry[];
}

function createManifest(): SyntheticManifest {
  return {
    schemaVersion: 1,
    importVersion: 'synthetic-2026-05-12.1',
    effectiveOn: '2026-05-12',
    campuses: [
      {
        code: 'synthetic-campus',
        name: '测试院区',
        displayOrder: 10,
        dialingNote: '合成测试说明',
      },
    ],
    documents: [
      {
        documentKey: 'synthetic-directory',
        campusCode: 'synthetic-campus',
        title: '合成通讯录',
        sha256: documentHash,
        effectiveOn: '2026-05-12',
        pageCount: 1,
        displayOrder: 10,
      },
    ],
    entries: [
      {
        entryKey: 'synthetic-campus:test-center:switchboard',
        sourceDocumentKey: 'synthetic-directory',
        sourcePage: 1,
        sourceLocator: 'table:r1:c1',
        campusCode: 'synthetic-campus',
        section: '行政服务',
        department: '测试中心',
        subunit: '综合服务台',
        contactName: '测试总机',
        building: 'A座',
        floor: '1楼',
        room: '101',
        entryKind: 'switchboard',
        notes: '仅用于自动化测试',
        visibility: 'member',
        verificationStatus: 'source_exact',
        displayOrder: 10,
        aliases: ['测试服务'],
        contacts: [
          {
            type: 'voice',
            label: '总机',
            fullNumber: '(0754) 0000-0000',
            internalExtension: '1000',
            isPrimary: true,
            displayOrder: 10,
          },
        ],
      },
    ],
  };
}

describe('directory import manifest', () => {
  it('preserves source values while preparing phone and pinyin search keys', () => {
    const manifest = validateDirectoryManifest(createManifest());
    const entry = manifest.entries[0];
    const contact = entry?.contacts[0];

    expect(contact).toMatchObject({
      fullNumber: '(0754) 0000-0000',
      internalExtension: '1000',
      normalizedFullNumber: '075400000000',
      normalizedInternalExtension: '1000',
    });
    expect(entry?.searchText).toContain('测试中心');
    expect(entry?.aliases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'source', normalizedValue: '测试中心' }),
        expect.objectContaining({ type: 'manual', normalizedValue: '测试服务' }),
        expect.objectContaining({ type: 'pinyin_compact', normalizedValue: 'ceshizhongxin' }),
        expect.objectContaining({ type: 'pinyin_initials', normalizedValue: 'cszx' }),
      ]),
    );
    expect(entry?.contentSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  const invalidManifestMutations: readonly [string, (manifest: SyntheticManifest) => void][] = [
    ['a malformed document hash', (manifest) => (firstDocument(manifest).sha256 = 'bad')],
    [
      'a duplicate stable entry key',
      (manifest) =>
        manifest.entries.push({ ...firstEntry(manifest), sourceLocator: 'table:r2:c1' }),
    ],
    [
      'a duplicate source locator',
      (manifest) =>
        manifest.entries.push({
          ...firstEntry(manifest),
          entryKey: 'synthetic-campus:test-center:secondary',
        }),
    ],
    ['an invalid phone value', (manifest) => (firstContact(manifest).fullNumber = 'not-a-number')],
  ];

  it.each(invalidManifestMutations)(
    'rejects %s without echoing sensitive values',
    (_label, mutate) => {
      const manifest = createManifest();
      mutate(manifest);

      let errorMessage = '';
      try {
        validateDirectoryManifest(manifest);
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }

      expect(errorMessage.length).toBeGreaterThan(0);
      expect(errorMessage).not.toContain('(0754) 0000-0000');
      expect(errorMessage).not.toContain('not-a-number');
    },
  );

  it('computes an incremental snapshot diff without returning contact values', () => {
    const manifest = validateDirectoryManifest(createManifest());
    const changedPlan = buildDirectoryImportPlan(manifest, [
      {
        entryKey: manifest.entries[0]?.entryKey ?? '',
        contentSha256: 'b'.repeat(64),
      },
      {
        entryKey: 'synthetic-campus:removed-entry',
        contentSha256: 'c'.repeat(64),
      },
    ]);

    expect(changedPlan.summary).toEqual({
      added: 0,
      changed: 1,
      contacts: 1,
      documents: 1,
      entries: 1,
      removed: 1,
      unchanged: 0,
      warnings: 0,
    });
    expect(JSON.stringify(changedPlan.summary)).not.toContain('0754');
    expect(JSON.stringify(changedPlan.summary)).not.toContain('1000');
  });
});

function firstDocument(manifest: SyntheticManifest): SyntheticDocument {
  const document = manifest.documents[0];
  if (document === undefined) {
    throw new Error('Synthetic manifest document is missing.');
  }
  return document;
}

function firstEntry(manifest: SyntheticManifest): SyntheticEntry {
  const entry = manifest.entries[0];
  if (entry === undefined) {
    throw new Error('Synthetic manifest entry is missing.');
  }
  return entry;
}

function firstContact(manifest: SyntheticManifest): SyntheticContact {
  const contact = firstEntry(manifest).contacts[0];
  if (contact === undefined) {
    throw new Error('Synthetic manifest contact is missing.');
  }
  return contact;
}

describe('directory import command arguments', () => {
  it('accepts stdin dry-run, stdin publish, and activation as exclusive modes', () => {
    expect(parseDirectoryImportArgs(['--stdin', '--dry-run'])).toEqual({
      action: 'dry-run',
      stdin: true,
    });
    expect(parseDirectoryImportArgs(['--stdin', '--publish'])).toEqual({
      action: 'publish',
      stdin: true,
    });
    expect(
      parseDirectoryImportArgs(['--activate-batch=00000000-0000-4000-8000-000000000002']),
    ).toEqual({
      action: 'activate',
      batchId: '00000000-0000-4000-8000-000000000002',
      stdin: false,
    });
  });

  it.each([
    [],
    ['--stdin'],
    ['--publish'],
    ['--stdin', '--publish', '--dry-run'],
    ['--activate-batch=not-a-uuid'],
  ])('rejects ambiguous arguments: %j', (arguments_) => {
    expect(() => parseDirectoryImportArgs(arguments_)).toThrow();
  });
});
