import { createHash, randomUUID } from 'node:crypto';

import {
  auditLogs,
  directoryCampuses,
  directoryContactMethods,
  directoryEntries,
  directoryImportBatches,
  directorySearchAliases,
  directorySourceDocuments,
  withTransaction,
  type DatabaseClient,
  type DatabaseTransaction,
} from '@schedule/database';
import { and, eq } from 'drizzle-orm';
import { pinyin } from 'pinyin-pro';

const manifestSchemaVersion = 1;
const maximumCampuses = 20;
const maximumDocuments = 50;
const maximumEntries = 5_000;
const maximumContactsPerEntry = 20;
const maximumAliasesPerEntry = 30;
const maximumFullNumberDigits = 20;
const maximumInternalExtensionDigits = 6;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const stableKeyPattern = /^[a-z0-9][a-z0-9:._-]*$/u;
const campusCodePattern = /^[a-z0-9][a-z0-9-]*$/u;
const phoneCharactersPattern = /^[0-9+()\-\s.]+$/u;
const hanPattern = /\p{Script=Han}/u;
const employeeCodePattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u;

const entryKinds = [
  'department',
  'person',
  'service',
  'facility',
  'vendor',
  'emergency',
  'switchboard',
  'other',
] as const;
const visibilityValues = ['member', 'administrator'] as const;
const verificationStatuses = ['source_exact', 'needs_review', 'manually_verified'] as const;
const contactTypes = ['voice', 'mobile', 'fax', 'emergency', 'hotline', 'other'] as const;
const directoryKinds = ['internal', 'employee'] as const;

type DirectoryEntryKind = (typeof entryKinds)[number];
type DirectoryKind = (typeof directoryKinds)[number];
type DirectoryVisibility = (typeof visibilityValues)[number];
type DirectoryVerificationStatus = (typeof verificationStatuses)[number];
type DirectoryContactType = (typeof contactTypes)[number];
type DirectoryAliasType =
  'source' | 'manual' | 'pinyin_full' | 'pinyin_compact' | 'pinyin_initials';

export class DirectoryImportError extends Error {}

export interface NormalizedDirectoryCampus {
  readonly code: string;
  readonly name: string;
  readonly displayOrder: number;
  readonly dialingNote: string | undefined;
}

export interface NormalizedDirectoryDocument {
  readonly documentKey: string;
  readonly campusCode: string;
  readonly title: string;
  readonly sha256: string;
  readonly effectiveOn: string;
  readonly pageCount: number;
  readonly displayOrder: number;
}

export interface NormalizedDirectoryContact {
  readonly type: DirectoryContactType;
  readonly label: string | undefined;
  readonly fullNumber: string | undefined;
  readonly internalExtension: string | undefined;
  readonly normalizedFullNumber: string | undefined;
  readonly normalizedInternalExtension: string | undefined;
  readonly contactSha256: string;
  readonly isPrimary: boolean;
  readonly displayOrder: number;
}

export interface NormalizedDirectoryAlias {
  readonly type: DirectoryAliasType;
  readonly aliasValue: string;
  readonly normalizedValue: string;
  readonly aliasSha256: string;
}

export interface NormalizedDirectoryEntry {
  readonly entryKey: string;
  readonly sourceDocumentKey: string;
  readonly sourcePage: number;
  readonly sourceLocator: string;
  readonly campusCode: string;
  readonly section: string | undefined;
  readonly department: string | undefined;
  readonly subunit: string | undefined;
  readonly contactName: string | undefined;
  readonly building: string | undefined;
  readonly floor: string | undefined;
  readonly room: string | undefined;
  readonly entryKind: DirectoryEntryKind;
  readonly notes: string | undefined;
  readonly visibility: DirectoryVisibility;
  readonly verificationStatus: DirectoryVerificationStatus;
  readonly displayOrder: number;
  readonly employeeCode: string | undefined;
  readonly contacts: readonly NormalizedDirectoryContact[];
  readonly aliases: readonly NormalizedDirectoryAlias[];
  readonly searchText: string;
  readonly contentSha256: string;
}

export interface NormalizedDirectoryManifest {
  readonly schemaVersion: 1;
  readonly directoryKind: DirectoryKind;
  readonly importVersion: string;
  readonly effectiveOn: string;
  readonly campuses: readonly NormalizedDirectoryCampus[];
  readonly documents: readonly NormalizedDirectoryDocument[];
  readonly entries: readonly NormalizedDirectoryEntry[];
  readonly warningSummary: Readonly<Record<string, number>>;
}

export interface ExistingDirectoryEntry {
  readonly entryKey: string;
  readonly contentSha256: string;
}

export interface DirectoryImportSummary {
  readonly added: number;
  readonly changed: number;
  readonly contacts: number;
  readonly documents: number;
  readonly entries: number;
  readonly removed: number;
  readonly unchanged: number;
  readonly warnings: number;
}

export interface DirectoryImportPlan {
  readonly summary: DirectoryImportSummary;
  readonly warningSummary: Readonly<Record<string, number>>;
}

export interface DirectoryImportCommand {
  readonly action: 'dry-run' | 'publish' | 'activate';
  readonly stdin: boolean;
  readonly batchId?: string;
}

export interface DirectoryPublicationResult extends DirectoryImportPlan {
  readonly batchId: string;
  readonly replacedBatchId: string | null;
}

export interface DirectoryActivationResult {
  readonly activatedBatchId: string;
  readonly replacedBatchId: string | null;
}

export function validateDirectoryManifest(input: unknown): NormalizedDirectoryManifest {
  const root = readObject(input, 'manifest');
  const schemaVersion = readInteger(root, 'schemaVersion', 1, 1);
  if (schemaVersion !== manifestSchemaVersion) {
    throw new DirectoryImportError(`manifest.schemaVersion must be ${manifestSchemaVersion}.`);
  }
  const importVersion = readRequiredString(root, 'importVersion', 64);
  if (!stableKeyPattern.test(importVersion)) {
    throw new DirectoryImportError('manifest.importVersion has an invalid format.');
  }
  const effectiveOn = readDate(root, 'effectiveOn');
  const directoryKind =
    root.directoryKind === undefined
      ? 'internal'
      : readEnum(root, 'directoryKind', directoryKinds, 'manifest');

  const campusInputs = readArray(root, 'campuses', 1, maximumCampuses);
  const campuses = campusInputs.map((value, index) => {
    const path = `manifest.campuses[${index}]`;
    const campus = readObject(value, path);
    const code = readRequiredString(campus, 'code', 64, path);
    if (!campusCodePattern.test(code)) {
      throw new DirectoryImportError(`${path}.code has an invalid format.`);
    }
    return {
      code,
      name: readRequiredString(campus, 'name', 100, path),
      displayOrder: readInteger(campus, 'displayOrder', 0, 1_000_000, path),
      dialingNote: readOptionalString(campus, 'dialingNote', 1_000, path),
    } satisfies NormalizedDirectoryCampus;
  });
  assertUnique(
    campuses.map((campus) => campus.code),
    'manifest.campuses codes',
  );
  const campusesByCode = new Map(campuses.map((campus) => [campus.code, campus]));

  const documentInputs = readArray(root, 'documents', 1, maximumDocuments);
  const documents = documentInputs.map((value, index) => {
    const path = `manifest.documents[${index}]`;
    const document = readObject(value, path);
    const campusCode = readRequiredString(document, 'campusCode', 64, path);
    if (!campusesByCode.has(campusCode)) {
      throw new DirectoryImportError(`${path}.campusCode does not reference a manifest campus.`);
    }
    const sha256 = readRequiredString(document, 'sha256', 64, path).toLowerCase();
    if (!sha256Pattern.test(sha256)) {
      throw new DirectoryImportError(`${path}.sha256 must be a lowercase SHA-256 digest.`);
    }
    return {
      documentKey: readStableKey(document, 'documentKey', 128, path),
      campusCode,
      title: readRequiredString(document, 'title', 255, path),
      sha256,
      effectiveOn: readDate(document, 'effectiveOn', path),
      pageCount: readInteger(document, 'pageCount', 1, 10_000, path),
      displayOrder: readInteger(document, 'displayOrder', 0, 1_000_000, path),
    } satisfies NormalizedDirectoryDocument;
  });
  assertUnique(
    documents.map((document) => document.documentKey),
    'manifest.documents document keys',
  );
  assertUnique(
    documents.map((document) => document.sha256),
    'manifest.documents SHA-256 digests',
  );
  const documentsByKey = new Map(documents.map((document) => [document.documentKey, document]));

  const entryInputs = readArray(root, 'entries', 1, maximumEntries);
  const seenEntryKeys = new Set<string>();
  const seenSourceLocators = new Set<string>();
  let reviewWarningCount = 0;
  const entries = entryInputs.map((value, index) => {
    const path = `manifest.entries[${index}]`;
    const entry = readObject(value, path);
    const entryKey = readStableKey(entry, 'entryKey', 191, path);
    if (seenEntryKeys.has(entryKey)) {
      throw new DirectoryImportError('manifest.entries contains a duplicate entryKey.');
    }
    seenEntryKeys.add(entryKey);

    const sourceDocumentKey = readStableKey(entry, 'sourceDocumentKey', 128, path);
    const document = documentsByKey.get(sourceDocumentKey);
    if (document === undefined) {
      throw new DirectoryImportError(`${path}.sourceDocumentKey does not reference a document.`);
    }
    const campusCode = readRequiredString(entry, 'campusCode', 64, path);
    if (campusCode !== document.campusCode) {
      throw new DirectoryImportError(`${path}.campusCode must match its source document.`);
    }
    const sourcePage = readInteger(entry, 'sourcePage', 1, document.pageCount, path);
    const sourceLocator = readRequiredString(entry, 'sourceLocator', 191, path);
    const sourceLocatorKey = `${sourceDocumentKey}\0${sourceLocator}`;
    if (seenSourceLocators.has(sourceLocatorKey)) {
      throw new DirectoryImportError('manifest.entries contains a duplicate source locator.');
    }
    seenSourceLocators.add(sourceLocatorKey);

    const section = readOptionalString(entry, 'section', 100, path);
    const department = readOptionalString(entry, 'department', 150, path);
    const subunit = readOptionalString(entry, 'subunit', 150, path);
    const contactName = readOptionalString(entry, 'contactName', 150, path);
    const building = readOptionalString(entry, 'building', 100, path);
    const floor = readOptionalString(entry, 'floor', 64, path);
    const room = readOptionalString(entry, 'room', 100, path);
    const employeeCode = readOptionalString(entry, 'employeeCode', 64, path);
    if (employeeCode !== undefined && !employeeCodePattern.test(employeeCode)) {
      throw new DirectoryImportError(`${path}.employeeCode has an invalid format.`);
    }
    const notes = readOptionalString(entry, 'notes', 1_000, path);
    if (department === undefined && contactName === undefined) {
      throw new DirectoryImportError(`${path} must provide department or contactName.`);
    }
    const entryKind = readEnum(entry, 'entryKind', entryKinds, path);
    const visibility = readEnum(entry, 'visibility', visibilityValues, path);
    const verificationStatus = readEnum(entry, 'verificationStatus', verificationStatuses, path);
    if (verificationStatus === 'needs_review') {
      reviewWarningCount += 1;
    }
    const displayOrder = readInteger(entry, 'displayOrder', 0, 1_000_000, path);

    const contactInputs = readArray(entry, 'contacts', 1, maximumContactsPerEntry, path);
    const seenContacts = new Set<string>();
    const contacts = contactInputs.map((contactValue, contactIndex) => {
      const contactPath = `${path}.contacts[${contactIndex}]`;
      const contact = readObject(contactValue, contactPath);
      const fullNumber = readOptionalString(contact, 'fullNumber', 64, contactPath);
      const internalExtension = readOptionalString(contact, 'internalExtension', 32, contactPath);
      const normalizedFullNumber = normalizePhoneValue(
        fullNumber,
        `${contactPath}.fullNumber`,
        maximumFullNumberDigits,
      );
      const normalizedInternalExtension = normalizePhoneValue(
        internalExtension,
        `${contactPath}.internalExtension`,
        maximumInternalExtensionDigits,
      );
      if (normalizedFullNumber === undefined && normalizedInternalExtension === undefined) {
        throw new DirectoryImportError(`${contactPath} must provide a phone value.`);
      }
      const normalizedContact = {
        type: readEnum(contact, 'type', contactTypes, contactPath),
        label: readOptionalString(contact, 'label', 100, contactPath),
        fullNumber,
        internalExtension,
        normalizedFullNumber,
        normalizedInternalExtension,
        isPrimary: readBoolean(contact, 'isPrimary', contactPath),
        displayOrder: readInteger(contact, 'displayOrder', 0, 1_000_000, contactPath),
      };
      const contactSha256 = hashValue(normalizedContact);
      if (seenContacts.has(contactSha256)) {
        throw new DirectoryImportError(`${path}.contacts contains a duplicate contact method.`);
      }
      seenContacts.add(contactSha256);
      return { ...normalizedContact, contactSha256 } satisfies NormalizedDirectoryContact;
    });

    const manualAliases = readOptionalStringArray(
      entry,
      'aliases',
      255,
      maximumAliasesPerEntry,
      path,
    );
    const sourceAliases = [
      section,
      department,
      subunit,
      contactName,
      building,
      floor,
      room,
      employeeCode,
    ].filter((item): item is string => item !== undefined);
    const aliases = buildSearchAliases(sourceAliases, manualAliases);
    const searchText = [...new Set([...sourceAliases, ...manualAliases])].join(' ');

    const content = {
      sourceDocumentKey,
      sourcePage,
      sourceLocator,
      campusCode,
      section,
      department,
      subunit,
      contactName,
      building,
      floor,
      room,
      employeeCode,
      entryKind,
      notes,
      visibility,
      verificationStatus,
      displayOrder,
      contacts,
      aliases,
      searchText,
    };
    return {
      entryKey,
      ...content,
      contentSha256: hashValue(content),
    } satisfies NormalizedDirectoryEntry;
  });

  return {
    schemaVersion: 1,
    directoryKind,
    importVersion,
    effectiveOn,
    campuses,
    documents,
    entries,
    warningSummary: reviewWarningCount === 0 ? {} : { needs_review: reviewWarningCount },
  };
}

export function buildDirectoryImportPlan(
  manifest: NormalizedDirectoryManifest,
  currentEntries: readonly ExistingDirectoryEntry[],
): DirectoryImportPlan {
  const currentByKey = new Map(
    currentEntries.map((entry) => [entry.entryKey, entry.contentSha256]),
  );
  let added = 0;
  let changed = 0;
  let unchanged = 0;
  for (const entry of manifest.entries) {
    const currentHash = currentByKey.get(entry.entryKey);
    if (currentHash === undefined) {
      added += 1;
    } else if (currentHash === entry.contentSha256) {
      unchanged += 1;
    } else {
      changed += 1;
    }
    currentByKey.delete(entry.entryKey);
  }
  const warnings = Object.values(manifest.warningSummary).reduce(
    (total, count) => total + count,
    0,
  );
  return {
    summary: {
      added,
      changed,
      contacts: manifest.entries.reduce((total, entry) => total + entry.contacts.length, 0),
      documents: manifest.documents.length,
      entries: manifest.entries.length,
      removed: currentByKey.size,
      unchanged,
      warnings,
    },
    warningSummary: manifest.warningSummary,
  };
}

export function parseDirectoryImportArgs(values: readonly string[]): DirectoryImportCommand {
  let stdin = false;
  let dryRun = false;
  let publish = false;
  let batchId: string | undefined;
  for (const value of values) {
    if (value === '--stdin') {
      stdin = true;
    } else if (value === '--dry-run') {
      dryRun = true;
    } else if (value === '--publish') {
      publish = true;
    } else if (value.startsWith('--activate-batch=')) {
      batchId = value.slice('--activate-batch='.length);
    } else {
      throw new DirectoryImportError('Unknown directory import argument.');
    }
  }

  const actionCount = Number(dryRun) + Number(publish) + Number(batchId !== undefined);
  if (actionCount !== 1) {
    throw new DirectoryImportError(
      'Choose exactly one of --dry-run, --publish, or --activate-batch.',
    );
  }
  if ((dryRun || publish) && !stdin) {
    throw new DirectoryImportError('--dry-run and --publish require --stdin.');
  }
  if (batchId !== undefined) {
    if (stdin || !uuidPattern.test(batchId)) {
      throw new DirectoryImportError('--activate-batch requires one valid UUID and no stdin.');
    }
    return { action: 'activate', batchId, stdin: false };
  }
  return { action: dryRun ? 'dry-run' : 'publish', stdin: true };
}

export async function previewDirectorySnapshot(
  client: DatabaseClient,
  manifest: NormalizedDirectoryManifest,
): Promise<DirectoryImportPlan> {
  const currentEntries = await selectCurrentEntries(client.database, manifest.directoryKind);
  return buildDirectoryImportPlan(manifest, currentEntries);
}

export async function publishDirectorySnapshot(
  client: DatabaseClient,
  manifest: NormalizedDirectoryManifest,
  manifestSha256: string,
  hooks: { readonly beforeCommit?: () => Promise<void> } = {},
): Promise<DirectoryPublicationResult> {
  if (!sha256Pattern.test(manifestSha256)) {
    throw new DirectoryImportError('The manifest digest must be a lowercase SHA-256 value.');
  }

  return withTransaction(client, async (transaction) => {
    const currentBatch = await selectCurrentBatch(transaction, manifest.directoryKind);
    const currentEntries = await selectCurrentEntries(transaction, manifest.directoryKind);
    const plan = buildDirectoryImportPlan(manifest, currentEntries);
    const batchId = randomUUID();
    const publishedAt = new Date();

    await transaction.insert(directoryImportBatches).values({
      id: batchId,
      importVersion: manifest.importVersion,
      schemaVersion: manifest.schemaVersion,
      directoryKind: manifest.directoryKind,
      status: 'draft',
      effectiveOn: manifest.effectiveOn,
      manifestSha256,
      sourceDocumentCount: plan.summary.documents,
      entryCount: plan.summary.entries,
      contactMethodCount: plan.summary.contacts,
      warningCount: plan.summary.warnings,
      diffSummary: {
        added: plan.summary.added,
        changed: plan.summary.changed,
        removed: plan.summary.removed,
        unchanged: plan.summary.unchanged,
      },
      warningSummary: { ...plan.warningSummary },
    });

    await upsertCampuses(transaction, manifest.campuses);
    const campusIds = await selectCampusIds(transaction, manifest.campuses);
    const documentIds = new Map<string, string>();
    await transaction.insert(directorySourceDocuments).values(
      manifest.documents.map((document) => {
        const id = randomUUID();
        documentIds.set(document.documentKey, id);
        return {
          id,
          batchId,
          campusId: requireMapValue(campusIds, document.campusCode, 'campus'),
          documentKey: document.documentKey,
          title: document.title,
          sourceSha256: document.sha256,
          effectiveOn: document.effectiveOn,
          pageCount: document.pageCount,
          displayOrder: document.displayOrder,
        };
      }),
    );

    const entryIds = new Map<string, string>();
    const entryRows = manifest.entries.map((entry) => {
      const id = randomUUID();
      entryIds.set(entry.entryKey, id);
      return {
        id,
        batchId,
        sourceDocumentId: requireMapValue(documentIds, entry.sourceDocumentKey, 'document'),
        campusId: requireMapValue(campusIds, entry.campusCode, 'campus'),
        entryKey: entry.entryKey,
        sourcePage: entry.sourcePage,
        sourceLocator: entry.sourceLocator,
        sectionName: entry.section ?? null,
        departmentName: entry.department ?? null,
        subunitName: entry.subunit ?? null,
        contactName: entry.contactName ?? null,
        employeeCode: entry.employeeCode ?? null,
        buildingName: entry.building ?? null,
        floorName: entry.floor ?? null,
        roomName: entry.room ?? null,
        entryKind: entry.entryKind,
        notes: entry.notes ?? null,
        visibility: entry.visibility,
        verificationStatus: entry.verificationStatus,
        displayOrder: entry.displayOrder,
        searchText: entry.searchText,
        contentSha256: entry.contentSha256,
      };
    });
    for (const chunk of chunkArray(entryRows)) {
      await transaction.insert(directoryEntries).values(chunk);
    }

    const contactRows = manifest.entries.flatMap((entry) =>
      entry.contacts.map((contact) => ({
        id: randomUUID(),
        entryId: requireMapValue(entryIds, entry.entryKey, 'entry'),
        type: contact.type,
        label: contact.label ?? null,
        fullNumber: contact.fullNumber ?? null,
        internalExtension: contact.internalExtension ?? null,
        normalizedFullNumber: contact.normalizedFullNumber ?? null,
        normalizedInternalExtension: contact.normalizedInternalExtension ?? null,
        contactSha256: contact.contactSha256,
        isPrimary: contact.isPrimary ? 1 : 0,
        displayOrder: contact.displayOrder,
      })),
    );
    for (const chunk of chunkArray(contactRows)) {
      await transaction.insert(directoryContactMethods).values(chunk);
    }

    const aliasRows = manifest.entries.flatMap((entry) =>
      entry.aliases.map((alias) => ({
        id: randomUUID(),
        entryId: requireMapValue(entryIds, entry.entryKey, 'entry'),
        type: alias.type,
        aliasValue: alias.aliasValue,
        normalizedValue: alias.normalizedValue,
        aliasSha256: alias.aliasSha256,
      })),
    );
    if (aliasRows.length > 0) {
      for (const chunk of chunkArray(aliasRows)) {
        await transaction.insert(directorySearchAliases).values(chunk);
      }
    }

    if (currentBatch !== undefined) {
      await transaction
        .update(directoryImportBatches)
        .set({ status: 'superseded', supersededAt: publishedAt })
        .where(
          and(
            eq(directoryImportBatches.id, currentBatch.id),
            eq(directoryImportBatches.status, 'published'),
          ),
        );
    }
    await transaction
      .update(directoryImportBatches)
      .set({ status: 'published', publishedAt, supersededAt: null })
      .where(eq(directoryImportBatches.id, batchId));
    await appendDirectoryAudit(transaction, {
      action: 'directory_snapshot_published',
      batchId,
      metadata: {
        importVersion: manifest.importVersion,
        manifestSha256,
        schemaVersion: manifest.schemaVersion,
        ...plan.summary,
        warningSummary: plan.warningSummary,
      },
    });
    await hooks.beforeCommit?.();

    return {
      batchId,
      replacedBatchId: currentBatch?.id ?? null,
      ...plan,
    };
  });
}

export async function activateDirectorySnapshot(
  client: DatabaseClient,
  batchId: string,
): Promise<DirectoryActivationResult> {
  if (!uuidPattern.test(batchId)) {
    throw new DirectoryImportError('The activation batch ID must be a UUID.');
  }
  return withTransaction(client, async (transaction) => {
    const [target] = await transaction
      .select({
        directoryKind: directoryImportBatches.directoryKind,
        id: directoryImportBatches.id,
        status: directoryImportBatches.status,
      })
      .from(directoryImportBatches)
      .where(eq(directoryImportBatches.id, batchId))
      .limit(1);
    if (target === undefined || target.status === 'draft' || target.status === 'failed') {
      throw new DirectoryImportError('The activation target is not a completed snapshot.');
    }
    const currentBatch = await selectCurrentBatch(transaction, target.directoryKind);
    if (currentBatch?.id === target.id) {
      throw new DirectoryImportError('The requested snapshot is already published.');
    }
    const activatedAt = new Date();
    if (currentBatch !== undefined) {
      await transaction
        .update(directoryImportBatches)
        .set({ status: 'superseded', supersededAt: activatedAt })
        .where(eq(directoryImportBatches.id, currentBatch.id));
    }
    await transaction
      .update(directoryImportBatches)
      .set({ status: 'published', publishedAt: activatedAt, supersededAt: null })
      .where(eq(directoryImportBatches.id, target.id));
    await appendDirectoryAudit(transaction, {
      action: 'directory_snapshot_activated',
      batchId: target.id,
      metadata: {
        activatedBatchId: target.id,
        replacedBatchId: currentBatch?.id ?? null,
      },
    });
    return {
      activatedBatchId: target.id,
      replacedBatchId: currentBatch?.id ?? null,
    };
  });
}

function buildSearchAliases(
  sourceAliases: readonly string[],
  manualAliases: readonly string[],
): readonly NormalizedDirectoryAlias[] {
  const aliases = new Map<string, NormalizedDirectoryAlias>();
  const addAlias = (
    type: DirectoryAliasType,
    aliasValue: string,
    normalizedValue: string,
  ): void => {
    const normalized = normalizeAlias(normalizedValue);
    if (normalized.length === 0 || normalized.length > 255) {
      return;
    }
    const aliasSha256 = hashValue({ type, normalized });
    aliases.set(`${type}\0${normalized}`, {
      type,
      aliasValue,
      normalizedValue: normalized,
      aliasSha256,
    });
  };

  for (const value of sourceAliases) {
    addAlias('source', value, value);
  }
  for (const value of manualAliases) {
    addAlias('manual', value, value);
  }
  for (const value of [...sourceAliases, ...manualAliases]) {
    if (!hanPattern.test(value)) {
      continue;
    }
    const full = pinyin(value, {
      nonZh: 'removed',
      toneType: 'none',
      type: 'string',
      v: true,
    }).toLowerCase();
    const initials = pinyin(value, {
      nonZh: 'removed',
      pattern: 'first',
      toneType: 'none',
      type: 'string',
      v: true,
    }).toLowerCase();
    addAlias('pinyin_full', full, full);
    addAlias('pinyin_compact', full.replaceAll(' ', ''), full.replaceAll(' ', ''));
    addAlias('pinyin_initials', initials.replaceAll(' ', ''), initials.replaceAll(' ', ''));
  }
  return [...aliases.values()];
}

async function upsertCampuses(
  transaction: DatabaseTransaction,
  campuses: readonly NormalizedDirectoryCampus[],
): Promise<void> {
  for (const campus of campuses) {
    await transaction
      .insert(directoryCampuses)
      .values({
        id: randomUUID(),
        code: campus.code,
        name: campus.name,
        displayOrder: campus.displayOrder,
        dialingNote: campus.dialingNote ?? null,
      })
      .onDuplicateKeyUpdate({
        set: {
          name: campus.name,
          displayOrder: campus.displayOrder,
          dialingNote: campus.dialingNote ?? null,
        },
      });
  }
}

async function selectCampusIds(
  transaction: DatabaseTransaction,
  campuses: readonly NormalizedDirectoryCampus[],
): Promise<Map<string, string>> {
  const wantedCodes = new Set(campuses.map((campus) => campus.code));
  const rows = await transaction
    .select({ code: directoryCampuses.code, id: directoryCampuses.id })
    .from(directoryCampuses);
  return new Map(rows.filter((row) => wantedCodes.has(row.code)).map((row) => [row.code, row.id]));
}

async function selectCurrentBatch(
  database: DatabaseTransaction,
  directoryKind: DirectoryKind,
): Promise<{ readonly id: string } | undefined> {
  const [batch] = await database
    .select({ id: directoryImportBatches.id })
    .from(directoryImportBatches)
    .where(
      and(
        eq(directoryImportBatches.directoryKind, directoryKind),
        eq(directoryImportBatches.status, 'published'),
      ),
    )
    .limit(1);
  return batch;
}

async function selectCurrentEntries(
  database: DatabaseTransaction | DatabaseClient['database'],
  directoryKind: DirectoryKind,
): Promise<readonly ExistingDirectoryEntry[]> {
  return database
    .select({ entryKey: directoryEntries.entryKey, contentSha256: directoryEntries.contentSha256 })
    .from(directoryEntries)
    .innerJoin(directoryImportBatches, eq(directoryEntries.batchId, directoryImportBatches.id))
    .where(
      and(
        eq(directoryImportBatches.directoryKind, directoryKind),
        eq(directoryImportBatches.status, 'published'),
      ),
    );
}

function chunkArray<T>(values: readonly T[], chunkSize = 500): readonly T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push([...values.slice(index, index + chunkSize)]);
  }
  return chunks;
}

async function appendDirectoryAudit(
  transaction: DatabaseTransaction,
  input: {
    readonly action: 'directory_snapshot_published' | 'directory_snapshot_activated';
    readonly batchId: string;
    readonly metadata: Record<string, unknown>;
  },
): Promise<void> {
  await transaction.insert(auditLogs).values({
    id: randomUUID(),
    action: input.action,
    actorUserId: null,
    groupId: null,
    metadata: input.metadata,
    operationId: randomUUID(),
    outcome: 'success',
    requestId: null,
    targetId: input.batchId,
    targetType: 'directory_import_batch',
  });
}

function normalizePhoneValue(
  value: string | undefined,
  path: string,
  maximumDigits: number,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const canonical = value.normalize('NFKC');
  if (!phoneCharactersPattern.test(canonical)) {
    throw new DirectoryImportError(`${path} contains unsupported characters.`);
  }
  const digits = canonical.replaceAll(/\D/gu, '');
  if (digits.length < 3 || digits.length > maximumDigits) {
    throw new DirectoryImportError(`${path} must contain 3 to ${maximumDigits} digits.`);
  }
  return digits;
}

function normalizeAlias(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replaceAll(/\s+/gu, ' ');
}

function hashValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function requireMapValue(map: ReadonlyMap<string, string>, key: string, kind: string): string {
  const value = map.get(key);
  if (value === undefined) {
    throw new DirectoryImportError(`Unable to resolve a normalized ${kind} reference.`);
  }
  return value;
}

function readObject(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DirectoryImportError(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function readArray(
  object: Readonly<Record<string, unknown>>,
  key: string,
  minimum: number,
  maximum: number,
  parentPath = 'manifest',
): readonly unknown[] {
  const value = object[key];
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new DirectoryImportError(
      `${parentPath}.${key} must contain ${minimum} to ${maximum} items.`,
    );
  }
  return value;
}

function readRequiredString(
  object: Readonly<Record<string, unknown>>,
  key: string,
  maximumLength: number,
  parentPath = 'manifest',
): string {
  const value = object[key];
  if (typeof value !== 'string') {
    throw new DirectoryImportError(`${parentPath}.${key} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maximumLength) {
    throw new DirectoryImportError(
      `${parentPath}.${key} must contain 1 to ${maximumLength} characters.`,
    );
  }
  return trimmed;
}

function readOptionalString(
  object: Readonly<Record<string, unknown>>,
  key: string,
  maximumLength: number,
  parentPath = 'manifest',
): string | undefined {
  const value = object[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return readRequiredString(object, key, maximumLength, parentPath);
}

function readOptionalStringArray(
  object: Readonly<Record<string, unknown>>,
  key: string,
  maximumItemLength: number,
  maximumItems: number,
  parentPath = 'manifest',
): readonly string[] {
  const value = object[key];
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new DirectoryImportError(
      `${parentPath}.${key} must be an array of up to ${maximumItems}.`,
    );
  }
  const strings = value.map((_item, index) =>
    readRequiredString(
      { value: value[index] },
      'value',
      maximumItemLength,
      `${parentPath}.${key}[${index}]`,
    ),
  );
  assertUnique(strings.map(normalizeAlias), `${parentPath}.${key}`);
  return strings;
}

function readStableKey(
  object: Readonly<Record<string, unknown>>,
  key: string,
  maximumLength: number,
  parentPath = 'manifest',
): string {
  const value = readRequiredString(object, key, maximumLength, parentPath);
  if (!stableKeyPattern.test(value)) {
    throw new DirectoryImportError(`${parentPath}.${key} has an invalid stable-key format.`);
  }
  return value;
}

function readInteger(
  object: Readonly<Record<string, unknown>>,
  key: string,
  minimum: number,
  maximum: number,
  parentPath = 'manifest',
): number {
  const value = object[key];
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new DirectoryImportError(
      `${parentPath}.${key} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return value as number;
}

function readBoolean(
  object: Readonly<Record<string, unknown>>,
  key: string,
  parentPath = 'manifest',
): boolean {
  const value = object[key];
  if (typeof value !== 'boolean') {
    throw new DirectoryImportError(`${parentPath}.${key} must be boolean.`);
  }
  return value;
}

function readEnum<const Values extends readonly string[]>(
  object: Readonly<Record<string, unknown>>,
  key: string,
  values: Values,
  parentPath = 'manifest',
): Values[number] {
  const value = object[key];
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new DirectoryImportError(`${parentPath}.${key} has an unsupported value.`);
  }
  return value;
}

function readDate(
  object: Readonly<Record<string, unknown>>,
  key: string,
  parentPath = 'manifest',
): string {
  const value = readRequiredString(object, key, 10, parentPath);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new DirectoryImportError(`${parentPath}.${key} must be a valid ISO date.`);
  }
  return value;
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new DirectoryImportError(`${label} must be unique.`);
  }
}
