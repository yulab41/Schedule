import type {
  AccountActivitySummary,
  AccountOpenRequest,
  AccountOpenResponse,
} from '@schedule/contracts';
import {
  accountActivitySummaryJsonSchema,
  accountOpenResponseJsonSchema,
} from './generated/calendar-schemas.js';
import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import { createCompactDecoder } from './json-decoder.js';
const endpoints = {
  summary: /* @__PURE__ */ defineClientEndpoint<{ userId: string }, AccountActivitySummary>({
    id: 'account-activity.summary',
    method: 'GET',
    auth: 'bearer',
    path: ({ userId }) => `/platform-admin/users/${encodeURIComponent(userId)}/activity`,
    decoder: /* @__PURE__ */ createCompactDecoder<AccountActivitySummary>(
      accountActivitySummaryJsonSchema,
    ),
  }),
  open: /* @__PURE__ */ defineClientEndpoint<AccountOpenRequest, AccountOpenResponse>({
    id: 'account-activity.open',
    method: 'POST',
    auth: 'bearer',
    path: () => '/me/activity/opens',
    body: (input) => input,
    idempotencyKey: (input) => input.eventId,
    decoder: /* @__PURE__ */ createCompactDecoder<AccountOpenResponse>(
      accountOpenResponseJsonSchema,
    ),
  }),
};
export const accountActivityEndpoints = endpoints;
export function createAccountOpenClient(transport: ClientTransport) {
  return { open: (input: AccountOpenRequest) => transport.request(endpoints.open, input) };
}
