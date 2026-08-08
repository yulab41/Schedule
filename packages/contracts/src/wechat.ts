import { z } from 'zod';

import { groupSummarySchema } from './groups.js';
import { userProfileSchema } from './users.js';

export const wechatLoginRequestSchema = z
  .object({
    code: z.string().min(1),
  })
  .strict();
export type WechatLoginRequest = z.infer<typeof wechatLoginRequestSchema>;

export const wechatLoginResponseSchema = z
  .object({
    isNewUser: z.boolean(),
    profile: userProfileSchema.optional(),
    token: z.string().min(1),
  })
  .strict();
export type WechatLoginResponse = z.infer<typeof wechatLoginResponseSchema>;

export const visitorResolveRequestSchema = z
  .object({
    visitorKey: z.string().regex(/^[0-9a-f]{32}$/iu),
  })
  .strict();
export type VisitorResolveRequest = z.infer<typeof visitorResolveRequestSchema>;

export const visitorResolveResponseSchema = z
  .object({
    groupId: z.string().min(1),
    groupName: z.string().min(1),
  })
  .strict();
export type VisitorResolveResponse = z.infer<typeof visitorResolveResponseSchema>;

export const visitorAccessLogSchema = z
  .object({
    businessMonth: z.string().regex(/^\d{4}-\d{2}$/u),
    clientIp: z.string().optional(),
    createdAt: z.string(),
    groupId: z.string().min(1),
    id: z.string().min(1),
    requestId: z.string().optional(),
  })
  .strict();
export type VisitorAccessLog = z.infer<typeof visitorAccessLogSchema>;

export const visitorAccessLogPageSchema = z
  .object({
    logs: z.readonly(z.array(visitorAccessLogSchema)),
    nextCursor: z.string().optional(),
  })
  .strict();
export type VisitorAccessLogPage = z.infer<typeof visitorAccessLogPageSchema>;

export const groupQrResponseSchema = z
  .object({
    imageBase64: z.string().min(1),
  })
  .strict();
export type GroupQrResponse = z.infer<typeof groupQrResponseSchema>;

export const visitorKeyChangedResponseSchema = z
  .object({
    visitorKeyChanged: z.literal(true),
  })
  .strict();
export type VisitorKeyChangedResponse = z.infer<typeof visitorKeyChangedResponseSchema>;

export const invitePermissionRoleSchema = z.enum(['member', 'administrator']);
export type InvitePermissionRole = z.infer<typeof invitePermissionRoleSchema>;

export const inviteStatusSchema = z.enum(['pending', 'used', 'revoked', 'expired']);
export type InviteStatus = z.infer<typeof inviteStatusSchema>;

export const createInviteLinkRequestSchema = z
  .object({
    permissionRole: invitePermissionRoleSchema.optional(),
    scheduleRoleId: z.string().min(1).optional(),
    targetMembershipId: z.string().min(1).optional(),
    targetRosterEntryId: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (value) =>
      (value.targetMembershipId === undefined) !== (value.targetRosterEntryId === undefined),
    { message: 'exactly one of targetMembershipId or targetRosterEntryId is required' },
  );
export type CreateInviteLinkRequest = z.infer<typeof createInviteLinkRequestSchema>;

export const createInviteLinkResponseSchema = z
  .object({
    expiresAt: z.string(),
    groupName: z.string().min(1),
    permissionRole: invitePermissionRoleSchema,
    realName: z.string().min(1),
    scheduleRoleName: z.string().optional(),
    sharePath: z.string().min(1),
    token: z.string().min(1),
  })
  .strict();
export type CreateInviteLinkResponse = z.infer<typeof createInviteLinkResponseSchema>;

export const resolveInviteRequestSchema = z
  .object({
    token: z.string().min(1),
  })
  .strict();
export type ResolveInviteRequest = z.infer<typeof resolveInviteRequestSchema>;

export const resolveInviteResponseSchema = z
  .object({
    groupId: z.string().min(1),
    groupName: z.string().min(1),
    inviteeRealName: z.string().min(1),
    permissionRole: invitePermissionRoleSchema,
    scheduleRoleName: z.string().optional(),
  })
  .strict();
export type ResolveInviteResponse = z.infer<typeof resolveInviteResponseSchema>;

export const acceptInviteRequestSchema = z
  .object({
    confirmRealName: z.string().min(1),
    token: z.string().min(1),
  })
  .strict();
export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;

export const acceptInviteResponseSchema = z
  .object({
    group: groupSummarySchema,
    token: z.string().min(1).optional(),
  })
  .strict();
export type AcceptInviteResponse = z.infer<typeof acceptInviteResponseSchema>;
