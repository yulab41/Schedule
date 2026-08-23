import type {
  AppliedManualScheduleTemplateResult,
  ApplyManualScheduleTemplateRequest,
  CreateManualScheduleTemplateRequest,
  ManualApplyPreview,
  ManualScheduleTemplate,
  PreviewManualTemplateApplyRequest,
  SchedulingConfig,
  UpdateManualScheduleTemplateRequest,
} from '@schedule/contracts';
import {
  isManualScheduleDateRangeWithinLimit,
  isValidManualScheduleDate,
} from '@schedule/contracts/manual-schedule-limits';

import {
  appliedManualScheduleTemplateResultJsonSchema,
  manualApplyPreviewJsonSchema,
  manualScheduleTemplateJsonSchema,
  manualScheduleTemplateListJsonSchema,
  schedulingConfigJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder, type CompactDecoder } from './json-decoder.js';

interface GroupInput {
  readonly groupId: string;
}

interface CreateTemplateInput extends GroupInput {
  readonly request: CreateManualScheduleTemplateRequest;
}

interface UpdateTemplateInput extends GroupInput {
  readonly request: UpdateManualScheduleTemplateRequest;
  readonly templateId: string;
}

interface PreviewInput extends GroupInput {
  readonly request: PreviewManualTemplateApplyRequest;
  readonly templateId: string;
}

interface ApplyInput extends GroupInput {
  readonly request: ApplyManualScheduleTemplateRequest;
  readonly templateId: string;
}

const templateStructureDecoder = createCompactDecoder<ManualScheduleTemplate>(
  manualScheduleTemplateJsonSchema,
);
const templateListStructureDecoder = createCompactDecoder<readonly ManualScheduleTemplate[]>(
  manualScheduleTemplateListJsonSchema,
);
const previewStructureDecoder = createCompactDecoder<ManualApplyPreview>(
  manualApplyPreviewJsonSchema,
);
const appliedStructureDecoder = createCompactDecoder<AppliedManualScheduleTemplateResult>(
  appliedManualScheduleTemplateResultJsonSchema,
);
const configStructureDecoder = createCompactDecoder<SchedulingConfig>(schedulingConfigJsonSchema);

export const manualScheduleTemplateDecoder = refineDecoder(
  templateStructureDecoder,
  isValidManualScheduleTemplate,
);
export const manualScheduleTemplateListDecoder = refineDecoder(
  templateListStructureDecoder,
  (templates) => templates.every(isValidManualScheduleTemplate),
);
export const manualApplyPreviewDecoder = refineDecoder(
  previewStructureDecoder,
  isValidManualApplyPreview,
);
export const appliedManualScheduleTemplateResultDecoder = refineDecoder(
  appliedStructureDecoder,
  (result) => isValidManualApplyPreview(result.preview),
);
export const schedulingConfigDecoder = refineDecoder(configStructureDecoder, (config) =>
  Number.isInteger(config.rulesVersion),
);

export const manualScheduleEndpoints = {
  apply: defineClientEndpoint<ApplyInput, AppliedManualScheduleTemplateResult>({
    auth: 'bearer',
    body: ({ request }) => request,
    decoder: appliedManualScheduleTemplateResultDecoder,
    id: 'manual-schedule.apply',
    idempotencyKey: ({ request }) => request.operationId,
    method: 'POST',
    path: ({ groupId, templateId }) => templateActionPath(groupId, templateId, 'apply'),
  }),
  config: defineClientEndpoint<GroupInput, SchedulingConfig>({
    auth: 'bearer',
    decoder: schedulingConfigDecoder,
    id: 'manual-schedule.config',
    method: 'GET',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/scheduling-config`,
  }),
  createTemplate: defineClientEndpoint<CreateTemplateInput, ManualScheduleTemplate>({
    auth: 'bearer',
    body: ({ request }) => request,
    decoder: manualScheduleTemplateDecoder,
    id: 'manual-schedule.create-template',
    method: 'POST',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates`,
  }),
  preview: defineClientEndpoint<PreviewInput, ManualApplyPreview>({
    auth: 'bearer',
    body: ({ request }) => request,
    decoder: manualApplyPreviewDecoder,
    id: 'manual-schedule.preview',
    method: 'POST',
    path: ({ groupId, templateId }) => templateActionPath(groupId, templateId, 'apply-preview'),
  }),
  templates: defineClientEndpoint<GroupInput, readonly ManualScheduleTemplate[]>({
    auth: 'bearer',
    decoder: manualScheduleTemplateListDecoder,
    id: 'manual-schedule.templates',
    method: 'GET',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates`,
  }),
  updateTemplate: defineClientEndpoint<UpdateTemplateInput, ManualScheduleTemplate>({
    auth: 'bearer',
    body: ({ request }) => request,
    decoder: manualScheduleTemplateDecoder,
    id: 'manual-schedule.update-template',
    method: 'PUT',
    path: ({ groupId, templateId }) => templatePath(groupId, templateId),
  }),
} as const;

export interface ManualScheduleClient {
  apply(
    groupId: string,
    templateId: string,
    request: ApplyManualScheduleTemplateRequest,
  ): Promise<AppliedManualScheduleTemplateResult>;
  createTemplate(
    groupId: string,
    request: CreateManualScheduleTemplateRequest,
  ): Promise<ManualScheduleTemplate>;
  getConfig(groupId: string): Promise<SchedulingConfig>;
  listTemplates(groupId: string): Promise<readonly ManualScheduleTemplate[]>;
  preview(
    groupId: string,
    templateId: string,
    request: PreviewManualTemplateApplyRequest,
  ): Promise<ManualApplyPreview>;
  updateTemplate(
    groupId: string,
    templateId: string,
    request: UpdateManualScheduleTemplateRequest,
  ): Promise<ManualScheduleTemplate>;
}

export function createManualScheduleClient(transport: ClientTransport): ManualScheduleClient {
  return {
    apply(groupId, templateId, request) {
      return transport.request(manualScheduleEndpoints.apply, { groupId, request, templateId });
    },
    createTemplate(groupId, request) {
      return transport.request(manualScheduleEndpoints.createTemplate, { groupId, request });
    },
    getConfig(groupId) {
      return transport.request(manualScheduleEndpoints.config, { groupId });
    },
    listTemplates(groupId) {
      return transport.request(manualScheduleEndpoints.templates, { groupId });
    },
    preview(groupId, templateId, request) {
      return transport.request(manualScheduleEndpoints.preview, { groupId, request, templateId });
    },
    updateTemplate(groupId, templateId, request) {
      return transport.request(manualScheduleEndpoints.updateTemplate, {
        groupId,
        request,
        templateId,
      });
    },
  };
}

function refineDecoder<Output>(
  decoder: CompactDecoder<Output>,
  validate: (value: Output) => boolean,
): CompactDecoder<Output> {
  return {
    safeDecode(value) {
      const decoded = decoder.safeDecode(value);
      return decoded.success && validate(decoded.data) ? decoded : { success: false };
    },
  };
}

function isValidManualScheduleTemplate(template: ManualScheduleTemplate): boolean {
  if (!isValidManualScheduleDate(template.startDate)) return false;
  const membershipIds = new Set(template.members.map((member) => member.membershipId));
  if (membershipIds.size !== template.members.length) return false;
  const cellKeys = new Set<string>();
  for (const cell of template.cells) {
    if (cell.cycleDay > template.cycleDays || !membershipIds.has(cell.membershipId)) return false;
    const key = `${cell.cycleDay}:${cell.membershipId}`;
    if (cellKeys.has(key)) return false;
    cellKeys.add(key);
  }
  return true;
}

function isValidManualApplyPreview(preview: ManualApplyPreview): boolean {
  return (
    isManualScheduleDateRangeWithinLimit(preview.applyStartDate, preview.applyEndDate) &&
    preview.assignments.every((assignment) => isValidManualScheduleDate(assignment.businessDate)) &&
    preview.vacancies.every((vacancy) => isValidManualScheduleDate(vacancy.businessDate))
  );
}

function templatePath(groupId: string, templateId: string): string {
  return `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates/${encodeURIComponent(templateId)}`;
}

function templateActionPath(groupId: string, templateId: string, action: string): string {
  return `${templatePath(groupId, templateId)}/${action}`;
}
