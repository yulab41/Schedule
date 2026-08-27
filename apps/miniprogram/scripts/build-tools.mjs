import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build as esbuild } from 'esbuild';
import ts from 'typescript';

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE_ROOT = path.join(APP_ROOT, 'src');
export const DIST_ROOT = path.join(APP_ROOT, 'dist');
export const ARTIFACT_ROOT = path.join(APP_ROOT, '.artifacts');
const REPOSITORY_ROOT = path.resolve(APP_ROOT, '..', '..');
const CLIENT_CORE_ENTRY = path.join(REPOSITORY_ROOT, 'packages', 'client-core', 'src', 'index.ts');
const CONTRACTS_MANUAL_SCHEDULE_LIMITS_ENTRY = path.join(
  REPOSITORY_ROOT,
  'packages',
  'contracts',
  'src',
  'manual-schedule-limits.ts',
);
const CONTRACTS_PAST_SCHEDULE_LIMITS_ENTRY = path.join(
  REPOSITORY_ROOT,
  'packages',
  'contracts',
  'src',
  'past-schedule-limits.ts',
);
const PRESENTATION_CORE_ENTRY = path.join(
  REPOSITORY_ROOT,
  'packages',
  'presentation-core',
  'src',
  'index.ts',
);
const PRESENTATION_CORE_EVENT_ENTRY = path.join(
  REPOSITORY_ROOT,
  'packages',
  'presentation-core',
  'src',
  'event.ts',
);
const PRESENTATION_CORE_EXPORT_ENTRY = path.join(
  REPOSITORY_ROOT,
  'packages',
  'presentation-core',
  'src',
  'export.ts',
);
const PRESENTATION_CORE_STATISTICS_ENTRY = path.join(
  REPOSITORY_ROOT,
  'packages',
  'presentation-core',
  'src',
  'statistics.ts',
);
const PRESENTATION_CORE_VISITOR_ACCESS_ENTRY = path.join(
  REPOSITORY_ROOT,
  'packages',
  'presentation-core',
  'src',
  'visitor-access.ts',
);
const UI_TOKENS_WXSS = path.resolve(
  APP_ROOT,
  '..',
  '..',
  'packages',
  'ui-tokens',
  'src',
  'tokens.wxss',
);

export const BUILD_PROFILES = Object.freeze({
  production: Object.freeze({
    apiBaseUrl: 'https://hosp.schedule.eylinhome.top/api',
  }),
  staging: Object.freeze({
    apiBaseUrl: 'https://staging-hosp.schedule.eylinhome.top/api',
  }),
});

export const PACKAGE_LIMITS = Object.freeze({
  packageBlockBytes: Math.floor(1.8 * 1024 * 1024),
  packageOfficialBytes: 2 * 1024 * 1024,
  packageWarningBytes: Math.floor(1.5 * 1024 * 1024),
  totalBlockBytes: 25 * 1024 * 1024,
  totalOfficialBytes: 30 * 1024 * 1024,
  totalWarningBytes: 15 * 1024 * 1024,
});

const nodeBuiltins = new Set(
  builtinModules.flatMap((moduleName) => {
    const normalized = moduleName.replace(/^node:/u, '');
    return [normalized, `node:${normalized}`];
  }),
);

const forbiddenModules = [
  '@schedule/database',
  '@schedule/test-fixtures',
  'pinia',
  'vue',
  'vue-router',
  'zod',
];
const forbiddenExactModules = new Set(['@schedule/contracts']);

const forbiddenRuntimeIdentifiers = new Set([
  'Buffer',
  'Element',
  'HTMLElement',
  'PointerEvent',
  'ResizeObserver',
  'XMLHttpRequest',
  '__dirname',
  '__filename',
  'document',
  'fetch',
  'global',
  'globalThis',
  'localStorage',
  'navigator',
  'process',
  'self',
  'sessionStorage',
  'window',
]);

const staticExtensions = new Set([
  '.gif',
  '.jpeg',
  '.jpg',
  '.json',
  '.otf',
  '.png',
  '.svg',
  '.ttf',
  '.webp',
  '.wxml',
  '.wxs',
  '.wxss',
]);

const BUNDLED_ONLY_TYPESCRIPT_MODULES = new Set([
  ...[
    'exports-panel',
    'insights-dashboard-panel',
    'notifications-panel',
    'visitor-access-panel',
  ].flatMap((panel) => [
    `subpackages/insights/components/${panel}/controller.ts`,
    `subpackages/insights/components/${panel}/index.ts`,
  ]),
  'subpackages/organization/components/directory-panel/controller.ts',
  'subpackages/organization/components/directory-panel/index.ts',
  'subpackages/organization/components/group-settings-panel/controller.ts',
  'subpackages/organization/components/invite-visitor-panel/controller.ts',
  'subpackages/organization/components/invite-visitor-panel/index.ts',
  'subpackages/organization/components/platform-accounts-panel/controller.ts',
  'subpackages/organization/components/platform-accounts-panel/index.ts',
  'subpackages/organization/components/scheduling-config-panel/controller.ts',
  'subpackages/organization/components/scheduling-config-panel/index.ts',
  'subpackages/workflows/components/controller-host.ts',
  'subpackages/workflows/components/workflow-duty-panel/controller.ts',
  'subpackages/workflows/components/workflow-leave-panel/controller.ts',
  'subpackages/workflows/components/workflow-swap-panel/controller.ts',
]);

const voidWxmlTags = new Set(['image', 'input', 'textarea']);

export function normalizeRelativePath(value) {
  return value.split(path.sep).join('/');
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function resolveBuildProfile(value) {
  if (typeof value !== 'string' || !(value in BUILD_PROFILES)) {
    throw new Error(`profile must be one of: ${Object.keys(BUILD_PROFILES).join(', ')}`);
  }
  return value;
}

export function readProfileArgument(argv = process.argv.slice(2)) {
  const argument = argv.find((value) => value.startsWith('--profile='));
  if (argument === undefined) {
    throw new Error('missing required --profile=staging|production');
  }
  return resolveBuildProfile(argument.slice('--profile='.length));
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function isInside(rootDirectory, candidatePath) {
  const relative = path.relative(rootDirectory, candidatePath);
  return (
    relative.length > 0 &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function assertSafeOutputDirectory(outputDirectory) {
  const resolved = path.resolve(outputDirectory);
  if (resolved === DIST_ROOT || isInside(ARTIFACT_ROOT, resolved)) return resolved;
  throw new Error(`refusing generated output outside dist/.artifacts: ${resolved}`);
}

function assertSafeSourceDirectory(sourceDirectory) {
  const resolved = path.resolve(sourceDirectory);
  if (resolved === SOURCE_ROOT || isInside(ARTIFACT_ROOT, resolved)) return resolved;
  throw new Error(`refusing build source outside src/.artifacts: ${resolved}`);
}

export function resetGeneratedDirectory(outputDirectory) {
  const resolved = assertSafeOutputDirectory(outputDirectory);
  rmSync(resolved, { force: true, recursive: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

export function listFiles(rootDirectory) {
  const resolvedRoot = path.resolve(rootDirectory);
  if (!existsSync(resolvedRoot)) return [];
  const files = [];

  function visit(directory) {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name, 'en'),
    );
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const stats = lstatSync(absolutePath);
      if (stats.isSymbolicLink()) {
        throw new Error(`symbolic link is forbidden: ${normalizeRelativePath(absolutePath)}`);
      }
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile()) files.push(absolutePath);
    }
  }

  visit(resolvedRoot);
  return files;
}

export function createFileManifest(rootDirectory, excludedRelativePaths = new Set()) {
  const resolvedRoot = path.resolve(rootDirectory);
  return listFiles(resolvedRoot)
    .map((filePath) => {
      const relativePath = normalizeRelativePath(path.relative(resolvedRoot, filePath));
      if (excludedRelativePaths.has(relativePath)) return undefined;
      const content = readFileSync(filePath);
      return {
        bytes: content.byteLength,
        path: relativePath,
        sha256: sha256(content),
      };
    })
    .filter((entry) => entry !== undefined);
}

function copyStaticFiles(sourceDirectory, outputDirectory) {
  for (const sourcePath of listFiles(sourceDirectory)) {
    const extension = path.extname(sourcePath).toLowerCase();
    if (extension === '.ts') continue;
    if (!staticExtensions.has(extension)) {
      throw new Error(
        `unsupported source asset: ${normalizeRelativePath(path.relative(sourceDirectory, sourcePath))}`,
      );
    }
    const relativePath = path.relative(sourceDirectory, sourcePath);
    const destinationPath = path.join(outputDirectory, relativePath);
    mkdirSync(path.dirname(destinationPath), { recursive: true });
    copyFileSync(sourcePath, destinationPath);
  }
}

function copyGeneratedUiTokens(outputDirectory) {
  if (!existsSync(UI_TOKENS_WXSS)) {
    throw new Error('generated @schedule/ui-tokens tokens.wxss is missing');
  }
  const destinationPath = path.join(outputDirectory, 'styles', 'tokens.wxss');
  mkdirSync(path.dirname(destinationPath), { recursive: true });
  copyFileSync(UI_TOKENS_WXSS, destinationPath);
}

function collectTypeScriptEntryPoints(sourceDirectory) {
  return Object.fromEntries(
    listFiles(sourceDirectory)
      .filter((filePath) => filePath.endsWith('.ts') && !filePath.endsWith('.d.ts'))
      .map((filePath) => {
        const relativePath = normalizeRelativePath(path.relative(sourceDirectory, filePath));
        return [relativePath, filePath];
      })
      .filter(([relativePath]) => !BUNDLED_ONLY_TYPESCRIPT_MODULES.has(relativePath))
      .map(([relativePath, filePath]) => [relativePath.slice(0, -'.ts'.length), filePath]),
  );
}

function resolveGitCommit() {
  return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
  }).trim();
}

export async function buildMiniProgram({
  buildCommit = resolveGitCommit(),
  buildVersion = process.env.WECHAT_CI_VERSION?.trim() || 'local',
  outdir = DIST_ROOT,
  profile,
  sourceRoot = SOURCE_ROOT,
}) {
  const resolvedProfile = resolveBuildProfile(profile);
  const sourceDirectory = assertSafeSourceDirectory(sourceRoot);
  const outputDirectory = resetGeneratedDirectory(outdir);
  const entryPoints = collectTypeScriptEntryPoints(sourceDirectory);
  if (Object.keys(entryPoints).length === 0) throw new Error('no TypeScript entry points found');

  const result = await esbuild({
    absWorkingDir: APP_ROOT,
    alias: {
      '@schedule/client-core': CLIENT_CORE_ENTRY,
      '@schedule/contracts/manual-schedule-limits': CONTRACTS_MANUAL_SCHEDULE_LIMITS_ENTRY,
      '@schedule/contracts/past-schedule-limits': CONTRACTS_PAST_SCHEDULE_LIMITS_ENTRY,
      '@schedule/presentation-core/event': PRESENTATION_CORE_EVENT_ENTRY,
      '@schedule/presentation-core/export': PRESENTATION_CORE_EXPORT_ENTRY,
      '@schedule/presentation-core/statistics': PRESENTATION_CORE_STATISTICS_ENTRY,
      '@schedule/presentation-core/visitor-access': PRESENTATION_CORE_VISITOR_ACCESS_ENTRY,
      '@schedule/presentation-core': PRESENTATION_CORE_ENTRY,
    },
    bundle: true,
    charset: 'utf8',
    define: {
      __MINIPROGRAM_API_BASE_URL__: JSON.stringify(BUILD_PROFILES[resolvedProfile].apiBaseUrl),
      __MINIPROGRAM_BUILD_COMMIT__: JSON.stringify(buildCommit),
      __MINIPROGRAM_BUILD_PROFILE__: JSON.stringify(resolvedProfile),
      __MINIPROGRAM_BUILD_VERSION__: JSON.stringify(buildVersion),
    },
    entryNames: '[dir]/[name]',
    entryPoints,
    format: 'cjs',
    legalComments: 'none',
    logLevel: 'silent',
    metafile: true,
    minify: true,
    outdir: outputDirectory,
    platform: 'browser',
    sourcemap: false,
    target: 'es2020',
    treeShaking: true,
  });

  copyStaticFiles(sourceDirectory, outputDirectory);
  copyGeneratedUiTokens(outputDirectory);
  writeFileSync(
    path.join(outputDirectory, 'build-profile.json'),
    `${JSON.stringify(
      {
        apiBaseUrl: BUILD_PROFILES[resolvedProfile].apiBaseUrl,
        buildCommit,
        buildVersion,
        profile: resolvedProfile,
        schemaVersion: 1,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const files = createFileManifest(outputDirectory, new Set(['build-manifest.json']));
  writeFileSync(
    path.join(outputDirectory, 'build-manifest.json'),
    `${JSON.stringify({ files, profile: resolvedProfile, schemaVersion: 1 }, null, 2)}\n`,
    'utf8',
  );
  return { files, metafile: result.metafile, outputDirectory, profile: resolvedProfile };
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRoute(value) {
  return value.replace(/^\/+|\/+$/gu, '');
}

function readPageList(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }
  const routes = value.map((route) => (typeof route === 'string' ? normalizeRoute(route) : ''));
  if (routes.some((route) => route.length === 0)) {
    throw new Error(`${label} must contain non-empty strings`);
  }
  return routes;
}

export function listRegisteredPages(appJson) {
  if (!isRecord(appJson)) throw new Error('app.json must be an object');
  const routes = readPageList(appJson.pages, 'app.json pages');
  const subpackages = appJson.subpackages ?? appJson.subPackages ?? [];
  if (!Array.isArray(subpackages)) throw new Error('app.json subpackages must be an array');
  for (const [index, subpackage] of subpackages.entries()) {
    if (!isRecord(subpackage) || typeof subpackage.root !== 'string') {
      throw new Error(`subpackages[${index}] must contain a root`);
    }
    const root = normalizeRoute(subpackage.root);
    if (root.length === 0) throw new Error(`subpackages[${index}].root must not be empty`);
    for (const route of readPageList(subpackage.pages, `subpackages[${index}].pages`)) {
      routes.push(`${root}/${route}`);
    }
  }
  if (new Set(routes).size !== routes.length) throw new Error('app.json contains duplicate routes');
  return routes;
}

function isPropertyName(identifier) {
  const parent = identifier.parent;
  return (
    (ts.isPropertyAccessExpression(parent) && parent.name === identifier) ||
    (ts.isPropertyAssignment(parent) && parent.name === identifier) ||
    (ts.isMethodDeclaration(parent) && parent.name === identifier) ||
    (ts.isPropertyDeclaration(parent) && parent.name === identifier)
  );
}

function isForbiddenModule(moduleName) {
  return (
    nodeBuiltins.has(moduleName) ||
    forbiddenExactModules.has(moduleName) ||
    forbiddenModules.some(
      (forbidden) => moduleName === forbidden || moduleName.startsWith(`${forbidden}/`),
    )
  );
}

function importDeclarationHasRuntimeEffect(node) {
  const clause = node.importClause;
  if (clause === undefined) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name !== undefined) return true;
  if (clause.namedBindings === undefined) return false;
  if (ts.isNamespaceImport(clause.namedBindings)) return true;
  return clause.namedBindings.elements.some((element) => !element.isTypeOnly);
}

export function findRuntimeBoundaryIssues(source, fileName = 'source.ts') {
  const kind = fileName.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const issues = new Set();

  function inspectModule(moduleName) {
    if (isForbiddenModule(moduleName)) {
      issues.add(`imports forbidden runtime module: ${moduleName}`);
    }
  }

  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      importDeclarationHasRuntimeEffect(node)
    ) {
      inspectModule(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      inspectModule(node.arguments[0].text);
    }
    if (
      ts.isIdentifier(node) &&
      !isPropertyName(node) &&
      forbiddenRuntimeIdentifiers.has(node.text)
    ) {
      issues.add(`references forbidden runtime identifier: ${node.text}`);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...issues];
}

export function findWorkletIssues(source, fileName = 'source.ts') {
  const kind = fileName.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const issues = [];
  let count = 0;

  function inspectBody(body, node) {
    if (body === undefined || !ts.isBlock(body)) return;
    const directiveIndexes = body.statements
      .map((statement, index) =>
        ts.isExpressionStatement(statement) &&
        ts.isStringLiteral(statement.expression) &&
        statement.expression.text === 'worklet'
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    if (directiveIndexes.length === 0) return;
    count += directiveIndexes.length;
    if (directiveIndexes.length !== 1 || directiveIndexes[0] !== 0) {
      const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      issues.push(
        `worklet directive must be the first and only directive at line ${location.line + 1}`,
      );
    }
  }

  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) {
      inspectBody(node.body, node);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { count, issues };
}

function findSecretIssues(source) {
  const patterns = [
    ['private key material', /-----BEGIN [A-Z ]+PRIVATE KEY-----/u],
    ['hard-coded bearer credential', /Bearer\s+[A-Za-z0-9._~+/-]{20,}/u],
    ['hard-coded AppSecret', /(?:app[_-]?secret|appSecret)\s*[:=]\s*['"][^'"]{8,}['"]/iu],
  ];
  return patterns.filter(([, pattern]) => pattern.test(source)).map(([label]) => label);
}

function validateWxml(source, relativePath) {
  const issues = [];
  if (/<\s*(?:script|iframe|web-view)\b/iu.test(source)) {
    issues.push(`${relativePath}: forbidden Web/WebView element`);
  }
  const withoutComments = source.replace(/<!--[\s\S]*?-->/gu, '');
  const stack = [];
  for (const match of withoutComments.matchAll(/<\s*(\/)?\s*([A-Za-z][\w-]*)([^>]*)>/gu)) {
    const closing = match[1] === '/';
    const tag = match[2];
    const suffix = match[3];
    if (closing) {
      const current = stack.pop();
      if (current !== tag) issues.push(`${relativePath}: mismatched closing tag </${tag}>`);
    } else if (!suffix.trimEnd().endsWith('/') && !voidWxmlTags.has(tag)) {
      stack.push(tag);
    }
  }
  if (stack.length > 0) issues.push(`${relativePath}: unclosed tag <${stack.at(-1)}>`);
  return issues;
}

function validateWxss(source, relativePath) {
  let depth = 0;
  for (const character of source.replace(/\/\*[\s\S]*?\*\//gu, '')) {
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth < 0) return [`${relativePath}: unmatched closing brace`];
  }
  return depth === 0 ? [] : [`${relativePath}: unclosed style block`];
}

function auditTree(rootDirectory, { built }) {
  const issues = [];
  let workletCount = 0;
  for (const filePath of listFiles(rootDirectory)) {
    const relativePath = normalizeRelativePath(path.relative(rootDirectory, filePath));
    const extension = path.extname(filePath).toLowerCase();
    const source = readFileSync(filePath, 'utf8');
    if (extension === '.json') {
      try {
        JSON.parse(source);
      } catch (error) {
        issues.push(`${relativePath}: invalid JSON (${error.message})`);
      }
    }
    if (extension === '.wxml') issues.push(...validateWxml(source, relativePath));
    if (extension === '.wxss') issues.push(...validateWxss(source, relativePath));
    if (extension === '.ts' || extension === '.js') {
      for (const issue of findRuntimeBoundaryIssues(source, relativePath)) {
        issues.push(`${relativePath}: ${issue}`);
      }
      const worklets = findWorkletIssues(source, relativePath);
      workletCount += worklets.count;
      for (const issue of worklets.issues) issues.push(`${relativePath}: ${issue}`);
    }
    for (const issue of findSecretIssues(source)) issues.push(`${relativePath}: ${issue}`);
    if (built && (extension === '.ts' || extension === '.map')) {
      issues.push(`${relativePath}: build output contains source/compiler artifact`);
    }
    if (built && /(?:[A-Za-z]:\\(?:Users|AItools)\\|\/(?:Users|home)\/)/u.test(source)) {
      issues.push(`${relativePath}: build output contains an absolute local path`);
    }
  }
  return { issues, workletCount };
}

export function auditSourceTree() {
  const issues = [];
  const projectConfigPath = path.join(APP_ROOT, 'project.config.json');
  const appJsonPath = path.join(SOURCE_ROOT, 'app.json');
  let projectConfig;
  let appJson;
  try {
    projectConfig = readJson(projectConfigPath);
  } catch (error) {
    issues.push(`project.config.json is invalid: ${error.message}`);
  }
  try {
    appJson = readJson(appJsonPath);
  } catch (error) {
    issues.push(`src/app.json is invalid: ${error.message}`);
  }

  if (projectConfig !== undefined) {
    if (projectConfig.compileType !== 'miniprogram') {
      issues.push('project.config.json compileType must be miniprogram');
    }
    if (projectConfig.miniprogramRoot !== 'dist/') {
      issues.push('project.config.json miniprogramRoot must be dist/');
    }
    if (typeof projectConfig.appid !== 'string' || projectConfig.appid.length === 0) {
      issues.push('project.config.json must preserve a non-empty AppID');
    }
    const requiredTrueSettings = [
      'compileWorklet',
      'es6',
      'minified',
      'minifyWXML',
      'minifyWXSS',
      'postcss',
      'urlCheck',
    ];
    for (const key of requiredTrueSettings) {
      if (projectConfig.setting?.[key] !== true) {
        issues.push(`project.config.json setting.${key} must be true`);
      }
    }
    if (projectConfig.setting?.uploadWithSourceMap !== false) {
      issues.push('project.config.json setting.uploadWithSourceMap must be false');
    }
    if (projectConfig.setting?.ignoreUploadUnusedFiles !== false) {
      issues.push('project.config.json setting.ignoreUploadUnusedFiles must be false');
    }
  }

  if (appJson !== undefined) {
    if (appJson.renderer !== 'skyline') issues.push('src/app.json renderer must be skyline');
    if (appJson.componentFramework !== 'glass-easel') {
      issues.push('src/app.json componentFramework must be glass-easel');
    }
    const skyline = appJson.rendererOptions?.skyline;
    if (skyline?.disableABTest !== true) issues.push('Skyline AB test must be disabled');
    if (skyline?.sdkVersionBegin !== '3.3.0') issues.push('Skyline minimum must be 3.3.0');
    if (skyline?.sdkVersionEnd !== '15.255.255') {
      issues.push('Skyline maximum must be 15.255.255');
    }
    try {
      for (const route of listRegisteredPages(appJson)) {
        for (const extension of ['.json', '.ts', '.wxml', '.wxss']) {
          if (!existsSync(path.join(SOURCE_ROOT, `${route}${extension}`))) {
            issues.push(`registered page is missing ${route}${extension}`);
          }
        }
      }
    } catch (error) {
      issues.push(error.message);
    }
  }

  const treeAudit = auditTree(SOURCE_ROOT, { built: false });
  issues.push(...treeAudit.issues);
  return { issues, workletCount: treeAudit.workletCount };
}

export function auditBuiltTree(outputDirectory = DIST_ROOT) {
  const resolvedOutput = assertSafeOutputDirectory(outputDirectory);
  const issues = [];
  if (!existsSync(resolvedOutput)) return { issues: ['dist output is missing'], workletCount: 0 };
  const treeAudit = auditTree(resolvedOutput, { built: true });
  issues.push(...treeAudit.issues);

  const manifestPath = path.join(resolvedOutput, 'build-manifest.json');
  try {
    const manifest = readJson(manifestPath);
    const actual = createFileManifest(resolvedOutput, new Set(['build-manifest.json']));
    if (JSON.stringify(manifest.files) !== JSON.stringify(actual)) {
      issues.push('build-manifest.json does not match output files');
    }
  } catch (error) {
    issues.push(`build-manifest.json is invalid: ${error.message}`);
  }

  if (existsSync(path.join(resolvedOutput, 'project.private.config.json'))) {
    issues.push('private project configuration leaked into dist');
  }
  if (!existsSync(path.join(resolvedOutput, 'styles', 'tokens.wxss'))) {
    issues.push('generated UI token stylesheet is missing from dist');
  }
  try {
    const appStylesheet = readFileSync(path.join(resolvedOutput, 'app.wxss'), 'utf8');
    if (!appStylesheet.includes('@import "./styles/tokens.wxss";')) {
      issues.push('app.wxss must import the generated UI token stylesheet');
    }
  } catch (error) {
    issues.push(`app.wxss is unreadable: ${error.message}`);
  }
  return { issues, workletCount: treeAudit.workletCount };
}

function formatBytes(value) {
  return `${value} bytes`;
}

export function auditPackageSize(outputDirectory = DIST_ROOT) {
  const resolvedOutput = assertSafeOutputDirectory(outputDirectory);
  const issues = [];
  const warnings = [];
  const appJson = readJson(path.join(resolvedOutput, 'app.json'));
  const subpackages = appJson.subpackages ?? appJson.subPackages ?? [];
  const roots = subpackages.map((subpackage) => normalizeRoute(subpackage.root));
  const totals = new Map([['main', 0]]);
  for (const root of roots) totals.set(root, 0);

  for (const filePath of listFiles(resolvedOutput)) {
    const relativePath = normalizeRelativePath(path.relative(resolvedOutput, filePath));
    const matchingRoot = roots.find(
      (root) => relativePath === root || relativePath.startsWith(`${root}/`),
    );
    const key = matchingRoot ?? 'main';
    totals.set(key, (totals.get(key) ?? 0) + statSync(filePath).size);
  }
  const totalBytes = [...totals.values()].reduce((sum, value) => sum + value, 0);

  for (const [name, bytes] of totals) {
    if (bytes > PACKAGE_LIMITS.packageOfficialBytes) {
      issues.push(`${name} exceeds official 2M limit (${formatBytes(bytes)})`);
    } else if (bytes > PACKAGE_LIMITS.packageBlockBytes) {
      issues.push(`${name} exceeds internal 1.8M limit (${formatBytes(bytes)})`);
    } else if (bytes > PACKAGE_LIMITS.packageWarningBytes) {
      warnings.push(`${name} exceeds internal 1.5M warning (${formatBytes(bytes)})`);
    }
  }
  if (totalBytes > PACKAGE_LIMITS.totalOfficialBytes) {
    issues.push(`total package exceeds official 30M limit (${formatBytes(totalBytes)})`);
  } else if (totalBytes > PACKAGE_LIMITS.totalBlockBytes) {
    issues.push(`total package exceeds internal 25M limit (${formatBytes(totalBytes)})`);
  } else if (totalBytes > PACKAGE_LIMITS.totalWarningBytes) {
    warnings.push(`total package exceeds internal 15M warning (${formatBytes(totalBytes)})`);
  }
  return {
    issues,
    packages: Object.fromEntries(totals),
    totalBytes,
    warnings,
  };
}

export async function verifyDeterministicBuild(profile) {
  const firstDirectory = path.join(ARTIFACT_ROOT, 'determinism-a');
  const secondDirectory = path.join(ARTIFACT_ROOT, 'determinism-b');
  try {
    const first = await buildMiniProgram({ outdir: firstDirectory, profile });
    const second = await buildMiniProgram({ outdir: secondDirectory, profile });
    const firstManifest = JSON.stringify(first.files);
    const secondManifest = JSON.stringify(second.files);
    if (firstManifest !== secondManifest) {
      return { issues: ['two clean builds produced different file manifests'] };
    }
    return { issues: [], manifestSha256: sha256(firstManifest) };
  } finally {
    rmSync(assertSafeOutputDirectory(firstDirectory), { force: true, recursive: true });
    rmSync(assertSafeOutputDirectory(secondDirectory), { force: true, recursive: true });
  }
}

export function printIssues(label, issues) {
  if (issues.length === 0) return;
  for (const issue of issues) console.error(`[${label}] ${issue}`);
}
