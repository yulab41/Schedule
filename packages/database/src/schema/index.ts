import { sql } from 'drizzle-orm';
import {
  char,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

const identifier = () => char('id', { length: 36 }).primaryKey();

const auditableColumns = () => ({
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp('deleted_at', { fsp: 3 }),
  version: int('version', { unsigned: true }).default(1).notNull(),
});

export const users = mysqlTable(
  'users',
  {
    id: identifier(),
    cloudbaseUid: varchar('cloudbase_uid', { length: 128 }).notNull(),
    status: mysqlEnum('status', ['active', 'suspended', 'deleted']).default('active').notNull(),
    ...auditableColumns(),
  },
  (table) => [uniqueIndex('users_cloudbase_uid_unique').on(table.cloudbaseUid)],
);

export const userProfiles = mysqlTable('user_profiles', {
  userId: char('user_id', { length: 36 })
    .primaryKey()
    .references(() => users.id),
  realName: varchar('real_name', { length: 100 }).notNull(),
  ...auditableColumns(),
});

export const groups = mysqlTable(
  'groups',
  {
    id: identifier(),
    name: varchar('name', { length: 100 }).notNull(),
    groupCode: char('group_code', { length: 4 }).notNull(),
    ownerUserId: char('owner_user_id', { length: 36 })
      .notNull()
      .references(() => users.id),
    rulesVersion: int('rules_version', { unsigned: true }).default(1).notNull(),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('groups_group_code_unique').on(table.groupCode),
    index('groups_owner_user_id_idx').on(table.ownerUserId),
  ],
);

export const rosterEntries = mysqlTable(
  'roster_entries',
  {
    id: identifier(),
    groupId: char('group_id', { length: 36 })
      .notNull()
      .references(() => groups.id),
    realName: varchar('real_name', { length: 100 }).notNull(),
    status: mysqlEnum('status', ['pending', 'claimed', 'removed']).default('pending').notNull(),
    claimedByUserId: char('claimed_by_user_id', { length: 36 }).references(() => users.id, {
      onDelete: 'set null',
    }),
    pendingRealName: varchar('pending_real_name', { length: 100 }).generatedAlwaysAs(
      sql`if(deleted_at is null and status = 'pending', real_name, null)`,
      { mode: 'stored' },
    ),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('roster_entries_pending_name_unique').on(table.groupId, table.pendingRealName),
    index('roster_entries_group_status_idx').on(table.groupId, table.status),
  ],
);

export const groupMemberships = mysqlTable(
  'group_memberships',
  {
    id: identifier(),
    groupId: char('group_id', { length: 36 })
      .notNull()
      .references(() => groups.id),
    userId: char('user_id', { length: 36 })
      .notNull()
      .references(() => users.id),
    role: mysqlEnum('role', ['owner', 'administrator', 'member']).default('member').notNull(),
    status: mysqlEnum('status', ['active', 'inactive']).default('active').notNull(),
    autoAcceptSwaps: tinyint('auto_accept_swaps', { unsigned: true }).default(0).notNull(),
    activeUserId: char('active_user_id', { length: 36 }).generatedAlwaysAs(
      sql`if(deleted_at is null and status = 'active', user_id, null)`,
      { mode: 'stored' },
    ),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('group_memberships_active_user_unique').on(table.groupId, table.activeUserId),
    index('group_memberships_user_status_idx').on(table.userId, table.status),
  ],
);

export const groupMemberContacts = mysqlTable(
  'group_member_contacts',
  {
    id: identifier(),
    membershipId: char('membership_id', { length: 36 })
      .notNull()
      .references(() => groupMemberships.id),
    mobilePhone: varchar('mobile_phone', { length: 32 }),
    shortPhone: varchar('short_phone', { length: 32 }),
    isConfirmed: tinyint('is_confirmed', { unsigned: true }).default(0).notNull(),
    activeMembershipId: char('active_membership_id', { length: 36 }).generatedAlwaysAs(
      sql`if(deleted_at is null, membership_id, null)`,
      { mode: 'stored' },
    ),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('group_member_contacts_active_membership_unique').on(table.activeMembershipId),
  ],
);

export const idempotencyKeys = mysqlTable(
  'idempotency_keys',
  {
    id: identifier(),
    actorUserId: char('actor_user_id', { length: 36 })
      .notNull()
      .references(() => users.id),
    scope: varchar('scope', { length: 64 }).notNull(),
    operationKey: varchar('operation_key', { length: 128 }).notNull(),
    requestFingerprint: char('request_fingerprint', { length: 64 }).notNull(),
    status: mysqlEnum('status', ['processing', 'completed']).default('processing').notNull(),
    completedAt: timestamp('completed_at', { fsp: 3 }),
    expiresAt: timestamp('expires_at', { fsp: 3 }).notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
    version: int('version', { unsigned: true }).default(1).notNull(),
  },
  (table) => [
    uniqueIndex('idempotency_keys_actor_scope_operation_unique').on(
      table.actorUserId,
      table.scope,
      table.operationKey,
    ),
    index('idempotency_keys_expires_at_idx').on(table.expiresAt),
  ],
);

export const groupCodeAttempts = mysqlTable('group_code_attempts', {
  userId: char('user_id', { length: 36 })
    .primaryKey()
    .references(() => users.id),
  windowStartedAt: timestamp('window_started_at', { fsp: 3 }).defaultNow().notNull(),
  attemptCount: int('attempt_count', { unsigned: true }).default(1).notNull(),
});

export const groupJoinRequests = mysqlTable(
  'group_join_requests',
  {
    id: identifier(),
    groupId: char('group_id', { length: 36 })
      .notNull()
      .references(() => groups.id),
    requestingUserId: char('requesting_user_id', { length: 36 })
      .notNull()
      .references(() => users.id),
    requestedRealName: varchar('requested_real_name', { length: 100 }).notNull(),
    status: mysqlEnum('status', ['pending', 'resolved', 'rejected']).default('pending').notNull(),
    pendingRequestKey: varchar('pending_request_key', { length: 73 }).generatedAlwaysAs(
      sql`if(deleted_at is null and status = 'pending', concat(group_id, ':', requesting_user_id), null)`,
      { mode: 'stored' },
    ),
    ...auditableColumns(),
  },
  (table) => [
    uniqueIndex('group_join_requests_pending_request_unique').on(table.pendingRequestKey),
    index('group_join_requests_group_status_idx').on(table.groupId, table.status),
    index('group_join_requests_user_status_idx').on(table.requestingUserId, table.status),
  ],
);
