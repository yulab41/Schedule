import { z } from 'zod';

import { passwordSecretSchema, passwordUsernameSchema } from './auth.js';
import { userProfileSchema } from './users.js';

export const wechatLoginRequestSchema = z
  .object({
    code: z.string().min(1),
  })
  .strict();
export type WechatLoginRequest = z.infer<typeof wechatLoginRequestSchema>;

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

export const wechatMiniProgramBindingStatusSchema = z
  .object({ bound: z.boolean(), canUnbind: z.boolean() })
  .strict();
export type WechatMiniProgramBindingStatus = z.infer<typeof wechatMiniProgramBindingStatusSchema>;

export const createWechatAdminBindingLinkRequestSchema = z
  .object({
    expectedAuthVersion: z.number().int().min(1),
    operationId: z.string().uuid(),
  })
  .strict();
export type CreateWechatAdminBindingLinkRequest = z.infer<
  typeof createWechatAdminBindingLinkRequestSchema
>;

export const createWechatAdminBindingLinkResponseSchema = z
  .object({
    authVersion: z.number().int().min(1),
    expiresAt: z.string().datetime({ offset: true }),
    urlLink: z.string().regex(/^https:\/\/[^\s]+$/u),
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

export const miniProgramQrEnvironmentSchema = z.enum(['release', 'trial']);
export type MiniProgramQrEnvironment = z.infer<typeof miniProgramQrEnvironmentSchema>;

export const createCurrentMemberWechatBindingQrRequestSchema = z
  .object({
    environment: miniProgramQrEnvironmentSchema,
    expectedMembershipVersion: z.number().int().min(1),
    operationId: z.string().uuid(),
  })
  .strict();
export type CreateCurrentMemberWechatBindingQrRequest = z.infer<
  typeof createCurrentMemberWechatBindingQrRequestSchema
>;

export const createCurrentMemberWechatBindingQrResponseSchema = z
  .object({
    employeeCode: z.string().min(1).optional(),
    environment: miniProgramQrEnvironmentSchema,
    expiresAt: z.string().datetime({ offset: true }),
    groupName: z.string().min(1),
    imageBase64: z.string().min(1),
    membershipId: z.string().min(1),
    realName: z.string().min(1),
  })
  .strict();
export type CreateCurrentMemberWechatBindingQrResponse = z.infer<
  typeof createCurrentMemberWechatBindingQrResponseSchema
>;

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

const visitorClientSafeAreaSchema = z
  .object({
    bottom: z.number().finite(),
    height: z.number().finite().nonnegative(),
    left: z.number().finite(),
    right: z.number().finite(),
    top: z.number().finite(),
    width: z.number().finite().nonnegative(),
  })
  .strict();

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export const visitorClientContextSchema = z
  .object({
    abi: z.string().trim().min(1).max(64).optional(),
    appVersion: z.string().trim().min(1).max(64).optional(),
    benchmarkLevel: z.number().int().min(-2).max(100_000).optional(),
    brand: z.string().trim().min(1).max(64).optional(),
    cpuType: z.string().trim().min(1).max(64).optional(),
    debug: z.boolean().optional(),
    envVersion: z.enum(['develop', 'trial', 'release']).optional(),
    fontSizeSetting: z.number().finite().min(1).max(200).optional(),
    language: z.string().trim().min(1).max(32).optional(),
    memorySize: z.number().finite().nonnegative().max(1_048_576).optional(),
    model: z.string().trim().min(1).max(128).optional(),
    networkType: z.string().trim().min(1).max(32).optional(),
    pixelRatio: z.number().finite().min(0.1).max(100).optional(),
    platform: z.string().trim().min(1).max(32).optional(),
    safeArea: visitorClientSafeAreaSchema.optional(),
    sdkVersion: z.string().trim().min(1).max(64).optional(),
    screenHeight: z.number().finite().min(1).max(100_000).optional(),
    screenWidth: z.number().finite().min(1).max(100_000).optional(),
    system: z.string().trim().min(1).max(128).optional(),
    theme: z.string().trim().min(1).max(32).optional(),
    version: z.literal(1),
    wechatVersion: z.string().trim().min(1).max(64).optional(),
    windowHeight: z.number().finite().min(1).max(100_000).optional(),
    windowWidth: z.number().finite().min(1).max(100_000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (utf8ByteLength(JSON.stringify(value)) > 4_096) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: '客户端环境信息过大。' });
    }
  });
export type VisitorClientContext = z.infer<typeof visitorClientContextSchema>;

export const visitorCalendarReadRequestSchema = z
  .object({
    businessMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/u),
    clientContext: visitorClientContextSchema,
    loginCode: z.string().trim().min(1).max(512).optional(),
    visitId: z.string().uuid().optional(),
    visitorKey: z.string().regex(/^[0-9a-f]{32}$/iu),
  })
  .strict();
export type VisitorCalendarReadRequest = z.infer<typeof visitorCalendarReadRequestSchema>;

export const visitorAccessLogSchema = z
  .object({
    businessMonth: z.string().regex(/^\d{4}-\d{2}$/u),
    clientIp: z.string().optional(),
    createdAt: z.string(),
    groupId: z.string().min(1),
    id: z.string().min(1),
    requestId: z.string().optional(),
    wechatOpenid: z.string().optional(),
    clientContext: visitorClientContextSchema.optional(),
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

const visitorAccessMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/u);

export const visitorAccessAggregateSchema = z
  .object({
    accessCount: z.string().regex(/^[1-9]\d*$/u),
    accessMonth: visitorAccessMonthSchema,
    businessMonth: visitorAccessMonthSchema,
  })
  .strict();
export type VisitorAccessAggregate = z.infer<typeof visitorAccessAggregateSchema>;

export const visitorAccessAggregatePageSchema = z
  .object({
    aggregates: z.readonly(z.array(visitorAccessAggregateSchema)),
    nextCursor: z.string().optional(),
  })
  .strict();
export type VisitorAccessAggregatePage = z.infer<typeof visitorAccessAggregatePageSchema>;

export const currentEnvironmentQrResponseSchema = z
  .object({
    environment: miniProgramQrEnvironmentSchema,
    imageBase64: z.string().min(1),
  })
  .strict();
export type CurrentEnvironmentQrResponse = z.infer<typeof currentEnvironmentQrResponseSchema>;

export const visitorKeyChangedResponseSchema = z
  .object({
    visitorKeyChanged: z.literal(true),
  })
  .strict();
export type VisitorKeyChangedResponse = z.infer<typeof visitorKeyChangedResponseSchema>;
