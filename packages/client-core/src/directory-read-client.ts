import type {
  DirectoryEntryLookupResponse,
  DirectoryFacetSnapshot,
  DirectoryKind,
  DirectoryPage,
  DirectoryQuery,
} from '@schedule/contracts';

import {
  directoryEntryLookupResponseJsonSchema,
  directoryFacetSnapshotJsonSchema,
  directoryPageJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';

interface DirectoryGroupInput {
  readonly directoryKind: DirectoryKind;
  readonly groupId: string;
}

interface DirectoryListInput extends DirectoryGroupInput {
  readonly query: DirectoryQuery;
}

interface DirectoryLookupInput extends DirectoryGroupInput {
  readonly entryIds: readonly string[];
}

export const directoryPageDecoder = createCompactDecoder<DirectoryPage>(directoryPageJsonSchema);
export const directoryFacetSnapshotDecoder = createCompactDecoder<DirectoryFacetSnapshot>(
  directoryFacetSnapshotJsonSchema,
);
export const directoryEntryLookupResponseDecoder =
  createCompactDecoder<DirectoryEntryLookupResponse>(directoryEntryLookupResponseJsonSchema);

export const directoryReadEndpoints = {
  facets: defineClientEndpoint<DirectoryGroupInput, DirectoryFacetSnapshot>({
    auth: 'bearer',
    decoder: directoryFacetSnapshotDecoder,
    id: 'organization.directory-facets',
    method: 'GET',
    path: ({ directoryKind, groupId }) => `${directoryPath(directoryKind, groupId)}/facets`,
  }),
  list: defineClientEndpoint<DirectoryListInput, DirectoryPage>({
    auth: 'bearer',
    decoder: directoryPageDecoder,
    id: 'organization.directory-list',
    method: 'GET',
    path: ({ directoryKind, groupId, query }) =>
      appendQuery(directoryPath(directoryKind, groupId), [
        ['building', query.building],
        ['campusCode', query.campusCode],
        ['cursor', query.cursor],
        ['department', query.department],
        ['entryKind', query.entryKind],
        ['floor', query.floor],
        ['pageSize', query.pageSize === undefined ? undefined : String(query.pageSize)],
        ['q', query.q],
        ['section', query.section],
        ['subunit', query.subunit],
      ]),
  }),
  lookup: defineClientEndpoint<DirectoryLookupInput, DirectoryEntryLookupResponse>({
    auth: 'bearer',
    body: ({ entryIds }) => ({ entryIds }),
    decoder: directoryEntryLookupResponseDecoder,
    id: 'organization.directory-lookup',
    method: 'POST',
    path: ({ directoryKind, groupId }) => `${directoryPath(directoryKind, groupId)}/lookup`,
  }),
} as const;

export interface DirectoryReadClient {
  getFacets(groupId: string, directoryKind: DirectoryKind): Promise<DirectoryFacetSnapshot>;
  list(
    groupId: string,
    directoryKind: DirectoryKind,
    query?: DirectoryQuery,
  ): Promise<DirectoryPage>;
  lookup(
    groupId: string,
    directoryKind: DirectoryKind,
    entryIds: readonly string[],
  ): Promise<DirectoryEntryLookupResponse>;
}

export function createDirectoryReadClient(transport: ClientTransport): DirectoryReadClient {
  return {
    getFacets(groupId, directoryKind) {
      return transport.request(directoryReadEndpoints.facets, { directoryKind, groupId });
    },
    list(groupId, directoryKind, query = {}) {
      return transport.request(directoryReadEndpoints.list, { directoryKind, groupId, query });
    },
    lookup(groupId, directoryKind, entryIds) {
      return transport.request(directoryReadEndpoints.lookup, { directoryKind, entryIds, groupId });
    },
  };
}

function directoryPath(directoryKind: DirectoryKind, groupId: string): string {
  const root = directoryKind === 'employee' ? 'employee-directory' : 'directory';
  return `/groups/${encodeURIComponent(groupId)}/${root}`;
}

function appendQuery(
  path: string,
  entries: readonly (readonly [string, string | undefined])[],
): string {
  const query = entries
    .filter((entry): entry is readonly [string, string] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  return query.length === 0 ? path : `${path}?${query.join('&')}`;
}
