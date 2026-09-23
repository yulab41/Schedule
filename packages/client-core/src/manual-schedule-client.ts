import type {
  AppliedManualScheduleTemplateResult,
  ApplyManualScheduleTemplateRequest,
  CreateManualScheduleDraftRequest,
  CreateManualScheduleTemplateRequest,
  CreatedManualScheduleDraftResult,
  ManualApplyPreview,
  ManualScheduleEditorPreview,
  ManualScheduleTemplate,
  ManualScheduleStartDate,
  PreviewManualTemplateApplyRequest,
  PreviewManualScheduleEditorRequest,
  SchedulingConfig,
  UpdateManualScheduleTemplateRequest,
} from '@schedule/contracts';
import {
  isManualScheduleDateRangeWithinLimit,
  isValidManualScheduleDate,
} from '@schedule/contracts/manual-schedule-limits';

import {
  appliedManualScheduleTemplateResultJsonSchema,
  createdManualScheduleDraftResultJsonSchema,
  manualApplyPreviewJsonSchema,
  manualScheduleEditorPreviewJsonSchema,
  manualScheduleStartDateJsonSchema,
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

interface PreviewEditorInput extends GroupInput {
  readonly request: PreviewManualScheduleEditorRequest;
}

interface CreateDraftInput extends GroupInput {
  readonly request: CreateManualScheduleDraftRequest;
}

interface DeleteTemplateInput extends GroupInput {
  readonly templateId: string;
}

const templateStructureDecoder = /* @__PURE__ */ createCompactDecoder<ManualScheduleTemplate>(
  manualScheduleTemplateJsonSchema,
);
const templateListStructureDecoder = /* @__PURE__ */ createCompactDecoder<
  readonly ManualScheduleTemplate[]
>(manualScheduleTemplateListJsonSchema);
const previewStructureDecoder = /* @__PURE__ */ createCompactDecoder<ManualApplyPreview>(
  manualApplyPreviewJsonSchema,
);
const appliedStructureDecoder =
  /* @__PURE__ */ createCompactDecoder<AppliedManualScheduleTemplateResult>(
    appliedManualScheduleTemplateResultJsonSchema,
  );
const editorPreviewStructureDecoder =
  /* @__PURE__ */ createCompactDecoder<ManualScheduleEditorPreview>(
    manualScheduleEditorPreviewJsonSchema,
  );
const createdDraftStructureDecoder =
  /* @__PURE__ */ createCompactDecoder<CreatedManualScheduleDraftResult>(
    createdManualScheduleDraftResultJsonSchema,
  );
const configStructureDecoder = /* @__PURE__ */ createCompactDecoder<SchedulingConfig>(
  schedulingConfigJsonSchema,
);

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
export const manualScheduleEditorPreviewDecoder = refineDecoder(
  editorPreviewStructureDecoder,
  isValidManualApplyPreview,
);
export const createdManualScheduleDraftResultDecoder = refineDecoder(
  createdDraftStructureDecoder,
  (result) => isValidManualApplyPreview(result.preview),
);
export const schedulingConfigDecoder = refineDecoder(configStructureDecoder, (config) =>
  Number.isInteger(config.rulesVersion),
);

const emptyResponseDecoder: CompactDecoder<void> = {
  safeDecode(value) {
    return value === undefined || value === null || value === ''
      ? { data: undefined, success: true }
      : { success: false };
  },
};

export const manualScheduleEndpoints = {
  nextStartDate: /* @__PURE__ */ defineClientEndpoint<
    GroupInput & { roleId: string },
    ManualScheduleStartDate
  >({
    auth: 'bearer',
    decoder: /* @__PURE__ */ createCompactDecoder<ManualScheduleStartDate>(
      manualScheduleStartDateJsonSchema,
    ),
    id: 'manual-schedule.next-start-date',
    method: 'GET',
    path: ({ groupId, roleId }) =>
      `/groups/${encodeURIComponent(groupId)}/manual-schedule-start-date/${encodeURIComponent(roleId)}`,
  }),
  apply: /* @__PURE__ */ defineClientEndpoint<ApplyInput, AppliedManualScheduleTemplateResult>({
    auth: 'bearer',
    body: ({ request }) => request,
    decoder: appliedManualScheduleTemplateResultDecoder,
    id: 'manual-schedule.apply',
    idempotencyKey: ({ request }) => request.operationId,
    method: 'POST',
    path: ({ groupId, templateId }) => templateActionPath(groupId, templateId, 'apply'),
  }),
  config: /* @__PURE__ */ defineClientEndpoint<GroupInput, SchedulingConfig>({
    auth: 'bearer',
    decoder: schedulingConfigDecoder,
    id: 'manual-schedule.config',
    method: 'GET',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/scheduling-config`,
  }),
  createTemplate: /* @__PURE__ */ defineClientEndpoint<CreateTemplateInput, ManualScheduleTemplate>(
    {
      auth: 'bearer',
      body: ({ request }) => request,
      decoder: manualScheduleTemplateDecoder,
      id: 'manual-schedule.create-template',
      method: 'POST',
      path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates`,
    },
  ),
  createDraft: /* @__PURE__ */ defineClientEndpoint<
    CreateDraftInput,
    CreatedManualScheduleDraftResult
  >({
    auth: 'bearer',
    body: ({ request }) => request,
    decoder: createdManualScheduleDraftResultDecoder,
    id: 'manual-schedule.create-draft',
    idempotencyKey: ({ request }) => request.operationId,
    method: 'POST',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/manual-schedules/drafts`,
  }),
  deleteTemplate: /* @__PURE__ */ defineClientEndpoint<DeleteTemplateInput, void>({
    auth: 'bearer',
    body: () => ({}),
    decoder: emptyResponseDecoder,
    id: 'manual-schedule.delete-template',
    method: 'DELETE',
    path: ({ groupId, templateId }) => templatePath(groupId, templateId),
  }),
  preview: /* @__PURE__ */ defineClientEndpoint<PreviewInput, ManualApplyPreview>({
    auth: 'bearer',
    body: ({ request }) => request,
    decoder: manualApplyPreviewDecoder,
    id: 'manual-schedule.preview',
    method: 'POST',
    path: ({ groupId, templateId }) => templateActionPath(groupId, templateId, 'apply-preview'),
  }),
  previewEditor: /* @__PURE__ */ defineClientEndpoint<
    PreviewEditorInput,
    ManualScheduleEditorPreview
  >({
    auth: 'bearer',
    body: ({ request }) => request,
    decoder: manualScheduleEditorPreviewDecoder,
    id: 'manual-schedule.preview-editor',
    method: 'POST',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/manual-schedules/preview`,
  }),
  templates: /* @__PURE__ */ defineClientEndpoint<GroupInput, readonly ManualScheduleTemplate[]>({
    auth: 'bearer',
    decoder: manualScheduleTemplateListDecoder,
    id: 'manual-schedule.templates',
    method: 'GET',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates`,
  }),
  updateTemplate: /* @__PURE__ */ defineClientEndpoint<UpdateTemplateInput, ManualScheduleTemplate>(
    {
      auth: 'bearer',
      body: ({ request }) => request,
      decoder: manualScheduleTemplateDecoder,
      id: 'manual-schedule.update-template',
      method: 'PUT',
      path: ({ groupId, templateId }) => templatePath(groupId, templateId),
    },
  ),
} as const;

export interface ManualScheduleClient {
  getNextStartDate(groupId: string, roleId: string): Promise<ManualScheduleStartDate>;
  apply(
    groupId: string,
    templateId: string,
    request: ApplyManualScheduleTemplateRequest,
  ): Promise<AppliedManualScheduleTemplateResult>;
  createTemplate(
    groupId: string,
    request: CreateManualScheduleTemplateRequest,
  ): Promise<ManualScheduleTemplate>;
  createDraft(
    groupId: string,
    request: CreateManualScheduleDraftRequest,
  ): Promise<CreatedManualScheduleDraftResult>;
  deleteTemplate(groupId: string, templateId: string): Promise<void>;
  getConfig(groupId: string): Promise<SchedulingConfig>;
  listTemplates(groupId: string): Promise<readonly ManualScheduleTemplate[]>;
  preview(
    groupId: string,
    templateId: string,
    request: PreviewManualTemplateApplyRequest,
  ): Promise<ManualApplyPreview>;
  previewEditor(
    groupId: string,
    request: PreviewManualScheduleEditorRequest,
  ): Promise<ManualScheduleEditorPreview>;
  updateTemplate(
    groupId: string,
    templateId: string,
    request: UpdateManualScheduleTemplateRequest,
  ): Promise<ManualScheduleTemplate>;
}

export function createManualScheduleClient(transport: ClientTransport): ManualScheduleClient {
  return {
    getNextStartDate(groupId, roleId) {
      return transport.request(manualScheduleEndpoints.nextStartDate, { groupId, roleId });
    },
    apply(groupId, templateId, request) {
      return transport.request(manualScheduleEndpoints.apply, { groupId, request, templateId });
    },
    createTemplate(groupId, request) {
      return transport.request(manualScheduleEndpoints.createTemplate, { groupId, request });
    },
    createDraft(groupId, request) {
      return transport.request(manualScheduleEndpoints.createDraft, { groupId, request });
    },
    deleteTemplate(groupId, templateId) {
      return transport.request(manualScheduleEndpoints.deleteTemplate, { groupId, templateId });
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
    previewEditor(groupId, request) {
      return transport.request(manualScheduleEndpoints.previewEditor, { groupId, request });
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

function isValidManualApplyPreview(
  preview: ManualApplyPreview | ManualScheduleEditorPreview,
): boolean {
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
