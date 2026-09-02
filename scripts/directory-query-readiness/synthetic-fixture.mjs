import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../packages/database/package.json', import.meta.url));
const mysql = require('mysql2/promise');

export const fixtureTargets = Object.freeze({
  aliases: 128_659,
  aliasesByType: Object.freeze({
    pinyin_compact: 31_053,
    pinyin_full: 31_053,
    pinyin_initials: 31_053,
    source: 35_500,
  }),
  aliasDistinctByType: Object.freeze({
    pinyin_compact: 1_554,
    pinyin_full: 1_554,
    pinyin_initials: 1_235,
    source: 2_802,
  }),
  campuses: 3,
  contacts: 7_057,
  entries: 7_021,
  importBatches: 7,
  publishedEmployeeAliases: 22_856,
  publishedEmployeeContacts: 1_203,
  publishedEmployeeEntries: 1_200,
  publishedInternalAliases: 4_488,
  publishedInternalContacts: 359,
  publishedInternalEntries: 341,
});

const special = Object.freeze({
  chinese: '合成甲乙',
  compactPinyin: 'qianzhouxin',
  employeeCode: 'Q4831',
  fullPinyin: 'qianzhouxin',
  initials: 'qzx',
  phone: '70000000001',
  phoneExtension: '7319',
});

export const benchmarkFixture = Object.freeze({
  filters: Object.freeze({
    building: `合成楼宇${cjkDigits(0, 3)}`,
    campusCode: 'synthetic-campus-1',
    department: `合成科室${cjkDigits(0, 3)}`,
    entryKind: 'person',
    floor: `合成楼层${cjkDigits(0, 2)}`,
    section: `合成分区${cjkDigits(0, 2)}`,
    subunit: `合成单元${cjkDigits(0, 4)}`,
  }),
  groupId: deterministicUuid('benchmark-group'),
  identities: Object.freeze({
    administrator: Object.freeze({ cloudbaseUid: 'benchmark-administrator' }),
    guest: Object.freeze({ cloudbaseUid: 'benchmark-guest' }),
    member: Object.freeze({ cloudbaseUid: 'benchmark-member' }),
    outsider: Object.freeze({ cloudbaseUid: 'benchmark-outsider' }),
    owner: Object.freeze({ cloudbaseUid: 'benchmark-owner' }),
  }),
  queries: Object.freeze({
    asciiSingle: Object.freeze({ q: 'i' }),
    chineseName: Object.freeze({ q: special.chinese }),
    employeeCodeExact: Object.freeze({ q: special.employeeCode }),
    employeeCodeWithoutPrefix: Object.freeze({ q: special.employeeCode.slice(1) }),
    fullPinyin: Object.freeze({ q: special.fullPinyin }),
    noResult: Object.freeze({ q: 'zzzzzzsyntheticnomatch' }),
    partialPinyin: Object.freeze({ q: special.fullPinyin.slice(0, 6) }),
    phoneExact: Object.freeze({ q: special.phone }),
    pinyinInitials: Object.freeze({ q: special.initials }),
  }),
});

const batchShapes = Object.freeze([
  Object.freeze({
    contacts: 1_203,
    entries: 1_200,
    key: 'employee-current',
    kind: 'employee',
    status: 'published',
  }),
  Object.freeze({
    contacts: 1_202,
    entries: 1_200,
    key: 'employee-history-1',
    kind: 'employee',
    status: 'superseded',
  }),
  Object.freeze({
    contacts: 1_202,
    entries: 1_200,
    key: 'employee-history-2',
    kind: 'employee',
    status: 'superseded',
  }),
  Object.freeze({
    contacts: 1_202,
    entries: 1_200,
    key: 'employee-history-3',
    kind: 'employee',
    status: 'superseded',
  }),
  Object.freeze({
    contacts: 1_202,
    entries: 1_200,
    key: 'employee-history-4',
    kind: 'employee',
    status: 'superseded',
  }),
  Object.freeze({
    contacts: 359,
    entries: 341,
    key: 'internal-current',
    kind: 'internal',
    status: 'published',
  }),
  Object.freeze({
    contacts: 687,
    entries: 680,
    key: 'internal-history-1',
    kind: 'internal',
    status: 'superseded',
  }),
]);

const aliasGroupTargets = Object.freeze({
  employeeCurrent: Object.freeze({
    pinyin_compact: 5_512,
    pinyin_full: 5_512,
    pinyin_initials: 5_512,
    source: 6_320,
  }),
  historical: Object.freeze({
    pinyin_compact: 24_485,
    pinyin_full: 24_485,
    pinyin_initials: 24_485,
    source: 27_860,
  }),
  internalCurrent: Object.freeze({
    pinyin_compact: 1_056,
    pinyin_full: 1_056,
    pinyin_initials: 1_056,
    source: 1_320,
  }),
});

const entryKinds = Object.freeze([
  'person',
  'person',
  'person',
  'department',
  'service',
  'facility',
  'other',
]);

export function readBenchmarkDatabaseConfig(environment = process.env) {
  const config = {
    database: environment.DIRECTORY_BENCHMARK_DATABASE ?? 'schedule_directory_readiness',
    host: environment.DIRECTORY_BENCHMARK_HOST ?? '127.0.0.1',
    password: environment.DIRECTORY_BENCHMARK_PASSWORD ?? 'local-readiness-app',
    port: Number(environment.DIRECTORY_BENCHMARK_PORT ?? 3318),
    user: environment.DIRECTORY_BENCHMARK_USER ?? 'schedule_directory_readiness',
  };
  if (!['127.0.0.1', '::1', 'localhost'].includes(config.host)) {
    throw new Error('Directory benchmark database host must be local.');
  }
  if (config.database !== 'schedule_directory_readiness' || config.port !== 3318) {
    throw new Error('Directory benchmark database must use the dedicated database and port.');
  }
  return config;
}

export async function seedSyntheticDirectoryFixture(environment = process.env) {
  const connection = await mysql.createConnection({
    ...readBenchmarkDatabaseConfig(environment),
    charset: 'utf8mb4_0900_ai_ci',
    multipleStatements: true,
    timezone: 'Z',
  });
  try {
    await resetFixtureTables(connection);
    const campuses = await seedCampuses(connection);
    await seedPermissionContexts(connection);
    const { entries, groups, sourceDocuments } = await seedBatchesAndEntries(connection, campuses);
    await seedContacts(connection, groups);
    await seedAliases(connection, groups);
    await connection.query(
      'ANALYZE TABLE directory_entries, directory_search_aliases, directory_contact_methods, directory_campuses',
    );
    const [counts] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM directory_entries) AS entries,
        (SELECT COUNT(*) FROM directory_search_aliases) AS aliases,
        (SELECT COUNT(*) FROM directory_contact_methods) AS contacts,
        (SELECT COUNT(*) FROM directory_import_batches) AS batches,
        (SELECT COUNT(*) FROM directory_campuses) AS campuses
    `);
    const actual = counts[0];
    assertTarget(actual.entries, fixtureTargets.entries, 'entries');
    assertTarget(actual.aliases, fixtureTargets.aliases, 'aliases');
    assertTarget(actual.contacts, fixtureTargets.contacts, 'contacts');
    assertTarget(actual.batches, fixtureTargets.importBatches, 'batches');
    assertTarget(actual.campuses, fixtureTargets.campuses, 'campuses');
    return Object.freeze({
      aliases: Number(actual.aliases),
      batches: Number(actual.batches),
      campuses: Number(actual.campuses),
      contacts: Number(actual.contacts),
      entries: entries.length,
      sourceDocuments: sourceDocuments.length,
    });
  } finally {
    await connection.end();
  }
}

async function resetFixtureTables(connection) {
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of [
    'directory_search_aliases',
    'directory_contact_methods',
    'directory_entries',
    'directory_source_documents',
    'directory_import_batches',
    'directory_campuses',
    'group_memberships',
    'groups',
    'user_profiles',
    'users',
  ]) {
    await connection.query(`TRUNCATE TABLE \`${table}\``);
  }
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function seedCampuses(connection) {
  const campuses = Array.from({ length: fixtureTargets.campuses }, (_, index) => ({
    code: `synthetic-campus-${index + 1}`,
    id: deterministicUuid(`campus-${index + 1}`),
    name: `合成院区${cjkDigits(index, 2)}`,
    order: (index + 1) * 10,
  }));
  await insertRows(
    connection,
    'directory_campuses',
    ['id', 'code', 'name', 'display_order', 'dialing_note'],
    campuses.map((campus) => [campus.id, campus.code, campus.name, campus.order, '合成拨号说明']),
  );
  return campuses;
}

async function seedPermissionContexts(connection) {
  const users = [
    { role: 'owner', uid: benchmarkFixture.identities.owner.cloudbaseUid },
    { role: 'administrator', uid: benchmarkFixture.identities.administrator.cloudbaseUid },
    { role: 'member', uid: benchmarkFixture.identities.member.cloudbaseUid },
    { role: 'guest', uid: benchmarkFixture.identities.guest.cloudbaseUid },
    { role: undefined, uid: benchmarkFixture.identities.outsider.cloudbaseUid },
  ].map((user) => ({ ...user, id: deterministicUuid(`user-${user.uid}`) }));
  await insertRows(
    connection,
    'users',
    ['id', 'cloudbase_uid', 'is_developer_admin'],
    users.map((user) => [user.id, user.uid, 0]),
  );
  await insertRows(
    connection,
    'user_profiles',
    ['user_id', 'real_name'],
    users.map((user, index) => [user.id, `合成账号${cjkDigits(index, 2)}`]),
  );
  const owner = users[0];
  await insertRows(
    connection,
    'groups',
    ['id', 'name', 'group_code', 'owner_user_id', 'visitor_key'],
    [[benchmarkFixture.groupId, '合成基准群组', '8642', owner.id, 'b'.repeat(32)]],
  );
  await insertRows(
    connection,
    'group_memberships',
    ['id', 'group_id', 'user_id', 'role'],
    users
      .filter((user) => user.role !== undefined)
      .map((user) => [
        deterministicUuid(`membership-${user.uid}`),
        benchmarkFixture.groupId,
        user.id,
        user.role,
      ]),
  );
}

async function seedBatchesAndEntries(connection, campuses) {
  const batches = batchShapes.map((shape, batchIndex) => ({
    ...shape,
    id: deterministicUuid(`batch-${shape.key}`),
    index: batchIndex,
  }));
  await insertRows(
    connection,
    'directory_import_batches',
    [
      'id',
      'import_version',
      'schema_version',
      'directory_kind',
      'status',
      'effective_on',
      'manifest_sha256',
      'source_document_count',
      'entry_count',
      'contact_method_count',
      'warning_count',
      'diff_summary',
      'warning_summary',
      'published_at',
      'superseded_at',
    ],
    batches.map((batch) => [
      batch.id,
      `synthetic-${batch.key}`,
      1,
      batch.kind,
      batch.status,
      `2026-0${(batch.index % 7) + 1}-01`,
      sha256(`manifest-${batch.key}`),
      campuses.length,
      batch.entries,
      batch.contacts,
      0,
      JSON.stringify({ added: batch.entries }),
      JSON.stringify({}),
      batch.status === 'published' ? '2026-08-20 00:00:00.000' : null,
      batch.status === 'superseded' ? '2026-08-20 00:00:00.000' : null,
    ]),
  );

  const sourceDocuments = batches.flatMap((batch) =>
    campuses.map((campus, campusIndex) => ({
      batch,
      campus,
      id: deterministicUuid(`document-${batch.key}-${campusIndex}`),
      index: campusIndex,
    })),
  );
  await insertRows(
    connection,
    'directory_source_documents',
    [
      'id',
      'batch_id',
      'campus_id',
      'document_key',
      'title',
      'source_sha256',
      'effective_on',
      'page_count',
      'display_order',
    ],
    sourceDocuments.map((document) => [
      document.id,
      document.batch.id,
      document.campus.id,
      `synthetic-document-${document.batch.index}-${document.index}`,
      `合成来源${cjkDigits(document.batch.index * 3 + document.index, 3)}`,
      sha256(`source-${document.batch.key}-${document.index}`),
      `2026-0${(document.batch.index % 7) + 1}-01`,
      100,
      document.index * 10 + 10,
    ]),
  );

  const entries = [];
  const groups = { employeeCurrent: [], historical: [], internalCurrent: [] };
  let globalIndex = 0;
  for (const batch of batches) {
    const documents = sourceDocuments.filter((document) => document.batch.id === batch.id);
    for (let localIndex = 0; localIndex < batch.entries; localIndex += 1) {
      const campus = campuses[localIndex % campuses.length];
      const document = documents[localIndex % documents.length];
      const entry = createEntry({ batch, campus, document, globalIndex, localIndex });
      entries.push(entry);
      if (batch.key === 'employee-current') groups.employeeCurrent.push(entry);
      else if (batch.key === 'internal-current') groups.internalCurrent.push(entry);
      else groups.historical.push(entry);
      globalIndex += 1;
    }
  }
  await insertRows(
    connection,
    'directory_entries',
    [
      'id',
      'batch_id',
      'source_document_id',
      'campus_id',
      'entry_key',
      'source_page',
      'source_locator',
      'section_name',
      'department_name',
      'subunit_name',
      'contact_name',
      'job_title',
      'employee_code',
      'building_name',
      'floor_name',
      'room_name',
      'entry_kind',
      'notes',
      'visibility',
      'verification_status',
      'display_order',
      'search_text',
      'content_sha256',
    ],
    entries.map((entry) => [
      entry.id,
      entry.batch.id,
      entry.document.id,
      entry.campus.id,
      entry.entryKey,
      entry.sourcePage,
      entry.sourceLocator,
      entry.section,
      entry.department,
      entry.subunit,
      entry.contactName,
      entry.jobTitle,
      entry.employeeCode,
      entry.building,
      entry.floor,
      entry.room,
      entry.entryKind,
      entry.notes,
      entry.visibility,
      'source_exact',
      entry.displayOrder,
      entry.searchText,
      sha256(`entry-content-${entry.globalIndex}`),
    ]),
  );
  return { batches, entries, groups, sourceDocuments };
}

function createEntry({ batch, campus, document, globalIndex, localIndex }) {
  const isSpecial = batch.key === 'employee-current' && localIndex === 0;
  const contactName = isSpecial ? special.chinese : `合成人员${cjkDigits(globalIndex, 5)}`;
  const employeeCode = isSpecial
    ? special.employeeCode
    : batch.kind === 'employee'
      ? `${String.fromCharCode(65 + (localIndex % 26))}${String(1000 + (localIndex % 9000)).padStart(4, '0')}`
      : null;
  const searchText = isSpecial
    ? `${special.chinese} ${special.fullPinyin} ${special.initials} ${employeeCode}`
    : `${contactName} fullsynthetic${toBase36(globalIndex, 6)} compact${toBase36(globalIndex, 8)} 合成检索${cjkDigits(globalIndex, 8)}`;
  return {
    batch,
    building: `合成楼宇${cjkDigits(localIndex % 18, 3)}`,
    campus,
    contactName,
    department: `合成科室${cjkDigits(localIndex % 120, 3)}`,
    displayOrder: localIndex * 10 + 10,
    document,
    employeeCode,
    entryKey: `synthetic-entry-${batch.index}-${String(localIndex).padStart(5, '0')}`,
    entryKind: entryKinds[localIndex % entryKinds.length],
    floor: `合成楼层${cjkDigits(localIndex % 12, 2)}`,
    globalIndex,
    id: deterministicUuid(`entry-${globalIndex}`),
    jobTitle: `合成岗位${cjkDigits(localIndex % 40, 3)}`,
    notes: `合成备注${cjkDigits(globalIndex, 28)}`,
    room: `合成房间${cjkDigits(localIndex % 240, 3)}`,
    searchText,
    section: `合成分区${cjkDigits(localIndex % 7, 2)}`,
    sourceLocator: `synthetic-row-${batch.index}-${String(localIndex).padStart(5, '0')}`,
    sourcePage: (localIndex % 100) + 1,
    subunit: `合成单元${cjkDigits(localIndex % 360, 4)}`,
    visibility: isSpecial || localIndex % 20 !== 0 ? 'member' : 'administrator',
  };
}

async function seedContacts(connection, groups) {
  const rows = [];
  let contactIndex = 0;
  const addContact = (entry, fullNumber, extension, displayOrder = 10) => {
    rows.push([
      deterministicUuid(`contact-${contactIndex}`),
      entry.id,
      'voice',
      fullNumber,
      extension,
      fullNumber,
      extension,
      sha256(`contact-${contactIndex}-${entry.id}`),
      displayOrder === 10 ? 1 : 0,
      displayOrder,
    ]);
    contactIndex += 1;
  };
  for (const [groupName, entries] of Object.entries(groups)) {
    for (const [index, entry] of entries.entries()) {
      const fullNumber =
        groupName === 'employeeCurrent' && index === 0
          ? special.phone
          : String(71000000000 + contactIndex);
      const extension =
        groupName === 'employeeCurrent' && index === 0
          ? special.phoneExtension
          : String(2000 + (contactIndex % 7000));
      addContact(entry, fullNumber, extension);
    }
  }
  const extraTargets = [
    { count: 3, entries: groups.employeeCurrent },
    { count: 18, entries: groups.internalCurrent },
    { count: 15, entries: groups.historical },
  ];
  let extraIndex = 0;
  for (const target of extraTargets) {
    for (let index = 0; index < target.count; index += 1) {
      const entry = target.entries[index % target.entries.length];
      addContact(entry, String(79000000000 + extraIndex), String(9000 + extraIndex), 20);
      extraIndex += 1;
    }
  }
  await insertRows(
    connection,
    'directory_contact_methods',
    [
      'id',
      'entry_id',
      'type',
      'full_number',
      'internal_extension',
      'normalized_full_number',
      'normalized_internal_extension',
      'contact_sha256',
      'is_primary',
      'display_order',
    ],
    rows,
  );
}

async function seedAliases(connection, groups) {
  const rows = [];
  const definitions = [
    {
      distinct: fixtureTargets.aliasDistinctByType.source,
      pool: (index) => `合${cjkDigits(index, 4)}`,
      specials: [special.chinese, special.employeeCode.toLowerCase()],
      type: 'source',
    },
    {
      distinct: fixtureTargets.aliasDistinctByType.pinyin_full,
      pool: (index) => `fullsynthetic${toBase36(index, 6)}`,
      specials: [special.fullPinyin],
      type: 'pinyin_full',
    },
    {
      distinct: fixtureTargets.aliasDistinctByType.pinyin_compact,
      pool: (index) => `compact${toBase36(index, 8)}`,
      specials: [special.compactPinyin],
      type: 'pinyin_compact',
    },
    {
      distinct: fixtureTargets.aliasDistinctByType.pinyin_initials,
      pool: (index) => `i${toBase36(index, 4)}`,
      specials: [special.initials],
      type: 'pinyin_initials',
    },
  ];
  let aliasIndex = 0;
  for (const definition of definitions) {
    const pool = Array.from(
      { length: definition.distinct - definition.specials.length },
      (_, index) => definition.pool(index),
    );
    const assignments = [
      {
        entries: groups.employeeCurrent,
        placeSpecialsOnFirstEntry: true,
        specials: definition.specials,
        target: aliasGroupTargets.employeeCurrent[definition.type],
      },
      {
        entries: groups.internalCurrent,
        specials: definition.specials.slice(0, 1),
        target: aliasGroupTargets.internalCurrent[definition.type],
      },
      {
        entries: groups.historical,
        specials: definition.specials.flatMap((value) => Array(4).fill(value)),
        target: aliasGroupTargets.historical[definition.type],
      },
    ];
    let poolCursor = 0;
    for (const assignment of assignments) {
      for (const [specialIndex, value] of assignment.specials.entries()) {
        const entry = assignment.placeSpecialsOnFirstEntry
          ? assignment.entries[0]
          : assignment.entries[specialIndex % assignment.entries.length];
        rows.push(aliasRow(aliasIndex, entry.id, definition.type, value));
        aliasIndex += 1;
      }
      const remaining = assignment.target - assignment.specials.length;
      for (let index = 0; index < remaining; index += 1) {
        const entry = assignment.entries[(index + 17) % assignment.entries.length];
        const value = pool[poolCursor % pool.length];
        rows.push(aliasRow(aliasIndex, entry.id, definition.type, value));
        aliasIndex += 1;
        poolCursor += 1;
      }
    }
  }
  await insertRows(
    connection,
    'directory_search_aliases',
    ['id', 'entry_id', 'type', 'alias_value', 'normalized_value', 'alias_sha256'],
    rows,
  );
}

function aliasRow(index, entryId, type, value) {
  return [
    deterministicUuid(`alias-${index}`),
    entryId,
    type,
    value,
    value,
    sha256(`alias-${index}-${entryId}-${type}-${value}`),
  ];
}

async function insertRows(connection, table, columns, rows, chunkSize = 750) {
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    await connection.query(
      `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES ?`,
      [chunk],
    );
  }
}

function assertTarget(actual, expected, label) {
  if (Number(actual) !== expected) {
    throw new Error(`Synthetic fixture ${label} mismatch: expected ${expected}, got ${actual}.`);
  }
}

function deterministicUuid(label) {
  const bytes = Buffer.from(sha256(label).slice(0, 32), 'hex');
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function toBase36(value, length) {
  return value.toString(36).padStart(length, '0').slice(-length);
}

function cjkDigits(value, length) {
  let current = value;
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output = String.fromCodePoint(0x4e00 + (current % 512)) + output;
    current = Math.floor(current / 512);
  }
  return output;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedSyntheticDirectoryFixture()
    .then((summary) => {
      process.stdout.write(`${JSON.stringify(summary)}\n`);
    })
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : 'Synthetic fixture failed.'}\n`,
      );
      process.exitCode = 1;
    });
}
