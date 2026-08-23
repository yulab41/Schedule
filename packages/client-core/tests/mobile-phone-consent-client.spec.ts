import { groupMobilePhoneConsentSchema } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  createGroupMobilePhoneConsentClient,
  groupMobilePhoneConsentDecoder,
  groupMobilePhoneConsentEndpoints,
  type ClientEndpoint,
  type ClientTransport,
} from '../src/index.js';
import { groupMobilePhoneConsentGoldenResponse } from '../src/testing/mobile-phone-consent-api-golden.js';

const groupId = '11111111-1111-4111-8111-111111111111';
const operationId = '33333333-3333-4333-8333-333333333333';
const request = {
  consented: true,
  expectedContactVersion: 3,
  noticeVersion: 'v1',
  operationId,
} as const;

describe('group mobile phone consent client', () => {
  it('defines self-only status and idempotent update endpoints', () => {
    expect(groupMobilePhoneConsentEndpoints.status).toMatchObject({
      auth: 'bearer',
      id: 'group-mobile-phone-consent.status',
      method: 'GET',
    });
    expect(groupMobilePhoneConsentEndpoints.status.path({ groupId })).toBe(
      `/groups/${groupId}/mobile-phone-consent`,
    );
    const input = { groupId, request };
    expect(groupMobilePhoneConsentEndpoints.update).toMatchObject({
      auth: 'bearer',
      id: 'group-mobile-phone-consent.update',
      method: 'PUT',
    });
    expect(groupMobilePhoneConsentEndpoints.update.path(input)).toBe(
      `/groups/${groupId}/mobile-phone-consent`,
    );
    expect(groupMobilePhoneConsentEndpoints.update.body?.(input)).toBe(request);
    expect(groupMobilePhoneConsentEndpoints.update.idempotencyKey?.(input)).toBe(operationId);
  });

  it('preserves the transport receiver, response identity, rejection, and one-call semantics', async () => {
    const rejection = new Error('network result unknown');
    const transport = {
      calls: 0,
      request<Input, Output>(endpoint: ClientEndpoint<Input, Output>): Promise<Output> {
        expect(this).toBe(transport);
        this.calls += 1;
        if (endpoint.id.endsWith('.update') && this.calls > 2) return Promise.reject(rejection);
        return Promise.resolve(groupMobilePhoneConsentGoldenResponse as Output);
      },
    } satisfies ClientTransport & { calls: number };
    const client = createGroupMobilePhoneConsentClient(transport);

    await expect(client.getStatus(groupId)).resolves.toBe(groupMobilePhoneConsentGoldenResponse);
    await expect(client.update(groupId, request)).resolves.toBe(
      groupMobilePhoneConsentGoldenResponse,
    );
    await expect(client.update(groupId, request)).rejects.toBe(rejection);
    expect(transport.calls).toBe(3);
  });

  it('matches Web Zod decoding for the golden response and fails closed', () => {
    const decoded = groupMobilePhoneConsentDecoder.safeDecode(
      groupMobilePhoneConsentGoldenResponse,
    );
    expect(decoded.success).toBe(true);
    if (decoded.success) expect(decoded.data).toBe(groupMobilePhoneConsentGoldenResponse);
    expect(groupMobilePhoneConsentSchema.parse(groupMobilePhoneConsentGoldenResponse)).toEqual(
      groupMobilePhoneConsentGoldenResponse,
    );
    expect(
      groupMobilePhoneConsentDecoder.safeDecode({
        ...groupMobilePhoneConsentGoldenResponse,
        groupId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      }).success,
    ).toBe(true);
    expect(
      groupMobilePhoneConsentDecoder.safeDecode({
        ...groupMobilePhoneConsentGoldenResponse,
        state: 'approved',
      }).success,
    ).toBe(false);
    for (const value of [
      { ...groupMobilePhoneConsentGoldenResponse, groupId: 'group-1' },
      { ...groupMobilePhoneConsentGoldenResponse, maskedMobilePhone: '1'.repeat(33) },
    ]) {
      expect(groupMobilePhoneConsentDecoder.safeDecode(value).success).toBe(false);
      expect(groupMobilePhoneConsentSchema.safeParse(value).success).toBe(false);
    }
    expect(
      groupMobilePhoneConsentDecoder.safeDecode({
        ...groupMobilePhoneConsentGoldenResponse,
        fullMobilePhone: '13812347926',
      }).success,
    ).toBe(false);
    for (const consentedAt of [
      'not-a-date',
      '2026-02-30T01:02:03.000Z',
      '2026-08-24T01:02:03+08:00',
    ]) {
      const value = {
        ...groupMobilePhoneConsentGoldenResponse,
        consentedAt,
        state: 'consented',
      };
      expect(groupMobilePhoneConsentDecoder.safeDecode(value).success).toBe(false);
      expect(groupMobilePhoneConsentSchema.safeParse(value).success).toBe(false);
    }
  });
});
