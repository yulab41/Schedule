import type {
  AddGroupMembersRequest,
  AddRosterEntriesRequest,
  ClaimGroupRequest,
  ConvertPendingRosterRequest,
  CreateGroupRequest,
  RegenerateGroupCodeRequest,
  TransferGroupOwnershipRequest,
  UpdateGroupMemberContactRequest,
  UpdateGroupMemberRoleRequest,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { ContactService } from './contact-service.js';
import { GroupService } from './group-service.js';
import { MembershipService } from './membership-service.js';

const groupCodeSchema = z.string().regex(/^\d{4}$/);
const groupIdSchema = z.string().uuid();
const groupNameSchema = z.string().trim().min(1).max(100);
const realNameSchema = z.string().trim().min(1).max(100);

const createGroupInputSchema = z
  .object({
    groupCode: groupCodeSchema.optional(),
    name: groupNameSchema,
  })
  .strict();

const rosterEntriesInputSchema = z
  .object({
    realNames: z.array(realNameSchema).min(1).max(500),
  })
  .strict();

const convertRosterEntriesInputSchema = z
  .object({
    realNames: z.array(realNameSchema).min(1).max(500),
  })
  .strict();

const addGroupMembersInputSchema = z
  .object({
    realNames: z.array(realNameSchema).min(1).max(100),
  })
  .strict();

const claimGroupInputSchema = z
  .object({
    groupCode: groupCodeSchema,
    realName: realNameSchema.optional(),
  })
  .strict();

const regenerateGroupCodeInputSchema = z
  .object({
    groupCode: groupCodeSchema.optional(),
  })
  .strict();

const membershipRoleSchema = z.enum(['administrator', 'member']);
const membershipIdSchema = z.string().uuid();
const claimRequestIdSchema = z.string().uuid();
const phoneSchema = z.string().trim().min(1).max(32);

const updateMemberRoleInputSchema = z
  .object({
    role: membershipRoleSchema,
  })
  .strict();

const transferOwnershipInputSchema = z
  .object({
    membershipId: membershipIdSchema,
  })
  .strict();

const claimLookupInputSchema = z
  .object({
    realName: realNameSchema,
  })
  .strict();

const createMembershipClaimInputSchema = z
  .object({
    membershipId: membershipIdSchema,
  })
  .strict();

const updateContactInputSchema = z
  .object({
    confirm: z.literal(true).optional(),
    mobilePhone: phoneSchema.nullable().optional(),
    shortPhone: phoneSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.confirm === true || input.mobilePhone !== undefined || input.shortPhone !== undefined,
  );

export function registerGroupRoutes(
  app: FastifyInstance,
  groupService: GroupService,
  membershipService: MembershipService,
  contactService: ContactService,
): void {
  app.post('/groups', { preHandler: app.authenticate }, async (request, reply) => {
    const group = await groupService.create(
      getAuthenticatedIdentity(request),
      parseCreateGroupInput(request.body),
    );

    return reply.code(201).send(group);
  });

  app.post('/groups/claim', { preHandler: app.authenticate }, async (request, reply) => {
    const result = await groupService.claim(
      getAuthenticatedIdentity(request),
      parseClaimGroupInput(request.body),
    );

    return reply.code(result.status === 'claimed' ? 201 : 202).send(result);
  });

  app.get('/groups', { preHandler: app.authenticate }, async (request) =>
    membershipService.listGroups(getAuthenticatedIdentity(request)),
  );

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
        parseCreateMembershipClaimInput(request.body),
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
      ),
  );

  app.post(
    '/groups/:groupId/members/:membershipId/revoke-claim',
    { preHandler: app.authenticate },
    (request) =>
      membershipService.revokeClaim(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseMembershipId(request),
      ),
  );

  app.delete(
    '/groups/:groupId/members/:membershipId',
    { preHandler: app.authenticate },
    async (request) =>
      membershipService.deleteMember(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseMembershipId(request),
      ),
  );

  app.get('/groups/:groupId/contacts', { preHandler: app.authenticate }, async (request) =>
    contactService.listContacts(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.post('/groups/:groupId/roster-entries', { preHandler: app.authenticate }, async (request) =>
    groupService.addRosterEntries(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseRosterEntriesInput(request.body),
    ),
  );

  app.post(
    '/groups/:groupId/roster-entries/convert',
    { preHandler: app.authenticate },
    async (request) =>
      groupService.convertRosterEntries(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseConvertRosterEntriesInput(request.body),
      ),
  );

  app.post('/groups/:groupId/members', { preHandler: app.authenticate }, async (request) =>
    groupService.addGroupMembers(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseAddGroupMembersInput(request.body),
    ),
  );

  app.put('/groups/:groupId/group-code', { preHandler: app.authenticate }, async (request) =>
    groupService.regenerateCode(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseRegenerateGroupCodeInput(request.body),
    ),
  );

  app.put(
    '/groups/:groupId/members/:membershipId/role',
    { preHandler: app.authenticate },
    async (request) =>
      membershipService.updateMemberRole(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseMembershipId(request),
        parseUpdateMemberRoleInput(request.body),
      ),
  );

  app.post('/groups/:groupId/owner-transfer', { preHandler: app.authenticate }, async (request) =>
    membershipService.transferOwnership(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseTransferOwnershipInput(request.body),
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
        parseUpdateContactInput(request.body),
      ),
  );

  app.delete('/groups/:groupId', { preHandler: app.authenticate }, async (request, reply) => {
    await membershipService.deleteGroup(getAuthenticatedIdentity(request), parseGroupId(request));
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

function parseCreateGroupInput(value: unknown): CreateGroupRequest {
  const result = createGroupInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data.groupCode === undefined
    ? { name: result.data.name }
    : { groupCode: result.data.groupCode, name: result.data.name };
}

function parseRosterEntriesInput(value: unknown): AddRosterEntriesRequest {
  const result = rosterEntriesInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function parseConvertRosterEntriesInput(value: unknown): ConvertPendingRosterRequest {
  const result = convertRosterEntriesInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function parseAddGroupMembersInput(value: unknown): AddGroupMembersRequest {
  const result = addGroupMembersInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function parseClaimGroupInput(value: unknown): ClaimGroupRequest {
  const result = claimGroupInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return {
    groupCode: result.data.groupCode,
    ...(result.data.realName === undefined ? {} : { realName: result.data.realName }),
  };
}

function parseRegenerateGroupCodeInput(value: unknown): RegenerateGroupCodeRequest {
  const result = regenerateGroupCodeInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data.groupCode === undefined ? {} : { groupCode: result.data.groupCode };
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

function parseUpdateMemberRoleInput(value: unknown): UpdateGroupMemberRoleRequest {
  const result = updateMemberRoleInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function parseTransferOwnershipInput(value: unknown): TransferGroupOwnershipRequest {
  const result = transferOwnershipInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function parseClaimLookupInput(value: unknown): { readonly realName: string } {
  const result = claimLookupInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function parseCreateMembershipClaimInput(value: unknown): {
  readonly membershipId: string;
} {
  const result = createMembershipClaimInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
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

function parseUpdateContactInput(value: unknown): UpdateGroupMemberContactRequest {
  const result = updateContactInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return {
    ...(result.data.confirm === undefined ? {} : { confirm: result.data.confirm }),
    ...(result.data.mobilePhone === undefined ? {} : { mobilePhone: result.data.mobilePhone }),
    ...(result.data.shortPhone === undefined ? {} : { shortPhone: result.data.shortPhone }),
  };
}

function throwValidationError(): never {
  throw new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '请求数据不符合要求。',
  });
}
