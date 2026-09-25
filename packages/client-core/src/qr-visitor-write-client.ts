import type {
  CreateCurrentMemberWechatBindingQrRequest,
  CreateCurrentMemberWechatBindingQrResponse,
  GroupVersionMutationRequest,
  VisitorKeyChangedResponse,
} from '@schedule/contracts';

import {
  createCurrentMemberWechatBindingQrResponseJsonSchema,
  visitorKeyChangedResponseJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';

interface RequestInput<Request> {
  readonly request: Request;
}

interface GroupRequestInput<Request> extends RequestInput<Request> {
  readonly groupId: string;
}

interface CurrentMemberQrInput extends GroupRequestInput<CreateCurrentMemberWechatBindingQrRequest> {
  readonly membershipId: string;
}

export const visitorKeyChangedResponseDecoder =
  /* @__PURE__ */ createCompactDecoder<VisitorKeyChangedResponse>(
    visitorKeyChangedResponseJsonSchema,
  );
export const createCurrentMemberWechatBindingQrResponseDecoder =
  /* @__PURE__ */ createCompactDecoder<CreateCurrentMemberWechatBindingQrResponse>(
    createCurrentMemberWechatBindingQrResponseJsonSchema,
  );

const body = <Request>({ request }: RequestInput<Request>): Request => request;
const operationId = <Request extends { readonly operationId: string }>(
  input: RequestInput<Request>,
): string => input.request.operationId;

export const qrVisitorWriteEndpoints = {
  createCurrentMemberWechatBindingQr: /* @__PURE__ */ defineClientEndpoint<
    CurrentMemberQrInput,
    CreateCurrentMemberWechatBindingQrResponse
  >({
    auth: 'bearer',
    body,
    decoder: createCurrentMemberWechatBindingQrResponseDecoder,
    id: 'qr-visitor-write.current-member-binding-qr-create',
    idempotencyKey: operationId,
    method: 'POST',
    path: ({ groupId, membershipId }) =>
      `${groupPath(groupId)}/members/${encodeURIComponent(membershipId)}/current-wechat-binding-qr`,
  }),
  regenerateVisitorKey: /* @__PURE__ */ defineClientEndpoint<
    GroupRequestInput<GroupVersionMutationRequest>,
    VisitorKeyChangedResponse
  >({
    auth: 'bearer',
    body,
    decoder: visitorKeyChangedResponseDecoder,
    id: 'qr-visitor-write.visitor-key-regenerate',
    idempotencyKey: operationId,
    method: 'PUT',
    path: ({ groupId }) => `${groupPath(groupId)}/visitor-key`,
  }),
} as const;

export interface QrVisitorWriteClient {
  createCurrentMemberWechatBindingQr(
    groupId: string,
    membershipId: string,
    request: CreateCurrentMemberWechatBindingQrRequest,
  ): Promise<CreateCurrentMemberWechatBindingQrResponse>;
  regenerateVisitorKey(
    groupId: string,
    request: GroupVersionMutationRequest,
  ): Promise<VisitorKeyChangedResponse>;
}

export function createQrVisitorWriteClient(transport: ClientTransport): QrVisitorWriteClient {
  return {
    createCurrentMemberWechatBindingQr: (groupId, membershipId, request) =>
      transport.request(qrVisitorWriteEndpoints.createCurrentMemberWechatBindingQr, {
        groupId,
        membershipId,
        request,
      }),
    regenerateVisitorKey: (groupId, request) =>
      transport.request(qrVisitorWriteEndpoints.regenerateVisitorKey, { groupId, request }),
  };
}

function groupPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}`;
}
