import type {
  AddRosterEntriesResponse,
  ApiErrorCode,
  ApiErrorResponse,
  CalendarReadModel,
  ClaimGroupResponse,
  CreateScheduleRoleRequest,
  CreateShiftTypeRequest,
  CreateManualScheduleTemplateRequest,
  CreateGroupRequest,
  GroupMember,
  GroupMemberContact,
  GroupSummary,
  ManualScheduleTemplate,
  ReorderRotationMembersRequest,
  RegenerateGroupCodeRequest,
  ReplaceScheduleRoleMembersRequest,
  ScheduleRole,
  SchedulingConfig,
  ShiftType,
  UpdateRotationRuleRequest,
  TransferGroupOwnershipRequest,
  UpdateGroupMemberContactRequest,
  UpdateGroupMemberRoleRequest,
  UpdateManualScheduleTemplateRequest,
  UpdateShiftTypeRequest,
  UserProfile,
} from '@schedule/contracts';

import { getAuthenticatedSession, type CloudbaseAuthClient } from '../auth/cloudbase.js';

export interface ApiClient {
  addRosterEntries(
    groupId: string,
    input: { readonly realNames: readonly string[] },
  ): Promise<AddRosterEntriesResponse>;
  claimGroup(input: { readonly groupCode: string }): Promise<ClaimGroupResponse>;
  createManualScheduleTemplate(
    groupId: string,
    input: CreateManualScheduleTemplateRequest,
  ): Promise<ManualScheduleTemplate>;
  createScheduleRole(groupId: string, input: CreateScheduleRoleRequest): Promise<ScheduleRole>;
  createShiftType(groupId: string, input: CreateShiftTypeRequest): Promise<ShiftType>;
  createGroup(input: CreateGroupRequest): Promise<GroupSummary>;
  createCurrentProfile(input: { readonly realName: string }): Promise<UserProfile>;
  deleteGroup(groupId: string): Promise<void>;
  getCalendar(groupId: string, businessMonth: string): Promise<CalendarReadModel>;
  getCurrentProfile(): Promise<UserProfile>;
  getSchedulingConfig(groupId: string): Promise<SchedulingConfig>;
  listManualScheduleTemplates(groupId: string): Promise<ManualScheduleTemplate[]>;
  listGroupContacts(groupId: string): Promise<GroupMemberContact[]>;
  listGroupMembers(groupId: string): Promise<GroupMember[]>;
  listGroups(): Promise<GroupSummary[]>;
  regenerateGroupCode(groupId: string, input: RegenerateGroupCodeRequest): Promise<GroupSummary>;
  reorderRotationMembers(
    groupId: string,
    roleId: string,
    input: ReorderRotationMembersRequest,
  ): Promise<ScheduleRole>;
  replaceScheduleRoleMembers(
    groupId: string,
    roleId: string,
    input: ReplaceScheduleRoleMembersRequest,
  ): Promise<ScheduleRole>;
  transferGroupOwnership(
    groupId: string,
    input: TransferGroupOwnershipRequest,
  ): Promise<GroupSummary>;
  updateManualScheduleTemplate(
    groupId: string,
    templateId: string,
    input: UpdateManualScheduleTemplateRequest,
  ): Promise<ManualScheduleTemplate>;
  updateGroupMemberContact(
    groupId: string,
    membershipId: string,
    input: UpdateGroupMemberContactRequest,
  ): Promise<GroupMemberContact>;
  updateGroupMemberRole(
    groupId: string,
    membershipId: string,
    input: UpdateGroupMemberRoleRequest,
  ): Promise<GroupMember>;
  updateRotationRule(
    groupId: string,
    roleId: string,
    input: UpdateRotationRuleRequest,
  ): Promise<ScheduleRole>;
  updateShiftType(
    groupId: string,
    shiftTypeId: string,
    input: UpdateShiftTypeRequest,
  ): Promise<ShiftType>;
}

export interface CreateApiClientOptions {
  readonly apiBaseUrl?: string;
  readonly auth: CloudbaseAuthClient;
  readonly fetch?: typeof fetch;
}

const knownApiErrorCodes = new Set<ApiErrorCode>([
  'AUTHENTICATION_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'CONFLICT',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

export function createApiClient(options: CreateApiClientOptions): ApiClient {
  const baseUrl = options.apiBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '/api';
  const fetchImplementation = options.fetch ?? fetch;

  return {
    addRosterEntries(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/roster-entries`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isAddRosterEntriesResponse,
      );
    },
    claimGroup(input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/groups/claim',
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isClaimGroupResponse,
      );
    },
    createManualScheduleTemplate(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isManualScheduleTemplate,
      );
    },
    createScheduleRole(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedule-roles`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isScheduleRole,
      );
    },
    createShiftType(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/shift-types`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isShiftType,
      );
    },
    createGroup(input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/groups',
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isGroupSummary,
      );
    },
    createCurrentProfile(input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/users',
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isUserProfile,
      );
    },
    deleteGroup(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}`,
        { method: 'DELETE' },
        isUndefined,
      );
    },
    getCalendar(groupId, businessMonth) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/calendar?businessMonth=${encodeURIComponent(businessMonth)}`,
        { method: 'GET' },
        isCalendarReadModel,
      );
    },
    getCurrentProfile() {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/users/me',
        { method: 'GET' },
        isUserProfile,
      );
    },
    getSchedulingConfig(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/scheduling-config`,
        { method: 'GET' },
        isSchedulingConfig,
      );
    },
    listManualScheduleTemplates(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates`,
        { method: 'GET' },
        isManualScheduleTemplateList,
      );
    },
    listGroupContacts(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/contacts`,
        { method: 'GET' },
        isGroupMemberContactList,
      );
    },
    listGroupMembers(groupId) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/members`,
        { method: 'GET' },
        isGroupMemberList,
      );
    },
    listGroups() {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        '/groups',
        { method: 'GET' },
        isGroupSummaryList,
      );
    },
    regenerateGroupCode(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/group-code`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isGroupSummary,
      );
    },
    reorderRotationMembers(groupId, roleId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedule-roles/${encodeURIComponent(roleId)}/rotation-members`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isScheduleRole,
      );
    },
    replaceScheduleRoleMembers(groupId, roleId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedule-roles/${encodeURIComponent(roleId)}/members`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isScheduleRole,
      );
    },
    transferGroupOwnership(groupId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/owner-transfer`,
        {
          body: JSON.stringify(input),
          method: 'POST',
        },
        isGroupSummary,
      );
    },
    updateManualScheduleTemplate(groupId, templateId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/manual-schedule-templates/${encodeURIComponent(templateId)}`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isManualScheduleTemplate,
      );
    },
    updateGroupMemberContact(groupId, membershipId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(membershipId)}/contact`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isGroupMemberContact,
      );
    },
    updateGroupMemberRole(groupId, membershipId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(membershipId)}/role`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isGroupMember,
      );
    },
    updateRotationRule(groupId, roleId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/schedule-roles/${encodeURIComponent(roleId)}/rotation-rule`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isScheduleRole,
      );
    },
    updateShiftType(groupId, shiftTypeId, input) {
      return requestJson(
        options.auth,
        fetchImplementation,
        baseUrl,
        `/groups/${encodeURIComponent(groupId)}/shift-types/${encodeURIComponent(shiftTypeId)}`,
        {
          body: JSON.stringify(input),
          method: 'PUT',
        },
        isShiftType,
      );
    },
  };
}

export class ApiClientError extends Error {
  public readonly code: ApiErrorCode | 'NETWORK_ERROR' | undefined;
  public readonly requestId: string | undefined;
  public readonly status: number | undefined;

  public constructor(input: {
    readonly code?: ApiErrorCode | 'NETWORK_ERROR';
    readonly message: string;
    readonly requestId?: string;
    readonly status?: number;
  }) {
    super(input.message);
    this.name = 'ApiClientError';
    this.code = input.code;
    this.requestId = input.requestId;
    this.status = input.status;
  }
}

async function requestJson<ResponseBody>(
  auth: CloudbaseAuthClient,
  fetchImplementation: typeof fetch,
  baseUrl: string,
  path: string,
  init: { readonly body?: string; readonly method: 'DELETE' | 'GET' | 'POST' | 'PUT' },
  isResponseBody: (value: unknown) => value is ResponseBody,
): Promise<ResponseBody> {
  const session = getAuthenticatedSession(await auth.getSession());

  if (session === undefined) {
    throw new ApiClientError({
      code: 'AUTHENTICATION_REQUIRED',
      message: '登录状态已失效，请重新登录。',
      status: 401,
    });
  }

  let response: Response;
  try {
    response = await fetchImplementation(joinUrl(baseUrl, path), {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      method: init.method,
      ...(init.body === undefined ? {} : { body: init.body }),
    });
  } catch {
    throw new ApiClientError({
      code: 'NETWORK_ERROR',
      message: '无法连接到服务，请检查网络后重试。',
    });
  }

  const body = await readJson(response);
  if (!response.ok) {
    throw toApiClientError(response.status, body);
  }

  if (!isResponseBody(body)) {
    throw new ApiClientError({
      code: 'SERVICE_UNAVAILABLE',
      message: '服务返回了无效资料，请稍后重试。',
      status: response.status,
    });
  }

  return body;
}

function isAddRosterEntriesResponse(value: unknown): value is AddRosterEntriesResponse {
  return (
    value !== null &&
    typeof value === 'object' &&
    'added' in value &&
    typeof value.added === 'number' &&
    Number.isInteger(value.added) &&
    value.added > 0
  );
}

function isCalendarReadModel(value: unknown): value is CalendarReadModel {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const calendar = value as Partial<CalendarReadModel>;
  return (
    typeof calendar.businessMonth === 'string' &&
    /^\d{4}-\d{2}$/u.test(calendar.businessMonth) &&
    typeof calendar.groupId === 'string' &&
    Array.isArray(calendar.assignments) &&
    calendar.assignments.every(isCalendarDutyAssignment) &&
    Array.isArray(calendar.members) &&
    calendar.members.every(isCalendarDutyMember) &&
    Array.isArray(calendar.roles) &&
    calendar.roles.every(isCalendarRoleSummary) &&
    Array.isArray(calendar.shiftTypes) &&
    calendar.shiftTypes.every(isCalendarShiftTypeSummary)
  );
}

function isCalendarDutyAssignment(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const assignment = value as Partial<CalendarReadModel['assignments'][number]>;
  return (
    typeof assignment.businessDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(assignment.businessDate) &&
    typeof assignment.endsAt === 'string' &&
    typeof assignment.id === 'string' &&
    assignment.id.length > 0 &&
    typeof assignment.startsAt === 'string' &&
    typeof assignment.schedulePeriodId === 'string' &&
    assignment.schedulePeriodId.length > 0 &&
    typeof assignment.scheduleRoleId === 'string' &&
    assignment.scheduleRoleId.length > 0 &&
    typeof assignment.scheduleRoleName === 'string' &&
    assignment.scheduleRoleName.length > 0 &&
    typeof assignment.shiftTypeAbbreviation === 'string' &&
    assignment.shiftTypeAbbreviation.length > 0 &&
    typeof assignment.shiftTypeColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(assignment.shiftTypeColor) &&
    typeof assignment.shiftTypeId === 'string' &&
    assignment.shiftTypeId.length > 0 &&
    typeof assignment.shiftTypeName === 'string' &&
    assignment.shiftTypeName.length > 0 &&
    typeof assignment.shiftTypeTextColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(assignment.shiftTypeTextColor) &&
    typeof assignment.slotPosition === 'number' &&
    Number.isInteger(assignment.slotPosition) &&
    assignment.slotPosition >= 1 &&
    Array.isArray(assignment.changeMarkers) &&
    assignment.changeMarkers.every(isCalendarChangeMarker) &&
    (assignment.actualMemberName === undefined ||
      typeof assignment.actualMemberName === 'string') &&
    (assignment.actualMembershipId === undefined ||
      typeof assignment.actualMembershipId === 'string') &&
    (assignment.plannedMemberName === undefined ||
      typeof assignment.plannedMemberName === 'string') &&
    (assignment.plannedMembershipId === undefined ||
      typeof assignment.plannedMembershipId === 'string')
  );
}

function isCalendarChangeMarker(value: unknown): boolean {
  return (
    value === 'swap' ||
    value === 'leave-cover' ||
    value === 'manual-adjustment' ||
    value === 'overtime'
  );
}

function isCalendarDutyMember(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const member = value as Partial<CalendarReadModel['members'][number]>;
  return (
    typeof member.membershipId === 'string' &&
    member.membershipId.length > 0 &&
    typeof member.realName === 'string' &&
    member.realName.length > 0 &&
    typeof member.isConfirmed === 'boolean' &&
    (member.mobilePhone === undefined || typeof member.mobilePhone === 'string') &&
    (member.shortPhone === undefined || typeof member.shortPhone === 'string')
  );
}

function isCalendarRoleSummary(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const role = value as Partial<CalendarReadModel['roles'][number]>;
  return (
    typeof role.id === 'string' &&
    role.id.length > 0 &&
    typeof role.name === 'string' &&
    role.name.length > 0
  );
}

function isCalendarShiftTypeSummary(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const shiftType = value as Partial<CalendarReadModel['shiftTypes'][number]>;
  return (
    typeof shiftType.id === 'string' &&
    shiftType.id.length > 0 &&
    typeof shiftType.name === 'string' &&
    shiftType.name.length > 0 &&
    typeof shiftType.abbreviation === 'string' &&
    shiftType.abbreviation.length > 0 &&
    typeof shiftType.color === 'string' &&
    /^#[\dA-F]{6}$/iu.test(shiftType.color) &&
    typeof shiftType.textColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(shiftType.textColor) &&
    typeof shiftType.crossesMidnight === 'boolean' &&
    typeof shiftType.isAllDay === 'boolean' &&
    (shiftType.startTime === undefined || /^\d{2}:\d{2}$/u.test(shiftType.startTime)) &&
    (shiftType.endTime === undefined || /^\d{2}:\d{2}$/u.test(shiftType.endTime))
  );
}

function isClaimGroupResponse(value: unknown): value is ClaimGroupResponse {
  if (value === null || typeof value !== 'object' || !('status' in value)) {
    return false;
  }

  if (value.status === 'request_created') {
    return Object.keys(value).length === 1;
  }

  return value.status === 'claimed' && 'group' in value && isGroupSummary(value.group);
}

function isGroupMember(value: unknown): value is GroupMember {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const member = value as Partial<GroupMember>;
  return (
    typeof member.id === 'string' &&
    member.id.length > 0 &&
    typeof member.isCurrentUser === 'boolean' &&
    typeof member.realName === 'string' &&
    member.realName.length > 0 &&
    (member.role === 'administrator' || member.role === 'member' || member.role === 'owner')
  );
}

function isGroupMemberContact(value: unknown): value is GroupMemberContact {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const contact = value as Partial<GroupMemberContact>;
  return (
    typeof contact.membershipId === 'string' &&
    contact.membershipId.length > 0 &&
    typeof contact.isConfirmed === 'boolean' &&
    typeof contact.version === 'number' &&
    Number.isInteger(contact.version) &&
    contact.version >= 0 &&
    (contact.mobilePhone === undefined || typeof contact.mobilePhone === 'string') &&
    (contact.shortPhone === undefined || typeof contact.shortPhone === 'string') &&
    (contact.updatedAt === undefined || typeof contact.updatedAt === 'string')
  );
}

function isGroupMemberContactList(value: unknown): value is GroupMemberContact[] {
  return Array.isArray(value) && value.every(isGroupMemberContact);
}

function isGroupMemberList(value: unknown): value is GroupMember[] {
  return Array.isArray(value) && value.every(isGroupMember);
}

function isScheduleRole(value: unknown): value is ScheduleRole {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const role = value as Partial<ScheduleRole>;
  return (
    typeof role.id === 'string' &&
    role.id.length > 0 &&
    typeof role.name === 'string' &&
    role.name.length > 0 &&
    typeof role.version === 'number' &&
    Number.isInteger(role.version) &&
    Array.isArray(role.members) &&
    role.members.every(isScheduleRoleMember) &&
    isRotationRule(role.rotationRule)
  );
}

function isScheduleRoleMember(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const member = value as {
    id?: unknown;
    membershipId?: unknown;
    position?: unknown;
    realName?: unknown;
    version?: unknown;
  };
  return (
    typeof member.id === 'string' &&
    member.id.length > 0 &&
    typeof member.membershipId === 'string' &&
    member.membershipId.length > 0 &&
    typeof member.position === 'number' &&
    Number.isInteger(member.position) &&
    member.position >= 1 &&
    typeof member.realName === 'string' &&
    member.realName.length > 0 &&
    typeof member.version === 'number' &&
    Number.isInteger(member.version)
  );
}

function isRotationRule(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const rule = value as {
    currentPosition?: unknown;
    defaultShiftTypeId?: unknown;
    requiredMembersPerDay?: unknown;
    startDate?: unknown;
    startingMemberScheduleRoleId?: unknown;
    version?: unknown;
  };
  return (
    typeof rule.currentPosition === 'number' &&
    Number.isInteger(rule.currentPosition) &&
    rule.currentPosition >= 1 &&
    typeof rule.defaultShiftTypeId === 'string' &&
    rule.defaultShiftTypeId.length > 0 &&
    typeof rule.requiredMembersPerDay === 'number' &&
    Number.isInteger(rule.requiredMembersPerDay) &&
    rule.requiredMembersPerDay >= 1 &&
    typeof rule.version === 'number' &&
    Number.isInteger(rule.version) &&
    (rule.startDate === undefined || typeof rule.startDate === 'string') &&
    (rule.startingMemberScheduleRoleId === undefined ||
      typeof rule.startingMemberScheduleRoleId === 'string')
  );
}

function isSchedulingConfig(value: unknown): value is SchedulingConfig {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const config = value as Partial<SchedulingConfig>;
  return (
    Array.isArray(config.groupMembers) &&
    config.groupMembers.every(isSchedulingGroupMember) &&
    Array.isArray(config.roles) &&
    config.roles.every(isScheduleRole) &&
    Array.isArray(config.shiftTypes) &&
    config.shiftTypes.every(isShiftType)
  );
}

function isSchedulingGroupMember(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const member = value as { membershipId?: unknown; realName?: unknown };
  return (
    typeof member.membershipId === 'string' &&
    member.membershipId.length > 0 &&
    typeof member.realName === 'string' &&
    member.realName.length > 0
  );
}

function isShiftType(value: unknown): value is ShiftType {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const shiftType = value as Partial<ShiftType>;
  return (
    typeof shiftType.id === 'string' &&
    shiftType.id.length > 0 &&
    typeof shiftType.name === 'string' &&
    shiftType.name.length > 0 &&
    typeof shiftType.abbreviation === 'string' &&
    shiftType.abbreviation.length > 0 &&
    typeof shiftType.color === 'string' &&
    /^#[\dA-F]{6}$/iu.test(shiftType.color) &&
    typeof shiftType.textColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(shiftType.textColor) &&
    typeof shiftType.displayOrder === 'number' &&
    Number.isInteger(shiftType.displayOrder) &&
    typeof shiftType.isAllDay === 'boolean' &&
    typeof shiftType.isEnabled === 'boolean' &&
    typeof shiftType.crossesMidnight === 'boolean' &&
    typeof shiftType.countsTowardStatistics === 'boolean' &&
    typeof shiftType.configurationVersion === 'number' &&
    Number.isInteger(shiftType.configurationVersion) &&
    typeof shiftType.version === 'number' &&
    Number.isInteger(shiftType.version) &&
    (shiftType.startTime === undefined || /^\d{2}:\d{2}$/.test(shiftType.startTime)) &&
    (shiftType.endTime === undefined || /^\d{2}:\d{2}$/.test(shiftType.endTime))
  );
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function toApiClientError(status: number, body: unknown): ApiClientError {
  if (isApiErrorResponse(body)) {
    return new ApiClientError({
      code: body.error.code,
      message: body.error.message,
      requestId: body.error.requestId,
      status,
    });
  }

  return new ApiClientError({
    message: getHttpErrorMessage(status),
    status,
  });
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (value === null || typeof value !== 'object' || !('error' in value)) {
    return false;
  }

  const error = value.error;
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    knownApiErrorCodes.has(error.code as ApiErrorCode) &&
    'message' in error &&
    typeof error.message === 'string' &&
    'requestId' in error &&
    typeof error.requestId === 'string'
  );
}

function isUserProfile(value: unknown): value is UserProfile {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const profile = value as Partial<UserProfile>;
  return (
    typeof profile.id === 'string' &&
    profile.id.length > 0 &&
    typeof profile.realName === 'string' &&
    profile.realName.length > 0 &&
    typeof profile.version === 'number' &&
    Number.isInteger(profile.version) &&
    profile.version >= 1
  );
}

function isGroupSummary(value: unknown): value is GroupSummary {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const group = value as Partial<GroupSummary>;
  return (
    typeof group.id === 'string' &&
    group.id.length > 0 &&
    typeof group.name === 'string' &&
    group.name.length > 0 &&
    typeof group.groupCode === 'string' &&
    /^\d{4}$/.test(group.groupCode) &&
    (group.role === 'administrator' || group.role === 'member' || group.role === 'owner') &&
    typeof group.version === 'number' &&
    Number.isInteger(group.version) &&
    group.version >= 1
  );
}

function isGroupSummaryList(value: unknown): value is GroupSummary[] {
  return Array.isArray(value) && value.every(isGroupSummary);
}

function isManualScheduleTemplate(value: unknown): value is ManualScheduleTemplate {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const template = value as Partial<ManualScheduleTemplate>;
  return (
    typeof template.id === 'string' &&
    template.id.length > 0 &&
    typeof template.groupId === 'string' &&
    template.groupId.length > 0 &&
    typeof template.scheduleRoleId === 'string' &&
    template.scheduleRoleId.length > 0 &&
    typeof template.scheduleRoleName === 'string' &&
    template.scheduleRoleName.length > 0 &&
    typeof template.startDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(template.startDate) &&
    typeof template.cycleDays === 'number' &&
    Number.isInteger(template.cycleDays) &&
    template.cycleDays >= 1 &&
    template.cycleDays <= 31 &&
    typeof template.version === 'number' &&
    Number.isInteger(template.version) &&
    template.version >= 1 &&
    Array.isArray(template.members) &&
    template.members.every(isManualScheduleTemplateMember) &&
    Array.isArray(template.cells) &&
    template.cells.every(isManualScheduleTemplateCell)
  );
}

function isManualScheduleTemplateMember(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const member = value as Partial<ManualScheduleTemplate['members'][number]>;
  return (
    typeof member.membershipId === 'string' &&
    member.membershipId.length > 0 &&
    typeof member.realName === 'string' &&
    member.realName.length > 0 &&
    typeof member.memberScheduleRoleVersion === 'number' &&
    Number.isInteger(member.memberScheduleRoleVersion) &&
    member.memberScheduleRoleVersion >= 1 &&
    typeof member.currentMemberScheduleRoleVersion === 'number' &&
    Number.isInteger(member.currentMemberScheduleRoleVersion) &&
    member.currentMemberScheduleRoleVersion >= 0 &&
    typeof member.isAvailable === 'boolean' &&
    typeof member.isStale === 'boolean'
  );
}

function isManualScheduleTemplateCell(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const cell = value as Partial<ManualScheduleTemplate['cells'][number]>;
  return (
    typeof cell.cycleDay === 'number' &&
    Number.isInteger(cell.cycleDay) &&
    cell.cycleDay >= 1 &&
    cell.cycleDay <= 31 &&
    typeof cell.membershipId === 'string' &&
    cell.membershipId.length > 0 &&
    typeof cell.shiftTypeId === 'string' &&
    cell.shiftTypeId.length > 0 &&
    typeof cell.shiftTypeName === 'string' &&
    cell.shiftTypeName.length > 0 &&
    typeof cell.shiftTypeAbbreviation === 'string' &&
    cell.shiftTypeAbbreviation.length > 0 &&
    typeof cell.shiftTypeColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(cell.shiftTypeColor) &&
    typeof cell.shiftTypeTextColor === 'string' &&
    /^#[\dA-F]{6}$/iu.test(cell.shiftTypeTextColor) &&
    typeof cell.shiftTypeConfigurationVersion === 'number' &&
    Number.isInteger(cell.shiftTypeConfigurationVersion) &&
    cell.shiftTypeConfigurationVersion >= 1 &&
    typeof cell.currentShiftTypeConfigurationVersion === 'number' &&
    Number.isInteger(cell.currentShiftTypeConfigurationVersion) &&
    cell.currentShiftTypeConfigurationVersion >= 0 &&
    typeof cell.isShiftTypeEnabled === 'boolean' &&
    typeof cell.isStale === 'boolean'
  );
}

function isManualScheduleTemplateList(value: unknown): value is ManualScheduleTemplate[] {
  return Array.isArray(value) && value.every(isManualScheduleTemplate);
}

function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

function getHttpErrorMessage(status: number): string {
  if (status === 401) {
    return '登录状态已失效，请重新登录。';
  }

  if (status === 403) {
    return '当前账户无权执行此操作。';
  }

  if (status === 409) {
    return '资料已发生变化，请刷新后重试。';
  }

  return '服务暂时不可用，请稍后重试。';
}
