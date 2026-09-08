import { z } from 'zod';
import { passwordSecretSchema } from './auth.js';

export type PlatformBackupKind = 'daily' | 'monthly';

export type PlatformJobRunStatus = 'completed' | 'failed' | 'running';

export interface PlatformJobRun {
  readonly finishedAt?: string;
  readonly id: string;
  readonly jobName: string;
  readonly startedAt: string;
  readonly status: PlatformJobRunStatus;
  readonly summary?: string;
}

export interface PlatformJobStatusPage {
  readonly runs: readonly PlatformJobRun[];
}

export interface PlatformBackup {
  readonly backupKind: PlatformBackupKind;
  readonly createdAt: string;
  readonly fileSize: number;
  readonly id: string;
  readonly rowCount: number;
  readonly sha256: string;
  readonly storageKey: string;
  readonly tableCount: number;
}

export interface PlatformBackupList {
  readonly archives: readonly PlatformBackup[];
}

export interface PlatformMeResponse {
  readonly isPlatformAdmin: boolean;
}

export const platformAdminUserAccountSchema = z
  .object({
    authVersion: z.number().int().min(1),
    hasPassword: z.boolean(),
    id: z.string().min(1),
    status: z.enum(['active', 'suspended']),
    username: z.string().min(1).optional(),
  })
  .strict();
export type PlatformAdminUserAccount = z.infer<typeof platformAdminUserAccountSchema>;

export const platformAdminUserAccountListSchema = z
  .object({ users: z.array(platformAdminUserAccountSchema) })
  .strict();
export type PlatformAdminUserAccountList = z.infer<typeof platformAdminUserAccountListSchema>;

export interface UpdatePlatformUserStatusInput {
  readonly status: 'active' | 'suspended';
}

export const platformAdminUserDetailsSchema = platformAdminUserAccountSchema
  .extend({
    accountVersion: z.number().int().min(1),
    profileVersion: z.number().int().min(0),
    realName: z.string().optional(),
    mobilePhone: z.string().optional(),
    accountKind: z.enum(['password', 'wechat', 'unbound-member', 'history-member', 'incomplete']),
  })
  .strict();
export type PlatformAdminUserDetails = z.infer<typeof platformAdminUserDetailsSchema>;
export const platformAdminUserDetailsListSchema = z
  .object({ users: z.array(platformAdminUserDetailsSchema) })
  .strict();
export type PlatformAdminUserDetailsList = z.infer<typeof platformAdminUserDetailsListSchema>;
export const updatePlatformUserProfileRequestSchema = z
  .object({
    operationId: z.string().uuid(),
    expectedAccountVersion: z.number().int().min(1),
    expectedProfileVersion: z.number().int().min(0),
    realName: z.string().trim().min(1).max(100),
    mobilePhone: z.string().trim().min(1).max(32).nullable(),
  })
  .strict();
export type UpdatePlatformUserProfileRequest = z.infer<
  typeof updatePlatformUserProfileRequestSchema
>;
export const updatePlatformUserProfileResponseSchema = z
  .object({
    accountVersion: z.number().int().min(1),
    profileVersion: z.number().int().min(1),
  })
  .strict();
export type UpdatePlatformUserProfileResponse = z.infer<
  typeof updatePlatformUserProfileResponseSchema
>;
export const resetPlatformUserPasswordRequestSchema = z
  .object({
    operationId: z.string().uuid(),
    expectedAuthVersion: z.number().int().min(1),
    newPassword: passwordSecretSchema,
  })
  .strict();
export type ResetPlatformUserPasswordRequest = z.infer<
  typeof resetPlatformUserPasswordRequestSchema
>;
export const resetPlatformUserPasswordResponseSchema = z
  .object({
    authVersion: z.number().int().min(1),
    passwordConfigured: z.literal(true),
  })
  .strict();
export type ResetPlatformUserPasswordResponse = z.infer<
  typeof resetPlatformUserPasswordResponseSchema
>;
