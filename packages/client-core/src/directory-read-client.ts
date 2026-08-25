import type {
  DirectoryEntry,
  DirectoryFacetSnapshot,
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
  readonly groupId: string;
}

interface DirectorySearchInput extends DirectoryGroupInput {
  readonly query: DirectoryQuery;
}

interface DirectoryLookupInput extends DirectoryGroupInput {
  readonly entryIds: readonly string[];
}

export const directoryPageDecoder = createCompactDecoder<DirectoryPage>(directoryPageJsonSchema);
export const directoryFacetSnapshotDecoder = createCompactDecoder<DirectoryFacetSnapshot>(
  directoryFacetSnapshotJsonSchema,
);
export const directoryEntryLookupResponseDecoder = createCompactDecoder<{
  readonly entries: readonly DirectoryEntry[];
}>(directoryEntryLookupResponseJsonSchema);

export const directoryReadEndpoints = {
  internalFacets: defineClientEndpoint<DirectoryGroupInput, DirectoryFacetSnapshot>({
    auth: 'bearer',
    decoder: directoryFacetSnapshotDecoder,
    id: 'directory.internal-facets',
    method: 'GET',
    path: ({ groupId }) => `${groupPath(groupId)}/directory/facets`,
  }),
  internalSearch: defineClientEndpoint<DirectorySearchInput, DirectoryPage>({
    auth: 'bearer',
    decoder: directoryPageDecoder,
    id: 'directory.internal-search',
    method: 'GET',
    path: ({ groupId, query }) => `${groupPath(groupId)}/directory${queryPath(query)}`,
  }),
  internalLookup: defineClientEndpoint<
    DirectoryLookupInput,
    { readonly entries: readonly DirectoryEntry[] }
  >({
    auth: 'bearer',
    body: ({ entryIds }) => ({ entryIds }),
    decoder: directoryEntryLookupResponseDecoder,
    id: 'directory.internal-lookup',
    method: 'POST',
    path: ({ groupId }) => `${groupPath(groupId)}/directory/lookup`,
  }),
  employeeFacets: defineClientEndpoint<DirectoryGroupInput, DirectoryFacetSnapshot>({
    auth: 'bearer',
    decoder: directoryFacetSnapshotDecoder,
    id: 'directory.employee-facets',
    method: 'GET',
    path: ({ groupId }) => `${groupPath(groupId)}/employee-directory/facets`,
  }),
  employeeSearch: defineClientEndpoint<DirectorySearchInput, DirectoryPage>({
    auth: 'bearer',
    decoder: directoryPageDecoder,
    id: 'directory.employee-search',
    method: 'GET',
    path: ({ groupId, query }) => `${groupPath(groupId)}/employee-directory${queryPath(query)}`,
  }),
  employeeLookup: defineClientEndpoint<
    DirectoryLookupInput,
    { readonly entries: readonly DirectoryEntry[] }
  >({
    auth: 'bearer',
    body: ({ entryIds }) => ({ entryIds }),
    decoder: directoryEntryLookupResponseDecoder,
    id: 'directory.employee-lookup',
    method: 'POST',
    path: ({ groupId }) => `${groupPath(groupId)}/employee-directory/lookup`,
  }),
} as const;

export interface DirectoryReadClient {
  getInternalFacets(groupId: string): Promise<DirectoryFacetSnapshot>;
  getEmployeeFacets(groupId: string): Promise<DirectoryFacetSnapshot>;
  searchInternal(groupId: string, query: DirectoryQuery): Promise<DirectoryPage>;
  searchEmployee(groupId: string, query: DirectoryQuery): Promise<DirectoryPage>;
  lookupInternal(groupId: string, entryIds: readonly string[]): Promise<readonly DirectoryEntry[]>;
  lookupEmployee(groupId: string, entryIds: readonly string[]): Promise<readonly DirectoryEntry[]>;
}

export function createDirectoryReadClient(transport: ClientTransport): DirectoryReadClient {
  return {
    getInternalFacets(groupId) {
      return transport.request(directoryReadEndpoints.internalFacets, { groupId });
    },
    getEmployeeFacets(groupId) {
      return transport.request(directoryReadEndpoints.employeeFacets, { groupId });
    },
    searchInternal(groupId, query) {
      return transport.request(directoryReadEndpoints.internalSearch, { groupId, query });
    },
    searchEmployee(groupId, query) {
      return transport.request(directoryReadEndpoints.employeeSearch, { groupId, query });
    },
    lookupInternal(groupId, entryIds) {
      return transport
        .request(directoryReadEndpoints.internalLookup, { entryIds, groupId })
        .then((response) => response.entries);
    },
    lookupEmployee(groupId, entryIds) {
      return transport
        .request(directoryReadEndpoints.employeeLookup, { entryIds, groupId })
        .then((response) => response.entries);
    },
  };
}

const directoryQueryKeys: readonly (keyof DirectoryQuery)[] = [
  'building',
  'campusCode',
  'cursor',
  'department',
  'entryKind',
  'floor',
  'pageSize',
  'q',
  'section',
  'subunit',
];

function queryPath(query: DirectoryQuery): string {
  const parts = directoryQueryKeys.flatMap((key) => {
    const value = query[key];
    return value === undefined
      ? []
      : [`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`];
  });
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

function groupPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}`;
}
