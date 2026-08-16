import { randomUUID } from 'node:crypto';

import type { GroupMemberContact, UpdateGroupMemberContactRequest } from '@schedule/contracts';
import {
  type DatabaseClient,
  groupMemberContacts,
  groupMemberships,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { GroupPermissionService } from './permission-service.js';

export class ContactService {
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
            ...(authorization.user.isDeveloperAdmin
              ? []
              : [eq(groupMemberships.userId, authorization.user.id)]),
            eq(groupMemberships.status, 'active'),
            eq(users.status, 'active'),
            ne(users.isDeveloperAdmin, 1),
            isNull(groupMemberships.deletedAt),
            isNull(users.deletedAt),
            isNull(userProfiles.deletedAt),
          ),
        )
        .orderBy(asc(userProfiles.realName), asc(groupMemberships.id));

      return contacts.map((contact) => toGroupMemberContact(contact));
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
      const canManageContacts = authorization.user.isDeveloperAdmin;
      const isCurrentMember = target.userId === authorization.user.id;

      if (!isCurrentMember && !canManageContacts) {
        throw new ApiError({
          code: 'FORBIDDEN',
          statusCode: 403,
          userMessage: '只能修改自己的联系方式。',
        });
      }
      if (input.isConfirmed !== undefined && !canManageContacts) {
        throw new ApiError({
          code: 'FORBIDDEN',
          statusCode: 403,
          userMessage: '只有后台管理员可以确认联系方式。',
        });
      }

      const [existing] = await transaction
        .select({
          id: groupMemberContacts.id,
          isConfirmed: groupMemberContacts.isConfirmed,
          mobilePhone: groupMemberContacts.mobilePhone,
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
      const phoneChanged =
        mobilePhone !== (existing?.mobilePhone ?? null) ||
        shortPhone !== (existing?.shortPhone ?? null);
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

        return toGroupMemberContact(created);
      }

      await transaction
        .update(groupMemberContacts)
        .set({
          isConfirmed,
          mobilePhone: mobilePhone ?? null,
          shortPhone: shortPhone ?? null,
          version: sql`${groupMemberContacts.version} + 1`,
        })
        .where(eq(groupMemberContacts.id, existing.id));

      const [updated] = await transaction
        .select({
          isConfirmed: groupMemberContacts.isConfirmed,
          membershipId: groupMemberContacts.membershipId,
          mobilePhone: groupMemberContacts.mobilePhone,
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

      return toGroupMemberContact(updated);
    });
  }
}

function toGroupMemberContact(contact: {
  readonly isConfirmed: number | null;
  readonly membershipId: string;
  readonly mobilePhone: string | null;
  readonly shortPhone: string | null;
  readonly updatedAt: Date | null;
  readonly version: number | null;
}): GroupMemberContact {
  return {
    isConfirmed: contact.isConfirmed === 1,
    membershipId: contact.membershipId,
    ...(contact.mobilePhone === null ? {} : { mobilePhone: contact.mobilePhone }),
    ...(contact.shortPhone === null ? {} : { shortPhone: contact.shortPhone }),
    ...(contact.updatedAt === null ? {} : { updatedAt: contact.updatedAt.toISOString() }),
    version: contact.version ?? 0,
  };
}
