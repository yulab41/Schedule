import type {
  GroupSchedulePublishMode,
  UpdateGroupSchedulePublishModeRequest,
} from '@schedule/contracts';
import { groups, withTransaction, type DatabaseClient } from '@schedule/database';
import { eq, sql } from 'drizzle-orm';
import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { GroupPermissionService } from '../groups/permission-service.js';
export class SchedulePublishModeService {
  private readonly permissionService = new GroupPermissionService();
  constructor(private readonly databaseClient: DatabaseClient) {}
  public async getPublishMode(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<GroupSchedulePublishMode> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewScheduleConfiguration',
      );
      return { publishMode: authorization.group.schedulePublishMode };
    });
  }

  public async updatePublishMode(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: UpdateGroupSchedulePublishModeRequest,
  ): Promise<GroupSchedulePublishMode> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      await transaction
        .update(groups)
        .set({
          schedulePublishMode: input.publishMode,
          version: sql`${groups.version} + 1`,
        })
        .where(eq(groups.id, authorization.group.id));

      return { publishMode: input.publishMode };
    });
  }
}
