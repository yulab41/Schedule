import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import { withTransaction } from '@schedule/database';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { withIdempotentOperation } from '../../plugins/idempotency.js';
import {
  GroupPermissionService,
  type GroupAuthorization,
  type GroupPermission,
} from '../groups/permission-service.js';

/**
 * 工作流变更入口的共享骨架：开事务 → 鉴权 → 幂等执行领域变更。
 * 各服务只提供权限、指纹、作用域与领域 run 函数，避免 7 个事务入口重复样板；
 * beforeIdempotentOperation 在幂等键写入前执行（如换班撤销的成员/管理员预检），
 * onError 在事务回滚后、错误重新抛出前执行（如 leave 审批被冲突拦截时写通知）。
 */
export async function runAuthorizedMutation<Result>(options: {
  readonly beforeIdempotentOperation?: (
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
  ) => Promise<void>;
  readonly databaseClient: DatabaseClient;
  readonly groupId: string;
  readonly identity: AuthenticatedIdentity;
  readonly onError?: (error: unknown) => Promise<void>;
  readonly operationId: string;
  readonly permission: GroupPermission;
  readonly permissionService: GroupPermissionService;
  readonly requestFingerprint: string;
  readonly run: (
    transaction: DatabaseTransaction,
    authorization: GroupAuthorization,
  ) => Promise<Result>;
  readonly scope: string;
}): Promise<Result> {
  try {
    return await withTransaction(options.databaseClient, async (transaction) => {
      const authorization = await options.permissionService.requirePermission(
        transaction,
        options.identity,
        options.groupId,
        options.permission,
      );

      if (options.beforeIdempotentOperation !== undefined) {
        await options.beforeIdempotentOperation(transaction, authorization);
      }

      return withIdempotentOperation(
        transaction,
        {
          actorUserId: authorization.user.id,
          operationId: options.operationId,
          requestFingerprint: options.requestFingerprint,
          scope: options.scope,
        },
        () => options.run(transaction, authorization),
      );
    });
  } catch (error) {
    if (options.onError !== undefined) {
      await options.onError(error);
    }
    throw error;
  }
}
