import { directoryFacetSnapshotSchema, directoryPageSchema } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createDirectoryReadClient,
  directoryFacetSnapshotDecoder,
  directoryPageDecoder,
  directoryReadEndpoints,
} from './directory-read-client.js';
import type { ClientTransport } from './endpoint.js';

const directoryPage = {
  entries: [],
  totalCount: 0,
};
const facets = {
  buildings: [],
  campuses: [],
  departments: [],
  entryKinds: [],
  floors: [],
  paths: [],
  publishedEffectiveOn: '2026-08-01',
  publishedImportVersion: 'directory-2026-08-01',
  sections: [],
  subunits: [],
  totalCount: 0,
};
const lookup = { entries: [] };

describe('P10 directory shared read boundary', () => {
  it('keeps organization routes, encoded paths and independent employee mode', () => {
    expect(
      directoryReadEndpoints.facets.path({ directoryKind: 'internal', groupId: 'group /一' }),
    ).toBe('/groups/group%20%2F%E4%B8%80/directory/facets');
    expect(
      directoryReadEndpoints.facets.path({ directoryKind: 'employee', groupId: 'group-1' }),
    ).toBe('/groups/group-1/employee-directory/facets');
    expect(
      directoryReadEndpoints.list.path({
        directoryKind: 'internal',
        groupId: 'group-1',
        query: { campusCode: 'main', q: '病案', pageSize: 24 },
      }),
    ).toBe('/groups/group-1/directory?campusCode=main&pageSize=24&q=%E7%97%85%E6%A1%88');
    expect(
      Object.values(directoryReadEndpoints).every((endpoint) => endpoint.auth === 'bearer'),
    ).toBe(true);
  });

  it('matches strict Web contracts and rejects malformed payloads', () => {
    expect(directoryPageSchema.safeParse(directoryPage).success).toBe(true);
    expect(directoryPageDecoder.safeDecode(directoryPage).success).toBe(true);
    expect(directoryPageDecoder.safeDecode({ ...directoryPage, extra: true }).success).toBe(false);
    expect(directoryFacetSnapshotSchema.safeParse(facets).success).toBe(true);
    expect(directoryFacetSnapshotDecoder.safeDecode(facets).success).toBe(true);
    expect(directoryFacetSnapshotDecoder.safeDecode({ ...facets, totalCount: -1 }).success).toBe(
      false,
    );
  });

  it('delegates facets, list and lookup without cloning response objects', async () => {
    const request = vi.fn(async (endpoint: { readonly id: string }) => {
      if (endpoint.id.endsWith('facets')) return facets;
      return endpoint.id.endsWith('lookup') ? lookup : directoryPage;
    });
    const client = createDirectoryReadClient({ request } as unknown as ClientTransport);
    await expect(client.getFacets('group-1', 'internal')).resolves.toBe(facets);
    await expect(client.list('group-1', 'employee', { pageSize: 10 })).resolves.toBe(directoryPage);
    await expect(
      client.lookup('group-1', 'internal', ['11111111-1111-4111-8111-111111111111']),
    ).resolves.toBe(lookup);
    expect(request).toHaveBeenCalledTimes(3);
  });
});
