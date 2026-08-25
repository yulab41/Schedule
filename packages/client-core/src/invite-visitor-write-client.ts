import type {
  AcceptInviteRequest,
  AcceptInviteResponse,
  CreateInviteLinkRequest,
  CreateInviteLinkResponse,
  GroupVersionMutationRequest,
  RevokeInviteRequest,
  VisitorKeyChangedResponse,
} from '@schedule/contracts';

import {
  acceptInviteResponseJsonSchema,
  createInviteLinkResponseJsonSchema,
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

export const createInviteLinkResponseDecoder = createCompactDecoder<CreateInviteLinkResponse>(
  createInviteLinkResponseJsonSchema,
);
export const acceptInviteResponseDecoder = createCompactDecoder<AcceptInviteResponse>(
  acceptInviteResponseJsonSchema,
);
export const visitorKeyChangedResponseDecoder = createCompactDecoder<VisitorKeyChangedResponse>(
  visitorKeyChangedResponseJsonSchema,
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
  acceptInvite: defineClientEndpoint<RequestInput<AcceptInviteRequest>, AcceptInviteResponse>({
    auth: 'bearer',
    body,
    decoder: acceptInviteResponseDecoder,
    id: 'invite-visitor-write.invite-accept',
    idempotencyKey: operationId,
    method: 'POST',
    path: () => '/invites/accept',
  }),
  createInviteLink: defineClientEndpoint<
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
  regenerateVisitorKey: defineClientEndpoint<
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
  revokeInvite: defineClientEndpoint<RevokeInviteInput, void>({
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
