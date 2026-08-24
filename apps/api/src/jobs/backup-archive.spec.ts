import { describe, expect, it } from 'vitest';

import {
  backupFormatVersion,
  computeFileSha256,
  computeTableChecksum,
  createBackupStorageKey,
  decryptBackupArchive,
  deriveBackupKey,
  encryptBackupArchive,
  sanitizeBackupPayloadForRestore,
  shouldIncludeBackupTable,
  type BackupArchivePayload,
} from './backup-archive.js';

const hexKey = 'a'.repeat(64);
const base64Key = Buffer.from('b'.repeat(32)).toString('base64');

const payload: BackupArchivePayload = {
  createdAt: '2026-08-02T00:00:00.000Z',
  format: 'medical-schedule-backup',
  formatVersion: 2,
  tables: {
    users: {
      rowCount: 1,
      rows: [
        {
          cloudbase_uid: 'cloudbase-1',
          id: 'user-1',
          status: 'active',
        },
      ],
      sha256: '',
    },
  },
};

describe('Backup archive format', () => {
  it('derives a 32-byte key from hex or base64 values', () => {
    expect(deriveBackupKey(hexKey)).toHaveLength(32);
    expect(deriveBackupKey(base64Key)).toHaveLength(32);
    expect(() => deriveBackupKey('too-short')).toThrow(/BACKUP_ENCRYPTION_KEY/);
    expect(() => deriveBackupKey('')).toThrow(/BACKUP_ENCRYPTION_KEY/);
  });

  it('encrypts and decrypts an archive with the same key', () => {
    expect(backupFormatVersion).toBe(2);
    const envelope = encryptBackupArchive(payload, deriveBackupKey(hexKey));
    expect(envelope.algorithm).toBe('aes-256-gcm');
    expect(envelope.ciphertext.length).toBeGreaterThan(0);

    const decrypted = decryptBackupArchive(envelope, deriveBackupKey(hexKey));
    expect(decrypted).toEqual(payload);
  });

  it('accepts format-1 archives but permanently excludes raw visitor access rows', () => {
    const legacy: BackupArchivePayload = {
      ...payload,
      formatVersion: 1,
      tables: {
        ...payload.tables,
        visitor_access_logs: {
          rowCount: 1,
          rows: [{ client_ip: '203.0.113.7', request_id: 'request-1' }],
          sha256: 'legacy-raw',
        },
      },
    };
    const envelope = encryptBackupArchive(legacy, deriveBackupKey(hexKey));
    expect(decryptBackupArchive(envelope, deriveBackupKey(hexKey))).toEqual(legacy);
    expect(sanitizeBackupPayloadForRestore(legacy).tables).not.toHaveProperty(
      'visitor_access_logs',
    );
    expect(shouldIncludeBackupTable('visitor_access_logs')).toBe(false);
    expect(shouldIncludeBackupTable('miniprogram_telemetry_events')).toBe(false);
    expect(shouldIncludeBackupTable('visitor_access_monthly_aggregates')).toBe(true);
  });

  it('fails closed on a wrong key or tampered ciphertext', () => {
    const envelope = encryptBackupArchive(payload, deriveBackupKey(hexKey));
    expect(() => decryptBackupArchive(envelope, deriveBackupKey(base64Key))).toThrow();

    const tampered = { ...envelope, tag: Buffer.alloc(16).toString('base64') };
    expect(() => decryptBackupArchive(tampered, deriveBackupKey(hexKey))).toThrow();
  });

  it('computes checksums independent of JSON key order', () => {
    const first = computeTableChecksum([{ b: 1, a: 2 }]);
    const second = computeTableChecksum([{ a: 2, b: 1 }]);
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    expect(computeFileSha256(Buffer.from('content'))).toHaveLength(64);
  });

  it('builds deterministic storage keys per backup kind', () => {
    const now = new Date('2026-08-02T00:00:00.000Z');
    expect(createBackupStorageKey(now, 'daily')).toBe(
      'backups/daily/2026-08-02T00-00-00.000Z.backup',
    );
    expect(createBackupStorageKey(now, 'monthly')).toContain('backups/monthly/');
  });
});
