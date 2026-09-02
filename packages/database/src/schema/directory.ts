import { sql } from 'drizzle-orm';
import {
  char,
  date,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

const identifier = () => char('id', { length: 36 }).primaryKey();

export const directoryCampuses = mysqlTable(
  'directory_campuses',
  {
    id: identifier(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    displayOrder: int('display_order', { unsigned: true }).notNull(),
    dialingNote: varchar('dialing_note', { length: 1000 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex('directory_campuses_code_unique').on(table.code),
    index('directory_campuses_display_order_idx').on(table.displayOrder, table.code),
  ],
);

export const directoryImportBatches = mysqlTable(
  'directory_import_batches',
  {
    id: identifier(),
    importVersion: varchar('import_version', { length: 64 }).notNull(),
    schemaVersion: int('schema_version', { unsigned: true }).notNull(),
    directoryKind: mysqlEnum('directory_kind', ['internal', 'employee'])
      .default('internal')
      .notNull(),
    status: mysqlEnum('status', ['draft', 'published', 'superseded', 'failed'])
      .default('draft')
      .notNull(),
    effectiveOn: date('effective_on', { mode: 'string' }).notNull(),
    manifestSha256: char('manifest_sha256', { length: 64 }).notNull(),
    sourceDocumentCount: int('source_document_count', { unsigned: true }).notNull(),
    entryCount: int('entry_count', { unsigned: true }).notNull(),
    contactMethodCount: int('contact_method_count', { unsigned: true }).notNull(),
    warningCount: int('warning_count', { unsigned: true }).notNull(),
    diffSummary: json('diff_summary').$type<Record<string, number>>().notNull(),
    warningSummary: json('warning_summary').$type<Record<string, number>>().notNull(),
    publishedAt: timestamp('published_at', { fsp: 3 }),
    supersededAt: timestamp('superseded_at', { fsp: 3 }),
    publishedSlot: tinyint('published_slot', { unsigned: true }).generatedAlwaysAs(
      sql`if(status = 'published', 1, null)`,
      { mode: 'stored' },
    ),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex('directory_import_batches_version_unique').on(table.importVersion),
    uniqueIndex('directory_import_batches_manifest_unique').on(table.manifestSha256),
    uniqueIndex('directory_import_batches_published_slot_unique').on(
      table.directoryKind,
      table.publishedSlot,
    ),
    index('directory_import_batches_effective_status_idx').on(table.effectiveOn, table.status),
  ],
);

export const directorySourceDocuments = mysqlTable(
  'directory_source_documents',
  {
    id: identifier(),
    batchId: char('batch_id', { length: 36 })
      .notNull()
      .references(() => directoryImportBatches.id),
    campusId: char('campus_id', { length: 36 })
      .notNull()
      .references(() => directoryCampuses.id),
    documentKey: varchar('document_key', { length: 128 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    sourceSha256: char('source_sha256', { length: 64 }).notNull(),
    effectiveOn: date('effective_on', { mode: 'string' }).notNull(),
    pageCount: int('page_count', { unsigned: true }).notNull(),
    displayOrder: int('display_order', { unsigned: true }).notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('directory_source_documents_batch_key_unique').on(table.batchId, table.documentKey),
    uniqueIndex('directory_source_documents_batch_hash_unique').on(
      table.batchId,
      table.sourceSha256,
    ),
    index('directory_source_documents_batch_campus_idx').on(
      table.batchId,
      table.campusId,
      table.displayOrder,
    ),
  ],
);

export const directoryEntries = mysqlTable(
  'directory_entries',
  {
    id: identifier(),
    batchId: char('batch_id', { length: 36 })
      .notNull()
      .references(() => directoryImportBatches.id),
    sourceDocumentId: char('source_document_id', { length: 36 })
      .notNull()
      .references(() => directorySourceDocuments.id),
    campusId: char('campus_id', { length: 36 })
      .notNull()
      .references(() => directoryCampuses.id),
    entryKey: varchar('entry_key', { length: 191 }).notNull(),
    sourcePage: int('source_page', { unsigned: true }).notNull(),
    sourceLocator: varchar('source_locator', { length: 191 }).notNull(),
    sectionName: varchar('section_name', { length: 100 }),
    departmentName: varchar('department_name', { length: 150 }),
    subunitName: varchar('subunit_name', { length: 150 }),
    contactName: varchar('contact_name', { length: 150 }),
    jobTitle: varchar('job_title', { length: 100 }),
    employeeCode: varchar('employee_code', { length: 64 }),
    buildingName: varchar('building_name', { length: 100 }),
    floorName: varchar('floor_name', { length: 64 }),
    roomName: varchar('room_name', { length: 100 }),
    entryKind: mysqlEnum('entry_kind', [
      'department',
      'person',
      'service',
      'facility',
      'vendor',
      'emergency',
      'switchboard',
      'other',
    ]).notNull(),
    notes: varchar('notes', { length: 1000 }),
    visibility: mysqlEnum('visibility', ['member', 'administrator']).default('member').notNull(),
    verificationStatus: mysqlEnum('verification_status', [
      'source_exact',
      'needs_review',
      'manually_verified',
    ])
      .default('source_exact')
      .notNull(),
    displayOrder: int('display_order', { unsigned: true }).notNull(),
    searchText: text('search_text').notNull(),
    contentSha256: char('content_sha256', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('directory_entries_batch_key_unique').on(table.batchId, table.entryKey),
    uniqueIndex('directory_entries_batch_source_unique').on(
      table.batchId,
      table.sourceDocumentId,
      table.sourceLocator,
    ),
    index('directory_entries_batch_campus_order_idx').on(
      table.batchId,
      table.campusId,
      table.displayOrder,
    ),
    index('directory_entries_batch_department_idx').on(
      table.batchId,
      table.departmentName,
      table.subunitName,
    ),
    index('directory_entries_batch_kind_idx').on(table.batchId, table.entryKind),
    index('directory_entries_source_page_idx').on(
      table.sourceDocumentId,
      table.sourcePage,
      table.displayOrder,
    ),
  ],
);

export const directoryContactMethods = mysqlTable(
  'directory_contact_methods',
  {
    id: identifier(),
    entryId: char('entry_id', { length: 36 })
      .notNull()
      .references(() => directoryEntries.id),
    type: mysqlEnum('type', ['voice', 'mobile', 'fax', 'emergency', 'hotline', 'other'])
      .default('voice')
      .notNull(),
    label: varchar('label', { length: 100 }),
    fullNumber: varchar('full_number', { length: 64 }),
    internalExtension: varchar('internal_extension', { length: 32 }),
    normalizedFullNumber: varchar('normalized_full_number', { length: 32 }),
    normalizedInternalExtension: varchar('normalized_internal_extension', { length: 20 }),
    contactSha256: char('contact_sha256', { length: 64 }).notNull(),
    isPrimary: tinyint('is_primary', { unsigned: true }).default(0).notNull(),
    displayOrder: int('display_order', { unsigned: true }).notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('directory_contact_methods_entry_hash_unique').on(
      table.entryId,
      table.contactSha256,
    ),
    index('directory_contact_methods_entry_order_idx').on(table.entryId, table.displayOrder),
    index('directory_contact_methods_full_number_idx').on(table.normalizedFullNumber),
    index('directory_contact_methods_extension_idx').on(table.normalizedInternalExtension),
  ],
);

export const directorySearchAliases = mysqlTable(
  'directory_search_aliases',
  {
    id: identifier(),
    entryId: char('entry_id', { length: 36 })
      .notNull()
      .references(() => directoryEntries.id),
    type: mysqlEnum('type', [
      'source',
      'manual',
      'pinyin_full',
      'pinyin_compact',
      'pinyin_initials',
    ]).notNull(),
    aliasValue: varchar('alias_value', { length: 255 }).notNull(),
    normalizedValue: varchar('normalized_value', { length: 255 }).notNull(),
    aliasSha256: char('alias_sha256', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('directory_search_aliases_entry_hash_unique').on(table.entryId, table.aliasSha256),
    index('directory_search_aliases_normalized_idx').on(table.normalizedValue, table.type),
    index('directory_search_aliases_entry_type_idx').on(table.entryId, table.type),
    index('directory_search_aliases_entry_type_normalized_idx').on(
      table.entryId,
      table.type,
      table.normalizedValue,
    ),
  ],
);
