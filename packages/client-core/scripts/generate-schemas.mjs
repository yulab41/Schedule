/* global console, process */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  apiErrorCodes,
  appliedManualScheduleTemplateResultSchema,
  calendarReadModelSchema,
  groupMobilePhoneConsentSchema,
  holidayReadModelSchema,
  manualApplyPreviewSchema,
  manualScheduleTemplateListSchema,
  manualScheduleTemplateSchema,
  pastScheduleBackfillBatchResultSchema,
  pastScheduleBackfillRecordListSchema,
  pastSchedulePeriodListSchema,
  publishSchedulePeriodBatchResultSchema,
  publishSchedulePeriodResultSchema,
  scheduleChangeImpactPreviewSchema,
  scheduleGenerationPreviewSchema,
  schedulePeriodHistoryItemListSchema,
  schedulePeriodMutationResultSchema,
  schedulingConfigSchema,
} from '../../contracts/dist/index.js';
import { z } from 'zod';

import {
  isGeneratedSourceCurrent,
  renderGeneratedSchemas,
  sanitizeJsonSchema,
} from './schema-generation.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(packageRoot, 'src', 'generated', 'calendar-schemas.ts');
const source = renderGeneratedSchemas({
  errorCodes: [...apiErrorCodes],
  schemas: {
    appliedManualScheduleTemplateResult: sanitizeJsonSchema(
      z.toJSONSchema(appliedManualScheduleTemplateResultSchema),
      'appliedManualScheduleTemplateResult',
    ),
    calendarReadModel: sanitizeJsonSchema(
      z.toJSONSchema(calendarReadModelSchema),
      'calendarReadModel',
    ),
    groupMobilePhoneConsent: sanitizeJsonSchema(
      z.toJSONSchema(groupMobilePhoneConsentSchema),
      'groupMobilePhoneConsent',
    ),
    holidayReadModel: sanitizeJsonSchema(
      z.toJSONSchema(holidayReadModelSchema),
      'holidayReadModel',
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
  },
});

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
