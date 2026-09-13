import { z } from 'zod';

export const scheduleExportTypeSchema = z.enum(['schedule', 'statistics']);
export type ScheduleExportType = z.infer<typeof scheduleExportTypeSchema>;
export const scheduleExportFormatSchema = z.enum(['csv', 'xlsx']);
export type ScheduleExportFormat = z.infer<typeof scheduleExportFormatSchema>;
export const scheduleExportPeriodTypeSchema = z.enum(['month', 'year']);
export type ScheduleExportPeriodType = z.infer<typeof scheduleExportPeriodTypeSchema>;
export const scheduleExportStatusSchema = z.enum(['completed', 'failed', 'pending', 'running']);
export type ScheduleExportStatus = z.infer<typeof scheduleExportStatusSchema>;

export interface CreateScheduleExportInput {
  readonly exportType: ScheduleExportType;
  readonly format?: ScheduleExportFormat;
  readonly membershipId?: string;
  readonly membershipIds?: readonly string[];
  readonly period: string;
  readonly roleId?: string;
  readonly roleIds?: readonly string[];
}

export const scheduleExportJobSchema = z
  .object({
    completedAt: z.string().optional(),
    createdAt: z.string(),
    error: z.string().optional(),
    expiresAt: z.string().optional(),
    exportType: scheduleExportTypeSchema,
    format: scheduleExportFormatSchema.optional(),
    groupId: z.string(),
    id: z.string(),
    membershipId: z.string().optional(),
    membershipIds: z.array(z.string()).optional(),
    period: z.string(),
    periodType: scheduleExportPeriodTypeSchema,
    roleId: z.string().optional(),
    roleIds: z.array(z.string()).optional(),
    rowCount: z.number().optional(),
    status: scheduleExportStatusSchema,
  })
  .strict();
export type ScheduleExportJob = z.infer<typeof scheduleExportJobSchema>;
