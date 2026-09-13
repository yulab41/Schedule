declare module 'archiver' {
  import type { Readable } from 'node:stream';
  interface Archive extends Readable {
    append(source: string | Buffer, options: { name: string }): this;
    finalize(): Promise<void>;
    pipe<T extends NodeJS.WritableStream>(destination: T): T;
  }
  export default function archiver(format: 'zip', options?: { zlib?: { level: number } }): Archive;
}
