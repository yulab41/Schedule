import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import {
  buildMiniTestPlanPayload,
  getMiniTestPlanStatus,
  loadP1MiniTestManifest,
  parseMiniTestArguments,
  resolveMiniTestCredentials,
  submitMiniTestPlan,
} from './minitest-helpers.mjs';

describe('MiniTest helpers', () => {
  it('accepts explicit submit/status actions and keeps dry-run side-effect free', () => {
    expect(parseMiniTestArguments(['submit', '--dry-run'])).toEqual({
      action: 'submit',
      dryRun: true,
      planId: undefined,
    });
    expect(parseMiniTestArguments(['status', '--plan-id=42'])).toEqual({
      action: 'status',
      dryRun: false,
      planId: '42',
    });
    expect(() => parseMiniTestArguments(['status', '--dry-run'])).toThrow(/dry-run.*submit/i);
    expect(() => parseMiniTestArguments(['delete'])).toThrow(/submit.*status/);
  });

  it('locks the P1 native evidence routes and unique screenshot names', async () => {
    const manifest = await loadP1MiniTestManifest();
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.platforms).toEqual(['android', 'ios']);
    expect(manifest.cases.map((entry) => entry.route)).toEqual([
      'pages/index/index',
      'pages/calendar-poc/index',
      'pages/manual-matrix-poc/index?mode=daily',
      'pages/manual-matrix-poc/index?mode=maximum',
    ]);
    expect(new Set(manifest.cases.map((entry) => entry.screenshotName)).size).toBe(4);
    expect(manifest.thresholds).toEqual({
      maxKeyGeometryDeltaPx: 2,
      significantPixelRatio: 0.02,
      stableRegionSimilarity: 0.98,
    });

    const source = await readFile(
      new URL('../testing/p1-minitest-plan.json', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/appid|openid|token/i);
  });

  it('requires external credentials and restricts preview robot accounts to 1 through 10', () => {
    const environment = {
      MINITEST_DEV_ACCOUNT_NO: '10',
      MINITEST_GROUP_EN_ID: 'schedule-staging',
      MINITEST_TEST_PLAN_ID: '197',
      MINITEST_USER_TOKEN: 'secret-token',
    };
    expect(resolveMiniTestCredentials(environment)).toEqual({
      devAccountNo: 10,
      groupEnId: 'schedule-staging',
      testPlanId: 197,
      token: 'secret-token',
    });
    expect(() =>
      resolveMiniTestCredentials({ ...environment, MINITEST_DEV_ACCOUNT_NO: '11' }),
    ).toThrow(/1 to 10/);
    expect(() => resolveMiniTestCredentials({ ...environment, WECHAT_CI_ROBOT: '2' })).toThrow(
      /same robot/i,
    );
    expect(() =>
      resolveMiniTestCredentials({ ...environment, MINITEST_TEST_PLAN_ID: 'native-p1' }),
    ).toThrow(/positive integer/i);
    expect(() => resolveMiniTestCredentials({})).toThrow(/MINITEST_USER_TOKEN/);
  });

  it('builds the official development-preview plan payload without repository secrets', async () => {
    const manifest = await loadP1MiniTestManifest();
    const payload = buildMiniTestPlanPayload(manifest, {
      devAccountNo: 3,
      groupEnId: 'schedule-staging',
      testPlanId: 197,
      token: 'secret-token',
    });

    expect(payload).toEqual({
      desc: 'Schedule P1 native visual and performance gate',
      dev_account_no: 3,
      group_en_id: 'schedule-staging',
      minium_config: {
        assert_capture: true,
        audits: true,
        auto_authorize: false,
        auto_relaunch: true,
        compile_mode: 'pages/index/index',
      },
      platforms: 'android,ios',
      test_plan_id: 197,
      test_type: 2,
      token: 'secret-token',
      wx_id: '',
      wx_version: 3,
    });
  });

  it('fails closed when approved screenshot names or performance gates drift', async () => {
    const manifest = await loadP1MiniTestManifest();
    const credentials = {
      devAccountNo: 3,
      groupEnId: 'schedule-staging',
      testPlanId: 197,
      token: 'secret-token',
    };
    const renamedScreenshot = structuredClone(manifest);
    renamedScreenshot.cases[0].screenshotName = 'renamed-at-runtime';
    expect(() => buildMiniTestPlanPayload(renamedScreenshot, credentials)).toThrow(
      /screenshot names/i,
    );

    const relaxedPerformance = structuredClone(manifest);
    relaxedPerformance.performance.tapFeedbackMs = 500;
    expect(() => buildMiniTestPlanPayload(relaxedPerformance, credentials)).toThrow(
      /performance gates/i,
    );
  });

  it('submits and reads a plan through only the documented non-destructive endpoints', async () => {
    const credentials = {
      devAccountNo: 1,
      groupEnId: 'schedule-staging',
      testPlanId: 197,
      token: 'secret-token',
    };
    const manifest = await loadP1MiniTestManifest();
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { plan_id: '1001' }, msg: 'ok', rtn: 0 }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { status: 12 }, msg: 'ok', rtn: 0 }), {
          status: 200,
        }),
      );

    await expect(
      submitMiniTestPlan({ credentials, fetchImplementation, manifest }),
    ).resolves.toEqual({ planId: '1001' });
    await expect(
      getMiniTestPlanStatus({ credentials, fetchImplementation, planId: '1001' }),
    ).resolves.toEqual({ planId: '1001', status: 'ended', statusCode: 12 });

    expect(fetchImplementation.mock.calls[0][0]).toBe(
      'https://minitest.weixin.qq.com/thirdapi/plan',
    );
    expect(fetchImplementation.mock.calls[0][1].method).toBe('POST');
    expect(fetchImplementation.mock.calls[1][0]).toMatch(
      /^https:\/\/minitest\.weixin\.qq\.com\/thirdapi\/plan\?/,
    );
    expect(fetchImplementation.mock.calls.flat().join(' ')).not.toMatch(/del_plan_image/);
  });

  it('redacts MiniTest credentials from platform errors', async () => {
    const credentials = {
      devAccountNo: 1,
      groupEnId: 'schedule-staging',
      testPlanId: 197,
      token: 'secret-token',
    };
    const fetchImplementation = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ msg: 'bad secret-token schedule-staging 197', rtn: -1 }), {
        status: 200,
      }),
    );

    await expect(
      submitMiniTestPlan({
        credentials,
        fetchImplementation,
        manifest: await loadP1MiniTestManifest(),
      }),
    ).rejects.toThrow('bad [REDACTED] [REDACTED] [REDACTED]');
  });

  it('redacts credentials when the HTTPS transport itself fails', async () => {
    const credentials = {
      devAccountNo: 1,
      groupEnId: 'schedule-staging',
      testPlanId: 197,
      token: 'secret-token',
    };

    await expect(
      getMiniTestPlanStatus({
        credentials,
        fetchImplementation: vi
          .fn()
          .mockRejectedValue(new Error('network secret-token schedule-staging 197')),
        planId: '1001',
      }),
    ).rejects.toThrow('network [REDACTED] [REDACTED] [REDACTED]');
  });
});
