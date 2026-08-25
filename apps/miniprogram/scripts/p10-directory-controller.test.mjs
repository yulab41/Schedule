import { describe, expect, it, vi } from 'vitest';

const { createDirectoryController } =
  await import('../src/features/directory/directory-controller.ts');

const facets = {
  buildings: [],
  campuses: [{ count: 1, label: '本部院区', value: 'main' }],
  departments: [],
  entryKinds: [],
  floors: [],
  paths: [],
  publishedEffectiveOn: '2026-08-19',
  publishedImportVersion: 'p10-v1',
  sections: [],
  subunits: [],
  totalCount: 1,
};

const entry = {
  campus: { code: 'main', name: '本部院区' },
  contacts: [],
  displayOrder: 1,
  entryKind: 'department',
  id: '31000000-0000-4000-8000-000000000001',
};

function page(entries, nextCursor, totalCount = entries.length) {
  return { entries, ...(nextCursor === undefined ? {} : { nextCursor }), totalCount };
}

function createClient(overrides = {}) {
  return {
    getEmployeeFacets: vi.fn(async () => facets),
    getInternalFacets: vi.fn(async () => facets),
    lookupEmployee: vi.fn(async () => []),
    lookupInternal: vi.fn(async () => []),
    searchEmployee: vi.fn(async () => page([])),
    searchInternal: vi.fn(async () => page([])),
    ...overrides,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('P10 directory controller', () => {
  it('loads facets without loading all entries in idle state', async () => {
    const client = createClient();
    const controller = createDirectoryController(client, 'group-1');

    await controller.load();

    expect(controller.getState()).toMatchObject({
      state: 'ready',
      mode: 'internal',
      totalCount: 0,
    });
    expect(controller.getState().facets).toBe(facets);
    expect(client.searchInternal).not.toHaveBeenCalled();
  });

  it('replaces searches, appends cursor pages, and preserves server result order', async () => {
    const client = createClient({
      searchInternal: vi
        .fn()
        .mockResolvedValueOnce(page([entry], 'cursor-2', 2))
        .mockResolvedValueOnce(
          page([{ ...entry, id: '31000000-0000-4000-8000-000000000002' }], undefined, 2),
        ),
    });
    const controller = createDirectoryController(client, 'group-1');

    await controller.load();
    await controller.search({ pageSize: 30, q: '病案' });
    expect(controller.getState().entries).toEqual([entry]);
    expect(controller.getState().nextCursor).toBe('cursor-2');

    await controller.loadMore();
    expect(controller.getState().entries.map(({ id }) => id)).toEqual([
      entry.id,
      '31000000-0000-4000-8000-000000000002',
    ]);
    expect(client.searchInternal).toHaveBeenNthCalledWith(2, 'group-1', {
      cursor: 'cursor-2',
      pageSize: 30,
      q: '病案',
    });
  });

  it('drops stale mode responses and keeps the newest mode', async () => {
    const first = deferred();
    const second = deferred();
    const client = createClient({
      getInternalFacets: vi.fn(() => first.promise),
      getEmployeeFacets: vi.fn(() => second.promise),
    });
    const controller = createDirectoryController(client, 'group-1');
    const firstLoad = controller.load('internal');
    const secondLoad = controller.setMode('employee');

    second.resolve({ ...facets, publishedImportVersion: 'employee-v1' });
    await secondLoad;
    first.resolve({ ...facets, publishedImportVersion: 'internal-v1' });
    await firstLoad;

    expect(controller.getState()).toMatchObject({ mode: 'employee', state: 'ready' });
    expect(controller.getState().facets?.publishedImportVersion).toBe('employee-v1');
  });

  it('fails closed with a retryable error and retries the active query', async () => {
    const client = createClient({
      searchInternal: vi
        .fn()
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce(page([entry])),
    });
    const controller = createDirectoryController(client, 'group-1');

    await controller.load();
    await controller.search({ pageSize: 30, q: '病案' });
    expect(controller.getState()).toMatchObject({
      state: 'error',
      errorMessage: '通讯录暂时无法加载，请稍后重试。',
    });

    await controller.retry();
    expect(controller.getState()).toMatchObject({ state: 'ready', totalCount: 1 });
    expect(client.searchInternal).toHaveBeenCalledTimes(2);
  });
});
