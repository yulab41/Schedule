import { describe, expect, it, vi } from 'vitest';

import { createQrVisitorWriteClient, qrVisitorWriteEndpoints } from './qr-visitor-write-client.js';

describe('qr visitor write client', () => {
  it('encodes member QR paths and carries idempotency keys', () => {
    const request = {
      environment: 'trial' as const,
      expectedMembershipVersion: 2,
      operationId: '00000000-0000-4000-8000-000000000001',
    };
    expect(
      qrVisitorWriteEndpoints.createCurrentMemberWechatBindingQr.path({
        groupId: 'group /一',
        membershipId: 'member /一',
        request,
      }),
    ).toBe('/groups/group%20%2F%E4%B8%80/members/member%20%2F%E4%B8%80/current-wechat-binding-qr');
    expect(
      qrVisitorWriteEndpoints.createCurrentMemberWechatBindingQr.idempotencyKey?.({
        groupId: 'group',
        membershipId: 'member',
        request,
      }),
    ).toBe(request.operationId);
  });

  it('delegates the two retained mutations', async () => {
    const request = vi.fn().mockResolvedValue({ visitorKeyChanged: true });
    const client = createQrVisitorWriteClient({ request });
    await client.regenerateVisitorKey('group', {
      expectedVersion: 1,
      operationId: '00000000-0000-4000-8000-000000000002',
    });
    expect(request).toHaveBeenCalledOnce();
    expect(Object.keys(qrVisitorWriteEndpoints)).toEqual([
      'createCurrentMemberWechatBindingQr',
      'regenerateVisitorKey',
    ]);
  });
});
