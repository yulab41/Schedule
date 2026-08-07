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
 * 各服务只提供权限、指纹、作用域与领域 run 函数，避免 7 个事务入口重复样板。
 */
export function runAuthorizedMutation<Result>(options: {
  readonly databaseClient: DatabaseClient;
  readonly groupId: string;
  readonly identity: AuthenticatedIdentity;
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
  return withTransaction(options.databaseClient, async (transaction) => {
    const authorization = await options.permissionService.requirePermission(
      transaction,
      options.identity,
      options.groupId,
      options.permission,
    );

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
}
