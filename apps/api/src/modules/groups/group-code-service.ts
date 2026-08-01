import { randomInt } from 'node:crypto';

import { type DatabaseClient, groupCodeAttempts } from '@schedule/database';
import { eq, sql } from 'drizzle-orm';

import { ApiError } from '../../plugins/error-handler.js';

const groupCodeAttemptLimit = 5;
const groupCodeAttemptWindowSeconds = 60;

export class GroupCodeService {
  public constructor(private readonly databaseClient: DatabaseClient) {}

  public createRandomCode(): string {
    return randomInt(0, 10_000).toString().padStart(4, '0');
  }

  public async consumeAttempt(userId: string): Promise<void> {
    const windowExpired = sql`${groupCodeAttempts.windowStartedAt} < timestampadd(second, -${groupCodeAttemptWindowSeconds}, current_timestamp(3))`;

    await this.databaseClient.database
      .insert(groupCodeAttempts)
      .values({ userId })
      .onDuplicateKeyUpdate({
        set: {
          attemptCount: sql`if(${windowExpired}, 1, ${groupCodeAttempts.attemptCount} + 1)`,
          windowStartedAt: sql`if(${windowExpired}, current_timestamp(3), ${groupCodeAttempts.windowStartedAt})`,
        },
      });

    const [attempt] = await this.databaseClient.database
      .select({ count: groupCodeAttempts.attemptCount })
      .from(groupCodeAttempts)
      .where(eq(groupCodeAttempts.userId, userId))
      .limit(1);

    if (attempt === undefined) {
      throw new ApiError({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
        userMessage: '群组码尝试状态暂时不可用，请稍后重试。',
      });
    }

    if (attempt.count > groupCodeAttemptLimit) {
      throw new ApiError({
        code: 'RATE_LIMITED',
        statusCode: 429,
        userMessage: '群组码尝试过于频繁，请稍后重试。',
      });
    }
  }
}
