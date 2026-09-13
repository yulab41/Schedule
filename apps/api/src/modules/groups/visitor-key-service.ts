import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { GroupVersionMutationRequest, VisitorKeyChangedResponse } from '@schedule/contracts';
import {
  type DatabaseClient,
  groups,
  groupVisitorQrAssets,
  withTransaction,
} from '@schedule/database';
import { and, eq, sql } from 'drizzle-orm';

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

type QrEnvironment = 'release' | 'trial';
type QrResult = {
  readonly bytes: Uint8Array;
  readonly generatedMs: number;
  readonly persisted: boolean;
};

export class VisitorKeyService {
  private readonly auditWriter = new AuditWriter();
  private readonly permissionService = new GroupPermissionService();
  private readonly qrCache = new Map<
    string,
    { readonly bytes: Uint8Array; readonly visitorKey: string }
  >();
  private readonly qrReads = new Map<string, Promise<QrResult>>();

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
        await transaction
          .delete(groupVisitorQrAssets)
          .where(eq(groupVisitorQrAssets.groupId, authorization.group.id));
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
    this.qrCache.delete(`${groupId}:release`);
    this.qrCache.delete(`${groupId}:trial`);
    for (const key of this.qrReads.keys()) {
      if (key.startsWith(`${groupId}:`)) this.qrReads.delete(key);
    }

    return result;
  }

  public async getGroupQr(
    identity: AuthenticatedIdentity,
    groupId: string,
    gateway: WechatGateway,
    includeTrial: boolean,
  ): Promise<{ readonly imageBase64: string; readonly trialImageBase64?: string }> {
    const startedAt = Date.now();
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

    const environments: readonly QrEnvironment[] = includeTrial
      ? ['release', 'trial']
      : ['release'];
    const results = await Promise.all(
      environments.map((environment) =>
        this.readOrGenerateQr(authorization.group.id, group.visitorKey, environment, gateway),
      ),
    );

    await withTransaction(this.databaseClient, async (transaction) => {
      await this.auditWriter.append(transaction, {
        action: 'group_qr_generated',
        actorUserId: authorization.user.id,
        groupId: authorization.group.id,
        metadata: {
          generatedCount: results.filter((result) => !result.persisted).length,
          generationMs: Math.max(0, ...results.map((result) => result.generatedMs)),
          totalMs: Date.now() - startedAt,
        },
        operationId: randomUUID(),
        outcome: 'completed',
        targetId: authorization.group.id,
        targetType: 'group',
      });
    });

    const release = results[0]?.bytes ?? new Uint8Array();
    if (!includeTrial) return { imageBase64: Buffer.from(release).toString('base64') };
    return {
      imageBase64: Buffer.from(release).toString('base64'),
      trialImageBase64: Buffer.from(results[1]?.bytes ?? []).toString('base64'),
    };
  }

  private async readOrGenerateQr(
    groupId: string,
    visitorKey: string,
    environment: QrEnvironment,
    gateway: WechatGateway,
  ): Promise<QrResult> {
    const cacheKey = `${groupId}:${environment}`;
    const cached = this.qrCache.get(cacheKey);
    if (cached?.visitorKey === visitorKey) {
      return { bytes: cached.bytes, generatedMs: 0, persisted: true };
    }
    const [stored] = await this.databaseClient.database
      .select({
        byteLength: groupVisitorQrAssets.byteLength,
        content: groupVisitorQrAssets.content,
        sha256: groupVisitorQrAssets.sha256,
        visitorKey: groupVisitorQrAssets.visitorKey,
      })
      .from(groupVisitorQrAssets)
      .where(
        and(
          eq(groupVisitorQrAssets.groupId, groupId),
          eq(groupVisitorQrAssets.environment, environment),
        ),
      )
      .limit(1);
    if (
      stored?.visitorKey === visitorKey &&
      stored.byteLength === stored.content.byteLength &&
      sha256(stored.content) === stored.sha256
    ) {
      this.qrCache.set(cacheKey, { bytes: stored.content, visitorKey });
      return { bytes: stored.content, generatedMs: 0, persisted: true };
    }
    // A mismatched row can belong to a newer refresh. Only remove corruption for this exact key;
    // the locked save below rejects a late request whose key is no longer current.
    if (stored?.visitorKey === visitorKey) {
      await this.databaseClient.database
        .delete(groupVisitorQrAssets)
        .where(
          and(
            eq(groupVisitorQrAssets.groupId, groupId),
            eq(groupVisitorQrAssets.environment, environment),
          ),
        );
    }
    const readKey = `${cacheKey}:${visitorKey}`;
    const existing = this.qrReads.get(readKey);
    if (existing !== undefined) return existing;
    const read = this.generateAndPersistQr(groupId, visitorKey, environment, gateway);
    this.qrReads.set(readKey, read);
    void read.then(
      () => {
        if (this.qrReads.get(readKey) === read) this.qrReads.delete(readKey);
      },
      () => {
        if (this.qrReads.get(readKey) === read) this.qrReads.delete(readKey);
      },
    );
    return read;
  }

  private async generateAndPersistQr(
    groupId: string,
    visitorKey: string,
    environment: QrEnvironment,
    gateway: WechatGateway,
  ): Promise<QrResult> {
    const startedAt = Date.now();
    let bytes: Uint8Array;
    try {
      // The 32-character scene is the permanent visitor key; refreshing it invalidates old images.
      bytes = await gateway.getUnlimitedQr(visitorKey, 'pages/guest/guest', environment);
    } catch (error) {
      if (error instanceof WechatGatewayError) throw toWechatGatewayApiError(error);
      throw error;
    }
    const content = Buffer.from(bytes);
    const saved = await withTransaction(this.databaseClient, async (transaction) => {
      const [current] = await transaction
        .select({ visitorKey: groups.visitorKey })
        .from(groups)
        .where(eq(groups.id, groupId))
        .limit(1)
        .for('update');
      if (current?.visitorKey !== visitorKey) return false;
      await transaction
        .insert(groupVisitorQrAssets)
        .values({
          byteLength: content.byteLength,
          content,
          contentType: detectQrContentType(content),
          environment,
          generatedAt: new Date(),
          groupId,
          sha256: sha256(content),
          visitorKey,
        })
        .onDuplicateKeyUpdate({
          set: {
            byteLength: content.byteLength,
            content,
            contentType: detectQrContentType(content),
            generatedAt: new Date(),
            sha256: sha256(content),
            visitorKey,
          },
        });
      return true;
    });
    if (!saved) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '访客码已刷新，请重新读取二维码。',
      });
    }
    this.qrCache.set(`${groupId}:${environment}`, { bytes: content, visitorKey });
    return { bytes: content, generatedMs: Date.now() - startedAt, persisted: false };
  }
}

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function detectQrContentType(value: Uint8Array): 'image/jpeg' | 'image/png' {
  return value[0] === 0x89 && value[1] === 0x50 && value[2] === 0x4e && value[3] === 0x47
    ? 'image/png'
    : 'image/jpeg';
}
