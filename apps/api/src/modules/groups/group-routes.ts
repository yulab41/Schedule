import {
  updateGroupMobilePhoneConsentRequestSchema,
  type AddGroupMembersRequest,
  type AddRosterEntriesRequest,
  type ClaimGroupRequest,
  type ConvertPendingRosterRequest,
  type CreateGroupRequest,
  type CreateMembershipClaimRequest,
  type GroupMemberVersionMutationRequest,
  type GroupVersionMutationRequest,
  type MembershipClaimDecisionRequest,
  type OrganizationOperationRequest,
  type TransferGroupOwnershipRequest,
  type UpdateGroupCodeRequest,
  type UpdateGroupMemberContactRequest,
  type UpdateGroupMemberNameRequest,
  type UpdateGroupMemberRoleRequest,
  type UpdateGroupMobilePhoneConsentRequest,
  type UpdateGroupNameRequest,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { resolveDangerousOperationId } from '../../plugins/operation-id.js';
import type { VisitorAccessLogService } from '../calendar/visitor-access-log.js';
import { ContactService } from './contact-service.js';
import { GroupService } from './group-service.js';
import { MembershipService } from './membership-service.js';
import type { VisitorKeyService } from './visitor-key-service.js';

const groupCodeSchema = z.string().regex(/^\d{4}$/);
const groupIdSchema = z.string().uuid();
const groupNameSchema = z.string().trim().min(1).max(100);
const realNameSchema = z.string().trim().min(1).max(100);
const operationIdSchema = z.string().uuid().optional();
const expectedVersionSchema = z.number().int().min(1);

const createGroupInputSchema = z
  .object({
    groupCode: groupCodeSchema,
    name: groupNameSchema,
    operationId: operationIdSchema,
  })
  .strict();

const rosterEntriesInputSchema = z
  .object({
    operationId: operationIdSchema,
    realNames: z.array(realNameSchema).min(1).max(500),
  })
  .strict();

const convertRosterEntriesInputSchema = z
  .object({
    operationId: operationIdSchema,
    realNames: z.array(realNameSchema).min(1).max(500),
  })
  .strict();

const addGroupMembersInputSchema = z
  .object({
    operationId: operationIdSchema,
    realNames: z.array(realNameSchema).min(1).max(100),
  })
  .strict();

const claimGroupInputSchema = z
  .object({
    groupCode: groupCodeSchema,
    operationId: operationIdSchema,
  })
  .strict();

const updateGroupCodeInputSchema = z
  .object({
    expectedVersion: expectedVersionSchema,
    groupCode: groupCodeSchema,
    operationId: operationIdSchema,
  })
  .strict();

const updateGroupNameInputSchema = z
  .object({
    expectedVersion: expectedVersionSchema,
    name: groupNameSchema,
    operationId: operationIdSchema,
  })
  .strict();

const membershipRoleSchema = z.enum(['administrator', 'member']);
const membershipIdSchema = z.string().uuid();
const claimRequestIdSchema = z.string().uuid();
const phoneSchema = z.string().trim().min(1).max(32);

const updateMemberRoleInputSchema = z
  .object({
    expectedVersion: expectedVersionSchema,
    operationId: operationIdSchema,
    role: membershipRoleSchema,
  })
  .strict();

const transferOwnershipInputSchema = z
  .object({
    expectedGroupVersion: expectedVersionSchema,
    expectedMemberVersion: expectedVersionSchema,
    membershipId: membershipIdSchema,
    operationId: operationIdSchema,
  })
  .strict();

const claimLookupInputSchema = z
  .object({
    realName: realNameSchema,
  })
  .strict();

const createMembershipClaimInputSchema = z
  .object({
    expectedMemberVersion: expectedVersionSchema,
    membershipId: membershipIdSchema,
    operationId: operationIdSchema,
  })
  .strict();

const updateContactInputSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
    isConfirmed: z.boolean().optional(),
    mobilePhone: phoneSchema.nullable().optional(),
    operationId: operationIdSchema,
    shortPhone: phoneSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.isConfirmed !== undefined ||
      input.mobilePhone !== undefined ||
      input.shortPhone !== undefined,
  );
const organizationOperationInputSchema = z.object({ operationId: operationIdSchema }).strict();
const versionMutationInputSchema = z
  .object({ expectedVersion: expectedVersionSchema, operationId: operationIdSchema })
  .strict();
const visitorLogsQuerySchema = z
  .object({
    cursor: z.string().min(1).max(100).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();
const visitorAggregatesQuerySchema = z
  .object({
    cursor: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])\|\d{4}-(0[1-9]|1[0-2])$/u)
      .optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export function registerGroupRoutes(
  app: FastifyInstance,
  groupService: GroupService,
  membershipService: MembershipService,
  contactService: ContactService,
  visitorKeyService: VisitorKeyService,
  visitorAccessLogService: VisitorAccessLogService,
): void {
  app.post('/groups', { preHandler: app.authenticate }, async (request, reply) => {
    const group = await groupService.create(
      getAuthenticatedIdentity(request),
      parseCreateGroupInput(request),
    );

    return reply.code(201).send(group);
  });

  app.post('/groups/claim', { preHandler: app.authenticate }, async (request, reply) => {
    const result = await groupService.claim(
      getAuthenticatedIdentity(request),
      parseClaimGroupInput(request),
    );

    return reply.code(result.status === 'claimed' ? 201 : 202).send(result);
  });

  app.get('/groups', { preHandler: app.authenticate }, async (request) =>
    membershipService.listGroups(getAuthenticatedIdentity(request)),
  );

  app.get('/groups/catalog', { preHandler: app.authenticate }, async (request) =>
    membershipService.listCatalog(getAuthenticatedIdentity(request)),
  );

  app.post(
    '/groups/:groupId/join-guest',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const group = await membershipService.joinAsGuest(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseOrganizationOperationInput(request),
      );
      return reply.code(201).send(group);
    },
  );

  app.post('/groups/:groupId/leave', { preHandler: app.authenticate }, async (request, reply) => {
    await membershipService.leaveGroup(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseOrganizationOperationInput(request),
    );
    return reply.code(204).send();
  });

  app.get('/groups/:groupId/members', { preHandler: app.authenticate }, async (request) =>
    membershipService.listMembers(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.post('/groups/:groupId/claim-lookups', { preHandler: app.authenticate }, async (request) =>
    membershipService.lookupClaimMatches(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseClaimLookupInput(request.body),
    ),
  );

  app.post(
    '/groups/:groupId/claim-requests',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const result = await membershipService.createClaimRequest(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseCreateMembershipClaimInput(request),
      );
      return reply.code(result.direct ? 201 : 202).send(result);
    },
  );

  app.get('/groups/:groupId/claim-requests', { preHandler: app.authenticate }, async (request) =>
    membershipService.listClaimRequests(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.post(
    '/groups/:groupId/claim-requests/:claimRequestId/approve',
    { preHandler: app.authenticate },
    (request) =>
      membershipService.approveClaimRequest(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseClaimRequestId(request),
        parseClaimDecisionInput(request),
      ),
  );

  app.post(
    '/groups/:groupId/claim-requests/:claimRequestId/reject',
    { preHandler: app.authenticate },
    (request) =>
      membershipService.rejectClaimRequest(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseClaimRequestId(request),
        parseClaimDecisionInput(request),
      ),
  );

  app.post(
    '/groups/:groupId/members/:membershipId/revoke-claim',
    { preHandler: app.authenticate },
    async (request) => {
      await membershipService.revokeClaim(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseMembershipId(request),
        parseMemberVersionMutationInput(request),
      );
    },
  );

  app.delete(
    '/groups/:groupId/members/:membershipId',
    { preHandler: app.authenticate },
    async (request) => {
      await membershipService.deleteMember(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseMembershipId(request),
        parseMemberVersionMutationInput(request),
      );
    },
  );

  app.get('/groups/:groupId/contacts', { preHandler: app.authenticate }, async (request) =>
    contactService.listContacts(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.get(
    '/groups/:groupId/mobile-phone-consent',
    { preHandler: app.authenticate },
    async (request) =>
      contactService.getMobilePhoneConsent(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
      ),
  );

  app.post('/groups/:groupId/roster-entries', { preHandler: app.authenticate }, async (request) =>
    groupService.addRosterEntries(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseRosterEntriesInput(request),
    ),
  );

  app.post(
    '/groups/:groupId/roster-entries/convert',
    { preHandler: app.authenticate },
    async (request) =>
      groupService.convertRosterEntries(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseConvertRosterEntriesInput(request),
      ),
  );

  app.post('/groups/:groupId/members', { preHandler: app.authenticate }, async (request) =>
    groupService.addGroupMembers(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseAddGroupMembersInput(request),
    ),
  );

  app.put('/groups/:groupId/group-code', { preHandler: app.authenticate }, async (request) =>
    groupService.updateCode(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseUpdateGroupCodeInput(request),
    ),
  );

  app.put('/groups/:groupId/visitor-key', { preHandler: app.authenticate }, async (request) =>
    visitorKeyService.regenerateKey(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseGroupVersionMutationInput(request),
    ),
  );

  app.get('/groups/:groupId/group-qr', { preHandler: app.authenticate }, async (request) => {
    const gateway = app.wechatGateway;
    if (gateway === undefined) {
      throw new ApiError({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
        userMessage: '群组小程序码暂不可用。',
      });
    }
    return visitorKeyService.getGroupQr(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      gateway,
      process.env.WECHAT_QR_ENV_VERSION ?? 'release',
    );
  });

  app.get(
    '/groups/:groupId/visitor-access-logs',
    { preHandler: app.authenticate },
    async (request) => {
      const query = parseOrThrow(visitorLogsQuerySchema, request.query);
      return visitorAccessLogService.listLogs(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        query.cursor,
        query.pageSize,
      );
    },
  );

  app.get(
    '/groups/:groupId/visitor-access-aggregates',
    { preHandler: app.authenticate },
    async (request) => {
      const query = parseOrThrow(visitorAggregatesQuerySchema, request.query);
      return visitorAccessLogService.listAggregates(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        query.cursor,
        query.pageSize,
      );
    },
  );

  app.put('/groups/:groupId/name', { preHandler: app.authenticate }, async (request) =>
    groupService.updateName(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseUpdateGroupNameInput(request),
    ),
  );

  app.get('/groups/dissolved', { preHandler: app.authenticate }, async (request) =>
    groupService.listDissolved(getAuthenticatedIdentity(request)),
  );

  app.put(
    '/groups/:groupId/members/:membershipId/role',
    { preHandler: app.authenticate },
    async (request) =>
      membershipService.updateMemberRole(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseMembershipId(request),
        parseUpdateMemberRoleInput(request),
      ),
  );

  app.put(
    '/groups/:groupId/members/:membershipId/name',
    { preHandler: app.authenticate },
    async (request) =>
      membershipService.updateMemberName(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseMembershipId(request),
        parseUpdateMemberNameInput(request),
      ),
  );

  app.post('/groups/:groupId/owner-transfer', { preHandler: app.authenticate }, async (request) =>
    membershipService.transferOwnership(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseTransferOwnershipInput(request),
    ),
  );

  app.put(
    '/groups/:groupId/members/:membershipId/contact',
    { preHandler: app.authenticate },
    async (request) =>
      contactService.updateContact(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseMembershipId(request),
        parseUpdateContactInput(request),
      ),
  );

  app.put(
    '/groups/:groupId/mobile-phone-consent',
    { preHandler: app.authenticate },
    async (request) => {
      const input = parseMobilePhoneConsentInput(request.body);
      return contactService.updateMobilePhoneConsent(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        input,
        resolveDangerousOperationId(request.headers['idempotency-key'], input.operationId),
      );
    },
  );

  app.delete('/groups/:groupId', { preHandler: app.authenticate }, async (request, reply) => {
    await membershipService.deleteGroup(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseGroupVersionMutationInput(request),
    );
    return reply.code(204).send();
  });

  app.post('/groups/:groupId/restore', { preHandler: app.authenticate }, async (request, reply) => {
    await groupService.restoreGroup(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseGroupVersionMutationInput(request),
    );
    return reply.code(204).send();
  });
}

function getAuthenticatedIdentity(request: FastifyRequest) {
  if (request.authenticatedIdentity === null) {
    throw new ApiError({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
      userMessage: '需要先登录后才能继续。',
    });
  }

  return request.authenticatedIdentity;
}

function parseCreateGroupInput(request: FastifyRequest): CreateGroupRequest {
  return parseDangerousBody(request, createGroupInputSchema) as CreateGroupRequest;
}

function parseRosterEntriesInput(request: FastifyRequest): AddRosterEntriesRequest {
  return parseDangerousBody(request, rosterEntriesInputSchema) as AddRosterEntriesRequest;
}

function parseConvertRosterEntriesInput(request: FastifyRequest): ConvertPendingRosterRequest {
  return parseDangerousBody(
    request,
    convertRosterEntriesInputSchema,
  ) as ConvertPendingRosterRequest;
}

function parseAddGroupMembersInput(request: FastifyRequest): AddGroupMembersRequest {
  return parseDangerousBody(request, addGroupMembersInputSchema) as AddGroupMembersRequest;
}

function parseClaimGroupInput(request: FastifyRequest): ClaimGroupRequest {
  return parseDangerousBody(request, claimGroupInputSchema) as ClaimGroupRequest;
}

function parseUpdateGroupCodeInput(request: FastifyRequest): UpdateGroupCodeRequest {
  return parseDangerousBody(request, updateGroupCodeInputSchema) as UpdateGroupCodeRequest;
}

function parseUpdateGroupNameInput(request: FastifyRequest): UpdateGroupNameRequest {
  return parseDangerousBody(request, updateGroupNameInputSchema) as UpdateGroupNameRequest;
}

function parseGroupId(request: FastifyRequest): string {
  const result = groupIdSchema.safeParse((request.params as { groupId?: unknown }).groupId);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function parseMembershipId(request: FastifyRequest): string {
  const result = membershipIdSchema.safeParse(
    (request.params as { membershipId?: unknown }).membershipId,
  );
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function parseUpdateMemberRoleInput(request: FastifyRequest): UpdateGroupMemberRoleRequest {
  return parseDangerousBody(request, updateMemberRoleInputSchema) as UpdateGroupMemberRoleRequest;
}

function parseTransferOwnershipInput(request: FastifyRequest): TransferGroupOwnershipRequest {
  return parseDangerousBody(request, transferOwnershipInputSchema) as TransferGroupOwnershipRequest;
}

function parseClaimLookupInput(value: unknown): { readonly realName: string } {
  const result = claimLookupInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function parseCreateMembershipClaimInput(request: FastifyRequest): CreateMembershipClaimRequest {
  return parseDangerousBody(
    request,
    createMembershipClaimInputSchema,
  ) as CreateMembershipClaimRequest;
}

function parseClaimRequestId(request: FastifyRequest): string {
  const result = claimRequestIdSchema.safeParse(
    (request.params as { claimRequestId?: unknown }).claimRequestId,
  );
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function parseUpdateContactInput(request: FastifyRequest): UpdateGroupMemberContactRequest {
  return parseDangerousBody(request, updateContactInputSchema) as UpdateGroupMemberContactRequest;
}

function parseMobilePhoneConsentInput(value: unknown): UpdateGroupMobilePhoneConsentRequest {
  const result = updateGroupMobilePhoneConsentRequestSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }
  return result.data;
}

function parseUpdateMemberNameInput(request: FastifyRequest): UpdateGroupMemberNameRequest {
  return parseDangerousBody(
    request,
    z
      .object({
        expectedVersion: expectedVersionSchema,
        operationId: operationIdSchema,
        realName: realNameSchema,
      })
      .strict(),
  ) as UpdateGroupMemberNameRequest;
}

function parseOrganizationOperationInput(request: FastifyRequest): OrganizationOperationRequest {
  return parseDangerousBody(
    request,
    organizationOperationInputSchema,
  ) as OrganizationOperationRequest;
}

function parseGroupVersionMutationInput(request: FastifyRequest): GroupVersionMutationRequest {
  return parseDangerousBody(request, versionMutationInputSchema) as GroupVersionMutationRequest;
}

function parseMemberVersionMutationInput(
  request: FastifyRequest,
): GroupMemberVersionMutationRequest {
  return parseDangerousBody(
    request,
    versionMutationInputSchema,
  ) as GroupMemberVersionMutationRequest;
}

function parseClaimDecisionInput(request: FastifyRequest): MembershipClaimDecisionRequest {
  return parseDangerousBody(request, versionMutationInputSchema) as MembershipClaimDecisionRequest;
}

function parseDangerousBody<Parsed extends { readonly operationId?: string | undefined }>(
  request: FastifyRequest,
  schema: z.ZodType<Parsed>,
): Parsed & { readonly operationId: string } {
  const result = schema.safeParse(request.body ?? {});
  if (!result.success) throwValidationError();
  return {
    ...result.data,
    operationId: resolveDangerousOperationId(
      request.headers['idempotency-key'],
      result.data.operationId,
    ),
  };
}

function throwValidationError(): never {
  throw new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '请求数据不符合要求。',
  });
}

function parseOrThrow<Output>(schema: z.ZodType<Output>, value: unknown): Output {
  const result = schema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}
