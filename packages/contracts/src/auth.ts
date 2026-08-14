import { z } from 'zod';

import { wechatLoginResponseSchema } from './wechat.js';

export const passwordUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);

export const passwordSecretSchema = z.string().min(8).max(128);

export const passwordRegisterRequestSchema = z
  .object({
    password: passwordSecretSchema,
    username: passwordUsernameSchema,
  })
  .strict();
export type PasswordRegisterRequest = z.infer<typeof passwordRegisterRequestSchema>;

export const passwordLoginRequestSchema = passwordRegisterRequestSchema;
export type PasswordLoginRequest = z.infer<typeof passwordLoginRequestSchema>;

export const passwordAuthResponseSchema = wechatLoginResponseSchema;
export type PasswordAuthResponse = z.infer<typeof passwordAuthResponseSchema>;
