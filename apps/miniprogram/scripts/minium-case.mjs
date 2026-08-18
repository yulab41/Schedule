import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { buildP1MiniumArchive, listStoredZipEntries } from './minium-case-helpers.mjs';

const outputUrl = new URL('../.artifacts/minitest/p1-minium-cases.zip', import.meta.url);
const archive = await buildP1MiniumArchive();
await mkdir(new URL('.', outputUrl), { recursive: true });
await writeFile(outputUrl, archive);

process.stdout.write(
  `${JSON.stringify(
    {
      bytes: archive.length,
      entries: listStoredZipEntries(archive),
      output: fileURLToPath(outputUrl),
      sha256: createHash('sha256').update(archive).digest('hex'),
    },
    null,
    2,
  )}\n`,
);
