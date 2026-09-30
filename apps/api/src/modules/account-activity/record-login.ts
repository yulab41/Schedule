import type { AccountLoginMethod } from '@schedule/contracts';
import type { FastifyBaseLogger } from 'fastify';
import type { AccountActivityService } from './account-activity-service.js';
export async function recordSuccessfulLogin(
  service: Pick<AccountActivityService, 'recordLogin'> | undefined,
  userId: string | undefined,
  method: AccountLoginMethod,
  logger: FastifyBaseLogger,
): Promise<void> {
  if (service === undefined || userId === undefined) return;
  try {
    await service.recordLogin(userId, method);
  } catch {
    logger.warn({ code: 'ACCOUNT_ACTIVITY_LOGIN_FAILED' }, 'Account login statistics unavailable');
  }
}
