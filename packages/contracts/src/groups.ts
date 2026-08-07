import { z } from 'zod';

export const groupRoleSchema = z.enum(['administrator', 'member', 'owner']);
export type GroupRole = z.infer<typeof groupRoleSchema>;

export const groupSummarySchema = z
  .object({
    groupCode: z.string().regex(/^\d{4}$/u),
    id: z.string().min(1),
    name: z.string().min(1),
    role: groupRoleSchema,
    version: z.number().int().min(1),
  })
  .strict();
export type GroupSummary = z.infer<typeof groupSummarySchema>;

export interface CreateGroupRequest {
  readonly groupCode?: string;
  readonly name: string;
}

export interface AddRosterEntriesRequest {
  readonly realNames: readonly string[];
}

export const addRosterEntriesResponseSchema = z
  .object({
    added: z.number().int().min(1),
  })
  .strict();
export type AddRosterEntriesResponse = z.infer<typeof addRosterEntriesResponseSchema>;

export interface AddGroupMembersRequest {
  readonly realNames: readonly string[];
}

export interface AddGroupMembersResponse {
  readonly added: number;
}

export interface ConvertPendingRosterRequest {
  readonly realNames: readonly string[];
}

export const convertPendingRosterResponseSchema = z
  .object({
    converted: z.number().int().min(0),
    skipped: z.number().int().min(0),
  })
  .strict();
export type ConvertPendingRosterResponse = z.infer<typeof convertPendingRosterResponseSchema>;

export interface ClaimGroupRequest {
  readonly groupCode: string;
  readonly realName?: string;
}

export const claimGroupResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('request_created') }).strict(),
  z.object({ status: z.literal('claimed'), group: groupSummarySchema }).strict(),
]);
export type ClaimGroupResponse = z.infer<typeof claimGroupResponseSchema>;

export interface RegenerateGroupCodeRequest {
  readonly groupCode?: string;
}

export const groupMemberSchema = z
  .object({
    claimRequestStatus: z.enum(['pending', 'rejected']).optional(),
    claimedByName: z.string().optional(),
    id: z.string().min(1),
    isClaimedByCurrentUser: z.boolean().optional(),
    isCurrentUser: z.boolean(),
    isPendingRoster: z.boolean().optional(),
    isUnclaimed: z.boolean().optional(),
    realName: z.string().min(1),
    role: groupRoleSchema,
  })
  .strict();
export type GroupMember = z.infer<typeof groupMemberSchema>;

export const membershipClaimRequestStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);
export type MembershipClaimRequestStatus = z.infer<typeof membershipClaimRequestStatusSchema>;

export interface MembershipClaimLookupRequest {
  readonly realName: string;
}

export const membershipClaimLookupEntrySchema = z
  .object({
    isUnclaimed: z.boolean(),
    membershipId: z.string().min(1),
    realName: z.string().min(1),
    role: groupRoleSchema,
  })
  .strict();
export type MembershipClaimLookupEntry = z.infer<typeof membershipClaimLookupEntrySchema>;

export const membershipClaimLookupResponseSchema = z
  .object({
    matches: z.readonly(z.array(membershipClaimLookupEntrySchema)),
  })
  .strict();
export type MembershipClaimLookupResponse = z.infer<typeof membershipClaimLookupResponseSchema>;

export interface CreateMembershipClaimRequest {
  readonly membershipId: string;
}

export const membershipClaimRequestSchema = z
  .object({
    createdAt: z.string(),
    decidedAt: z.string().optional(),
    decidedByRealName: z.string().optional(),
    decidedByUserId: z.string().optional(),
    groupId: z.string().min(1),
    id: z.string().min(1),
    requestingUserId: z.string().min(1),
    requestingUserRealName: z.string(),
    status: membershipClaimRequestStatusSchema,
    targetMemberRealName: z.string(),
    targetMembershipId: z.string().min(1),
    version: z.number(),
  })
  .strict();
export type MembershipClaimRequest = z.infer<typeof membershipClaimRequestSchema>;

export const membershipClaimRequestListSchema = z.array(membershipClaimRequestSchema);

export const createMembershipClaimResponseSchema = z.discriminatedUnion('direct', [
  z.object({ direct: z.literal(true), request: z.undefined().optional() }).strict(),
  z.object({ direct: z.literal(false), request: membershipClaimRequestSchema }).strict(),
]);
export type CreateMembershipClaimResponse = z.infer<typeof createMembershipClaimResponseSchema>;

export const groupMemberContactSchema = z
  .object({
    isConfirmed: z.boolean(),
    membershipId: z.string().min(1),
    mobilePhone: z.string().optional(),
    shortPhone: z.string().optional(),
    updatedAt: z.string().optional(),
    version: z.number().int().min(0),
  })
  .strict();
export type GroupMemberContact = z.infer<typeof groupMemberContactSchema>;

export const groupMemberContactListSchema = z.array(groupMemberContactSchema);
export const groupMemberListSchema = z.array(groupMemberSchema);
export const groupSummaryListSchema = z.array(groupSummarySchema);

export interface UpdateGroupMemberRoleRequest {
  readonly role: Extract<GroupRole, 'administrator' | 'member'>;
}

export interface TransferGroupOwnershipRequest {
  readonly membershipId: string;
}

export interface UpdateGroupMemberContactRequest {
  readonly confirm?: true;
  readonly mobilePhone?: string | null;
  readonly shortPhone?: string | null;
}
