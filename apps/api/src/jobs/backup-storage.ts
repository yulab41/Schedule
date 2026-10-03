import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

export interface BackupStorage {
  delete(key: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  write(key: string, content: Buffer): Promise<void>;
  writeStream?(key: string, content: AsyncIterable<Uint8Array>): Promise<void>;
  readStream?(key: string): AsyncIterable<Uint8Array>;
}

export class LocalBackupStorage implements BackupStorage {
  public constructor(private readonly rootDirectory: string) {}

  public async writeStream(key: string, content: AsyncIterable<Uint8Array>): Promise<void> {
    const target = this.resolve(key);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await pipeline(
        Readable.from(content),
        createWriteStream(temporary, { flags: 'wx', mode: 0o600, flush: true }),
      );
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch((cleanup) => {
        if (!isMissingFileError(cleanup)) throw cleanup;
      });
      throw error;
    }
  }
  public readStream(key: string): AsyncIterable<Uint8Array> {
    return createReadStream(this.resolve(key));
  }

  public async write(key: string, content: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.tmp`;
    await writeFile(temporary, content);
    await rename(temporary, target);
  }

  public async read(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  public async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }

  private resolve(key: string): string {
    const root = resolve(this.rootDirectory);
    const target = resolve(root, key);
    if (target !== root && !target.startsWith(`${root}${sep}`)) {
      throw new Error('The backup storage key escapes the backup directory.');
    }
    return target;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
