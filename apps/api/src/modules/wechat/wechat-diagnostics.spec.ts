import { describe, expect, it } from 'vitest';
import { safeWechatDiagnosticError } from './wechat-diagnostics-service.js';
import { WechatGatewayError } from './wechat-gateway.js';

describe('WeChat diagnostic errors', () => {
  it('exposes code/category only and never the raw external message', () => {
    expect(
      safeWechatDiagnosticError(
        new WechatGatewayError(47003, 'SECRET openid', 'VALIDATION_FAILED'),
      ),
    ).toEqual({ outcome: 'rejected', code: 47003, category: 'template-fields' });
    expect(
      safeWechatDiagnosticError(
        new WechatGatewayError(43101, 'SECRET', 'WECHAT_MESSAGE_SEND_FAILED'),
      ),
    ).toEqual({ outcome: 'rejected', code: 43101, category: 'subscription-unavailable' });
    expect(JSON.stringify(safeWechatDiagnosticError(new Error('SECRET')))).not.toContain('SECRET');
  });
  it('treats transport uncertainty as unknown so a replay never sends again', () => {
    expect(
      safeWechatDiagnosticError(new WechatGatewayError(null, null, 'SERVICE_UNAVAILABLE')),
    ).toEqual({ outcome: 'unknown', category: 'transport-unknown' });
  });
});
