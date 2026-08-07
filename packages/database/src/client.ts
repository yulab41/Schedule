import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { createPool } from 'mysql2';

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
  // MySQL 服务器会话时区默认可能不是 UTC，而 NOW()/CURRENT_TIMESTAMP 必须与应用层统一，
  // 否则时间戳会漂移（本项目曾因此发生数据事故）。mysql2 没有连接初始化选项，
  // 因此挂到公开的 connection 事件：池在连接建立后、交给调用方前同步触发该事件，
  // 此处同步把 SET 命令入队；mysql2 按连接串行执行命令，首个业务查询必在 SET 完成后运行。
  // SET 失败时销毁连接，避免未初始化时区的连接进入池中。
  pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+00:00'", (error) => {
      if (error !== null) {
        connection.destroy();
      }
    });
  });
  const promisePool = pool.promise();

  return {
    database: drizzle(promisePool, { schema, mode: 'default' }),
    close: async () => promisePool.end(),
  };
}

export function createTestDatabaseClient(options: DatabaseConnectionOptions): DatabaseClient {
  return createDatabaseClient({
    ...options,
    connectionLimit: 1,
  });
}
