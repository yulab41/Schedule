import type { DatabaseClient } from '@schedule/database';

import { EventWriter } from '../events/event-writer.js';
import { GroupMemberReader } from '../groups/group-member-reader.js';
import { GroupPermissionService } from '../groups/permission-service.js';
import { NotificationWriter } from '../notifications/notification-writer.js';
import { StatisticsService } from '../statistics/statistics-service.js';
import { WorkflowConflictService } from './workflow-conflict-service.js';
import { WorkflowSelfHealingService } from './workflow-self-healing-service.js';

/**
 * 换班/加扣班/请假服务共享的依赖集合，避免三个大服务各自实例化同一套
 * 事件/通知/权限/成员/冲突/统计/自愈依赖。
 */
export class WorkflowServices {
  public readonly eventWriter = new EventWriter();
  public readonly notificationWriter = new NotificationWriter();
  public readonly permissionService = new GroupPermissionService();
  public readonly memberReader = new GroupMemberReader();
  public readonly workflowConflictService = new WorkflowConflictService();
  public readonly statisticsService: StatisticsService;
  public readonly workflowSelfHealingService: WorkflowSelfHealingService;

  public constructor(public readonly databaseClient: DatabaseClient) {
    this.statisticsService = new StatisticsService(databaseClient);
    this.workflowSelfHealingService = new WorkflowSelfHealingService(databaseClient);
  }
}
