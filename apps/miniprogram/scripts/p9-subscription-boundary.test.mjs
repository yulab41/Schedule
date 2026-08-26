import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P9 external message subscription boundary', () => {
  it('bridges shared notification preferences through the externalMessages capability', () => {
    const runtime = read('src/platform/client-core-calendar.ts');
    const client = read('../../packages/client-core/src/notification-preferences-client.ts');

    expect(runtime).toContain('createRuntimeNotificationPreferencesClient');
    expect(runtime).toContain("'externalMessages'");
    expect(client).toContain('/notification-preferences/mine');
    expect(client).toContain("auth: 'bearer'");
  });

  it('requires explicit capability-gated subscribe consent and keeps decisions in memory', () => {
    const adapter = read('src/platform/wechat-subscription.ts');

    expect(adapter).toContain("requireClientCapability('externalMessages')");
    expect(adapter).toContain('requestSubscribeMessage');
    expect(adapter).toContain('tmplIds');
    expect(adapter).not.toContain('wx.setStorageSync');
    expect(adapter).not.toContain('wx.setStorage');
    expect(adapter).not.toContain('Authorization');
  });

  it('normalizes accept/reject/ban/filter and rejects an invalid template set', () => {
    const adapter = read('src/platform/wechat-subscription.ts');

    expect(adapter).toContain("case 'accept':");
    expect(adapter).toContain("case 'reject':");
    expect(adapter).toContain("case 'ban':");
    expect(adapter).toContain("case 'filter':");
    expect(adapter).toContain('normalized.length > 3');
  });

  it('uses the approved duty reminder template for explicit subscription consent', () => {
    const controller = read(
      'src/subpackages/insights/components/notifications-panel/controller.ts',
    );

    expect(controller).toContain(
      "const SUBSCRIPTION_TEMPLATE_IDS: readonly string[] = [\n  'Nmgf9k3bTIUaohtQFIMl8j_xbZAN2VDm1qnpQIL5WKI',\n];",
    );
    expect(controller).toContain('templateConfigured: SUBSCRIPTION_TEMPLATE_IDS.length > 0');
  });
});
