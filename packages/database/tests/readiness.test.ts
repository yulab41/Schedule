import { afterEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({
  connection: { query: vi.fn(), destroy: vi.fn(), release: vi.fn() },
  getConnection: vi.fn(),
  on: vi.fn(),
  promise: vi.fn(() => ({ end: vi.fn() })),
}));
vi.mock('mysql2', () => ({ createPool: () => fake }));
import { createDatabaseClient } from '../src/client.js';
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
it('bounds a probe queued behind a stalled session initialization', async () => {
  vi.useFakeTimers();
  fake.getConnection.mockImplementation((callback) => callback(null, fake.connection));
  const client = createDatabaseClient({
    host: '127.0.0.1',
    port: 3318,
    database: 'schedule_test',
    user: 'synthetic',
    password: 'synthetic',
  });
  const probe = client.checkReadiness!();
  const rejected = expect(probe).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(2000);
  await rejected;
  expect(fake.connection.destroy).toHaveBeenCalledOnce();
  const callback = fake.connection.query.mock.calls[0]![1] as (error: Error | null) => void;
  callback(null);
  expect(fake.connection.release).not.toHaveBeenCalled();
});
it('does not keep adding pool waiters after acquisition timeout and releases a late connection', async () => {
  vi.useFakeTimers();
  fake.getConnection.mockImplementation(() => {});
  const client = createDatabaseClient({
    host: '127.0.0.1',
    port: 3318,
    database: 'schedule_test',
    user: 'synthetic',
    password: 'synthetic',
  });
  const rejected = expect(client.checkReadiness!()).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(2000);
  await rejected;
  await expect(client.checkReadiness!()).rejects.toThrow('timed out');
  expect(fake.getConnection).toHaveBeenCalledOnce();
  const callback = fake.getConnection.mock.calls[0]![0] as (
    error: null,
    connection: typeof fake.connection,
  ) => void;
  callback(null, fake.connection);
  expect(fake.connection.release).toHaveBeenCalledOnce();
  expect(fake.connection.query).not.toHaveBeenCalled();
});
