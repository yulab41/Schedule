import {
  directoryEntryLookupResponseSchema,
  directoryFacetSnapshotSchema,
  directoryPageSchema,
} from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { ClientTransport } from './endpoint.js';
import {
  createDirectoryReadClient,
  directoryEntryLookupResponseDecoder,
  directoryFacetSnapshotDecoder,
  directoryPageDecoder,
  directoryReadEndpoints,
} from './directory-read-client.js';
import { directoryReadApiGoldenResponse as golden } from './testing/directory-read-api-golden.js';

describe('P10 directory shared read boundary', () => {
  it('keeps bearer methods, paths, query ordering, and lookup bodies exact', () => {
    const groupId = 'group /一';
    expect(directoryReadEndpoints.internalFacets.path({ groupId })).toBe(
      '/groups/group%20%2F%E4%B8%80/directory/facets',
    );
    expect(
      directoryReadEndpoints.internalSearch.path({
        groupId,
        query: { floor: '5楼', pageSize: 30, q: '病案' },
      }),
    ).toBe(
      '/groups/group%20%2F%E4%B8%80/directory?floor=5%E6%A5%BC&pageSize=30&q=%E7%97%85%E6%A1%88',
    );
    expect(directoryReadEndpoints.employeeFacets.path({ groupId })).toBe(
      '/groups/group%20%2F%E4%B8%80/employee-directory/facets',
    );
    expect(directoryReadEndpoints.employeeSearch.path({ groupId, query: { q: 'jzk' } })).toBe(
      '/groups/group%20%2F%E4%B8%80/employee-directory?q=jzk',
    );
    expect(directoryReadEndpoints.internalLookup.path({ groupId, entryIds: ['entry-1'] })).toBe(
      '/groups/group%20%2F%E4%B8%80/directory/lookup',
    );
    expect(
      directoryReadEndpoints.internalLookup.body?.({ entryIds: ['entry-1'], groupId }),
    ).toEqual({
      entryIds: ['entry-1'],
    });
    expect(
      Object.values(directoryReadEndpoints).every((endpoint) => endpoint.auth === 'bearer'),
    ).toBe(true);
    expect(
      Object.values(directoryReadEndpoints)
        .filter((endpoint) => endpoint.id.includes('lookup'))
        .every((endpoint) => endpoint.method === 'POST'),
    ).toBe(true);
  });

  it('matches Web Zod for valid payloads and preserves response identity', () => {
    const fixtures = [
      [directoryFacetSnapshotSchema, directoryFacetSnapshotDecoder, golden.facets],
      [directoryPageSchema, directoryPageDecoder, golden.page],
      [
        directoryEntryLookupResponseSchema,
        directoryEntryLookupResponseDecoder,
        { entries: golden.page.entries },
      ],
    ] as const;

    for (const [schema, decoder, value] of fixtures) {
      const zodResult = schema.safeParse(value);
      const compactResult = decoder.safeDecode(value);
      expect(zodResult.success).toBe(true);
      expect(compactResult.success).toBe(true);
      if (zodResult.success && compactResult.success) {
        expect(compactResult.data).toEqual(zodResult.data);
        expect(compactResult.data).toBe(value);
      }
    }
  });

  it('rejects strict malformed payloads in both Web and Mini decoders', () => {
    const malformedPage = { ...golden.page, unexpected: true };
    const malformedFacet = { ...golden.facets, totalCount: -1 };
    const malformedLookup = { entries: [{ ...golden.page.entries[0], entryKind: 'unknown' }] };

    expect(directoryPageSchema.safeParse(malformedPage).success).toBe(false);
    expect(directoryPageDecoder.safeDecode(malformedPage).success).toBe(false);
    expect(directoryFacetSnapshotSchema.safeParse(malformedFacet).success).toBe(false);
    expect(directoryFacetSnapshotDecoder.safeDecode(malformedFacet).success).toBe(false);
    expect(directoryEntryLookupResponseSchema.safeParse(malformedLookup).success).toBe(false);
    expect(directoryEntryLookupResponseDecoder.safeDecode(malformedLookup).success).toBe(false);
  });

  it('uses the transport receiver once per read and unwraps lookup entries only', async () => {
    const request = vi.fn(async (endpoint: { readonly id: string }) => {
      switch (endpoint.id) {
        case 'directory.internal-facets':
          return golden.facets;
        case 'directory.internal-search':
          return golden.page;
        case 'directory.internal-lookup':
          return { entries: golden.page.entries };
        default:
          throw new Error(`unexpected endpoint ${endpoint.id}`);
      }
    });
    const transport = { request } as unknown as ClientTransport;
    const client = createDirectoryReadClient(transport);

    await expect(client.getInternalFacets('group-1')).resolves.toBe(golden.facets);
    await expect(client.searchInternal('group-1', { q: '病案' })).resolves.toBe(golden.page);
    await expect(client.lookupInternal('group-1', ['entry-1'])).resolves.toBe(golden.page.entries);
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.contexts).toEqual([transport, transport, transport]);
  });
});
