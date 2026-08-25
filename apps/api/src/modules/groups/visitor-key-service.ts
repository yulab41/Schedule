import { randomBytes, randomUUID } from 'node:crypto';

import type { GroupVersionMutationRequest, VisitorKeyChangedResponse } from '@schedule/contracts';
import { type DatabaseClient, groups, withTransaction } from '@schedule/database';
import { eq, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { assertExpectedVersion } from '../concurrency/version-guard.js';
import { AuditWriter } from '../audit/audit-writer.js';
import { toWechatGatewayApiError } from '../wechat/wechat-errors.js';
import { WechatGatewayError, type WechatGateway } from '../wechat/wechat-gateway.js';
import {
  createOrganizationFingerprint,
  runOrganizationMutation,
} from './organization-operation.js';
import { GroupPermissionService } from './permission-service.js';

const QR_CACHE_TTL_MS = 5 * 60 * 1000;

export class VisitorKeyService {
  private readonly auditWriter = new AuditWriter();
  private readonly permissionService = new GroupPermissionService();
  private readonly qrCache = new Map<
    string,
    { readonly bytes: Uint8Array; readonly expiresAt: number; readonly visitorKey: string }
  >();

  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async regenerateKey(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: GroupVersionMutationRequest,
  ): Promise<VisitorKeyChangedResponse> {
    const result = await runOrganizationMutation({
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      requestFingerprint: createOrganizationFingerprint({
        expectedVersion: input.expectedVersion,
        groupId,
      }),
      run: async (transaction) => {
        const authorization = await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'regenerateVisitorKey',
        );
        assertExpectedVersion({
          actualVersion: authorization.group.version,
          expectedVersion: input.expectedVersion,
          id: authorization.group.id,
          objectType: 'group',
        });
        const visitorKey = randomBytes(16).toString('hex');
        await transaction
          .update(groups)
          .set({ visitorKey, version: sql`${groups.version} + 1` })
          .where(eq(groups.id, authorization.group.id));
        await this.auditWriter.append(transaction, {
          action: 'visitor_key_regenerated',
          actorUserId: authorization.user.id,
          groupId: authorization.group.id,
          metadata: {},
          operationId: input.operationId,
          outcome: 'completed',
          targetId: authorization.group.id,
          targetType: 'group',
        });
        return { visitorKeyChanged: true } as const;
      },
      scope: 'organization_visitor_key_regenerate',
    });
    this.qrCache.delete(groupId);

    return result;
  }

  public async getGroupQr(
    identity: AuthenticatedIdentity,
    groupId: string,
    gateway: WechatGateway,
    envVersion: string,
  ): Promise<{ readonly imageBase64: string }> {
    const authorization = await withTransaction(this.databaseClient, async (transaction) =>
      this.permissionService.requirePermission(transaction, identity, groupId, 'viewGroupQr'),
    );

    const [group] = await this.databaseClient.database
      .select({ visitorKey: groups.visitorKey })
      .from(groups)
      .where(eq(groups.id, authorization.group.id))
      .limit(1);
    if (group === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '群组不存在或不可用。',
      });
    }

    const cached = this.qrCache.get(groupId);
    const now = Date.now();
    if (cached === undefined || cached.visitorKey !== group.visitorKey || cached.expiresAt <= now) {
      let bytes: Uint8Array;
      try {
        // scene is limited to 32 visible characters by WeChat; the visitor key
        // itself is exactly 32 hex chars, so it is passed without a prefix.
        bytes = await gateway.getUnlimitedQr(group.visitorKey, 'pages/guest/guest', envVersion);
      } catch (error) {
        if (error instanceof WechatGatewayError) {
          throw toWechatGatewayApiError(error);
        }
        throw error;
      }
      this.qrCache.set(groupId, {
        bytes,
        expiresAt: now + QR_CACHE_TTL_MS,
        visitorKey: group.visitorKey,
      });
    }

    await withTransaction(this.databaseClient, async (transaction) => {
      await this.auditWriter.append(transaction, {
        action: 'group_qr_generated',
        actorUserId: authorization.user.id,
        groupId: authorization.group.id,
        metadata: {},
        operationId: randomUUID(),
        outcome: 'completed',
        targetId: authorization.group.id,
        targetType: 'group',
      });
    });

    const qrBytes = this.qrCache.get(groupId)?.bytes ?? new Uint8Array();
    return { imageBase64: Buffer.from(qrBytes).toString('base64') };
  }
}
