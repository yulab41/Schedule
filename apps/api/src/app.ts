import { randomUUID } from 'node:crypto';

import type { AuthPort } from './adapters/auth/auth-port.js';
import type { DatabaseClient } from '@schedule/database';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { UserService } from './modules/users/user-service.js';
import { registerUserRoutes } from './modules/users/user-routes.js';
import { registerGroupRoutes } from './modules/groups/group-routes.js';
import { GroupService } from './modules/groups/group-service.js';
import { MembershipService } from './modules/groups/membership-service.js';
import { ContactService } from './modules/groups/contact-service.js';
import { VisitorKeyService } from './modules/groups/visitor-key-service.js';
import { InviteService } from './modules/groups/invite-service.js';
import { registerInviteRoutes } from './modules/groups/invite-routes.js';
import { registerSchedulingConfigRoutes } from './modules/scheduling-config/scheduling-config-routes.js';
import { SchedulingConfigService } from './modules/scheduling-config/scheduling-config-service.js';
import { registerScheduleRoutes } from './modules/schedules/schedule-routes.js';
import { ScheduleGenerateService } from './modules/schedules/generate-service.js';
import { SchedulePublishService } from './modules/schedules/publish-service.js';
import { ScheduleRepository } from './modules/schedules/schedule-repository.js';
import { registerCalendarRoutes } from './modules/calendar/calendar-routes.js';
import { CalendarQuery } from './modules/calendar/calendar-query.js';
import { VisitorAccessLogService } from './modules/calendar/visitor-access-log.js';
import { registerManualScheduleTemplateRoutes } from './modules/manual-schedules/template-routes.js';
import { ManualScheduleTemplateService } from './modules/manual-schedules/template-service.js';
import { registerManualScheduleApplyRoutes } from './modules/manual-schedules/apply-routes.js';
import { ManualScheduleApplyService } from './modules/manual-schedules/apply-service.js';
import { registerLeaveRoutes } from './modules/leaves/leave-routes.js';
import { LeaveService } from './modules/leaves/leave-service.js';
import { registerSwapRoutes } from './modules/swaps/swap-routes.js';
import { SwapService } from './modules/swaps/swap-service.js';
import { registerDutyAdjustmentRoutes } from './modules/duty-adjustments/duty-adjustment-routes.js';
import { DutyAdjustmentService } from './modules/duty-adjustments/duty-adjustment-service.js';
import { registerEventRoutes } from './modules/events/event-routes.js';
import { EventQuery } from './modules/events/event-query.js';
import { createPushDispatcher } from './modules/notifications/notification-dispatcher.js';
import type { PushDispatcher } from './modules/notifications/notification-dispatcher.js';
import { NotificationQueryService } from './modules/notifications/notification-query.js';
import { registerNotificationRoutes } from './modules/notifications/notification-routes.js';
import { NotificationService } from './modules/notifications/notification-service.js';
import { registerHolidayRoutes } from './modules/holidays/holiday-routes.js';
import { HolidayService } from './modules/holidays/holiday-service.js';
import { parseHolidayAdminUids } from './modules/holidays/holiday-admin.js';
import { registerPlatformAdminRoutes } from './modules/platform-admin/platform-admin-routes.js';
import { PlatformAdminService } from './modules/platform-admin/platform-admin-service.js';
import { parsePlatformAdminUids } from './modules/platform-admin/platform-admin.js';
import { registerStatisticsRoutes } from './modules/statistics/statistics-routes.js';
import { StatisticsService } from './modules/statistics/statistics-service.js';
import { registerExportRoutes } from './modules/exports/export-routes.js';
import { registerPastScheduleRoutes } from './modules/past-schedules/past-schedule-routes.js';
import { PastScheduleService } from './modules/past-schedules/past-schedule-service.js';
import { ExportService } from './modules/exports/export-service.js';
import { WechatAuthService } from './modules/wechat/wechat-auth-service.js';
import { registerWechatAuthRoutes } from './modules/wechat/wechat-auth-routes.js';
import { registerWechatWebAuthRoutes } from './modules/wechat/wechat-web-auth-routes.js';
import type { WechatWebAuthService } from './modules/wechat/wechat-web-auth-service.js';
import { registerAuthentication } from './plugins/authenticate.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerRequestContext } from './plugins/request-context.js';
import type { WechatGateway } from './modules/wechat/wechat-gateway.js';
import { logRedactionPaths, redactSensitiveFields } from './security/redact.js';
import { getApiStatus } from './status.js';

type ApiLoggerOptions = NonNullable<FastifyServerOptions['logger']>;
type ApiLoggerConfiguration = Exclude<ApiLoggerOptions, boolean>;

declare module 'fastify' {
  interface FastifyInstance {
    wechatGateway?: WechatGateway;
  }
}

export interface CreateAppOptions {
  readonly authPort?: AuthPort;
  readonly databaseClient?: DatabaseClient;
  readonly holidayAdminUids?: ReadonlySet<string>;
  readonly logger?: false;
  readonly loggerStream?: ApiLoggerConfiguration['stream'];
  readonly platformAdminUids?: ReadonlySet<string>;
  readonly pushDispatcher?: PushDispatcher;
  readonly wechatGateway?: WechatGateway;
  readonly wechatWebAuthService?: WechatWebAuthService;
  readonly wechatSessionSecret?: string | undefined;
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const app = Fastify({
    genReqId: () => randomUUID(),
    logger: options.logger === false ? false : createLoggerOptions(options.loggerStream),
    requestIdHeader: false,
  });

  registerRequestContext(app);
  registerErrorHandler(app);
  if (options.wechatGateway !== undefined) {
    app.decorate('wechatGateway', options.wechatGateway);
  }

  app.get('/health', () => getApiStatus());
  app.get('/ready', () => getApiStatus());

  if (options.authPort !== undefined && options.databaseClient !== undefined) {
    registerAuthentication(app, options.authPort);
    registerUserRoutes(app, new UserService(options.databaseClient));
    const holidayAdminUids = options.holidayAdminUids ?? parseHolidayAdminUids(process.env);
    const platformAdminUids = options.platformAdminUids ?? parsePlatformAdminUids(process.env);
    let wechatAuthService: WechatAuthService | undefined;
    if (options.wechatGateway !== undefined) {
      wechatAuthService = new WechatAuthService({
        databaseClient: options.databaseClient,
        gateway: options.wechatGateway,
        sessionSecret: options.wechatSessionSecret,
      });
      registerWechatAuthRoutes(app, wechatAuthService);
    }
    if (options.wechatWebAuthService !== undefined) {
      registerWechatWebAuthRoutes(app, options.wechatWebAuthService);
    }
    registerInviteRoutes(
      app,
      new InviteService({
        databaseClient: options.databaseClient,
        holidayAdminUids,
        issueSessionForUser:
          wechatAuthService === undefined
            ? undefined
            : (userId, openid) => wechatAuthService.issueSessionForUser(userId, openid),
        platformAdminUids,
      }),
    );
    registerGroupRoutes(
      app,
      new GroupService(options.databaseClient),
      new MembershipService(options.databaseClient),
      new ContactService(options.databaseClient),
      new VisitorKeyService(options.databaseClient),
      new VisitorAccessLogService(options.databaseClient),
    );
    registerSchedulingConfigRoutes(app, new SchedulingConfigService(options.databaseClient));
    const scheduleRepository = new ScheduleRepository(options.databaseClient);
    registerScheduleRoutes(
      app,
      new ScheduleGenerateService(options.databaseClient, scheduleRepository),
      new SchedulePublishService(options.databaseClient, scheduleRepository),
    );
    registerCalendarRoutes(
      app,
      new CalendarQuery(options.databaseClient),
      new VisitorAccessLogService(options.databaseClient),
    );
    registerManualScheduleTemplateRoutes(
      app,
      new ManualScheduleTemplateService(options.databaseClient),
    );
    registerManualScheduleApplyRoutes(
      app,
      new ManualScheduleApplyService(options.databaseClient, scheduleRepository),
    );
    registerLeaveRoutes(app, new LeaveService(options.databaseClient));
    registerSwapRoutes(app, new SwapService(options.databaseClient));
    registerDutyAdjustmentRoutes(app, new DutyAdjustmentService(options.databaseClient));
    registerEventRoutes(app, new EventQuery(options.databaseClient), options.databaseClient);
    registerNotificationRoutes(
      app,
      new NotificationQueryService(options.databaseClient),
      new NotificationService(
        options.databaseClient,
        options.pushDispatcher ?? createPushDispatcher(process.env),
      ),
    );
    registerHolidayRoutes(app, new HolidayService(options.databaseClient, holidayAdminUids));
    registerStatisticsRoutes(app, new StatisticsService(options.databaseClient));
    registerExportRoutes(app, new ExportService(options.databaseClient));
    registerPastScheduleRoutes(app, new PastScheduleService(options.databaseClient));
    registerPlatformAdminRoutes(
      app,
      new PlatformAdminService(options.databaseClient, platformAdminUids),
    );
  } else if (options.authPort !== undefined || options.databaseClient !== undefined) {
    throw new Error('Authentication and database dependencies must be configured together.');
  }

  return app;
}

function createLoggerOptions(stream: ApiLoggerConfiguration['stream']): ApiLoggerConfiguration {
  const logger: ApiLoggerConfiguration = {
    level: stream === undefined && process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    redact: {
      censor: '[REDACTED]',
      paths: logRedactionPaths,
    },
    serializers: {
      err(error) {
        return {
          message: '[REDACTED]',
          stack: '[REDACTED]',
          type: error.name,
        };
      },
      req(request) {
        return {
          method: request.method,
          requestId: request.id,
          url: request.url.split('?')[0] ?? '/',
        };
      },
    },
    hooks: {
      logMethod(args, method) {
        method.apply(
          this,
          args.map((argument) => redactSensitiveFields(argument)) as Parameters<typeof method>,
        );
      },
      streamWrite(logLine) {
        return sanitizeLogLine(logLine);
      },
    },
  };

  return stream === undefined ? logger : { ...logger, stream };
}

function sanitizeLogLine(logLine: string): string {
  const lineEnding = logLine.endsWith('\r\n') ? '\r\n' : logLine.endsWith('\n') ? '\n' : '';
  const json = lineEnding === '' ? logLine : logLine.slice(0, -lineEnding.length);

  try {
    return `${JSON.stringify(redactSensitiveFields(JSON.parse(json)))}${lineEnding}`;
  } catch {
    return `{"level":50,"msg":"Log entry omitted because sanitization failed"}${lineEnding}`;
  }
}
