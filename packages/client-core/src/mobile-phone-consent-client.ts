import type {
  GroupMobilePhoneConsent,
  UpdateGroupMobilePhoneConsentRequest,
} from '@schedule/contracts';

import { groupMobilePhoneConsentJsonSchema } from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';

interface GroupInput {
  readonly groupId: string;
}

export type GroupMobilePhoneConsentSubmission = Readonly<
  Omit<UpdateGroupMobilePhoneConsentRequest, 'operationId'>
> & {
  readonly operationId: string;
};

interface UpdateConsentInput extends GroupInput {
  readonly request: GroupMobilePhoneConsentSubmission;
}

export const groupMobilePhoneConsentDecoder = createCompactDecoder<GroupMobilePhoneConsent>(
  groupMobilePhoneConsentJsonSchema,
);

export const groupMobilePhoneConsentEndpoints = {
  status: defineClientEndpoint<GroupInput, GroupMobilePhoneConsent>({
    auth: 'bearer',
    decoder: groupMobilePhoneConsentDecoder,
    id: 'group-mobile-phone-consent.status',
    method: 'GET',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/mobile-phone-consent`,
  }),
  update: defineClientEndpoint<UpdateConsentInput, GroupMobilePhoneConsent>({
    auth: 'bearer',
    body: ({ request }) => request,
    decoder: groupMobilePhoneConsentDecoder,
    id: 'group-mobile-phone-consent.update',
    idempotencyKey: ({ request }) => request.operationId,
    method: 'PUT',
    path: ({ groupId }) => `/groups/${encodeURIComponent(groupId)}/mobile-phone-consent`,
  }),
} as const;

export interface GroupMobilePhoneConsentClient {
  getStatus(groupId: string): Promise<GroupMobilePhoneConsent>;
  update(
    groupId: string,
    request: GroupMobilePhoneConsentSubmission,
  ): Promise<GroupMobilePhoneConsent>;
}

export function createGroupMobilePhoneConsentClient(
  transport: ClientTransport,
): GroupMobilePhoneConsentClient {
  return {
    getStatus(groupId) {
      return transport.request(groupMobilePhoneConsentEndpoints.status, { groupId });
    },
    update(groupId, request) {
      return transport.request(groupMobilePhoneConsentEndpoints.update, { groupId, request });
    },
  };
}
