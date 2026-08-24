import {
  approvedLeaveRequestResultJsonSchema,
  appliedManualScheduleTemplateResultJsonSchema,
  calendarReadModelJsonSchema,
  clientCapabilityResponseJsonSchema,
  dutyAdjustmentPreviewJsonSchema,
  dutyAdjustmentRequestJsonSchema,
  dutyAdjustmentRequestListJsonSchema,
  generatedApiErrorCodes,
  groupMobilePhoneConsentJsonSchema,
  groupDutyAdjustmentSettingsJsonSchema,
  groupLeaveReflowStrategyJsonSchema,
  groupSwapSettingsJsonSchema,
  holidayReadModelJsonSchema,
  leaveAffectedShiftListJsonSchema,
  leaveReflowPreviewJsonSchema,
  leaveRequestJsonSchema,
  leaveRequestListJsonSchema,
  leaveRequestMutationResultJsonSchema,
  manualApplyPreviewJsonSchema,
  manualScheduleTemplateJsonSchema,
  manualScheduleTemplateListJsonSchema,
  memberSwapSettingsJsonSchema,
  pastScheduleBackfillBatchResultJsonSchema,
  pastScheduleBackfillRecordListJsonSchema,
  pastSchedulePeriodListJsonSchema,
  publishSchedulePeriodBatchResultJsonSchema,
  publishSchedulePeriodResultJsonSchema,
  rejectedLeaveRequestResultJsonSchema,
  scheduleChangeImpactPreviewJsonSchema,
  scheduleGenerationPreviewJsonSchema,
  schedulePeriodHistoryItemListJsonSchema,
  schedulePeriodMutationResultJsonSchema,
  schedulingConfigJsonSchema,
  swapPreviewJsonSchema,
  swapRequestJsonSchema,
  swapRequestListJsonSchema,
} from '../src/generated/calendar-schemas.js';
import {
  apiErrorCodes,
  approvedLeaveRequestResultSchema,
  appliedManualScheduleTemplateResultSchema,
  calendarReadModelSchema,
  clientCapabilityResponseSchema,
  dutyAdjustmentPreviewSchema,
  dutyAdjustmentRequestSchema,
  dutyAdjustmentRequestListSchema,
  groupDutyAdjustmentSettingsSchema,
  groupLeaveReflowStrategySchema,
  groupMobilePhoneConsentSchema,
  groupSwapSettingsSchema,
  holidayReadModelSchema,
  leaveAffectedShiftListSchema,
  leaveReflowPreviewSchema,
  leaveRequestSchema,
  leaveRequestListSchema,
  leaveRequestMutationResultSchema,
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
  swapRequestSchema,
  swapRequestListSchema,
} from '@schedule/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { isGeneratedSourceCurrent, sanitizeJsonSchema } from '../scripts/schema-generation.mjs';

describe('client-core generated schemas', () => {
  it('stay structurally equal to the authoritative Zod contracts', () => {
    expect(approvedLeaveRequestResultJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(approvedLeaveRequestResultSchema),
        'approvedLeaveRequestResult',
      ),
    );
    expect(calendarReadModelJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(calendarReadModelSchema), 'calendarReadModel'),
    );
    expect(clientCapabilityResponseJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(clientCapabilityResponseSchema),
        'clientCapabilityResponse',
      ),
    );
    expect(dutyAdjustmentPreviewJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(dutyAdjustmentPreviewSchema), 'dutyAdjustmentPreview'),
    );
    expect(dutyAdjustmentRequestJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(dutyAdjustmentRequestSchema), 'dutyAdjustmentRequest'),
    );
    expect(dutyAdjustmentRequestListJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(dutyAdjustmentRequestListSchema),
        'dutyAdjustmentRequestList',
      ),
    );
    expect(groupDutyAdjustmentSettingsJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(groupDutyAdjustmentSettingsSchema),
        'groupDutyAdjustmentSettings',
      ),
    );
    expect(groupLeaveReflowStrategyJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(groupLeaveReflowStrategySchema),
        'groupLeaveReflowStrategy',
      ),
    );
    expect(groupMobilePhoneConsentJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(groupMobilePhoneConsentSchema), 'groupMobilePhoneConsent'),
    );
    expect(groupSwapSettingsJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(groupSwapSettingsSchema), 'groupSwapSettings'),
    );
    expect(holidayReadModelJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(holidayReadModelSchema), 'holidayReadModel'),
    );
    expect(leaveAffectedShiftListJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(leaveAffectedShiftListSchema), 'leaveAffectedShiftList'),
    );
    expect(leaveReflowPreviewJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(leaveReflowPreviewSchema), 'leaveReflowPreview'),
    );
    expect(leaveRequestJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(leaveRequestSchema), 'leaveRequest'),
    );
    expect(leaveRequestListJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(leaveRequestListSchema), 'leaveRequestList'),
    );
    expect(leaveRequestMutationResultJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(leaveRequestMutationResultSchema),
        'leaveRequestMutationResult',
      ),
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
    expect(memberSwapSettingsJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(memberSwapSettingsSchema), 'memberSwapSettings'),
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
    expect(rejectedLeaveRequestResultJsonSchema).toEqual(
      sanitizeJsonSchema(
        z.toJSONSchema(rejectedLeaveRequestResultSchema),
        'rejectedLeaveRequestResult',
      ),
    );
    expect(swapPreviewJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(swapPreviewSchema), 'swapPreview'),
    );
    expect(swapRequestJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(swapRequestSchema), 'swapRequest'),
    );
    expect(swapRequestListJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(swapRequestListSchema), 'swapRequestList'),
    );
    expect(generatedApiErrorCodes).toEqual(apiErrorCodes);
  });

  it('treats Git CRLF checkout and generated LF source as the same content', () => {
    expect(isGeneratedSourceCurrent('first\r\nsecond\r\n', 'first\nsecond\n')).toBe(true);
    expect(isGeneratedSourceCurrent('first\r\nchanged\r\n', 'first\nsecond\n')).toBe(false);
  });
});
