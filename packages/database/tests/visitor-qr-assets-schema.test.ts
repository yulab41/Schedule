import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../..', import.meta.url));

describe('group visitor QR asset schema', () => {
  it('keeps one permanent current asset per group and Mini environment', () => {
    const migration = readFileSync(`${root}/migrations/0061_group_visitor_qr_assets.sql`, 'utf8');
    expect(migration).toContain('CREATE TABLE `group_visitor_qr_assets`');
    expect(migration).toContain('PRIMARY KEY (`group_id`, `environment`)');
    expect(migration).toContain('`visitor_key` varchar(64) NOT NULL');
    expect(migration).not.toContain('expires_at');
  });
});
