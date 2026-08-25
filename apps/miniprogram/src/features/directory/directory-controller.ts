import type { DirectoryFacetSnapshot, DirectoryPage, DirectoryQuery } from '@schedule/contracts';
import type { DirectoryReadClient } from '@schedule/client-core';

export type DirectoryMode = 'employee' | 'internal';
export type DirectoryLoadState = 'error' | 'loading' | 'ready';

export interface DirectoryControllerState {
  readonly activeQuery: DirectoryQuery | undefined;
  readonly entries: DirectoryPage['entries'];
  readonly errorMessage: string;
  readonly facets: DirectoryFacetSnapshot | undefined;
  readonly isLoadingMore: boolean;
  readonly mode: DirectoryMode;
  readonly nextCursor: string | undefined;
  readonly state: DirectoryLoadState;
  readonly totalCount: number;
}

export interface DirectoryController {
  getState(): DirectoryControllerState;
  load(mode?: DirectoryMode): Promise<void>;
  loadMore(): Promise<void>;
  retry(): Promise<void>;
  search(query: DirectoryQuery): Promise<void>;
  setMode(mode: DirectoryMode): Promise<void>;
}

const GENERIC_ERROR_MESSAGE = '通讯录暂时无法加载，请稍后重试。';

export function createDirectoryController(
  client: DirectoryReadClient,
  groupId: string,
): DirectoryController {
  let state: DirectoryControllerState = {
    activeQuery: undefined,
    entries: [],
    errorMessage: '',
    facets: undefined,
    isLoadingMore: false,
    mode: 'internal',
    nextCursor: undefined,
    state: 'loading',
    totalCount: 0,
  };
  let requestSerial = 0;

  const getState = (): DirectoryControllerState => state;

  const load = async (mode = state.mode): Promise<void> => {
    const serial = ++requestSerial;
    state = {
      activeQuery: undefined,
      entries: [],
      errorMessage: '',
      facets: undefined,
      isLoadingMore: false,
      mode,
      nextCursor: undefined,
      state: 'loading',
      totalCount: 0,
    };
    try {
      const facets =
        mode === 'internal'
          ? await client.getInternalFacets(groupId)
          : await client.getEmployeeFacets(groupId);
      if (serial !== requestSerial) return;
      state = { ...state, errorMessage: '', facets, state: 'ready' };
    } catch {
      if (serial !== requestSerial) return;
      state = { ...state, errorMessage: GENERIC_ERROR_MESSAGE, state: 'error' };
    }
  };

  const search = async (query: DirectoryQuery): Promise<void> => {
    const serial = ++requestSerial;
    state = {
      ...state,
      activeQuery: query,
      entries: [],
      errorMessage: '',
      isLoadingMore: false,
      nextCursor: undefined,
      state: 'loading',
      totalCount: 0,
    };
    try {
      const page = await searchForMode(client, state.mode, groupId, query);
      if (serial !== requestSerial) return;
      state = applyPage(state, page, false);
    } catch {
      if (serial !== requestSerial) return;
      state = { ...state, errorMessage: GENERIC_ERROR_MESSAGE, state: 'error' };
    }
  };

  const loadMore = async (): Promise<void> => {
    if (state.isLoadingMore || state.nextCursor === undefined || state.activeQuery === undefined) {
      return;
    }
    const serial = ++requestSerial;
    const query: DirectoryQuery = { ...state.activeQuery, cursor: state.nextCursor };
    state = { ...state, errorMessage: '', isLoadingMore: true };
    try {
      const page = await searchForMode(client, state.mode, groupId, query);
      if (serial !== requestSerial) return;
      state = applyPage({ ...state, isLoadingMore: false }, page, true);
    } catch {
      if (serial !== requestSerial) return;
      state = { ...state, errorMessage: GENERIC_ERROR_MESSAGE, isLoadingMore: false };
    }
  };

  const retry = async (): Promise<void> => {
    if (state.activeQuery === undefined) await load(state.mode);
    else await search(state.activeQuery);
  };

  return {
    getState,
    load,
    loadMore,
    retry,
    search,
    setMode: (mode) => load(mode),
  };
}

function applyPage(
  previous: DirectoryControllerState,
  page: DirectoryPage,
  append: boolean,
): DirectoryControllerState {
  return {
    ...previous,
    entries: append ? [...previous.entries, ...page.entries] : page.entries,
    errorMessage: '',
    isLoadingMore: false,
    nextCursor: page.nextCursor,
    state: 'ready',
    totalCount: page.totalCount,
  };
}

function searchForMode(
  client: DirectoryReadClient,
  mode: DirectoryMode,
  groupId: string,
  query: DirectoryQuery,
): Promise<DirectoryPage> {
  return mode === 'internal'
    ? client.searchInternal(groupId, query)
    : client.searchEmployee(groupId, query);
}
