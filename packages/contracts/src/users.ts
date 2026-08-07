import { z } from 'zod';

export const userProfileSchema = z
  .object({
    id: z.string().min(1),
    realName: z.string().min(1),
    version: z.number().int().min(1),
  })
  .passthrough();
export type UserProfile = z.infer<typeof userProfileSchema>;

export interface CreateUserProfileRequest {
  readonly realName: string;
}

export interface UpdateUserProfileRequest {
  readonly realName: string;
  readonly version: number;
}
