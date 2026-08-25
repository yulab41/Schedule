import { z } from 'zod';

import { userProfileSchema } from './users.js';

export const passwordUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);

export const passwordSecretSchema = z.string().min(1);

export const passwordRegisterRequestSchema = z
  .object({
    password: passwordSecretSchema,
    username: passwordUsernameSchema,
  })
  .strict();
export type PasswordRegisterRequest = z.infer<typeof passwordRegisterRequestSchema>;

export const passwordLoginRequestSchema = passwordRegisterRequestSchema;
export type PasswordLoginRequest = z.infer<typeof passwordLoginRequestSchema>;

export const passwordAuthResponseSchema = z
  .object({
    isNewUser: z.boolean(),
    mustChangePassword: z.boolean(),
    profile: userProfileSchema.optional(),
    token: z.string().min(1),
  })
  .strict();
export type PasswordAuthResponse = z.infer<typeof passwordAuthResponseSchema>;

export const passwordChangeRequestSchema = z
  .object({
    currentPassword: passwordSecretSchema,
    newPassword: passwordSecretSchema,
  })
  .strict()
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'The new password must differ from the current password.',
    path: ['newPassword'],
  });
export type PasswordChangeRequest = z.infer<typeof passwordChangeRequestSchema>;

export const passwordProofChangeRequestSchema = z.union([
  z
    .object({
      currentPassword: passwordSecretSchema,
      newPassword: passwordSecretSchema,
    })
    .strict()
    .refine((value) => value.currentPassword !== value.newPassword, {
      message: 'The new password must differ from the current password.',
      path: ['newPassword'],
    }),
  z
    .object({
      code: z.string().min(1).max(512),
      newPassword: passwordSecretSchema,
    })
    .strict(),
]);
export type PasswordProofChangeRequest = z.infer<typeof passwordProofChangeRequestSchema>;

export const passwordIdentityAssignmentRequestSchema = z
  .object({
    expectedAuthVersion: z.number().int().min(1),
    operationId: z.string().uuid(),
    username: passwordUsernameSchema,
  })
  .strict();
export type PasswordIdentityAssignmentRequest = z.infer<
  typeof passwordIdentityAssignmentRequestSchema
>;

export const passwordIdentityAssignmentResponseSchema = z
  .object({
    authVersion: z.number().int().min(1),
    passwordConfigured: z.boolean(),
    username: passwordUsernameSchema,
  })
  .strict();
export type PasswordIdentityAssignmentResponse = z.infer<
  typeof passwordIdentityAssignmentResponseSchema
>;

export const passwordChangeResponseSchema = z.object({ passwordChanged: z.literal(true) }).strict();
export type PasswordChangeResponse = z.infer<typeof passwordChangeResponseSchema>;

export const passwordStatusResponseSchema = z
  .object({
    hasPassword: z.boolean(),
    mustChangePassword: z.boolean(),
  })
  .strict();
export type PasswordStatusResponse = z.infer<typeof passwordStatusResponseSchema>;
