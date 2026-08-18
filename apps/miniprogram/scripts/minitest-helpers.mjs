import { readFile } from 'node:fs/promises';

import { redactText } from './miniprogram-ci-helpers.mjs';

const MINI_TEST_API_ROOT = 'https://minitest.weixin.qq.com/thirdapi';
const MANIFEST_URL = new URL('../testing/p1-minitest-plan.json', import.meta.url);
const ALLOWED_ACTIONS = new Set(['status', 'submit']);
const STATUS_NAMES = new Map([
  [1, 'queued'],
  [2, 'running'],
  [11, 'no-cases'],
  [12, 'ended'],
  [15, 'timed-out'],
]);
const P1_ROUTES = [
  'pages/index/index',
  'pages/calendar-poc/index',
  'pages/manual-matrix-poc/index?mode=daily',
  'pages/manual-matrix-poc/index?mode=maximum',
];
const P1_THRESHOLDS = {
  maxKeyGeometryDeltaPx: 2,
  significantPixelRatio: 0.02,
  stableRegionSimilarity: 0.98,
};
const P1_SCREENSHOTS = [
  'p1-foundation-controls-v1',
  'p1-calendar-month-v1',
  'p1-manual-matrix-daily-v1',
  'p1-manual-matrix-maximum-v1',
];
const P1_STATES = [
  ['initial', 'notification-on', 'contact-unchecked', 'week-selected'],
  ['initial', 'selected-date', 'previous-month', 'next-month', 'rebound'],
  ['initial', 'horizontal-scroll', 'cell-selected', 'undo'],
  ['initial', 'scroll-end', 'stale-cell', 'cell-selected', 'undo'],
];
const P1_PERFORMANCE = {
  androidInteractiveMs: 2500,
  maximumMatrixRenderMs: 1000,
  tapFeedbackMs: 100,
};

function requiredText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

export function parseMiniTestArguments(argv) {
  const [action, ...options] = argv;
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error('Expected action "submit" or "status".');
  }
  const dryRun = options.includes('--dry-run');
  const planOption = options.find((option) => option.startsWith('--plan-id='));
  const unknown = options.filter(
    (option) => option !== '--dry-run' && !option.startsWith('--plan-id='),
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown option: ${unknown[0]}`);
  }
  const planId = planOption?.slice('--plan-id='.length) || undefined;
  if (action === 'status' && dryRun) {
    throw new Error('--dry-run is only valid for submit.');
  }
  if (action === 'status' && !dryRun && !planId) {
    throw new Error('--plan-id is required for status.');
  }
  if (action === 'submit' && planId) {
    throw new Error('--plan-id is only valid for status.');
  }
  return { action, dryRun, planId };
}

export function resolveMiniTestCredentials(environment = process.env) {
  const token = requiredText(environment.MINITEST_USER_TOKEN, 'MINITEST_USER_TOKEN');
  const groupEnId = requiredText(environment.MINITEST_GROUP_EN_ID, 'MINITEST_GROUP_EN_ID');
  const testPlanSource = requiredText(environment.MINITEST_TEST_PLAN_ID, 'MINITEST_TEST_PLAN_ID');
  const testPlanId = Number.parseInt(testPlanSource, 10);
  if (!Number.isInteger(testPlanId) || testPlanId <= 0 || String(testPlanId) !== testPlanSource) {
    throw new Error('MINITEST_TEST_PLAN_ID must be a positive integer.');
  }
  const devAccountSource = environment.MINITEST_DEV_ACCOUNT_NO?.trim() || '1';
  const devAccountNo = Number.parseInt(devAccountSource, 10);
  if (
    !Number.isInteger(devAccountNo) ||
    devAccountNo < 1 ||
    devAccountNo > 10 ||
    String(devAccountNo) !== devAccountSource
  ) {
    throw new Error('MINITEST_DEV_ACCOUNT_NO must be an integer from 1 to 10.');
  }
  if (
    environment.WECHAT_CI_ROBOT?.trim() &&
    environment.WECHAT_CI_ROBOT.trim() !== String(devAccountNo)
  ) {
    throw new Error(
      'WECHAT_CI_ROBOT and MINITEST_DEV_ACCOUNT_NO must identify the same robot account.',
    );
  }
  return { devAccountNo, groupEnId, testPlanId, token };
}

function validateManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.cases)) {
    throw new Error('P1 MiniTest manifest schema is invalid.');
  }
  if (manifest.cases.length !== 4) {
    throw new Error('P1 MiniTest manifest must define exactly four native evidence cases.');
  }
  const screenshots = manifest.cases.map((entry) =>
    requiredText(entry.screenshotName, 'screenshotName'),
  );
  if (new Set(screenshots).size !== screenshots.length) {
    throw new Error('P1 MiniTest screenshot names must be unique.');
  }
  if (JSON.stringify(screenshots) !== JSON.stringify(P1_SCREENSHOTS)) {
    throw new Error('P1 MiniTest screenshot names do not match the approved native evidence set.');
  }
  if (JSON.stringify(manifest.platforms) !== JSON.stringify(['android', 'ios'])) {
    throw new Error('P1 MiniTest platforms must remain android and ios.');
  }
  if (manifest.entryRoute !== P1_ROUTES[0]) {
    throw new Error('P1 MiniTest entry route is invalid.');
  }
  if (JSON.stringify(manifest.cases.map((entry) => entry.route)) !== JSON.stringify(P1_ROUTES)) {
    throw new Error('P1 MiniTest routes do not match the approved native evidence pages.');
  }
  if (JSON.stringify(manifest.cases.map((entry) => entry.states)) !== JSON.stringify(P1_STATES)) {
    throw new Error('P1 MiniTest states do not match the implemented native evidence flows.');
  }
  if (
    !Object.entries(P1_THRESHOLDS).every(
      ([name, value]) => manifest.thresholds?.[name] === value,
    ) ||
    Object.keys(manifest.thresholds ?? {}).length !== Object.keys(P1_THRESHOLDS).length
  ) {
    throw new Error('P1 MiniTest visual thresholds do not match the approved parity standard.');
  }
  if (
    !Object.entries(P1_PERFORMANCE).every(
      ([name, value]) => manifest.performance?.[name] === value,
    ) ||
    Object.keys(manifest.performance ?? {}).length !== Object.keys(P1_PERFORMANCE).length
  ) {
    throw new Error('P1 MiniTest performance gates do not match the approved P1 standard.');
  }
  return manifest;
}

export async function loadP1MiniTestManifest() {
  return validateManifest(JSON.parse(await readFile(MANIFEST_URL, 'utf8')));
}

export function buildMiniTestPlanPayload(manifest, credentials) {
  validateManifest(manifest);
  return {
    desc: manifest.description,
    dev_account_no: credentials.devAccountNo,
    group_en_id: credentials.groupEnId,
    minium_config: {
      assert_capture: true,
      audits: true,
      auto_authorize: false,
      auto_relaunch: true,
      compile_mode: manifest.entryRoute,
    },
    platforms: manifest.platforms.join(','),
    test_plan_id: credentials.testPlanId,
    test_type: 2,
    token: credentials.token,
    wx_id: '',
    wx_version: 3,
  };
}

function secretValues(credentials) {
  return [credentials.token, credentials.groupEnId, String(credentials.testPlanId)];
}

async function callMiniTestApi(url, options, credentials, fetchImplementation) {
  try {
    return await fetchImplementation(url, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redactText(message, secretValues(credentials)));
  }
}

async function readApiResponse(response, credentials) {
  const rawBody = await response.text();
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new Error(
      `MiniTest returned non-JSON status ${response.status}: ${redactText(rawBody, secretValues(credentials))}`,
    );
  }
  const resultCode = body.rtn ?? body.errcode;
  if (!response.ok || resultCode !== 0) {
    const message = redactText(body.msg || body.errmsg || rawBody, secretValues(credentials));
    throw new Error(`MiniTest request failed (${resultCode ?? response.status}): ${message}`);
  }
  return body.data ?? body;
}

export async function submitMiniTestPlan({ credentials, fetchImplementation = fetch, manifest }) {
  const response = await callMiniTestApi(
    `${MINI_TEST_API_ROOT}/plan`,
    {
      body: JSON.stringify(buildMiniTestPlanPayload(manifest, credentials)),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    },
    credentials,
    fetchImplementation,
  );
  const data = await readApiResponse(response, credentials);
  const planId = String(data.plan_id ?? data.planId ?? '');
  if (!planId) {
    throw new Error('MiniTest submit response did not include a plan id.');
  }
  return { planId };
}

export async function getMiniTestPlanStatus({ credentials, fetchImplementation = fetch, planId }) {
  const query = new URLSearchParams({
    group_en_id: credentials.groupEnId,
    plan_id: requiredText(planId, 'planId'),
    token: credentials.token,
  });
  const response = await callMiniTestApi(
    `${MINI_TEST_API_ROOT}/plan?${query}`,
    undefined,
    credentials,
    fetchImplementation,
  );
  const data = await readApiResponse(response, credentials);
  const statusCode = Number(data.status);
  return {
    planId: String(planId),
    status: STATUS_NAMES.get(statusCode) ?? `unknown-${statusCode}`,
    statusCode,
  };
}

export async function runMiniTestCommand(
  { action, dryRun, planId },
  environment = process.env,
  fetchImplementation = fetch,
) {
  const manifest = await loadP1MiniTestManifest();
  if (dryRun) {
    return {
      action,
      caseCount: manifest.cases.length,
      externalStateChanged: false,
      platforms: manifest.platforms,
      screenshotNames: manifest.cases.map((entry) => entry.screenshotName),
    };
  }

  const credentials = resolveMiniTestCredentials(environment);
  if (action === 'submit') {
    const result = await submitMiniTestPlan({ credentials, fetchImplementation, manifest });
    return { action, externalStateChanged: true, ...result };
  }
  const result = await getMiniTestPlanStatus({ credentials, fetchImplementation, planId });
  return { action, externalStateChanged: false, ...result };
}
