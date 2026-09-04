import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { iconCatalog } from './catalog.js';
import type { IconNode } from './types.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const webRequire = createRequire(resolve(repositoryRoot, 'apps/web/package.json'));

function uniquePaths(nodes: readonly IconNode[]) {
  return [...new Set(nodes.flatMap((node) => (node.kind === 'path' ? [node.d] : [])))].sort();
}

describe('canonical icon catalog provenance', () => {
  it('keeps the search geometry complete and aligned with the pinned TDesign source', () => {
    const packageJsonPath = webRequire.resolve('tdesign-icons-vue-next/package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string };
    expect(packageJson.version).toBe('0.4.7');

    const searchModulePath = resolve(dirname(packageJsonPath), 'esm/components/search.js');
    const upstreamSource = readFileSync(searchModulePath, 'utf8');
    const upstreamPaths = [...upstreamSource.matchAll(/"d":\s*"([^"]+)"/g)].map(
      (match) => match[1],
    );
    const canonicalPaths = uniquePaths(iconCatalog.search.nodes);

    expect(canonicalPaths).toEqual([...new Set(upstreamPaths)].sort());
    expect(canonicalPaths).toContain(
      'M15.8033 15.8033C12.8744 18.7322 8.12563 18.7322 5.1967 15.8033C2.26777 12.8744 2.26777 8.12563 5.1967 5.1967C8.12563 2.26777 12.8744 2.26777 15.8033 5.1967C18.7322 8.12563 18.7322 12.8744 15.8033 15.8033Z',
    );
    expect(canonicalPaths).toContain('M15.8027 15.8037L21.106 21.107');
  });
});
