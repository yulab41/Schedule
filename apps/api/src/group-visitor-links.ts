import { pathToFileURL } from 'node:url';
import { createDatabaseClient } from '@schedule/database';
import { z } from 'zod';
import { inspectVisitorLink, setVisitorLink } from './modules/groups/visitor-link-operations.js';

export function parseVisitorLinkArguments(args: readonly string[]) {
  const [action, first, second, expectedVersion, operator] = args;
  if (action === 'inspect' && args.length === 3 && first?.trim() && second?.trim()) {
    return { action, first, second } as const;
  }
  if (
    (action === 'enable' || action === 'disable') &&
    args.length === 5 &&
    z.string().uuid().safeParse(first).success &&
    z.string().uuid().safeParse(second).success &&
    /^(0|[1-9]\d*)$/u.test(expectedVersion ?? '') &&
    Number.isSafeInteger(Number(expectedVersion)) &&
    operator?.trim() &&
    operator.trim().length <= 64
  ) {
    return {
      action,
      first: first!,
      second: second!,
      expectedVersion: Number(expectedVersion),
      operator: operator.trim(),
    } as const;
  }
  throw new Error(
    '用法：inspect <准确群名1> <准确群名2>；enable|disable <群ID1> <群ID2> <预检版本> <操作人标识>',
  );
}

async function run() {
  const args = parseVisitorLinkArguments(process.argv.slice(2));
  // No fallback credentials and no migration side effect. Use the reviewed release environment.
  const environment = z
    .object({
      MYSQL_HOST: z.string().min(1),
      MYSQL_PORT: z.coerce.number().int().min(1).max(65535),
      MYSQL_DATABASE: z.string().min(1),
      MYSQL_USER: z.string().min(1),
      MYSQL_PASSWORD: z.string().min(1),
    })
    .parse(process.env);
  const client = createDatabaseClient({
    host: environment.MYSQL_HOST,
    port: environment.MYSQL_PORT,
    database: environment.MYSQL_DATABASE,
    user: environment.MYSQL_USER,
    password: environment.MYSQL_PASSWORD,
  });
  try {
    const result =
      args.action === 'inspect'
        ? await inspectVisitorLink(client, args.first, args.second)
        : await setVisitorLink(client, {
            firstGroupId: args.first,
            secondGroupId: args.second,
            enabled: args.action === 'enable',
            expectedVersion: args.expectedVersion,
            operator: args.operator,
          });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await client.close();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  void run().catch(() => {
    // Do not emit driver errors: they can contain connection or business parameters.
    process.stderr.write(
      '群组关联操作未完成。请检查参数、群名唯一性、预检版本及数据库连接；未输出敏感详情。\n',
    );
    process.exitCode = 1;
  });
}
