import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P10 directory shared boundary', () => {
  it('connects the Mini runtime to the organization-gated directory client', () => {
    const runtime = read('src/platform/client-core-calendar.ts');
    const client = read('../../packages/client-core/src/directory-read-client.ts');

    expect(runtime).toContain('createRuntimeDirectoryReadClient');
    expect(runtime).toContain("'organization'");
    expect(client).toContain('organization.directory-facets');
    expect(client).toContain('}/facets');
    expect(client).toContain('employee-directory');
  });

  it('keeps directory reads bearer-only and avoids local persistence', () => {
    const client = read('../../packages/client-core/src/directory-read-client.ts');
    expect(client).toContain("auth: 'bearer'");
    expect(client).toContain('directoryPageDecoder');
    expect(client).toContain('directoryFacetSnapshotDecoder');
    expect(client).not.toContain('wx.setStorageSync');
    expect(client).not.toContain('visitorKey');
  });

  it('keeps pagination, independent filters and employee mode explicit', () => {
    const client = read('../../packages/client-core/src/directory-read-client.ts');
    expect(client).toContain("['cursor', query.cursor]");
    expect(client).toContain("['entryKind', query.entryKind]");
    expect(client).toContain("directoryKind === 'employee'");
    expect(client).toContain('encodeURIComponent(value)');
  });
});
