import { sql } from 'drizzle-orm';
import {
  char,
  check,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

const identifier = () => char('id', { length: 36 }).primaryKey();

export const userAuthIdentities = mysqlTable(
  'user_auth_identities',
  {
    id: identifier(),
    userId: char('user_id', { length: 36 }).notNull(),
    provider: mysqlEnum('provider', ['wechat_mini_program', 'wechat_web']).notNull(),
    appId: varchar('app_id', { length: 64 }),
    subject: varchar('subject', { length: 128 }).notNull(),
    unionId: varchar('union_id', { length: 128 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_auth_identities_provider_subject_unique').on(table.provider, table.subject),
    uniqueIndex('user_auth_identities_union_id_unique').on(table.unionId),
    index('user_auth_identities_provider_app_subject_idx').on(
      table.provider,
      table.appId,
      table.subject,
    ),
    index('user_auth_identities_user_idx').on(table.userId),
  ],
);

export const wechatUnionAccounts = mysqlTable(
  'wechat_union_accounts',
  {
    id: identifier(),
    userId: char('user_id', { length: 36 }).notNull(),
    unionId: varchar('union_id', { length: 128 }).notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex('wechat_union_accounts_union_id_unique').on(table.unionId),
    uniqueIndex('wechat_union_accounts_user_id_unique').on(table.userId),
  ],
);

export const wechatIdentityDetachments = mysqlTable(
  'wechat_identity_detachments',
  {
    id: identifier(),
    userId: char('user_id', { length: 36 }).notNull(),
    provider: mysqlEnum('provider', ['wechat_mini_program', 'wechat_web']).notNull(),
    appId: varchar('app_id', { length: 64 }).notNull(),
    subjectHash: char('subject_hash', { length: 64 }).notNull(),
    detachedAt: timestamp('detached_at', { fsp: 3 }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex('wechat_identity_detachments_scope_unique').on(
      table.provider,
      table.appId,
      table.subjectHash,
    ),
    uniqueIndex('wechat_identity_detachments_user_scope_unique').on(
      table.provider,
      table.appId,
      table.userId,
    ),
  ],
);

export const wechatAdminBindingTickets = mysqlTable(
  'wechat_admin_binding_tickets',
  {
    id: identifier(),
    ticketHash: char('ticket_hash', { length: 64 }).notNull(),
    targetUserId: char('target_user_id', { length: 36 }).notNull(),
    appId: varchar('app_id', { length: 64 }).notNull(),
    status: mysqlEnum('status', ['pending', 'consumed']).default('pending').notNull(),
    expiresAt: timestamp('expires_at', { fsp: 3 }).notNull(),
    consumedAt: timestamp('consumed_at', { fsp: 3 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex('wechat_admin_binding_tickets_ticket_hash_unique').on(table.ticketHash),
    index('wechat_admin_binding_tickets_target_status_idx').on(table.targetUserId, table.status),
    index('wechat_admin_binding_tickets_expires_at_idx').on(table.expiresAt),
  ],
);

export const wechatLinkTokens = mysqlTable(
  'wechat_link_tokens',
  {
    id: identifier(),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    appId: varchar('app_id', { length: 64 }).notNull(),
    subject: varchar('subject', { length: 128 }).notNull(),
    unionId: varchar('union_id', { length: 128 }),
    existingUserId: char('existing_user_id', { length: 36 }),
    status: mysqlEnum('status', ['pending', 'consumed']).default('pending').notNull(),
    expiresAt: timestamp('expires_at', { fsp: 3 }).notNull(),
    consumedAt: timestamp('consumed_at', { fsp: 3 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex('wechat_link_tokens_token_hash_unique').on(table.tokenHash),
    index('wechat_link_tokens_identity_status_idx').on(table.appId, table.subject, table.status),
    index('wechat_link_tokens_existing_user_idx').on(table.existingUserId),
    index('wechat_link_tokens_expires_at_idx').on(table.expiresAt),
  ],
);

export const inviteTokens = mysqlTable(
  'invite_tokens',
  {
    id: identifier(),
    groupId: char('group_id', { length: 36 }).notNull(),
    targetMembershipId: char('target_membership_id', { length: 36 }),
    targetRosterEntryId: char('target_roster_entry_id', { length: 36 }),
    inviteeRealName: varchar('invitee_real_name', { length: 100 }).notNull(),
    permissionRole: mysqlEnum('permission_role', ['member', 'administrator'])
      .default('member')
      .notNull(),
    scheduleRoleId: char('schedule_role_id', { length: 36 }),
    createdByUserId: char('created_by_user_id', { length: 36 }).notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { fsp: 3 }).notNull(),
    usedByUserId: char('used_by_user_id', { length: 36 }),
    usedAt: timestamp('used_at', { fsp: 3 }),
    status: mysqlEnum('status', ['pending', 'used', 'revoked', 'expired'])
      .default('pending')
      .notNull(),
    version: int('version', { unsigned: true }).default(1).notNull(),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex('invite_tokens_token_hash_unique').on(table.tokenHash),
    index('invite_tokens_group_status_idx').on(table.groupId, table.status),
    index('invite_tokens_target_membership_idx').on(table.targetMembershipId),
    index('invite_tokens_target_roster_entry_idx').on(table.targetRosterEntryId),
    index('invite_tokens_created_by_idx').on(table.createdByUserId),
    index('invite_tokens_expires_at_idx').on(table.expiresAt),
    check(
      'invite_tokens_target_exactly_one',
      sql`(${table.targetMembershipId} IS NULL) <> (${table.targetRosterEntryId} IS NULL)`,
    ),
  ],
);

export const visitorAccessLogs = mysqlTable(
  'visitor_access_logs',
  {
    id: identifier(),
    groupId: char('group_id', { length: 36 }).notNull(),
    businessMonth: char('business_month', { length: 7 }).notNull(),
    clientIp: varchar('client_ip', { length: 45 }),
    requestId: char('request_id', { length: 36 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    index('visitor_access_logs_group_created_idx').on(table.groupId, table.createdAt, table.id),
    index('visitor_access_logs_business_month_idx').on(table.businessMonth),
  ],
);
