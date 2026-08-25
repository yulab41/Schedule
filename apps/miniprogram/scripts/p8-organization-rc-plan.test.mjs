import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const PLAN_URL = new URL('../testing/p8-organization-rc-plan.json', import.meta.url);
const RUNBOOK_URL = new URL('../docs/runbooks/p8-organization-rc.md', import.meta.url);
const ENV_URL = new URL('../../../.env.production.example', import.meta.url);
const DEPLOYMENT_URL = new URL('../../../docs/deployment/aliyun-ecs.md', import.meta.url);
const AUDIT_URL = new URL('../docs/architecture/p8-organization-parity-audit.md', import.meta.url);
const APP_URL = new URL('../src/app.json', import.meta.url);
const CAPABILITY_SWITCH_URL = new URL(
  '../../../infra/scripts/client-capability-switch.sh',
  import.meta.url,
);

const candidateVersion = '0.1.0-p8.20260825.3';

describe('P8 organization RC and production release contract', () => {
  it('keeps the full P8 candidate allowlisted while organization remains fail-closed', async () => {
    const [environment, deployment] = await Promise.all([
      readFile(ENV_URL, 'utf8'),
      readFile(DEPLOYMENT_URL, 'utf8'),
    ]);

    for (const source of [environment, deployment]) {
      expect(source).toContain(candidateVersion);
      expect(source).toContain('MINIPROGRAM_CAPABILITY_ORGANIZATION_ENABLED=false');
      expect(source).not.toContain('0.1.0-p8.20260825.1-leave');
      expect(source).not.toContain('0.1.0-p8.20260825.2-invite');
    }
  });

  it('registers the four native organization pages in one subpackage', async () => {
    const app = JSON.parse(await readFile(APP_URL, 'utf8'));
    expect(app.subpackages).toContainEqual({
      root: 'subpackages/organization',
      pages: [
        'pages/group-settings/index',
        'pages/scheduling-config/index',
        'pages/invite-visitor/index',
        'pages/platform-accounts/index',
      ],
    });
  });

  it('locks roles, boundaries, failure-closed behavior, and manual evidence', async () => {
    const [planSource, runbook, audit, capabilitySwitch] = await Promise.all([
      readFile(PLAN_URL, 'utf8'),
      readFile(RUNBOOK_URL, 'utf8'),
      readFile(AUDIT_URL, 'utf8'),
      readFile(CAPABILITY_SWITCH_URL, 'utf8'),
    ]);
    const plan = JSON.parse(planSource);

    expect(plan).toMatchObject({
      candidateVersion,
      channel: 'user-manual',
      requiredDevice: 'user-android-physical',
      schemaVersion: 1,
      stage: 'P8-organization',
    });
    expect(plan.roles).toEqual(['owner', 'administrator', 'member', 'platform-admin']);
    expect(plan.cases.map((entry) => entry.id)).toEqual([
      'owner-group-member-lifecycle',
      'administrator-roster-claims-contacts',
      'member-readonly-boundary',
      'owner-admin-scheduling-configuration',
      'owner-admin-invite-and-visitor',
      'guest-qr-dual-capability',
      'platform-admin-account-lifecycle',
      'weak-network-idempotent-retry',
      'foreground-capability-refresh',
      'capability-rollback',
    ]);
    expect(plan.requiredEvidence).toContain('duplicateWriteObserved');
    expect(plan.requiredEvidence).toContain('secretPersistenceObserved');
    expect(plan.completion.acceptedFeedback).toEqual([
      'P8组织管理RC通过',
      'P8 组织管理 RC 通过',
    ]);
    expect(planSource).not.toMatch(/MINITEST_|minium|privateKey|token|AppSecret/iu);

    for (const copy of [
      candidateVersion,
      '群主账号',
      '管理员账号',
      '普通成员账号',
      '平台管理员账号',
      '结果尚未确认',
      'operationId',
      'expectedVersion',
      'organization=false',
      '二维码内容只存在当前页面内存',
      '关闭 `organization`',
      '不能进入 P9',
    ]) {
      expect(runbook).toContain(copy);
    }
    expect(audit).toContain('P8-C–F 原生页面已完成');
    expect(audit).toContain('P8 RC 自动契约');
    expect(capabilitySwitch).toContain('Usage: schedule-client-capability <capability> <true|false>');
    expect(capabilitySwitch).toContain('validate_policy_configuration');
    expect(capabilitySwitch).toContain('probe_effective_capabilities');
    expect(capabilitySwitch).toContain('restore_previous_environment');
    expect(capabilitySwitch).toContain('trap rollback_on_error ERR');
    expect(capabilitySwitch).toContain('trap rollback_on_signal HUP INT TERM');
    expect(capabilitySwitch).toContain('compose up -d --force-recreate api');
    expect(capabilitySwitch).not.toMatch(/MINIPROGRAM_CAPABILITY_ORGANIZATION_ENABLED=true/iu);
  });
});
