/* global console, process */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  acceptInviteResponseSchema,
  addGroupMembersResponseSchema,
  addRosterEntriesResponseSchema,
  apiErrorCodes,
  approvedLeaveRequestResultSchema,
  appliedManualScheduleTemplateResultSchema,
  calendarReadModelSchema,
  clientCapabilityResponseSchema,
  convertPendingRosterResponseSchema,
  createInviteLinkResponseSchema,
  createWechatAdminBindingLinkResponseSchema,
  dissolvedGroupListSchema,
  dutyAdjustmentPreviewSchema,
  dutyAdjustmentRequestListSchema,
  dutyAdjustmentRequestSchema,
  groupDutyAdjustmentSettingsSchema,
  groupCatalogListSchema,
  groupLeaveReflowStrategySchema,
  groupMemberContactSchema,
  groupMemberContactListSchema,
  groupMemberSchema,
  groupMemberListSchema,
  groupMobilePhoneConsentSchema,
  groupQrResponseSchema,
  groupSummarySchema,
  groupSummaryListSchema,
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
  membershipClaimLookupResponseSchema,
  membershipClaimRequestSchema,
  membershipClaimRequestListSchema,
  organizationMutationCompletedSchema,
  pastScheduleBackfillBatchResultSchema,
  pastScheduleBackfillRecordListSchema,
  pastSchedulePeriodListSchema,
  publishSchedulePeriodBatchResultSchema,
  publishSchedulePeriodResultSchema,
  rejectedLeaveRequestResultSchema,
  resolveInviteResponseSchema,
  scheduleChangeImpactPreviewSchema,
  scheduleGenerationPreviewSchema,
  schedulePeriodHistoryItemListSchema,
  schedulePeriodMutationResultSchema,
  scheduleRoleSchema,
  schedulingConfigSchema,
  shiftTypeSchema,
  platformAdminUserAccountListSchema,
  passwordIdentityAssignmentResponseSchema,
  swapPreviewSchema,
  swapRequestListSchema,
  swapRequestSchema,
  visitorAccessAggregatePageSchema,
  visitorKeyChangedResponseSchema,
  visitorAccessLogPageSchema,
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
      acceptInviteResponse: sanitizeJsonSchema(
        z.toJSONSchema(acceptInviteResponseSchema),
        'acceptInviteResponse',
      ),
      addGroupMembersResponse: sanitizeJsonSchema(
        z.toJSONSchema(addGroupMembersResponseSchema),
        'addGroupMembersResponse',
      ),
      addRosterEntriesResponse: sanitizeJsonSchema(
        z.toJSONSchema(addRosterEntriesResponseSchema),
        'addRosterEntriesResponse',
      ),
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
      convertPendingRosterResponse: sanitizeJsonSchema(
        z.toJSONSchema(convertPendingRosterResponseSchema),
        'convertPendingRosterResponse',
      ),
      createInviteLinkResponse: sanitizeJsonSchema(
        z.toJSONSchema(createInviteLinkResponseSchema),
        'createInviteLinkResponse',
      ),
      createWechatAdminBindingLinkResponse: sanitizeJsonSchema(
        z.toJSONSchema(createWechatAdminBindingLinkResponseSchema),
        'createWechatAdminBindingLinkResponse',
      ),
      dissolvedGroupList: sanitizeJsonSchema(
        z.toJSONSchema(dissolvedGroupListSchema),
        'dissolvedGroupList',
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
      groupCatalogList: sanitizeJsonSchema(
        z.toJSONSchema(groupCatalogListSchema),
        'groupCatalogList',
      ),
      groupLeaveReflowStrategy: sanitizeJsonSchema(
        z.toJSONSchema(groupLeaveReflowStrategySchema),
        'groupLeaveReflowStrategy',
      ),
      groupMemberContact: sanitizeJsonSchema(
        z.toJSONSchema(groupMemberContactSchema),
        'groupMemberContact',
      ),
      groupMobilePhoneConsent: sanitizeJsonSchema(
        z.toJSONSchema(groupMobilePhoneConsentSchema),
        'groupMobilePhoneConsent',
      ),
      groupQrResponse: sanitizeJsonSchema(z.toJSONSchema(groupQrResponseSchema), 'groupQrResponse'),
      groupMemberContactList: sanitizeJsonSchema(
        z.toJSONSchema(groupMemberContactListSchema),
        'groupMemberContactList',
      ),
      groupMemberList: sanitizeJsonSchema(z.toJSONSchema(groupMemberListSchema), 'groupMemberList'),
      groupMember: sanitizeJsonSchema(z.toJSONSchema(groupMemberSchema), 'groupMember'),
      groupSummary: sanitizeJsonSchema(z.toJSONSchema(groupSummarySchema), 'groupSummary'),
      groupSummaryList: sanitizeJsonSchema(
        z.toJSONSchema(groupSummaryListSchema),
        'groupSummaryList',
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
      membershipClaimLookupResponse: sanitizeJsonSchema(
        z.toJSONSchema(membershipClaimLookupResponseSchema),
        'membershipClaimLookupResponse',
      ),
      membershipClaimRequest: sanitizeJsonSchema(
        z.toJSONSchema(membershipClaimRequestSchema),
        'membershipClaimRequest',
      ),
      membershipClaimRequestList: sanitizeJsonSchema(
        z.toJSONSchema(membershipClaimRequestListSchema),
        'membershipClaimRequestList',
      ),
      organizationMutationCompleted: sanitizeJsonSchema(
        z.toJSONSchema(organizationMutationCompletedSchema),
        'organizationMutationCompleted',
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
      platformAdminUserAccountList: sanitizeJsonSchema(
        z.toJSONSchema(platformAdminUserAccountListSchema),
        'platformAdminUserAccountList',
      ),
      passwordIdentityAssignmentResponse: sanitizeJsonSchema(
        z.toJSONSchema(passwordIdentityAssignmentResponseSchema),
        'passwordIdentityAssignmentResponse',
      ),
      rejectedLeaveRequestResult: sanitizeJsonSchema(
        z.toJSONSchema(rejectedLeaveRequestResultSchema),
        'rejectedLeaveRequestResult',
      ),
      resolveInviteResponse: sanitizeJsonSchema(
        z.toJSONSchema(resolveInviteResponseSchema),
        'resolveInviteResponse',
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
      scheduleRole: sanitizeJsonSchema(z.toJSONSchema(scheduleRoleSchema), 'scheduleRole'),
      schedulingConfig: sanitizeJsonSchema(
        z.toJSONSchema(schedulingConfigSchema),
        'schedulingConfig',
      ),
      shiftType: sanitizeJsonSchema(z.toJSONSchema(shiftTypeSchema), 'shiftType'),
      swapPreview: sanitizeJsonSchema(z.toJSONSchema(swapPreviewSchema), 'swapPreview'),
      swapRequest: sanitizeJsonSchema(z.toJSONSchema(swapRequestSchema), 'swapRequest'),
      swapRequestList: sanitizeJsonSchema(z.toJSONSchema(swapRequestListSchema), 'swapRequestList'),
      visitorKeyChangedResponse: sanitizeJsonSchema(
        z.toJSONSchema(visitorKeyChangedResponseSchema),
        'visitorKeyChangedResponse',
      ),
      visitorAccessAggregatePage: sanitizeJsonSchema(
        z.toJSONSchema(visitorAccessAggregatePageSchema),
        'visitorAccessAggregatePage',
      ),
      visitorAccessLogPage: sanitizeJsonSchema(
        z.toJSONSchema(visitorAccessLogPageSchema),
        'visitorAccessLogPage',
      ),
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
