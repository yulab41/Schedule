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
