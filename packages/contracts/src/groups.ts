import { z } from 'zod';

export const groupRoleSchema = z.enum(['administrator', 'member', 'owner', 'guest']);
export type GroupRole = z.infer<typeof groupRoleSchema>;

export const groupSummarySchema = z
  .object({
    id: z.string().min(1),
    isDeveloperAdmin: z.boolean().optional(),
    name: z.string().min(1),
    role: groupRoleSchema,
    version: z.number().int().min(1),
  })
  .strict();
export type GroupSummary = z.infer<typeof groupSummarySchema>;

export interface CreateGroupRequest {
  readonly name: string;
  readonly operationId: string;
}

export interface AddRosterEntriesRequest {
  readonly operationId: string;
  readonly realNames: readonly string[];
}

export const addRosterEntriesResponseSchema = z
  .object({
    added: z.number().int().min(1),
  })
  .strict();
export type AddRosterEntriesResponse = z.infer<typeof addRosterEntriesResponseSchema>;

export interface AddGroupMembersRequest {
  readonly operationId: string;
  readonly realNames: readonly string[];
}

export const addGroupMembersResponseSchema = addRosterEntriesResponseSchema;
export type AddGroupMembersResponse = z.infer<typeof addGroupMembersResponseSchema>;

export interface ConvertPendingRosterRequest {
  readonly operationId: string;
  readonly realNames: readonly string[];
}

export const convertPendingRosterResponseSchema = z
  .object({
    converted: z.number().int().min(0),
    skipped: z.number().int().min(0),
  })
  .strict();
export type ConvertPendingRosterResponse = z.infer<typeof convertPendingRosterResponseSchema>;

export const groupMemberSchema = z
  .object({
    id: z.string().min(1),
    isCurrentUser: z.boolean(),
    isPendingRoster: z.boolean().optional(),
    isUnclaimed: z.boolean().optional(),
    realName: z.string().min(1),
    role: groupRoleSchema,
    version: z.number().int().min(1),
  })
  .strict();
export type GroupMember = z.infer<typeof groupMemberSchema>;

export const groupMemberContactSchema = z
  .object({
    employeeCodes: z.array(z.string()).optional(),
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

export const GROUP_MOBILE_PHONE_CONSENT_NOTICE_VERSION = 'v1';

export const groupMobilePhoneConsentSchema = z
  .object({
    consentedAt: z.string().datetime().optional(),
    contactVersion: z.number().int().nonnegative(),
    groupId: z.string().uuid(),
    maskedMobilePhone: z.string().min(1).max(32).optional(),
    membershipId: z.string().uuid(),
    noticeVersion: z.literal(GROUP_MOBILE_PHONE_CONSENT_NOTICE_VERSION),
    state: z.enum(['missing-phone', 'not-consented', 'consented', 'stale']),
  })
  .strict();
export type GroupMobilePhoneConsent = z.infer<typeof groupMobilePhoneConsentSchema>;

export const updateGroupMobilePhoneConsentRequestSchema = z
  .object({
    consented: z.boolean(),
    expectedContactVersion: z.number().int().nonnegative(),
    noticeVersion: z.literal(GROUP_MOBILE_PHONE_CONSENT_NOTICE_VERSION),
    operationId: z.string().uuid().optional(),
  })
  .strict();
export type UpdateGroupMobilePhoneConsentRequest = z.infer<
  typeof updateGroupMobilePhoneConsentRequestSchema
>;

export const groupCatalogRelationSchema = z.enum([
  'none',
  'active-member',
  'active-guest',
  'left-member',
]);
export type GroupCatalogRelation = z.infer<typeof groupCatalogRelationSchema>;

export const groupCatalogEntrySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    relation: groupCatalogRelationSchema,
  })
  .strict();
export type GroupCatalogEntry = z.infer<typeof groupCatalogEntrySchema>;

export const groupCatalogListSchema = z.array(groupCatalogEntrySchema);

export const updateGroupNameRequestSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    name: z.string().trim().min(1).max(100),
    operationId: z.string().uuid(),
  })
  .strict();
export interface UpdateGroupNameRequest {
  readonly expectedVersion: number;
  readonly name: string;
  readonly operationId: string;
}

export const dissolvedGroupSchema = z
  .object({
    deletedAt: z.string(),
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.number().int().min(1),
  })
  .strict();
export type DissolvedGroup = z.infer<typeof dissolvedGroupSchema>;

export const dissolvedGroupListSchema = z.array(dissolvedGroupSchema);

export interface UpdateGroupMemberRoleRequest {
  readonly expectedVersion: number;
  readonly operationId: string;
  readonly role: Extract<GroupRole, 'administrator' | 'member'>;
}

export interface TransferGroupOwnershipRequest {
  readonly expectedGroupVersion: number;
  readonly expectedMemberVersion: number;
  readonly membershipId: string;
  readonly operationId: string;
}

export interface UpdateGroupMemberContactRequest {
  readonly expectedVersion: number;
  readonly isConfirmed?: boolean;
  readonly mobilePhone?: string | null;
  readonly operationId: string;
  readonly shortPhone?: string | null;
}

export interface UpdateGroupMemberNameRequest {
  readonly expectedVersion: number;
  readonly operationId: string;
  readonly realName: string;
}

export interface OrganizationOperationRequest {
  readonly operationId: string;
}

export interface GroupVersionMutationRequest {
  readonly expectedVersion: number;
  readonly operationId: string;
}

export interface GroupMemberVersionMutationRequest {
  readonly expectedVersion: number;
  readonly operationId: string;
}

export const organizationMutationCompletedSchema = z
  .object({ completed: z.literal(true) })
  .strict();
export type OrganizationMutationCompleted = z.infer<typeof organizationMutationCompletedSchema>;
