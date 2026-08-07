import type { DatabaseClient } from '@schedule/database';
import { sql } from 'drizzle-orm';

export async function resetDatabase(databaseClient: DatabaseClient): Promise<void> {
  await databaseClient.database.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  const [tables] = (await databaseClient.database.execute(
    sql`SELECT TABLE_NAME AS t FROM information_schema.tables WHERE table_schema = DATABASE()`,
  )) as unknown as [{ t: string }[], unknown];
  for (const row of tables) {
    await databaseClient.database.execute(
      sql.raw(`DROP TABLE IF EXISTS \`${row.t.replaceAll('`', '``')}\``),
    );
  }
  await databaseClient.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
