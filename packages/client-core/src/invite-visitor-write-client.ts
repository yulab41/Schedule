import type {
  AcceptInviteRequest,
  AcceptInviteResponse,
  CreateInviteLinkRequest,
  CreateInviteLinkResponse,
  CreateMemberWechatBindingQrRequest,
  CreateMemberWechatBindingQrResponse,
  GroupVersionMutationRequest,
  RevokeInviteRequest,
  VisitorKeyChangedResponse,
} from '@schedule/contracts';

import {
  acceptInviteResponseJsonSchema,
  createInviteLinkResponseJsonSchema,
  createMemberWechatBindingQrResponseJsonSchema,
  visitorKeyChangedResponseJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder, type CompactDecoder } from './json-decoder.js';

interface RequestInput<Request> {
  readonly request: Request;
}

interface GroupRequestInput<Request> extends RequestInput<Request> {
  readonly groupId: string;
}

interface RevokeInviteInput extends GroupRequestInput<RevokeInviteRequest> {
  readonly inviteToken: string;
}

interface MemberQrInput extends GroupRequestInput<CreateMemberWechatBindingQrRequest> {
  readonly membershipId: string;
}

export const createInviteLinkResponseDecoder =
  /* @__PURE__ */ createCompactDecoder<CreateInviteLinkResponse>(
    createInviteLinkResponseJsonSchema,
  );
export const acceptInviteResponseDecoder =
  /* @__PURE__ */ createCompactDecoder<AcceptInviteResponse>(acceptInviteResponseJsonSchema);
export const visitorKeyChangedResponseDecoder =
  /* @__PURE__ */ createCompactDecoder<VisitorKeyChangedResponse>(
    visitorKeyChangedResponseJsonSchema,
  );
export const createMemberWechatBindingQrResponseDecoder =
  /* @__PURE__ */ createCompactDecoder<CreateMemberWechatBindingQrResponse>(
    createMemberWechatBindingQrResponseJsonSchema,
  );

const emptyResponseDecoder: CompactDecoder<void> = {
  safeDecode(value) {
    return value === undefined || value === null || value === ''
      ? { data: undefined, success: true }
      : { success: false };
  },
};
const body = <Request>({ request }: RequestInput<Request>): Request => request;
const operationId = <Request extends { readonly operationId: string }>(
  input: RequestInput<Request>,
): string => input.request.operationId;

export const inviteVisitorWriteEndpoints = {
  acceptInvite: /* @__PURE__ */ defineClientEndpoint<
    RequestInput<AcceptInviteRequest>,
    AcceptInviteResponse
  >({
    auth: 'bearer',
    body,
    decoder: acceptInviteResponseDecoder,
    id: 'invite-visitor-write.invite-accept',
    idempotencyKey: operationId,
    method: 'POST',
    path: () => '/invites/accept',
  }),
  createInviteLink: /* @__PURE__ */ defineClientEndpoint<
    GroupRequestInput<CreateInviteLinkRequest>,
    CreateInviteLinkResponse
  >({
    auth: 'bearer',
    body,
    decoder: createInviteLinkResponseDecoder,
    id: 'invite-visitor-write.invite-create',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId }) => `${groupPath(groupId)}/invite-links`,
  }),
  createMemberWechatBindingQr: /* @__PURE__ */ defineClientEndpoint<
    MemberQrInput,
    CreateMemberWechatBindingQrResponse
  >({
    auth: 'bearer',
    body,
    decoder: createMemberWechatBindingQrResponseDecoder,
    id: 'invite-visitor-write.member-binding-qr-create',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId, membershipId }) =>
      `${groupPath(groupId)}/members/${encodeURIComponent(membershipId)}/wechat-miniprogram-binding-qr`,
  }),
  regenerateVisitorKey: /* @__PURE__ */ defineClientEndpoint<
    GroupRequestInput<GroupVersionMutationRequest>,
    VisitorKeyChangedResponse
  >({
    auth: 'bearer',
    body,
    decoder: visitorKeyChangedResponseDecoder,
    id: 'invite-visitor-write.visitor-key-regenerate',
    idempotencyKey: operationId,
    method: 'PUT',
    path: ({ groupId }) => `${groupPath(groupId)}/visitor-key`,
  }),
  revokeInvite: /* @__PURE__ */ defineClientEndpoint<RevokeInviteInput, void>({
    auth: 'bearer',
    body,
    decoder: emptyResponseDecoder,
    id: 'invite-visitor-write.invite-revoke',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId, inviteToken }) =>
      `${groupPath(groupId)}/invite-links/${encodeURIComponent(inviteToken)}/revoke`,
  }),
} as const;

export interface InviteVisitorWriteClient {
  acceptInvite(request: AcceptInviteRequest): Promise<AcceptInviteResponse>;
  createInviteLink(
    groupId: string,
    request: CreateInviteLinkRequest,
  ): Promise<CreateInviteLinkResponse>;
  createMemberWechatBindingQr(
    groupId: string,
    membershipId: string,
    request: CreateMemberWechatBindingQrRequest,
  ): Promise<CreateMemberWechatBindingQrResponse>;
  regenerateVisitorKey(
    groupId: string,
    request: GroupVersionMutationRequest,
  ): Promise<VisitorKeyChangedResponse>;
  revokeInvite(groupId: string, inviteToken: string, request: RevokeInviteRequest): Promise<void>;
}

export function createInviteVisitorWriteClient(
  transport: ClientTransport,
): InviteVisitorWriteClient {
  return {
    acceptInvite: (request) =>
      transport.request(inviteVisitorWriteEndpoints.acceptInvite, { request }),
    createInviteLink: (groupId, request) =>
      transport.request(inviteVisitorWriteEndpoints.createInviteLink, { groupId, request }),
    createMemberWechatBindingQr: (groupId, membershipId, request) =>
      transport.request(inviteVisitorWriteEndpoints.createMemberWechatBindingQr, {
        groupId,
        membershipId,
        request,
      }),
    regenerateVisitorKey: (groupId, request) =>
      transport.request(inviteVisitorWriteEndpoints.regenerateVisitorKey, { groupId, request }),
    revokeInvite: (groupId, inviteToken, request) =>
      transport.request(inviteVisitorWriteEndpoints.revokeInvite, {
        groupId,
        inviteToken,
        request,
      }),
  };
}

function groupPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}`;
}
