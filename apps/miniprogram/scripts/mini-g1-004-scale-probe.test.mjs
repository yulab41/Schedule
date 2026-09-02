import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const groupId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const scales = [1, 25, 100];
const appRoot = process.cwd();

describe('MINI-G1-004 scale evidence (synthetic, diagnostic-only)', () => {
  it('measures full-load list growth without changing production behavior', async () => {
    const platform = [];
    const group = [];

    for (const count of scales) {
      platform.push(await measurePlatformPage(count));
      group.push(await measureGroupSettingsPage(count));
    }

    const nodeCoefficients = {
      groupMemberRow: countRenderedElementsPerRecord(
        readSource('src/subpackages/organization/components/group-settings-panel/index.wxml'),
        'memberCards',
        (tag) =>
          !tag.includes('member.isPendingRoster && member.canManage') &&
          !tag.includes('member.isUnclaimed && !member.isCurrentUser') &&
          !tag.includes("member.roleLabel === '管理员'") &&
          !tag.includes('!member.hasMobilePhone && !member.hasShortPhone'),
      ),
      platformAccountRow: countRenderedElementsPerRecord(
        readSource('src/subpackages/organization/components/platform-accounts-panel/index.wxml'),
        'accounts',
      ),
    };

    const report = { group, nodeCoefficients, platform };
    console.log(`[MINI-G1-004-SCALE] ${JSON.stringify(report)}`);

    expect(platform.map((result) => result.responseRecordCount)).toEqual(scales);
    expect(platform.map((result) => result.viewModelRecordCount)).toEqual(scales);
    expect(group.map((result) => result.responseRecordCount)).toEqual(scales);
    expect(group.map((result) => result.viewModelRecordCount)).toEqual(scales);
    expect(platform.every((result) => result.listRequestCount === 1)).toBe(true);
    expect(group.every((result) => result.memberRequestCount === 1)).toBe(true);
    expect(group.every((result) => result.contactRequestCount === 1)).toBe(true);
    expect(platform.every((result) => result.setDataCalls === platform[0].setDataCalls)).toBe(true);
    expect(group.every((result) => result.setDataCalls === group[0].setDataCalls)).toBe(true);
    expect(nodeCoefficients).toEqual({ groupMemberRow: 12, platformAccountRow: 8 });
    expect(platform[2].readySetDataBytes).toBeGreaterThan(platform[0].readySetDataBytes);
    expect(group[2].readySetDataBytes).toBeGreaterThan(group[0].readySetDataBytes);
    expect(platform[2].responsePayloadBytes).toBeGreaterThan(platform[0].responsePayloadBytes);
    expect(group[2].responsePayloadBytes).toBeGreaterThan(group[0].responsePayloadBytes);
  });
});

async function measurePlatformPage(count) {
  const accounts = Array.from({ length: count }, (_, index) => createAccount(index));
  const requests = [];
  const patches = [];
  installRuntimeGlobals({
    requests,
    requestHandler(options) {
      if (options.url.endsWith('/platform-admin/users') && options.method === 'GET') {
        options.success({ data: { users: accounts }, statusCode: 200 });
        return;
      }
      throw new Error(`unexpected platform request ${options.method} ${options.url}`);
    },
  });

  vi.resetModules();
  await import('../src/subpackages/organization/pages/platform-accounts/index.ts');
  const definition = globalThis.Page.mock.calls[0][0];
  await enableTestClientCapabilities();

  const page = createPageInstance(definition, patches);
  const start = performance.now();
  definition.onLoad.call(page, {});
  await vi.waitFor(() => expect(page.data.state).toBe('ready'));
  const elapsedMs = performance.now() - start;
  const readyPatch = patches.find((entry) => Object.hasOwn(entry.patch, 'accounts'));

  vi.unstubAllGlobals();
  return {
    count,
    elapsedMs: round(elapsedMs),
    listRequestCount: requests.filter(
      (request) => request.method === 'GET' && request.url.endsWith('/platform-admin/users'),
    ).length,
    logicalTransformPasses: { accountCardMap: count, countFilters: count * 2 },
    responsePayloadBytes: byteLength({ users: accounts }),
    responseRecordCount: accounts.length,
    readySetDataBytes: readyPatch?.bytes ?? 0,
    setDataCalls: patches.length,
    setDataPayloadBytes: patches.reduce((total, entry) => total + entry.bytes, 0),
    templateNodes: nodeCount('platformAccountRow', count),
    viewModelRecordCount: page.data.accounts.length,
  };
}

async function measureGroupSettingsPage(count) {
  const members = Array.from({ length: count }, (_, index) => createMember(index));
  const contacts = members.map((member) => createContact(member.id));
  const requests = [];
  const patches = [];
  installRuntimeGlobals({
    requests,
    requestHandler(options) {
      const url = options.url;
      if (url.endsWith('/groups') && options.method === 'GET') {
        options.success({ data: [createGroup()], statusCode: 200 });
        return;
      }
      if (url.endsWith(`/groups/${groupId}/mobile-phone-consent`) && options.method === 'GET') {
        options.success({ data: createConsent(), statusCode: 200 });
        return;
      }
      if (url.endsWith(`/groups/${groupId}/members`) && options.method === 'GET') {
        options.success({ data: members, statusCode: 200 });
        return;
      }
      if (url.endsWith(`/groups/${groupId}/contacts`) && options.method === 'GET') {
        options.success({ data: contacts, statusCode: 200 });
        return;
      }
      if (url.endsWith(`/groups/${groupId}/claim-requests`) && options.method === 'GET') {
        options.success({ data: [], statusCode: 200 });
        return;
      }
      if (url.endsWith('/groups/catalog') && options.method === 'GET') {
        options.success({ data: [], statusCode: 200 });
        return;
      }
      if (url.endsWith('/groups/dissolved') && options.method === 'GET') {
        options.success({ data: [], statusCode: 200 });
        return;
      }
      if (url.endsWith(`/groups/${groupId}/calendar-preferences`) && options.method === 'GET') {
        options.success({ data: createCalendarPreferences(), statusCode: 200 });
        return;
      }
      if (url.endsWith(`/groups/${groupId}/scheduling-config`) && options.method === 'GET') {
        options.success({ data: createSchedulingConfig(), statusCode: 200 });
        return;
      }
      throw new Error(`unexpected group request ${options.method} ${url}`);
    },
  });

  vi.resetModules();
  await import('../src/subpackages/organization/pages/group-settings/index.ts');
  const definition = globalThis.Page.mock.calls[0][0];
  await enableTestClientCapabilities();

  const page = createPageInstance(definition, patches);
  const start = performance.now();
  definition.onLoad.call(page, { groupId });
  await vi.waitFor(() => expect(page.data.calendarPreferencesState).toBe('ready'));
  const elapsedMs = performance.now() - start;
  const readyPatch = patches.find(
    (entry) => entry.patch.managementState === 'ready' && entry.patch.memberCards?.length === count,
  );

  vi.unstubAllGlobals();
  return {
    count,
    contactResponsePayloadBytes: byteLength(contacts),
    elapsedMs: round(elapsedMs),
    logicalTransformPasses: {
      contactIndexMap: count,
      memberCardMap: count,
      claimCardMap: 0,
    },
    memberRequestCount: requests.filter(
      (request) => request.method === 'GET' && request.url.endsWith(`/groups/${groupId}/members`),
    ).length,
    responsePayloadBytes: byteLength(members),
    responseRecordCount: members.length,
    readySetDataBytes: readyPatch?.bytes ?? 0,
    setDataCalls: patches.length,
    setDataPayloadBytes: patches.reduce((total, entry) => total + entry.bytes, 0),
    templateNodes: nodeCount('groupMemberRow', count),
    viewModelRecordCount: page.data.memberCards.length,
    contactRequestCount: requests.filter(
      (request) => request.method === 'GET' && request.url.endsWith(`/groups/${groupId}/contacts`),
    ).length,
  };
}

function installRuntimeGlobals({ requestHandler, requests }) {
  vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
  vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
  vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
  vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
  vi.stubGlobal('Page', vi.fn());
  vi.stubGlobal('wx', {
    getStorageSync: vi.fn((key) => (key === 'schedule.wechat.session' ? session() : undefined)),
    getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
    navigateBack: vi.fn(),
    request: vi.fn((options) => {
      requests.push({ method: options.method, url: options.url });
      requestHandler(options);
    }),
  });
}

function createPageInstance(definition, patches) {
  const page = {
    data: structuredClone(definition.data),
    setData(patch, callback) {
      patches.push({ bytes: byteLength(patch), patch });
      this.data = { ...this.data, ...patch };
      callback?.();
    },
  };
  for (const [key, value] of Object.entries(definition)) {
    if (key.startsWith('_')) page[key] = value;
  }
  return page;
}

function createAccount(index) {
  return {
    authVersion: index + 1,
    hasPassword: index % 2 === 0,
    id: `account-${String(index + 1).padStart(3, '0')}`,
    status: index % 3 === 0 ? 'suspended' : 'active',
    username: `user-${String(index + 1).padStart(3, '0')}`,
  };
}

function createGroup() {
  return {
    groupCode: '0000',
    id: groupId,
    isDeveloperAdmin: true,
    name: 'fixture-group',
    role: 'owner',
    version: 1,
  };
}

function createMember(index) {
  return {
    id: `membership-${String(index + 1).padStart(3, '0')}`,
    isClaimedByCurrentUser: false,
    isCurrentUser: false,
    isUnclaimed: false,
    realName: `member-${String(index + 1).padStart(3, '0')}`,
    role: 'member',
    version: 1,
  };
}

function createContact(memberId) {
  return {
    isConfirmed: false,
    membershipId: memberId,
    mobilePhone: 'mobile-placeholder',
    shortPhone: 'short-placeholder',
    version: 1,
  };
}

function createConsent() {
  return {
    contactVersion: 0,
    groupId,
    membershipId,
    noticeVersion: 'v1',
    state: 'missing-phone',
  };
}

function createCalendarPreferences() {
  return {
    canManageGroupDefaults: true,
    effectiveMonthShiftTypeId: null,
    effectiveView: 'month',
    groupDefaultMonthShiftTypeId: null,
    groupDefaultView: 'month',
    groupId,
    memberDefaultMonthShiftTypeId: null,
    memberDefaultView: null,
    membershipId,
  };
}

function createSchedulingConfig() {
  return { groupMembers: [], roles: [], rulesVersion: 1, shiftTypes: [] };
}

function readSource(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

function countRenderedElementsPerRecord(template, expression, includeTag = () => true) {
  const startMatch = template.match(
    new RegExp(`<view(?=[^>]*wx:for="\\{\\{${expression}\\}\\}")`, 'su'),
  );
  const start = startMatch?.index ?? -1;
  if (start < 0) throw new Error(`missing repeated template for ${expression}`);
  const block = extractElementBlock(template, start);
  return [...block.matchAll(/<([A-Za-z][\w-]*)(?=[\s/>])[^>]*>/gu)].filter((match) =>
    includeTag(match[0]),
  ).length;
}

function extractElementBlock(template, start) {
  const tokenPattern = /<\/?([A-Za-z][\w-]*)(?:\s[^>]*?)?\/?\s*>/gu;
  tokenPattern.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tokenPattern.exec(template)) !== null) {
    const token = match[0];
    if (token.startsWith('</')) {
      depth -= 1;
      if (depth === 0) return template.slice(start, tokenPattern.lastIndex);
    } else if (!token.endsWith('/>')) {
      depth += 1;
    }
  }
  throw new Error('unterminated repeated template');
}

function nodeCount(kind, count) {
  const nodesPerRecord = kind === 'platformAccountRow' ? 8 : 12;
  return nodesPerRecord * count;
}

function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function round(value) {
  return Number(value.toFixed(3));
}

function session() {
  return {
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    profile: { id: 'fixture-admin', realName: 'fixture-admin', version: 1 },
    token: 'session-token',
  };
}
