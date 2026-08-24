/* global console, process */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  apiErrorCodes,
  approvedLeaveRequestResultSchema,
  appliedManualScheduleTemplateResultSchema,
  calendarReadModelSchema,
  clientCapabilityResponseSchema,
  dutyAdjustmentPreviewSchema,
  dutyAdjustmentRequestListSchema,
  dutyAdjustmentRequestSchema,
  groupDutyAdjustmentSettingsSchema,
  groupLeaveReflowStrategySchema,
  groupMobilePhoneConsentSchema,
  groupSwapSettingsSchema,
  holidayReadModelSchema,
  leaveAffectedShiftListSchema,
  leaveReflowPreviewSchema,
  leaveRequestListSchema,
  leaveRequestMutationResultSchema,
  leaveRequestSchema,
  manualApplyPreviewSchema,
  manualScheduleTemplateListSchema,
  manualScheduleTemplateSchema,
  memberSwapSettingsSchema,
  pastScheduleBackfillBatchResultSchema,
  pastScheduleBackfillRecordListSchema,
  pastSchedulePeriodListSchema,
  publishSchedulePeriodBatchResultSchema,
  publishSchedulePeriodResultSchema,
  rejectedLeaveRequestResultSchema,
  scheduleChangeImpactPreviewSchema,
  scheduleGenerationPreviewSchema,
  schedulePeriodHistoryItemListSchema,
  schedulePeriodMutationResultSchema,
  schedulingConfigSchema,
  swapPreviewSchema,
  swapRequestListSchema,
  swapRequestSchema,
} from '../../contracts/dist/index.js';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';

import {
  isGeneratedSourceCurrent,
  renderGeneratedSchemas,
  sanitizeJsonSchema,
} from './schema-generation.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(packageRoot, 'src', 'generated', 'calendar-schemas.ts');
const prettierConfig = (await resolveConfig(outputPath)) ?? {};
const source = await format(
  renderGeneratedSchemas({
    errorCodes: [...apiErrorCodes],
    schemas: {
      approvedLeaveRequestResult: sanitizeJsonSchema(
        z.toJSONSchema(approvedLeaveRequestResultSchema),
        'approvedLeaveRequestResult',
      ),
      appliedManualScheduleTemplateResult: sanitizeJsonSchema(
        z.toJSONSchema(appliedManualScheduleTemplateResultSchema),
        'appliedManualScheduleTemplateResult',
      ),
      calendarReadModel: sanitizeJsonSchema(
        z.toJSONSchema(calendarReadModelSchema),
        'calendarReadModel',
      ),
      clientCapabilityResponse: sanitizeJsonSchema(
        z.toJSONSchema(clientCapabilityResponseSchema),
        'clientCapabilityResponse',
      ),
      dutyAdjustmentPreview: sanitizeJsonSchema(
        z.toJSONSchema(dutyAdjustmentPreviewSchema),
        'dutyAdjustmentPreview',
      ),
      dutyAdjustmentRequest: sanitizeJsonSchema(
        z.toJSONSchema(dutyAdjustmentRequestSchema),
        'dutyAdjustmentRequest',
      ),
      dutyAdjustmentRequestList: sanitizeJsonSchema(
        z.toJSONSchema(dutyAdjustmentRequestListSchema),
        'dutyAdjustmentRequestList',
      ),
      groupDutyAdjustmentSettings: sanitizeJsonSchema(
        z.toJSONSchema(groupDutyAdjustmentSettingsSchema),
        'groupDutyAdjustmentSettings',
      ),
      groupLeaveReflowStrategy: sanitizeJsonSchema(
        z.toJSONSchema(groupLeaveReflowStrategySchema),
        'groupLeaveReflowStrategy',
      ),
      groupMobilePhoneConsent: sanitizeJsonSchema(
        z.toJSONSchema(groupMobilePhoneConsentSchema),
        'groupMobilePhoneConsent',
      ),
      groupSwapSettings: sanitizeJsonSchema(
        z.toJSONSchema(groupSwapSettingsSchema),
        'groupSwapSettings',
      ),
      holidayReadModel: sanitizeJsonSchema(
        z.toJSONSchema(holidayReadModelSchema),
        'holidayReadModel',
      ),
      leaveAffectedShiftList: sanitizeJsonSchema(
        z.toJSONSchema(leaveAffectedShiftListSchema),
        'leaveAffectedShiftList',
      ),
      leaveReflowPreview: sanitizeJsonSchema(
        z.toJSONSchema(leaveReflowPreviewSchema),
        'leaveReflowPreview',
      ),
      leaveRequest: sanitizeJsonSchema(z.toJSONSchema(leaveRequestSchema), 'leaveRequest'),
      leaveRequestList: sanitizeJsonSchema(
        z.toJSONSchema(leaveRequestListSchema),
        'leaveRequestList',
      ),
      leaveRequestMutationResult: sanitizeJsonSchema(
        z.toJSONSchema(leaveRequestMutationResultSchema),
        'leaveRequestMutationResult',
      ),
      manualApplyPreview: sanitizeJsonSchema(
        z.toJSONSchema(manualApplyPreviewSchema),
        'manualApplyPreview',
      ),
      manualScheduleTemplate: sanitizeJsonSchema(
        z.toJSONSchema(manualScheduleTemplateSchema),
        'manualScheduleTemplate',
      ),
      manualScheduleTemplateList: sanitizeJsonSchema(
        z.toJSONSchema(manualScheduleTemplateListSchema),
        'manualScheduleTemplateList',
      ),
      memberSwapSettings: sanitizeJsonSchema(
        z.toJSONSchema(memberSwapSettingsSchema),
        'memberSwapSettings',
      ),
      pastScheduleBackfillBatchResult: sanitizeJsonSchema(
        z.toJSONSchema(pastScheduleBackfillBatchResultSchema),
        'pastScheduleBackfillBatchResult',
      ),
      pastScheduleBackfillRecordList: sanitizeJsonSchema(
        z.toJSONSchema(pastScheduleBackfillRecordListSchema),
        'pastScheduleBackfillRecordList',
      ),
      pastSchedulePeriodList: sanitizeJsonSchema(
        z.toJSONSchema(pastSchedulePeriodListSchema),
        'pastSchedulePeriodList',
      ),
      publishSchedulePeriodBatchResult: sanitizeJsonSchema(
        z.toJSONSchema(publishSchedulePeriodBatchResultSchema),
        'publishSchedulePeriodBatchResult',
      ),
      publishSchedulePeriodResult: sanitizeJsonSchema(
        z.toJSONSchema(publishSchedulePeriodResultSchema),
        'publishSchedulePeriodResult',
      ),
      rejectedLeaveRequestResult: sanitizeJsonSchema(
        z.toJSONSchema(rejectedLeaveRequestResultSchema),
        'rejectedLeaveRequestResult',
      ),
      scheduleChangeImpactPreview: sanitizeJsonSchema(
        z.toJSONSchema(scheduleChangeImpactPreviewSchema),
        'scheduleChangeImpactPreview',
      ),
      scheduleGenerationPreview: sanitizeJsonSchema(
        z.toJSONSchema(scheduleGenerationPreviewSchema),
        'scheduleGenerationPreview',
      ),
      schedulePeriodHistoryItemList: sanitizeJsonSchema(
        z.toJSONSchema(schedulePeriodHistoryItemListSchema),
        'schedulePeriodHistoryItemList',
      ),
      schedulePeriodMutationResult: sanitizeJsonSchema(
        z.toJSONSchema(schedulePeriodMutationResultSchema),
        'schedulePeriodMutationResult',
      ),
      schedulingConfig: sanitizeJsonSchema(
        z.toJSONSchema(schedulingConfigSchema),
        'schedulingConfig',
      ),
      swapPreview: sanitizeJsonSchema(z.toJSONSchema(swapPreviewSchema), 'swapPreview'),
      swapRequest: sanitizeJsonSchema(z.toJSONSchema(swapRequestSchema), 'swapRequest'),
      swapRequestList: sanitizeJsonSchema(z.toJSONSchema(swapRequestListSchema), 'swapRequestList'),
    },
  }),
  { ...prettierConfig, filepath: outputPath },
);

if (process.argv.includes('--check')) {
  if (
    !existsSync(outputPath) ||
    !isGeneratedSourceCurrent(readFileSync(outputPath, 'utf8'), source)
  ) {
    console.error('[client-core] generated calendar schemas are stale');
    process.exitCode = 1;
  } else {
    console.log('[client-core] generated calendar schemas are current');
  }
} else {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, source, 'utf8');
  console.log(`[client-core] generated ${outputPath}`);
}
