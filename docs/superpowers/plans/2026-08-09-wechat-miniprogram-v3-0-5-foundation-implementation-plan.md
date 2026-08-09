# WeChat Mini Program V3-0.5 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inherited V2 project configuration with an auditable V3 baseline, remove the obsolete login route from the API client, and make manifest route discovery cover both the main package and subpackages.

**Architecture:** Keep V3-0.5 page-free: this phase changes only tracked configuration, pure audit utilities, API-client authentication-expiry injection, and smoke-manifest parsing. The future app shell will register the authentication-expiry handler and create `app.json`; this phase must not create either. Pure Node and TypeScript tests lock down every behavior before later UI work depends on it.

**Tech Stack:** Node.js 24, pnpm 11, TypeScript 5.9, Vitest 3, WeChat Mini Program API typings, WeChat DevTools project configuration.

---

## Scope And Authority

Read these files completely before changing anything:

- `AGENTS.md`
- `docs/project-status.md`
- `docs/superpowers/specs/2026-08-09-wechat-miniprogram-v3-design.md`, sections 1, 2, 5, 11, 12.3, 13, and 15
- `docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-delivery-roadmap.md`, sections 0, 1, 3, 4, 5, and 12
- `apps/miniprogram/project.config.json`
- `apps/miniprogram/api/client.ts`
- `apps/miniprogram/store/session.ts`
- `scripts/miniprogram-smoke.mjs`
- `scripts/miniprogram-devtools-lib.mjs`

This plan contains exactly two implementation tasks, matching the active V3-0.5 batch in `docs/project-status.md`. Stop after Task 2. Do not create V3 pages, `app.json`, `app.ts`, a tab bar, a login page, Skyline page configuration, or TDesign component declarations.

The tracked base-library version is `3.16.2`, copied from the current ignored `apps/miniprogram/project.private.config.json`. This only pins a reproducible baseline. Actual page compilation, Skyline, `glass-easel`, Worklet runtime, and fallback validation remain V3-1 work because V3-0.5 intentionally has no manifest or pages.

## File Responsibility Map

| Path                                        | Action                | Single responsibility                                                                          |
| ------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| `apps/miniprogram/project.config.json`      | Modify                | Store only reproducible team-level WeChat project identity and compiler settings.              |
| `scripts/miniprogram-config-audit.mjs`      | Create                | Validate the tracked project configuration without reading or changing private configuration.  |
| `scripts/miniprogram-config-audit.test.mjs` | Create                | Lock down accepted and rejected project-configuration shapes.                                  |
| `package.json`                              | Modify                | Expose the configuration audit as `pnpm miniprogram:config:audit`.                             |
| `apps/miniprogram/miniprogram_npm/`         | Delete if present     | Remove ignored, reproducible npm build output; never commit it.                                |
| `apps/miniprogram/pages/test/`              | Delete if present     | Remove the obsolete empty V2 directory; do not replace it in this phase.                       |
| `apps/miniprogram/api/client.ts`            | Modify                | Expose an injectable authentication-expiry handler while preserving API error rejection.       |
| `apps/miniprogram/api/client.test.ts`       | Create                | Verify protected/public 401 behavior and handler-error isolation.                              |
| `scripts/miniprogram-manifest.mjs`          | Create                | Convert `pages` plus `subPackages[].pages` into one validated route list.                      |
| `scripts/miniprogram-manifest.test.mjs`     | Create                | Verify main-package, subpackage, duplicate, and invalid-manifest behavior.                     |
| `scripts/miniprogram-smoke.mjs`             | Modify                | Consume the route helper; keep navigation, screenshots, and script-error collection unchanged. |
| `docs/project-status.md`                    | Modify per checkpoint | Record completed task, exact validation result, checkpoint, and next active batch.             |
| `docs/debug/debug-feedback-log.md`          | Modify per checkpoint | Record decisions and mandatory browser-smoke evidence for the API-client change.               |

Do not modify `apps/miniprogram/project.private.config.json`, any `*.key` file, `pnpm-lock.yaml`, `apps/miniprogram/package.json`, `apps/miniprogram/store/session.ts`, or shared contracts in this phase.

## Design Coverage

| Design requirement                                                              | Plan coverage                                                    |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Section 2.2 generated-output and private-state boundary                         | Task 1 Steps 1, 9, and 10                                        |
| Section 2.3 pinned config, domain checks, TypeScript, and Worklet compiler flag | Task 1 Steps 2–8                                                 |
| Section 2.3 removal of the V2 login route                                       | Task 2 Steps 1, 2, 5, and 9                                      |
| Section 2.3 main-package and subpackage smoke discovery                         | Task 2 Steps 3, 6–9                                              |
| Section 5 API/UI dependency direction                                           | Task 2 injects a handler but does not import a page or app shell |
| Section 10 error semantics and session isolation                                | Task 2 tests protected/public 401 and handler failure separately |
| Section 12.3 core browser verification                                          | Task 2 Steps 10–12                                               |
| Sections 13 and 15 phase stop/agent handoff                                     | Scope gate, two checkpoint commits, and completion gate          |

### Task 1: Establish An Auditable Tracked Project Configuration

**Files:**

- Create: `scripts/miniprogram-config-audit.mjs`
- Create: `scripts/miniprogram-config-audit.test.mjs`
- Modify: `apps/miniprogram/project.config.json`
- Modify: `package.json`
- Delete if present: `apps/miniprogram/miniprogram_npm/`
- Delete if present: `apps/miniprogram/pages/test/`
- Modify before commit: `docs/project-status.md`
- Modify before commit: `docs/debug/debug-feedback-log.md`

- [ ] **Step 1: Confirm the task starts from the documented checkpoint**

Run:

```powershell
git status --short --branch
git log -5 --oneline --decorate
git remote -v
git diff -- apps/miniprogram/project.config.json package.json scripts docs/project-status.md docs/debug/debug-feedback-log.md
git check-ignore -q apps/miniprogram/project.private.config.json
if ($LASTEXITCODE -ne 0) { throw 'project.private.config.json must remain ignored' }
```

Expected:

- Branch is `main` unless the user explicitly selected another branch.
- The two local documentation checkpoints may still be ahead of `origin/main`.
- No pre-existing change in a task file is treated as disposable. If one exists, stop and reconcile it with the user-owned change before editing.
- `git check-ignore` exits `0`; the private configuration remains ignored.

- [ ] **Step 2: Write the failing project-configuration audit tests**

Create `scripts/miniprogram-config-audit.test.mjs` with this complete content:

```js
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { findProjectConfigIssues } from './miniprogram-config-audit.mjs';

const trackedConfig = JSON.parse(
  readFileSync(new URL('../apps/miniprogram/project.config.json', import.meta.url), 'utf8'),
);

const cleanConfig = {
  appid: 'wx56a7a21f974fd9af',
  compileType: 'miniprogram',
  libVersion: '3.16.2',
  miniprogramRoot: './',
  projectname: 'schedule-miniprogram',
  setting: {
    compileWorklet: true,
    es6: true,
    minified: true,
    minifyWXML: true,
    minifyWXSS: true,
    postcss: true,
    uploadWithSourceMap: true,
    urlCheck: true,
    useCompilerPlugins: ['typescript'],
  },
};

describe('tracked miniprogram project configuration', () => {
  it('rejects inherited V2 and machine-local compiler settings', () => {
    const issues = findProjectConfigIssues({
      ...cleanConfig,
      libVersion: 'latest',
      setting: {
        ...cleanConfig.setting,
        babelSetting: { disablePlugins: [], ignore: [], outputPath: '' },
        compileWorklet: false,
        disableSWC: true,
        swc: false,
        urlCheck: false,
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        'libVersion must equal 3.16.2',
        'setting.compileWorklet must be true',
        'setting.urlCheck must be true',
        'setting.babelSetting is not allowed in tracked configuration',
        'setting.disableSWC is not allowed in tracked configuration',
        'setting.swc is not allowed in tracked configuration',
      ]),
    );
  });

  it('accepts the exact V3-0.5 team baseline', () => {
    expect(findProjectConfigIssues(cleanConfig)).toEqual([]);
  });

  it('keeps the committed project configuration on the accepted baseline', () => {
    expect(findProjectConfigIssues(trackedConfig)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the audit test and observe the planned failure**

Run:

```powershell
pnpm vitest run scripts/miniprogram-config-audit.test.mjs
```

Expected: FAIL before tests are collected because `scripts/miniprogram-config-audit.mjs` does not exist. If it fails for another reason, stop and fix the test setup before proceeding.

- [ ] **Step 4: Implement the configuration audit utility**

Create `scripts/miniprogram-config-audit.mjs` with this complete content:

```js
#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const allowedRootKeys = new Set([
  'appid',
  'compileType',
  'libVersion',
  'miniprogramRoot',
  'projectname',
  'setting',
]);

const allowedSettingKeys = new Set([
  'compileWorklet',
  'es6',
  'minified',
  'minifyWXML',
  'minifyWXSS',
  'postcss',
  'uploadWithSourceMap',
  'urlCheck',
  'useCompilerPlugins',
]);

const requiredRootValues = {
  appid: 'wx56a7a21f974fd9af',
  compileType: 'miniprogram',
  libVersion: '3.16.2',
  miniprogramRoot: './',
  projectname: 'schedule-miniprogram',
};

const requiredTrueSettings = [
  'compileWorklet',
  'es6',
  'minified',
  'minifyWXML',
  'minifyWXSS',
  'postcss',
  'uploadWithSourceMap',
  'urlCheck',
];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function findProjectConfigIssues(config) {
  if (!isRecord(config)) {
    return ['project configuration must be an object'];
  }

  const issues = [];
  for (const key of Object.keys(config)) {
    if (!allowedRootKeys.has(key)) {
      issues.push(`${key} is not allowed in tracked configuration`);
    }
  }

  for (const [key, expected] of Object.entries(requiredRootValues)) {
    if (config[key] !== expected) {
      issues.push(`${key} must equal ${expected}`);
    }
  }

  if (!isRecord(config.setting)) {
    issues.push('setting must be an object');
    return issues;
  }

  for (const key of Object.keys(config.setting)) {
    if (!allowedSettingKeys.has(key)) {
      issues.push(`setting.${key} is not allowed in tracked configuration`);
    }
  }
  for (const key of requiredTrueSettings) {
    if (config.setting[key] !== true) {
      issues.push(`setting.${key} must be true`);
    }
  }
  if (
    !Array.isArray(config.setting.useCompilerPlugins) ||
    config.setting.useCompilerPlugins.length !== 1 ||
    config.setting.useCompilerPlugins[0] !== 'typescript'
  ) {
    issues.push('setting.useCompilerPlugins must contain only typescript');
  }

  return issues;
}

export function auditTrackedProjectConfig() {
  const configUrl = new URL('../apps/miniprogram/project.config.json', import.meta.url);
  const config = JSON.parse(readFileSync(configUrl, 'utf8'));
  return findProjectConfigIssues(config);
}

const invokedUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (invokedUrl === import.meta.url) {
  const issues = auditTrackedProjectConfig();
  if (issues.length > 0) {
    console.error('[miniprogram-config-audit] failed');
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
  } else {
    console.log('[miniprogram-config-audit] passed');
  }
}
```

- [ ] **Step 5: Run the audit test and observe the second planned failure**

Run:

```powershell
pnpm vitest run scripts/miniprogram-config-audit.test.mjs
```

Expected: two tests PASS and `keeps the committed project configuration on the accepted baseline` FAILS because the tracked file still uses `latest`, disables domain checking and Worklet compilation, and contains inherited settings.

- [ ] **Step 6: Replace the tracked project configuration**

Replace `apps/miniprogram/project.config.json` with this complete content:

```json
{
  "appid": "wx56a7a21f974fd9af",
  "compileType": "miniprogram",
  "libVersion": "3.16.2",
  "miniprogramRoot": "./",
  "projectname": "schedule-miniprogram",
  "setting": {
    "compileWorklet": true,
    "es6": true,
    "minified": true,
    "minifyWXML": true,
    "minifyWXSS": true,
    "postcss": true,
    "uploadWithSourceMap": true,
    "urlCheck": true,
    "useCompilerPlugins": ["typescript"]
  }
}
```

Do not copy any value from `project.private.config.json` except the already documented base-library version `3.16.2`. Do not change that ignored file.

- [ ] **Step 7: Add the audit command to the root package scripts**

In `package.json`, insert this exact property immediately before `miniprogram:devtools:open`:

```json
"miniprogram:config:audit": "node scripts/miniprogram-config-audit.mjs",
```

Do not reorder or change any other script or dependency.

- [ ] **Step 8: Run the focused tests and audit**

Run:

```powershell
pnpm vitest run scripts/miniprogram-config-audit.test.mjs
pnpm miniprogram:config:audit
```

Expected:

- Vitest reports `1` file and `3` tests passed.
- The audit prints `[miniprogram-config-audit] passed` and exits `0`.

- [ ] **Step 9: Remove only the two known reproducible V2 artifacts**

Run these exact PowerShell commands from `E:\AItools\Schedule`:

```powershell
$artifactPaths = @(
  'E:\AItools\Schedule\apps\miniprogram\miniprogram_npm',
  'E:\AItools\Schedule\apps\miniprogram\pages\test'
)
$allowedRoot = 'E:\AItools\Schedule\apps\miniprogram\'
foreach ($artifactPath in $artifactPaths) {
  $fullPath = [System.IO.Path]::GetFullPath($artifactPath)
  if (-not $fullPath.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove path outside miniprogram root: $fullPath"
  }
  if (Test-Path -LiteralPath $fullPath) {
    Remove-Item -LiteralPath $fullPath -Recurse -Force
  }
}
if (Test-Path -LiteralPath 'apps/miniprogram/miniprogram_npm') { throw 'miniprogram_npm remains' }
if (Test-Path -LiteralPath 'apps/miniprogram/pages/test') { throw 'pages/test remains' }
```

Expected: both paths are absent. This step must not delete or edit `project.private.config.json`, `private.wx56a7a21f974fd9af.key`, or any other `*.key` file.

- [ ] **Step 10: Run Task 1 validation**

Run:

```powershell
pnpm miniprogram:config:audit
pnpm miniprogram:typecheck
pnpm exec prettier --check package.json apps/miniprogram/project.config.json scripts/miniprogram-config-audit.mjs scripts/miniprogram-config-audit.test.mjs
git diff --check
git check-ignore -q apps/miniprogram/project.private.config.json
if ($LASTEXITCODE -ne 0) { throw 'private config ignore boundary failed' }
git ls-files --error-unmatch apps/miniprogram/project.private.config.json 2>$null
if ($LASTEXITCODE -eq 0) { throw 'private config must not be tracked' }
```

Expected: audit, typecheck, Prettier, and `git diff --check` pass; the ignored private file is not tracked. Do not run `pnpm miniprogram:smoke`: there is intentionally no `app.json` until V3-1.

- [ ] **Step 11: Update checkpoint documentation for Task 1**

Update `docs/project-status.md` so the current batch says Task 1 completed with the exact commands from Step 10, records that runtime compilation is deferred until V3-1 creates the manifest, and names Task 2 as the only next active task.

Append a concise V3-0.5 Task 1 entry to `docs/debug/debug-feedback-log.md` with these exact decisions:

```markdown
- 行为变化：跟踪配置固定基础库 `3.16.2`，开启域名校验和 Worklet 编译，移除继承的 SWC/Babel/本机开关；新增可执行配置审计。
- 生成物边界：仅删除被忽略的 `miniprogram_npm` 和旧空目录 `pages/test`；私有配置与上传私钥未修改、未跟踪。
- 运行/浏览器验证：本任务未创建 `app.json` 或页面，按 V3-0.5 边界不运行小程序页面冒烟；配置审计、类型检查和格式检查通过。
- 状态：任务 1 已完成；下一任务仅为 V3-0.5 任务 2。
```

- [ ] **Step 12: Review, stage, and commit Task 1**

Run:

```powershell
git diff -- apps/miniprogram/project.config.json package.json scripts/miniprogram-config-audit.mjs scripts/miniprogram-config-audit.test.mjs docs/project-status.md docs/debug/debug-feedback-log.md
git status --short
git add apps/miniprogram/project.config.json package.json scripts/miniprogram-config-audit.mjs scripts/miniprogram-config-audit.test.mjs docs/project-status.md docs/debug/debug-feedback-log.md
git diff --cached --check
git diff --cached
git commit -m "chore(miniprogram): establish V3 clean build baseline"
```

Expected: the staged diff contains only Task 1 files; the commit succeeds. Push only if `origin` and the upstream remain configured and a normal fast-forward push is available:

```powershell
git push
```

If the push fails, keep the local commit unchanged, record the failure in the next checkpoint update, and do not force-push.

### Task 2: Inject Authentication Expiry And Cover Subpackage Routes

**Files:**

- Create: `apps/miniprogram/api/client.test.ts`
- Modify: `apps/miniprogram/api/client.ts`
- Create: `scripts/miniprogram-manifest.mjs`
- Create: `scripts/miniprogram-manifest.test.mjs`
- Modify: `scripts/miniprogram-smoke.mjs`
- Modify before commit: `docs/project-status.md`
- Modify before commit: `docs/debug/debug-feedback-log.md`

- [ ] **Step 1: Inspect the Task 2 introduction points before editing**

Run:

```powershell
git status --short --branch
git log -S "wx.reLaunch({ url: '/pages/login/login' })" -- apps/miniprogram/api/client.ts
git blame -L 60,95 apps/miniprogram/api/client.ts
git log -S 'const pages = appJson.pages' -- scripts/miniprogram-smoke.mjs
git blame -L 65,105 scripts/miniprogram-smoke.mjs
```

Expected: both introduction points are identified and recorded in `docs/debug/debug-feedback-log.md` before the Task 2 commit. Line numbers may shift after Task 1, so use the expressions above rather than guessing a commit.

- [ ] **Step 2: Write the failing API-client tests**

Create `apps/miniprogram/api/client.test.ts` with this complete content:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { request, setUnauthorizedHandler, storeToken } from './client.js';

const requestMock = vi.fn();
const reLaunchMock = vi.fn();
const storage = new Map<string, unknown>();

function respond(statusCode: number, data: unknown): void {
  const options = requestMock.mock.calls[0]?.[0] as WechatMiniprogram.RequestOption;
  options.success?.({
    cookies: [],
    data,
    header: {},
    statusCode,
  } as WechatMiniprogram.RequestSuccessCallbackResult);
}

beforeEach(() => {
  requestMock.mockReset();
  reLaunchMock.mockReset();
  storage.clear();
  vi.stubGlobal('wx', {
    getStorageSync: vi.fn((key: string) => storage.get(key)),
    reLaunch: reLaunchMock,
    removeStorageSync: vi.fn((key: string) => storage.delete(key)),
    request: requestMock,
    setStorageSync: vi.fn((key: string, value: unknown) => storage.set(key, value)),
  });
});

afterEach(() => {
  setUnauthorizedHandler(undefined);
  vi.unstubAllGlobals();
});

describe('API client authentication expiry', () => {
  it('clears a protected session, invokes the injected handler once, and rejects the API error', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    storeToken('token');

    const result = request('/protected');
    respond(401, {
      error: { code: 'UNAUTHORIZED', message: 'Session expired', requestId: 'req-1' },
    });

    await expect(result).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Session expired',
      requestId: 'req-1',
      status: 401,
    });
    expect(storage.has('schedule.session')).toBe(false);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(reLaunchMock).not.toHaveBeenCalled();
  });

  it('does not clear the session or invoke the handler for a public 401 response', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    storeToken('token');

    const result = request('/public', { auth: false });
    respond(401, {
      error: { code: 'UNAUTHORIZED', message: 'Public request rejected', requestId: 'req-2' },
    });

    await expect(result).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(storage.get('schedule.session')).toBe('token');
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(reLaunchMock).not.toHaveBeenCalled();
  });

  it('preserves the API rejection when the injected handler throws', async () => {
    setUnauthorizedHandler(() => {
      throw new Error('navigation failed');
    });

    const result = request('/protected');
    respond(401, {
      error: { code: 'UNAUTHORIZED', message: 'Session expired', requestId: 'req-3' },
    });

    await expect(result).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      requestId: 'req-3',
      status: 401,
    });
    expect(reLaunchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Write the failing manifest-route tests**

Create `scripts/miniprogram-manifest.test.mjs` with this complete content:

```js
import { describe, expect, it } from 'vitest';

import { listRegisteredPages } from './miniprogram-manifest.mjs';

describe('miniprogram manifest routes', () => {
  it('returns main-package routes followed by normalized subpackage routes', () => {
    expect(
      listRegisteredPages({
        pages: ['pages/workbench/index', 'pages/calendar/index'],
        subPackages: [
          { pages: ['login/index', '/profile/index/'], root: 'pages/auth/' },
          { pages: ['manual/index'], root: '/pages/schedule' },
        ],
      }),
    ).toEqual([
      'pages/workbench/index',
      'pages/calendar/index',
      'pages/auth/login/index',
      'pages/auth/profile/index',
      'pages/schedule/manual/index',
    ]);
  });

  it('rejects duplicate normalized routes instead of silently skipping coverage', () => {
    expect(() =>
      listRegisteredPages({
        pages: ['pages/auth/login/index'],
        subPackages: [{ pages: ['login/index'], root: 'pages/auth' }],
      }),
    ).toThrow('Duplicate miniprogram route: pages/auth/login/index');
  });

  it('rejects a malformed pages or subPackages shape', () => {
    expect(() => listRegisteredPages({ pages: 'pages/workbench/index' })).toThrow(
      'app.json pages must be an array of non-empty strings',
    );
    expect(() =>
      listRegisteredPages({ pages: ['pages/workbench/index'], subPackages: [{}] }),
    ).toThrow('subPackages[0].root must be a non-empty string');
  });
});
```

- [ ] **Step 4: Run both new tests and verify they fail for the planned reasons**

Run:

```powershell
pnpm vitest run apps/miniprogram/api/client.test.ts scripts/miniprogram-manifest.test.mjs
```

Expected:

- Manifest tests fail before collection because `scripts/miniprogram-manifest.mjs` does not exist.
- API-client tests fail because `setUnauthorizedHandler` is not exported. If TypeScript reports an unrelated error in the test code, fix that test error before implementing production behavior.

- [ ] **Step 5: Add the injectable authentication-expiry API**

In `apps/miniprogram/api/client.ts`, insert this complete block immediately after the two storage-key constants:

```ts
export type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | undefined;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | undefined): void {
  unauthorizedHandler = handler;
}
```

Then replace the existing `if (response.statusCode === 401) { ... }` block with this exact block:

```ts
if (response.statusCode === 401 && options.auth !== false) {
  storeToken(undefined);
  try {
    unauthorizedHandler?.();
  } catch {
    // The request must still reject with the original API error if navigation fails.
  }
}
```

Do not change `request` into an `async` function, do not change how `wx.request` is invoked, and do not change success, network-error, `requestId`, `latestData`, or `ApiClientError` semantics. Do not register a route here; V3-1 `app.ts` will register and clear the handler.

- [ ] **Step 6: Implement validated main-package and subpackage route discovery**

Create `scripts/miniprogram-manifest.mjs` with this complete content:

```js
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSegment(value) {
  return value.replace(/^\/+|\/+$/g, '');
}

function readPages(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${label} must be an array of non-empty strings`);
  }
  const pages = value.map((page) => (typeof page === 'string' ? normalizeSegment(page) : ''));
  if (pages.some((page) => page.length === 0)) {
    throw new TypeError(`${label} must be an array of non-empty strings`);
  }
  return pages;
}

export function listRegisteredPages(appJson) {
  if (!isRecord(appJson)) {
    throw new TypeError('app.json must contain an object');
  }

  const routes = readPages(appJson.pages, 'app.json pages');
  const subPackages = appJson.subPackages ?? [];
  if (!Array.isArray(subPackages)) {
    throw new TypeError('app.json subPackages must be an array');
  }

  subPackages.forEach((subPackage, index) => {
    if (!isRecord(subPackage)) {
      throw new TypeError(`subPackages[${index}] must be an object`);
    }
    if (typeof subPackage.root !== 'string' || normalizeSegment(subPackage.root).length === 0) {
      throw new TypeError(`subPackages[${index}].root must be a non-empty string`);
    }
    const root = normalizeSegment(subPackage.root);
    for (const page of readPages(subPackage.pages, `subPackages[${index}].pages`)) {
      routes.push(`${root}/${page}`);
    }
  });

  const seen = new Set();
  for (const route of routes) {
    if (seen.has(route)) {
      throw new Error(`Duplicate miniprogram route: ${route}`);
    }
    seen.add(route);
  }
  return routes;
}
```

- [ ] **Step 7: Run the focused production-module tests**

Run:

```powershell
pnpm vitest run apps/miniprogram/api/client.test.ts scripts/miniprogram-manifest.test.mjs
```

Expected: `2` files and `6` tests pass. The API tests also prove no fallback `wx.reLaunch` occurs.

- [ ] **Step 8: Wire the smoke runner to the manifest helper**

In `scripts/miniprogram-smoke.mjs`, add this import immediately after the existing `miniprogram-devtools-lib.mjs` import:

```js
import { listRegisteredPages } from './miniprogram-manifest.mjs';
```

Replace this line:

```js
const pages = appJson.pages;
```

with:

```js
const pages = listRegisteredPages(appJson);
```

Make no other change to `scripts/miniprogram-smoke.mjs`. In particular, keep `switchTab` for `tabBar.list`, `reLaunch` for other routes, screenshot collection, console collection, and script-error detection exactly as they are.

- [ ] **Step 9: Prove the old route is gone and all focused checks pass**

Run:

```powershell
pnpm vitest run apps/miniprogram/api/client.test.ts scripts/miniprogram-manifest.test.mjs scripts/miniprogram-config-audit.test.mjs
pnpm miniprogram:config:audit
pnpm miniprogram:typecheck
pnpm exec prettier --check apps/miniprogram/api/client.ts apps/miniprogram/api/client.test.ts scripts/miniprogram-manifest.mjs scripts/miniprogram-manifest.test.mjs scripts/miniprogram-smoke.mjs
rg -n --fixed-strings "/pages/login/login" apps/miniprogram scripts
if ($LASTEXITCODE -eq 0) { throw 'obsolete login route remains' }
git diff --check
```

Expected:

- Vitest reports `3` files and `9` tests passed.
- Configuration audit, typecheck, Prettier, and `git diff --check` pass.
- `rg` prints nothing; the PowerShell guard does not throw.
- Do not run `pnpm miniprogram:smoke` in this phase because `app.json` intentionally does not exist. The route helper is covered by unit tests; V3-1 must run the real simulator smoke after creating the manifest.

- [ ] **Step 10: Run mandatory browser smoke for the core API-client change**

Run:

```powershell
pnpm smoke:browser
```

Expected: exit `0` with the existing Web authentication, administrator, member, guest, and workbench smoke scenarios passing. This command is mandatory because Task 2 modifies `apps/miniprogram/api/client.ts`. If it fails, do not commit Task 2; record the real failure and diagnose it under `AGENTS.md`.

- [ ] **Step 11: Update checkpoint documentation and run the core-change guard**

Update `docs/project-status.md` with Task 2 outcomes, every command and result from Steps 9–10, both V3-0.5 commit identifiers, the push result, and this exact next active batch:

```markdown
1. 用户复核并批准 V3-1 阶段范围；停止条件：用户明确批准或提出修改。
2. 使用 `writing-plans` 基于 V3-0.5 检查点生成 V3-1 可执行计划；停止条件：任务 3–5 具备精确文件职责、失败测试、最小实现和提交步骤。
3. 计划批准前不创建 `app.json`、app-shell、登录页或日历 VM。
```

Append a V3-0.5 Task 2 entry to `docs/debug/debug-feedback-log.md` containing:

```markdown
- 引入点：记录 `git log -S` 与 `git blame` 找到的旧 401 路由和主包-only 冒烟代码提交。
- 行为变化：受保护请求 401 清除令牌并调用可注入回调；公开请求 401 不清除现有会话；回调异常不替换原始 `ApiClientError`；API 层不再导航。
- 冒烟变化：路由发现严格遍历 `pages` 和 `subPackages[].pages`，规范化后重复路由直接报错；页面导航、截图和错误收集语义不变。
- 运行/浏览器验证：pnpm smoke:browser 通过。
- 小程序运行边界：V3-0.5 无 `app.json`，未运行 `pnpm miniprogram:smoke`；manifest helper 单测通过，真实模拟器遍历留给 V3-1。
- 状态：V3-0.5 已完成；V3-1 计划生成和用户批准前停止实现。
```

Then run:

```powershell
pnpm smoke:check-core
```

Expected: exit `0` and report that the `pnpm smoke:browser` record exists.

- [ ] **Step 12: Run final V3-0.5 validation**

Run:

```powershell
pnpm miniprogram:config:audit
pnpm miniprogram:typecheck
pnpm vitest run apps/miniprogram/api/client.test.ts scripts/miniprogram-manifest.test.mjs scripts/miniprogram-config-audit.test.mjs
pnpm smoke:check-core
pnpm exec prettier --check package.json apps/miniprogram/project.config.json apps/miniprogram/api/client.ts apps/miniprogram/api/client.test.ts scripts/miniprogram-config-audit.mjs scripts/miniprogram-config-audit.test.mjs scripts/miniprogram-manifest.mjs scripts/miniprogram-manifest.test.mjs scripts/miniprogram-smoke.mjs docs/project-status.md docs/debug/debug-feedback-log.md
git diff --check
```

Expected: all commands exit `0`; Vitest reports `3` files and `9` tests passed.

- [ ] **Step 13: Review behavior, stage, and commit Task 2**

Before staging, state this behavior-change list in the task record and verify it against the diff:

```text
1. Protected 401: token cleared, injected handler called once, original API error rejected.
2. Public 401: existing token preserved, injected handler not called, API error rejected.
3. Handler failure: swallowed only at the navigation boundary; original API error still rejected.
4. Smoke routes: main-package order retained, then subpackage declaration order; duplicate normalized routes fail fast.
5. Receiver binding: `wx.request({...})` remains a member call; no existing method becomes an unbound function.
6. Async/error path: the same Promise resolves for 2xx and rejects once for HTTP/network failures; only handler exceptions are isolated.
7. Null semantics: `options.auth !== false`, `getStoredToken() ?? ''`, payload optional chaining, and default error values remain unchanged.
8. Type narrowing: response/payload casts and `ApiClientError` constructor arguments remain unchanged.
9. Side effects/calls: protected 401 clears once and calls the handler once; public 401 does neither; each manifest route is visited once.
10. UI smoke behavior: tab detection, `switchTab`/`reLaunch`, screenshots, waits, console collection, and error patterns remain unchanged.
```

Run:

```powershell
git diff -- apps/miniprogram/api/client.ts apps/miniprogram/api/client.test.ts scripts/miniprogram-manifest.mjs scripts/miniprogram-manifest.test.mjs scripts/miniprogram-smoke.mjs docs/project-status.md docs/debug/debug-feedback-log.md
git status --short
git add apps/miniprogram/api/client.ts apps/miniprogram/api/client.test.ts scripts/miniprogram-manifest.mjs scripts/miniprogram-manifest.test.mjs scripts/miniprogram-smoke.mjs docs/project-status.md docs/debug/debug-feedback-log.md
git diff --cached --check
git diff --cached
git commit -m "fix(miniprogram): inject auth expiry and cover subpackages"
```

Expected: the staged diff contains only Task 2 files and checkpoint documentation; the commit succeeds. Push only as a normal fast-forward:

```powershell
git push
```

If the push fails, retain the local commit, record the exact error in `docs/project-status.md` at the next safe checkpoint, and do not amend or force-push solely to rewrite push metadata.

## V3-0.5 Completion Gate

V3-0.5 is complete only when both task commits exist and all of these statements are true:

- The tracked project config passes `pnpm miniprogram:config:audit` and pins `3.16.2`.
- Private config and upload keys remain ignored and unchanged.
- No tracked or ignored V2 page/build artifact remains at the two explicit cleanup paths.
- `apps/miniprogram/api/client.ts` contains no page route and preserves original request-error semantics.
- The manifest helper covers main and subpackage routes and rejects duplicates.
- Focused tests, miniprogram typecheck, Web browser smoke, core-change guard, formatting, and diff checks pass.
- `docs/project-status.md` stops implementation before V3-1 planning and approval.

Do not mark V3 page runtime, Skyline, Worklet runtime, TDesign, package size, or device compatibility as complete. None is exercised in this phase.
