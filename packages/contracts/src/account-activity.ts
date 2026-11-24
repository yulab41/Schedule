import { z } from 'zod';
export const accountLoginMethodSchema = z.enum([
  'password',
  'wechat_manual',
  'wechat_auto',
  'wechat_binding',
  'wechat_unspecified',
]);
export type AccountLoginMethod = z.infer<typeof accountLoginMethodSchema>;
const directoryQueryActivitySchema = z
  .object({
    todayCount: z.number().int().nonnegative(),
    totalCount: z.number().int().nonnegative(),
    lastQueriedAt: z.string().datetime().optional(),
  })
  .strict();
export const accountActivitySummarySchema = z
  .object({
    startedAt: z.string().datetime().optional(),
    lastLoginAt: z.string().datetime().optional(),
    lastLoginMethod: accountLoginMethodSchema.optional(),
    todayLoginCount: z.number().int().nonnegative(),
    lastOpenedAt: z.string().datetime().optional(),
    todayOpenCount: z.number().int().nonnegative(),
    totalOpenCount: z.number().int().nonnegative(),
    directoryQueries: z
      .object({ internal: directoryQueryActivitySchema, employee: directoryQueryActivitySchema })
      .strict()
      .optional(),
  })
  .strict();
export type AccountActivitySummary = z.infer<typeof accountActivitySummarySchema>;
export const accountOpenRequestSchema = z
  .object({ eventId: z.string().uuid(), openedAt: z.string().datetime() })
  .strict();
export type AccountOpenRequest = z.infer<typeof accountOpenRequestSchema>;
export const accountOpenResponseSchema = z.object({ recorded: z.boolean() }).strict();
export type AccountOpenResponse = z.infer<typeof accountOpenResponseSchema>;
