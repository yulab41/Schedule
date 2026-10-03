import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

export const streamBackupMagic = Buffer.from('SCHEDULE-BACKUP-STREAM-3\n');
export const maximumBackupFrameBytes = 64 * 1024 * 1024;
export type BackupFrame =
  | { kind: 'archive'; createdAt: string }
  | {
      kind: 'table';
      name: string;
      primaryKey: readonly string[];
      binaryColumns: readonly string[];
      columns: readonly string[];
    }
  | { kind: 'rows'; rows: readonly Record<string, unknown>[] }
  | { kind: 'table-end'; rowCount: number; sha256: string }
  | { kind: 'end'; tableCount: number; rowCount: number };

export async function* encryptBackupFrames(
  frames: AsyncIterable<BackupFrame>,
  key: Buffer,
): AsyncGenerator<Buffer> {
  const header = Buffer.from(
    JSON.stringify({
      version: 3,
      algorithm: 'aes-256-gcm-frames',
      salt: randomBytes(32).toString('base64'),
    }),
  );
  const size = Buffer.alloc(4);
  size.writeUInt32BE(header.length);
  const frameKey = Buffer.from(
    hkdfSync(
      'sha256',
      key,
      Buffer.from(JSON.parse(header.toString()).salt, 'base64'),
      'schedule-backup-v3',
      32,
    ),
  );
  yield Buffer.concat([streamBackupMagic, size, header]);
  let sequence = 0n;
  for await (const frame of frames) {
    const plain = Buffer.from(JSON.stringify(frame));
    if (plain.length > maximumBackupFrameBytes)
      throw new Error('Backup row exceeds the 64 MiB frame limit');
    const iv = Buffer.alloc(12);
    iv.writeBigUInt64BE(sequence, 4);
    const cipher = createCipheriv('aes-256-gcm', frameKey, iv);
    cipher.setAAD(Buffer.concat([header, iv]));
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(encrypted.length);
    yield Buffer.concat([length, encrypted, cipher.getAuthTag()]);
    sequence++;
  }
}

export async function* decryptBackupFrames(
  source: AsyncIterable<Uint8Array>,
  key: Buffer,
): AsyncGenerator<BackupFrame> {
  const reader = new BackupByteReader(source);
  try {
    if (!(await reader.read(streamBackupMagic.length))?.equals(streamBackupMagic))
      throw new Error('Unsupported stream backup format');
    const headerSize = (await reader.required(4)).readUInt32BE();
    if (headerSize > 4096) throw new Error('Invalid backup header');
    const header = await reader.required(headerSize);
    const parsed = JSON.parse(header.toString()) as {
      version?: unknown;
      algorithm?: unknown;
      salt?: unknown;
    };
    if (
      parsed.version !== 3 ||
      parsed.algorithm !== 'aes-256-gcm-frames' ||
      typeof parsed.salt !== 'string' ||
      Buffer.from(parsed.salt, 'base64').length !== 32
    )
      throw new Error('Invalid backup header');
    const frameKey = Buffer.from(
      hkdfSync('sha256', key, Buffer.from(parsed.salt, 'base64'), 'schedule-backup-v3', 32),
    );
    let sequence = 0n,
      ended = false;
    for (;;) {
      const length = await reader.read(4);
      if (!length) break;
      if (ended) throw new Error('Trailing backup data');
      const size = length.readUInt32BE();
      if (size < 2 || size > maximumBackupFrameBytes) throw new Error('Invalid backup frame size');
      const encrypted = await reader.required(size),
        tag = await reader.required(16);
      const iv = Buffer.alloc(12);
      iv.writeBigUInt64BE(sequence, 4);
      const cipher = createDecipheriv('aes-256-gcm', frameKey, iv);
      cipher.setAAD(Buffer.concat([header, iv]));
      cipher.setAuthTag(tag);
      const frame = JSON.parse(
        Buffer.concat([cipher.update(encrypted), cipher.final()]).toString(),
      ) as BackupFrame;
      if (!frame || !['archive', 'table', 'rows', 'table-end', 'end'].includes(frame.kind))
        throw new Error('Invalid backup frame kind');
      if (sequence === 0n && frame.kind !== 'archive')
        throw new Error('Missing authenticated archive header');
      if (sequence > 0n && frame.kind === 'archive') throw new Error('Duplicate archive header');
      ended = frame.kind === 'end';
      sequence++;
      yield frame;
    }
    if (!ended) throw new Error('Truncated backup: missing authenticated end frame');
  } finally {
    await reader.close();
  }
}

class BackupByteReader {
  private readonly iterator: AsyncIterator<Uint8Array>;
  private pending: Buffer = Buffer.alloc(0);
  private offset = 0;
  public constructor(source: AsyncIterable<Uint8Array>) {
    this.iterator = source[Symbol.asyncIterator]();
  }
  public async close(): Promise<void> {
    await this.iterator.return?.();
  }
  public async required(size: number): Promise<Buffer> {
    const result = await this.read(size);
    if (!result) throw new Error('Truncated backup');
    return result;
  }
  public async read(size: number): Promise<Buffer | undefined> {
    const result = Buffer.allocUnsafe(size);
    let copied = 0;
    while (copied < size) {
      if (this.offset === this.pending.length) {
        const next = await this.iterator.next();
        if (next.done) {
          if (!copied) return undefined;
          throw new Error('Truncated backup');
        }
        this.pending = Buffer.from(next.value.buffer, next.value.byteOffset, next.value.byteLength);
        this.offset = 0;
        if (!this.pending.length) continue;
      }
      const count = Math.min(size - copied, this.pending.length - this.offset);
      this.pending.copy(result, copied, this.offset, this.offset + count);
      this.offset += count;
      copied += count;
    }
    return result;
  }
}
