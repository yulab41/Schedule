import { z } from 'zod';

import { passwordSecretSchema, passwordUsernameSchema } from './auth.js';
import { groupSummarySchema } from './groups.js';
import { userProfileSchema } from './users.js';

export const wechatLoginRequestSchema = z
  .object({
    code: z.string().min(1),
  })
  .strict();
export type WechatLoginRequest = z.infer<typeof wechatLoginRequestSchema>;

const legacyWechatLoginResponseSchema = z
  .object({
    isNewUser: z.boolean(),
    profile: userProfileSchema.optional(),
    token: z.string().min(1),
  })
  .strict();

export const wechatAuthenticatedResponseSchema = z
  .object({
    expiresAt: z.string().datetime({ offset: true }),
    profile: userProfileSchema,
    status: z.literal('authenticated'),
    token: z.string().min(1),
  })
  .strict();
export type WechatAuthenticatedResponse = z.infer<typeof wechatAuthenticatedResponseSchema>;

export const wechatLoginResponseSchema = z.discriminatedUnion('status', [
  wechatAuthenticatedResponseSchema,
  z
    .object({
      expiresAt: z.string().datetime({ offset: true }),
      linkToken: z.string().min(1),
      status: z.literal('link_required'),
    })
    .strict(),
]);
export type WechatLoginResponse = z.infer<typeof wechatLoginResponseSchema>;

const wechatLinkTokenSchema = z.string().min(1).max(512);

export const wechatLinkPasswordRequestSchema = z
  .object({
    linkToken: wechatLinkTokenSchema,
    password: passwordSecretSchema,
    username: passwordUsernameSchema,
  })
  .strict();
export type WechatLinkPasswordRequest = z.infer<typeof wechatLinkPasswordRequestSchema>;

export const wechatLinkPasswordResponseSchema = wechatAuthenticatedResponseSchema;
export type WechatLinkPasswordResponse = z.infer<typeof wechatLinkPasswordResponseSchema>;

export const wechatRegisterRequestSchema = z
  .object({
    linkToken: wechatLinkTokenSchema,
    realName: z.string().trim().min(1).max(100),
  })
  .strict();
export type WechatRegisterRequest = z.infer<typeof wechatRegisterRequestSchema>;

export const wechatRegisterResponseSchema = wechatAuthenticatedResponseSchema;
export type WechatRegisterResponse = z.infer<typeof wechatRegisterResponseSchema>;

export const wechatMiniProgramUnbindRequestSchema = z
  .object({
    code: z.string().min(1).max(512),
  })
  .strict();
export type WechatMiniProgramUnbindRequest = z.infer<typeof wechatMiniProgramUnbindRequestSchema>;

export const platformAdminWechatMiniProgramUnbindRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export type PlatformAdminWechatMiniProgramUnbindRequest = z.infer<
  typeof platformAdminWechatMiniProgramUnbindRequestSchema
>;

export const wechatMiniProgramUnbindResponseSchema = z
  .object({ unbound: z.literal(true) })
  .strict();
export type WechatMiniProgramUnbindResponse = z.infer<typeof wechatMiniProgramUnbindResponseSchema>;

export const createWechatAdminBindingLinkResponseSchema = z
  .object({
    expiresAt: z.string().datetime({ offset: true }),
    urlLink: z.string().url(),
  })
  .strict();
export type CreateWechatAdminBindingLinkResponse = z.infer<
  typeof createWechatAdminBindingLinkResponseSchema
>;

export const wechatAdminBindingPreviewRequestSchema = z
  .object({ ticket: wechatLinkTokenSchema })
  .strict();
export type WechatAdminBindingPreviewRequest = z.infer<
  typeof wechatAdminBindingPreviewRequestSchema
>;

export const wechatAdminBindingPreviewResponseSchema = z
  .object({
    expiresAt: z.string().datetime({ offset: true }),
    realNameMasked: z.string().min(1),
    usernameMasked: z.string().min(1),
  })
  .strict();
export type WechatAdminBindingPreviewResponse = z.infer<
  typeof wechatAdminBindingPreviewResponseSchema
>;

export const wechatAdminBindingConfirmRequestSchema = z
  .object({ ticket: wechatLinkTokenSchema, code: z.string().min(1).max(512) })
  .strict();
export type WechatAdminBindingConfirmRequest = z.infer<
  typeof wechatAdminBindingConfirmRequestSchema
>;

export const wechatAdminBindingConfirmResponseSchema = wechatAuthenticatedResponseSchema;
export type WechatAdminBindingConfirmResponse = z.infer<
  typeof wechatAdminBindingConfirmResponseSchema
>;

export const wechatWebLoginStartQuerySchema = z
  .object({
    state: z.string().min(16).max(256),
  })
  .strict();
export type WechatWebLoginStartQuery = z.infer<typeof wechatWebLoginStartQuerySchema>;

export const wechatWebLoginStartResponseSchema = z
  .object({
    authorizeUrl: z.string().url(),
    state: z.string().min(1),
  })
  .strict();
export type WechatWebLoginStartResponse = z.infer<typeof wechatWebLoginStartResponseSchema>;

export const wechatWebLoginExchangeRequestSchema = z
  .object({
    code: z.string().min(1),
    state: z.string().min(1),
  })
  .strict();
export type WechatWebLoginExchangeRequest = z.infer<typeof wechatWebLoginExchangeRequestSchema>;

export const wechatWebLoginResponseSchema = legacyWechatLoginResponseSchema;
export type WechatWebLoginResponse = z.infer<typeof wechatWebLoginResponseSchema>;

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
