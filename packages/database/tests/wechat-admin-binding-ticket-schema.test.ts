import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../../migrations/0047_wechat_admin_binding_tickets.sql',
  import.meta.url,
);
const journal = readFileSync(
  new URL('../../../migrations/meta/_journal.json', import.meta.url),
  'utf8',
);
const schema = readFileSync(new URL('../src/schema/wechat.ts', import.meta.url), 'utf8');

describe('P3 admin binding ticket schema', () => {
  it('stores only a single-use ticket hash scoped to the target user and AppID', () => {
    expect(existsSync(migrationUrl)).toBe(true);
    if (!existsSync(migrationUrl)) return;
    const migration = readFileSync(migrationUrl, 'utf8');
    expect(journal).toContain('0047_wechat_admin_binding_tickets');
    expect(migration).toContain('CREATE TABLE `wechat_admin_binding_tickets`');
    expect(migration).toContain('`ticket_hash` CHAR(64) NOT NULL');
    expect(migration).toContain("`status` ENUM('pending', 'consumed') NOT NULL DEFAULT 'pending'");
    expect(migration).toContain('`target_user_id` CHAR(36) NOT NULL');
    expect(migration).toContain('UNIQUE KEY `wechat_admin_binding_tickets_ticket_hash_unique`');
    expect(migration).not.toMatch(/`ticket`\s/u);
  });

  it('keeps the Drizzle schema free of raw tickets', () => {
    expect(schema).toContain('export const wechatAdminBindingTickets = mysqlTable(');
    expect(schema).toContain("ticketHash: char('ticket_hash', { length: 64 }).notNull()");
    expect(schema).toContain("targetUserId: char('target_user_id', { length: 36 }).notNull()");
  });
});
