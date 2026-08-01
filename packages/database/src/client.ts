import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { createPool } from 'mysql2/promise';

import * as schema from './schema/index.js';

export interface DatabaseConnectionOptions {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly connectionLimit?: number;
}

export type ScheduleDatabase = MySql2Database<typeof schema>;

export interface DatabaseClient {
  readonly database: ScheduleDatabase;
  close(): Promise<void>;
}

export function createDatabaseClient(options: DatabaseConnectionOptions): DatabaseClient {
  const pool = createPool({
    host: options.host,
    port: options.port,
    database: options.database,
    user: options.user,
    password: options.password,
    waitForConnections: true,
    connectionLimit: options.connectionLimit ?? 10,
    queueLimit: 0,
    enableKeepAlive: true,
    timezone: 'Z',
  });
  pool.pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+00:00'", (error) => {
      if (error !== null) {
        connection.destroy();
      }
    });
  });

  return {
    database: drizzle(pool, { schema, mode: 'default' }),
    close: async () => pool.end(),
  };
}

export function createTestDatabaseClient(options: DatabaseConnectionOptions): DatabaseClient {
  return createDatabaseClient({
    ...options,
    connectionLimit: 1,
  });
}
