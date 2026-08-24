import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const PLAN_URL = new URL('../testing/p7-workflow-rc-plan.json', import.meta.url);
const RUNBOOK_URL = new URL('../docs/runbooks/p7-workflow-rc.md', import.meta.url);
const ENV_URL = new URL('../../../.env.production.example', import.meta.url);
const DEPLOYMENT_URL = new URL('../../../docs/deployment/aliyun-ecs.md', import.meta.url);
const AUDIT_URL = new URL('../docs/architecture/p7-workflow-parity-audit.md', import.meta.url);
const APP_URL = new URL('../src/app.json', import.meta.url);

const finalVersion = '0.1.0-p7.20260824.86';
const partialVersions = [
  '0.1.0-p7.20260824.82-leave',
  '0.1.0-p7.20260824.83-swap',
  '0.1.0-p7.20260824.84-duty',
];

describe('P7 workflow RC and production release contract', () => {
  it('allows only the full P7 candidate and enables workflows in the production contract', async () => {
    const [environment, deployment, audit] = await Promise.all([
      readFile(ENV_URL, 'utf8'),
      readFile(DEPLOYMENT_URL, 'utf8'),
      readFile(AUDIT_URL, 'utf8'),
    ]);

    for (const source of [environment, deployment]) {
      expect(source).toContain(finalVersion);
      expect(source).toContain('MINIPROGRAM_CAPABILITY_WORKFLOWS_ENABLED=true');
      for (const partial of partialVersions) expect(source).not.toContain(partial);
    }
    expect(audit).toContain(`完整 P7 候选固定为\`${finalVersion}\``);
    expect(audit).toContain('部分切片候选永不加入 production allowlist');
  });

  it('registers exactly the three native workflow pages in the final subpackage', async () => {
    const app = JSON.parse(await readFile(APP_URL, 'utf8'));
    expect(app.subpackages).toContainEqual({
      pages: ['pages/leave/index', 'pages/swap/index', 'pages/duty/index'],
      root: 'subpackages/workflows',
    });
  });

  it('locks member/admin, full lifecycle, weak-network, refresh, calendar, and rollback evidence', async () => {
    const source = await readFile(PLAN_URL, 'utf8');
    const runbook = await readFile(RUNBOOK_URL, 'utf8');
    const plan = JSON.parse(source);

    expect(plan).toMatchObject({
      candidateVersion: finalVersion,
      channel: 'user-manual',
      requiredDevice: 'user-android-physical',
      schemaVersion: 1,
      stage: 'P7-workflows',
    });
    expect(plan.routes).toEqual({
      duty: 'subpackages/workflows/pages/duty/index',
      leave: 'subpackages/workflows/pages/leave/index',
      swap: 'subpackages/workflows/pages/swap/index',
    });
    expect(plan.roles).toEqual(['member', 'owner-or-administrator']);
    expect(plan.statuses).toEqual([
      'pending_target',
      'pending_approval',
      'completed',
      'rejected',
      'cancelled',
      'revoked',
    ]);
    expect(plan.cases.map((entry) => entry.id)).toEqual([
      'member-leave-lifecycle',
      'admin-leave-approval-conflict',
      'member-swap-lifecycle',
      'admin-swap-approval-direct-revoke',
      'member-duty-lifecycle',
      'admin-duty-approval-direct-revoke',
      'weak-network-idempotent-retry',
      'foreground-capability-refresh',
      'calendar-and-notification-effects',
      'capability-rollback',
    ]);
    expect(plan.requiredEvidence).toEqual([
      'buildLabel',
      'deviceModel',
      'androidVersion',
      'wechatVersion',
      'baseLibraryVersion',
      'systemFontScale',
      'role',
      'caseId',
      'result',
      'duplicateWriteObserved',
      'calendarMarkerObserved',
      'notificationObserved',
      'symptomOnFailure',
    ]);
    expect(plan.completion).toEqual({
      acceptedFeedback: ['P7工作流RC通过', 'P7 工作流 RC 通过'],
      screenshotsRequiredOnPass: false,
    });
    expect(source).not.toMatch(/MINITEST_|minium|privateKey|token|AppSecret/iu);
    for (const copy of [
      finalVersion,
      '成员账号',
      '群主或管理员账号',
      '结果尚未确认',
      '日历标记',
      '通知',
      '关闭 workflows',
      '重新开启 workflows',
      '不进入 P8',
    ]) {
      expect(runbook).toContain(copy);
    }
  });
});
