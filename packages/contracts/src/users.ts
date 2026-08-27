import { z } from 'zod';

export const userProfileSchema = z
  .object({
    avatarVersion: z.number().int().min(1).optional(),
    id: z.string().min(1),
    realName: z.string().min(1),
    version: z.number().int().min(1),
  })
  .strict();
export type UserProfile = z.infer<typeof userProfileSchema>;

export const userProfileAvatarMutationResponseSchema = z
  .object({ avatarVersion: z.number().int().min(1) })
  .strict();
export type UserProfileAvatarMutationResponse = z.infer<
  typeof userProfileAvatarMutationResponseSchema
>;

export const userProfileAvatarDeleteResponseSchema = z.object({ removed: z.boolean() }).strict();
export type UserProfileAvatarDeleteResponse = z.infer<typeof userProfileAvatarDeleteResponseSchema>;

export interface CreateUserProfileRequest {
  readonly realName: string;
}

export interface UpdateUserProfileRequest {
  readonly realName: string;
  readonly version: number;
}
