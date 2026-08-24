import { createHash, randomUUID } from 'node:crypto';

import {
  GROUP_MOBILE_PHONE_CONSENT_NOTICE_VERSION,
  type GroupMemberContact,
  type GroupMobilePhoneConsent,
  type UpdateGroupMemberContactRequest,
  type UpdateGroupMobilePhoneConsentRequest,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  type DatabaseTransaction,
  groupMemberContacts,
  groupMemberships,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { withIdempotentOperation } from '../../plugins/idempotency.js';
import { AuditWriter } from '../audit/audit-writer.js';
import {
  createMobilePhoneConsentFingerprint,
  isMobilePhoneConsentEffective,
  maskMobilePhone,
} from './mobile-phone-consent.js';
import { GroupPermissionService } from './permission-service.js';

interface MobileConsentContactRow {
  readonly id: string;
  readonly membershipId: string;
  readonly mobilePhone: string | null;
  readonly mobilePhoneConsentFingerprint: string | null;
  readonly mobilePhoneConsentNoticeVersion: string | null;
  readonly mobilePhoneConsentRevokedAt: Date | null;
  readonly mobilePhoneConsentedAt: Date | null;
  readonly version: number;
}

export class ContactService {
  private readonly auditWriter = new AuditWriter();
  private readonly permissionService = new GroupPermissionService();

  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async listContacts(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<GroupMemberContact[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewContacts',
      );
      const contacts = await transaction
        .select({
          isConfirmed: groupMemberContacts.isConfirmed,
          membershipId: groupMemberships.id,
          mobilePhone: groupMemberContacts.mobilePhone,
          mobilePhoneConsentFingerprint: groupMemberContacts.mobilePhoneConsentFingerprint,
          mobilePhoneConsentNoticeVersion: groupMemberContacts.mobilePhoneConsentNoticeVersion,
          mobilePhoneConsentRevokedAt: groupMemberContacts.mobilePhoneConsentRevokedAt,
          mobilePhoneConsentedAt: groupMemberContacts.mobilePhoneConsentedAt,
          shortPhone: groupMemberContacts.shortPhone,
          updatedAt: groupMemberContacts.updatedAt,
          version: groupMemberContacts.version,
        })
        .from(groupMemberships)
        .innerJoin(users, eq(users.id, groupMemberships.userId))
        .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
        .leftJoin(
          groupMemberContacts,
          and(
            eq(groupMemberContacts.membershipId, groupMemberships.id),
            isNull(groupMemberContacts.deletedAt),
          ),
        )
        .where(
          and(
            eq(groupMemberships.groupId, authorization.group.id),
            eq(groupMemberships.status, 'active'),
            ne(groupMemberships.role, 'guest'),
            eq(users.status, 'active'),
            ne(users.isDeveloperAdmin, 1),
            isNull(groupMemberships.deletedAt),
            isNull(users.deletedAt),
            isNull(userProfiles.deletedAt),
          ),
        )
        .orderBy(asc(userProfiles.realName), asc(groupMemberships.id));

      return contacts.map((contact) =>
        toGroupMemberContact(
          contact,
          contact.membershipId === authorization.membership.id ||
            isMobilePhoneConsentEffective(authorization.group.id, contact.membershipId, contact),
        ),
      );
    });
  }

  public async getMobilePhoneConsent(
    identity: AuthenticatedIdentity,
    groupId: string,
  ): Promise<GroupMobilePhoneConsent> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewContacts',
      );
      const contact = await this.readMobileConsentContact(transaction, authorization.membership.id);
      return toMobilePhoneConsent(authorization.group.id, authorization.membership.id, contact);
    });
  }

  public async updateMobilePhoneConsent(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: UpdateGroupMobilePhoneConsentRequest,
    operationId: string,
  ): Promise<GroupMobilePhoneConsent> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewContacts',
      );
      return withIdempotentOperation(
        transaction,
        {
          actorUserId: authorization.user.id,
          operationId,
          requestFingerprint: createHash('sha256')
            .update(
              JSON.stringify({
                consented: input.consented,
                expectedContactVersion: input.expectedContactVersion,
                groupId: authorization.group.id,
                noticeVersion: input.noticeVersion,
              }),
            )
            .digest('hex'),
          scope: `mobile_phone_consent:${authorization.group.id}`,
        },
        async () => {
          const contact = await this.readMobileConsentContact(
            transaction,
            authorization.membership.id,
            true,
          );
          const currentVersion = contact?.version ?? 0;
          if (currentVersion !== input.expectedContactVersion) {
            throw new ApiError({
              code: 'CONFLICT',
              statusCode: 409,
              userMessage: '联系方式已发生变化，请刷新后重试。',
            });
          }

          if (input.consented) {
            if (input.noticeVersion !== GROUP_MOBILE_PHONE_CONSENT_NOTICE_VERSION) {
              throw new ApiError({
                code: 'CONFLICT',
                statusCode: 409,
                userMessage: '手机号公开说明已更新，请重新阅读后确认。',
              });
            }
            if (contact?.mobilePhone === null || contact?.mobilePhone === undefined) {
              throw new ApiError({
                code: 'CONFLICT',
                statusCode: 409,
                userMessage: '请先保存手机号，再设置公开同意。',
              });
            }
            const fingerprint = createMobilePhoneConsentFingerprint(
              authorization.group.id,
              authorization.membership.id,
              contact.mobilePhone,
            );
            if (
              contact.mobilePhoneConsentFingerprint !== fingerprint ||
              contact.mobilePhoneConsentNoticeVersion !==
                GROUP_MOBILE_PHONE_CONSENT_NOTICE_VERSION ||
              contact.mobilePhoneConsentRevokedAt !== null ||
              contact.mobilePhoneConsentedAt === null
            ) {
              const consentedAt = new Date();
              await transaction
                .update(groupMemberContacts)
                .set({
                  mobilePhoneConsentFingerprint: fingerprint,
                  mobilePhoneConsentNoticeVersion: GROUP_MOBILE_PHONE_CONSENT_NOTICE_VERSION,
                  mobilePhoneConsentRevokedAt: null,
                  mobilePhoneConsentedAt: consentedAt,
                  version: sql`${groupMemberContacts.version} + 1`,
                })
                .where(eq(groupMemberContacts.id, contact.id));
              await this.auditWriter.append(transaction, {
                action: 'mobile_phone_consent_granted',
                actorUserId: authorization.user.id,
                groupId: authorization.group.id,
                metadata: {
                  contactVersion: currentVersion + 1,
                  fingerprint,
                  noticeVersion: GROUP_MOBILE_PHONE_CONSENT_NOTICE_VERSION,
                },
                operationId,
                outcome: 'completed',
                targetId: contact.id,
                targetType: 'group_member_contact',
              });
            }
          } else if (
            contact !== undefined &&
            !(
              contact.mobilePhoneConsentFingerprint === null &&
              contact.mobilePhoneConsentRevokedAt !== null
            )
          ) {
            const revokedFingerprint =
              contact.mobilePhoneConsentFingerprint ??
              (contact.mobilePhone === null
                ? null
                : createMobilePhoneConsentFingerprint(
                    authorization.group.id,
                    authorization.membership.id,
                    contact.mobilePhone,
                  ));
            const revokedNoticeVersion = contact.mobilePhoneConsentNoticeVersion;
            await transaction
              .update(groupMemberContacts)
              .set({
                mobilePhoneConsentFingerprint: null,
                mobilePhoneConsentNoticeVersion: null,
                mobilePhoneConsentRevokedAt: new Date(),
                mobilePhoneConsentedAt: null,
                version: sql`${groupMemberContacts.version} + 1`,
              })
              .where(eq(groupMemberContacts.id, contact.id));
            await this.auditWriter.append(transaction, {
              action: 'mobile_phone_consent_revoked',
              actorUserId: authorization.user.id,
              groupId: authorization.group.id,
              metadata: {
                contactVersion: currentVersion + 1,
                fingerprint: revokedFingerprint ?? 'missing-phone',
                noticeVersion: revokedNoticeVersion ?? GROUP_MOBILE_PHONE_CONSENT_NOTICE_VERSION,
              },
              operationId,
              outcome: 'completed',
              targetId: contact.id,
              targetType: 'group_member_contact',
            });
          }

          const updated = await this.readMobileConsentContact(
            transaction,
            authorization.membership.id,
          );
          return toMobilePhoneConsent(authorization.group.id, authorization.membership.id, updated);
        },
      );
    });
  }

  public async updateContact(
    identity: AuthenticatedIdentity,
    groupId: string,
    membershipId: string,
    input: UpdateGroupMemberContactRequest,
  ): Promise<GroupMemberContact> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'viewContacts',
      );
      const target = await this.permissionService.getActiveMemberForUpdate(
        transaction,
        authorization.group.id,
        membershipId,
      );
      const canManageContacts =
        authorization.user.isDeveloperAdmin ||
        authorization.membership.role === 'owner' ||
        authorization.membership.role === 'administrator';
      const isCurrentMember = target.userId === authorization.user.id;

      if (target.role === 'guest' || target.isDeveloperAdmin) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '群组成员不存在或不可用。',
        });
      }

      if (!isCurrentMember && !canManageContacts) {
        throw new ApiError({
          code: 'FORBIDDEN',
          statusCode: 403,
          userMessage: '只能修改自己的联系方式。',
        });
      }
      if (input.mobilePhone !== undefined && !isCurrentMember) {
        throw new ApiError({
          code: 'FORBIDDEN',
          statusCode: 403,
          userMessage: '手机号只能由成员本人修改。',
        });
      }
      if (input.isConfirmed !== undefined && !canManageContacts) {
        throw new ApiError({
          code: 'FORBIDDEN',
          statusCode: 403,
          userMessage: '只有群主、群管理员或后台管理员可以确认联系方式。',
        });
      }

      const [existing] = await transaction
        .select({
          id: groupMemberContacts.id,
          isConfirmed: groupMemberContacts.isConfirmed,
          membershipId: groupMemberContacts.membershipId,
          mobilePhone: groupMemberContacts.mobilePhone,
          mobilePhoneConsentFingerprint: groupMemberContacts.mobilePhoneConsentFingerprint,
          mobilePhoneConsentNoticeVersion: groupMemberContacts.mobilePhoneConsentNoticeVersion,
          mobilePhoneConsentRevokedAt: groupMemberContacts.mobilePhoneConsentRevokedAt,
          mobilePhoneConsentedAt: groupMemberContacts.mobilePhoneConsentedAt,
          shortPhone: groupMemberContacts.shortPhone,
          updatedAt: groupMemberContacts.updatedAt,
          version: groupMemberContacts.version,
        })
        .from(groupMemberContacts)
        .where(
          and(
            eq(groupMemberContacts.membershipId, target.id),
            isNull(groupMemberContacts.deletedAt),
          ),
        )
        .limit(1)
        .for('update');

      const mobilePhone =
        input.mobilePhone === undefined ? existing?.mobilePhone : input.mobilePhone;
      const shortPhone = input.shortPhone === undefined ? existing?.shortPhone : input.shortPhone;
      const mobilePhoneChanged = mobilePhone !== (existing?.mobilePhone ?? null);
      const phoneChanged = mobilePhoneChanged || shortPhone !== (existing?.shortPhone ?? null);
      const isConfirmed =
        input.isConfirmed === undefined
          ? phoneChanged
            ? 0
            : (existing?.isConfirmed ?? 0)
          : input.isConfirmed
            ? 1
            : 0;

      if (existing === undefined) {
        const contactId = randomUUID();
        await transaction.insert(groupMemberContacts).values({
          id: contactId,
          isConfirmed,
          membershipId: target.id,
          mobilePhone: mobilePhone ?? null,
          shortPhone: shortPhone ?? null,
        });

        const [created] = await transaction
          .select({
            isConfirmed: groupMemberContacts.isConfirmed,
            membershipId: groupMemberContacts.membershipId,
            mobilePhone: groupMemberContacts.mobilePhone,
            mobilePhoneConsentFingerprint: groupMemberContacts.mobilePhoneConsentFingerprint,
            mobilePhoneConsentNoticeVersion: groupMemberContacts.mobilePhoneConsentNoticeVersion,
            mobilePhoneConsentRevokedAt: groupMemberContacts.mobilePhoneConsentRevokedAt,
            mobilePhoneConsentedAt: groupMemberContacts.mobilePhoneConsentedAt,
            shortPhone: groupMemberContacts.shortPhone,
            updatedAt: groupMemberContacts.updatedAt,
            version: groupMemberContacts.version,
          })
          .from(groupMemberContacts)
          .where(eq(groupMemberContacts.id, contactId))
          .limit(1);

        if (created === undefined) {
          throw new ApiError({
            code: 'INTERNAL_ERROR',
            statusCode: 500,
            userMessage: '联系方式暂时无法保存，请稍后重试。',
          });
        }

        return toGroupMemberContact(created, isCurrentMember);
      }

      const consentInvalidated =
        mobilePhoneChanged &&
        existing.mobilePhoneConsentFingerprint !== null &&
        existing.mobilePhoneConsentRevokedAt === null;
      await transaction
        .update(groupMemberContacts)
        .set({
          isConfirmed,
          mobilePhone: mobilePhone ?? null,
          ...(consentInvalidated ? { mobilePhoneConsentRevokedAt: new Date() } : {}),
          shortPhone: shortPhone ?? null,
          version: sql`${groupMemberContacts.version} + 1`,
        })
        .where(eq(groupMemberContacts.id, existing.id));

      const [updated] = await transaction
        .select({
          isConfirmed: groupMemberContacts.isConfirmed,
          membershipId: groupMemberContacts.membershipId,
          mobilePhone: groupMemberContacts.mobilePhone,
          mobilePhoneConsentFingerprint: groupMemberContacts.mobilePhoneConsentFingerprint,
          mobilePhoneConsentNoticeVersion: groupMemberContacts.mobilePhoneConsentNoticeVersion,
          mobilePhoneConsentRevokedAt: groupMemberContacts.mobilePhoneConsentRevokedAt,
          mobilePhoneConsentedAt: groupMemberContacts.mobilePhoneConsentedAt,
          shortPhone: groupMemberContacts.shortPhone,
          updatedAt: groupMemberContacts.updatedAt,
          version: groupMemberContacts.version,
        })
        .from(groupMemberContacts)
        .where(eq(groupMemberContacts.id, existing.id))
        .limit(1);

      if (updated === undefined) {
        throw new ApiError({
          code: 'INTERNAL_ERROR',
          statusCode: 500,
          userMessage: '联系信息暂时无法保存，请稍后重试。',
        });
      }
      if (consentInvalidated) {
        await this.auditWriter.append(transaction, {
          action: 'mobile_phone_consent_invalidated',
          actorUserId: authorization.user.id,
          groupId: authorization.group.id,
          metadata: {
            contactVersion: updated.version,
            fingerprint: existing.mobilePhoneConsentFingerprint,
            noticeVersion:
              existing.mobilePhoneConsentNoticeVersion ?? GROUP_MOBILE_PHONE_CONSENT_NOTICE_VERSION,
          },
          operationId: randomUUID(),
          outcome: 'completed',
          targetId: existing.id,
          targetType: 'group_member_contact',
        });
      }

      return toGroupMemberContact(
        updated,
        isCurrentMember ||
          isMobilePhoneConsentEffective(authorization.group.id, target.id, updated),
      );
    });
  }

  private async readMobileConsentContact(
    transaction: DatabaseTransaction,
    membershipId: string,
    lock = false,
  ): Promise<MobileConsentContactRow | undefined> {
    const query = transaction
      .select({
        id: groupMemberContacts.id,
        membershipId: groupMemberContacts.membershipId,
        mobilePhone: groupMemberContacts.mobilePhone,
        mobilePhoneConsentFingerprint: groupMemberContacts.mobilePhoneConsentFingerprint,
        mobilePhoneConsentNoticeVersion: groupMemberContacts.mobilePhoneConsentNoticeVersion,
        mobilePhoneConsentRevokedAt: groupMemberContacts.mobilePhoneConsentRevokedAt,
        mobilePhoneConsentedAt: groupMemberContacts.mobilePhoneConsentedAt,
        version: groupMemberContacts.version,
      })
      .from(groupMemberContacts)
      .where(
        and(
          eq(groupMemberContacts.membershipId, membershipId),
          isNull(groupMemberContacts.deletedAt),
        ),
      )
      .limit(1);
    const [contact] = lock ? await query.for('update') : await query;
    return contact;
  }
}

function toGroupMemberContact(
  contact: {
    readonly isConfirmed: number | null;
    readonly membershipId: string;
    readonly mobilePhone: string | null;
    readonly mobilePhoneConsentFingerprint: string | null;
    readonly mobilePhoneConsentNoticeVersion: string | null;
    readonly mobilePhoneConsentRevokedAt: Date | null;
    readonly mobilePhoneConsentedAt: Date | null;
    readonly shortPhone: string | null;
    readonly updatedAt: Date | null;
    readonly version: number | null;
  },
  includeMobilePhone: boolean,
): GroupMemberContact {
  return {
    isConfirmed: contact.isConfirmed === 1,
    membershipId: contact.membershipId,
    ...(contact.mobilePhone === null || !includeMobilePhone
      ? {}
      : { mobilePhone: contact.mobilePhone }),
    ...(contact.shortPhone === null ? {} : { shortPhone: contact.shortPhone }),
    ...(contact.updatedAt === null ? {} : { updatedAt: contact.updatedAt.toISOString() }),
    version: contact.version ?? 0,
  };
}

function toMobilePhoneConsent(
  groupId: string,
  membershipId: string,
  contact: MobileConsentContactRow | undefined,
): GroupMobilePhoneConsent {
  const mobilePhone = contact?.mobilePhone ?? null;
  const state =
    mobilePhone === null
      ? 'missing-phone'
      : contact?.mobilePhoneConsentFingerprint === null &&
          contact.mobilePhoneConsentRevokedAt !== null
        ? 'not-consented'
        : 'consented';
  return {
    ...(contact?.mobilePhoneConsentedAt === null || contact?.mobilePhoneConsentedAt === undefined
      ? {}
      : { consentedAt: contact.mobilePhoneConsentedAt.toISOString() }),
    contactVersion: contact?.version ?? 0,
    groupId,
    ...(mobilePhone === null ? {} : { maskedMobilePhone: maskMobilePhone(mobilePhone) }),
    membershipId,
    noticeVersion: GROUP_MOBILE_PHONE_CONSENT_NOTICE_VERSION,
    state,
  };
}
