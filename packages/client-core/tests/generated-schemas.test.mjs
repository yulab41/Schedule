import {
  appliedManualScheduleTemplateResultJsonSchema,
  calendarReadModelJsonSchema,
  generatedApiErrorCodes,
  holidayReadModelJsonSchema,
  manualApplyPreviewJsonSchema,
  manualScheduleTemplateJsonSchema,
  manualScheduleTemplateListJsonSchema,
  pastScheduleBackfillBatchResultJsonSchema,
  pastScheduleBackfillRecordListJsonSchema,
  pastSchedulePeriodListJsonSchema,
  publishSchedulePeriodBatchResultJsonSchema,
  publishSchedulePeriodResultJsonSchema,
  scheduleChangeImpactPreviewJsonSchema,
  scheduleGenerationPreviewJsonSchema,
  schedulePeriodHistoryItemListJsonSchema,
  schedulePeriodMutationResultJsonSchema,
  schedulingConfigJsonSchema,
} from '../src/generated/calendar-schemas.js';
import {
  apiErrorCodes,
  appliedManualScheduleTemplateResultSchema,
  calendarReadModelSchema,
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
} from '@schedule/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { isGeneratedSourceCurrent, sanitizeJsonSchema } from '../scripts/schema-generation.mjs';

describe('client-core generated schemas', () => {
  it('stay structurally equal to the authoritative Zod contracts', () => {
    expect(calendarReadModelJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(calendarReadModelSchema), 'calendarReadModel'),
    );
    expect(holidayReadModelJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(holidayReadModelSchema), 'holidayReadModel'),
    );
    expect(manualScheduleTemplateJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(manualScheduleTemplateSchema), 'manualScheduleTemplate'),
    );
    expect(manualScheduleTemplateListJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(manualScheduleTemplateListSchema),
        'manualScheduleTemplateList',
      ),
    );
    expect(manualApplyPreviewJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(manualApplyPreviewSchema), 'manualApplyPreview'),
    );
    expect(appliedManualScheduleTemplateResultJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(appliedManualScheduleTemplateResultSchema),
        'appliedManualScheduleTemplateResult',
      ),
    );
    expect(pastSchedulePeriodListJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(pastSchedulePeriodListSchema), 'pastSchedulePeriodList'),
    );
    expect(pastScheduleBackfillRecordListJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(pastScheduleBackfillRecordListSchema),
        'pastScheduleBackfillRecordList',
      ),
    );
    expect(pastScheduleBackfillBatchResultJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(pastScheduleBackfillBatchResultSchema),
        'pastScheduleBackfillBatchResult',
      ),
    );
    expect(schedulingConfigJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(schedulingConfigSchema), 'schedulingConfig'),
    );
    expect(schedulePeriodHistoryItemListJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(schedulePeriodHistoryItemListSchema),
        'schedulePeriodHistoryItemList',
      ),
    );
    expect(scheduleGenerationPreviewJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(scheduleGenerationPreviewSchema),
        'scheduleGenerationPreview',
      ),
    );
    expect(scheduleChangeImpactPreviewJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(scheduleChangeImpactPreviewSchema),
        'scheduleChangeImpactPreview',
      ),
    );
    expect(schedulePeriodMutationResultJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(schedulePeriodMutationResultSchema),
        'schedulePeriodMutationResult',
      ),
    );
    expect(publishSchedulePeriodBatchResultJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(publishSchedulePeriodBatchResultSchema),
        'publishSchedulePeriodBatchResult',
      ),
    );
    expect(publishSchedulePeriodResultJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(publishSchedulePeriodResultSchema),
        'publishSchedulePeriodResult',
      ),
    );
    expect(generatedApiErrorCodes).toEqual(apiErrorCodes);
  });

  it('treats Git CRLF checkout and generated LF source as the same content', () => {
    expect(isGeneratedSourceCurrent('first\r\nsecond\r\n', 'first\nsecond\n')).toBe(true);
    expect(isGeneratedSourceCurrent('first\r\nchanged\r\n', 'first\nsecond\n')).toBe(false);
  });
});
