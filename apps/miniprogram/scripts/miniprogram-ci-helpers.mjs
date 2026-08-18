import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import {
  APP_ROOT,
  ARTIFACT_ROOT,
  buildMiniProgram,
  readProfileArgument,
  sha256,
} from './build-tools.mjs';

const ALLOWED_ACTIONS = new Set(['preview', 'upload-experience']);
const DEFAULT_ROBOT = 1;
const REPOSITORY_ROOT = path.resolve(APP_ROOT, '..', '..');
const require = createRequire(import.meta.url);

export const MINIPROGRAM_CI_SETTINGS = Object.freeze({
  compileWorklet: true,
  es6: true,
  minify: true,
  minifyWXML: true,
  minifyWXSS: true,
});

function isInsidePath(parentPath, candidatePath) {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function requiredText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

export function parseCiArguments(argv) {
  const [action, ...options] = argv;
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error('Expected action "preview" or "upload-experience".');
  }

  const dryRun = options.includes('--dry-run');
  const profile = readProfileArgument(options);
  const unknownOptions = options.filter(
    (option) => option !== '--dry-run' && !option.startsWith('--profile='),
  );

  if (unknownOptions.length > 0) {
    throw new Error(`Unknown option: ${unknownOptions[0]}`);
  }

  return { action, dryRun, profile };
}

export function resolveCiCredentials(environment = process.env) {
  const privateKeyPath = path.resolve(
    requiredText(environment.WECHAT_CI_PRIVATE_KEY_PATH, 'WECHAT_CI_PRIVATE_KEY_PATH'),
  );

  if (!existsSync(privateKeyPath)) {
    throw new Error('WECHAT_CI_PRIVATE_KEY_PATH does not point to an existing file.');
  }

  const realPrivateKeyPath = realpathSync(privateKeyPath);
  if (isInsidePath(REPOSITORY_ROOT, realPrivateKeyPath)) {
    throw new Error('The WeChat upload private key must remain outside the repository.');
  }

  const robotSource = environment.WECHAT_CI_ROBOT?.trim() || String(DEFAULT_ROBOT);
  const robot = Number.parseInt(robotSource, 10);
  if (!Number.isInteger(robot) || robot < 1 || robot > 30 || String(robot) !== robotSource) {
    throw new Error('WECHAT_CI_ROBOT must be an integer from 1 to 30.');
  }

  return { privateKeyPath: realPrivateKeyPath, robot };
}

export function resolveUploadMetadata(environment = process.env) {
  const version = requiredText(environment.WECHAT_CI_VERSION, 'WECHAT_CI_VERSION');
  const description = requiredText(environment.WECHAT_CI_DESCRIPTION, 'WECHAT_CI_DESCRIPTION');

  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('WECHAT_CI_VERSION must be a semantic version.');
  }

  if (description.length > 80) {
    throw new Error('WECHAT_CI_DESCRIPTION must not exceed 80 characters.');
  }

  return { description, version };
}

export function redactText(value, secrets) {
  let output = String(value);
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length > 0) {
      output = output.split(secret).join('[REDACTED]');
    }
  }
  return output;
}

export function configureMiniprogramCiModulePath(
  environment = process.env,
  resolvePackage = (specifier) => require.resolve(specifier),
) {
  const packagePath = resolvePackage('miniprogram-ci/package.json');
  const dependencyRoot = path.dirname(path.dirname(packagePath));
  const existingEntries = (environment.NODE_PATH ?? '')
    .split(path.delimiter)
    .filter((entry) => entry.length > 0 && entry !== dependencyRoot);
  environment.NODE_PATH = [dependencyRoot, ...existingEntries].join(path.delimiter);
  return dependencyRoot;
}

export async function withRedactedConsole(secrets, operation) {
  const originalMethods = new Map();
  for (const method of ['debug', 'error', 'info', 'log', 'warn']) {
    const original = console[method];
    originalMethods.set(method, original);
    console[method] = (...values) => original(...values.map((value) => redactText(value, secrets)));
  }

  try {
    return await operation();
  } finally {
    for (const [method, original] of originalMethods) {
      console[method] = original;
    }
  }
}

async function loadProjectIdentity() {
  const projectConfig = JSON.parse(
    await (
      await import('node:fs/promises')
    ).readFile(path.join(APP_ROOT, 'project.config.json'), 'utf8'),
  );
  const appid = requiredText(projectConfig.appid, 'project.config.json appid');
  return { appid };
}

export async function runCiCommand({ action, dryRun, profile }, environment = process.env) {
  const buildResult = await buildMiniProgram({ profile });

  if (dryRun) {
    return {
      action,
      externalStateChanged: false,
      manifestDigest: sha256(JSON.stringify(buildResult.files)),
      profile,
    };
  }

  const credentials = resolveCiCredentials(environment);
  const { appid } = await loadProjectIdentity();
  const secrets = [appid, credentials.privateKeyPath];
  configureMiniprogramCiModulePath(environment);
  const ciModule = await import('miniprogram-ci');
  const ci = ciModule.default ?? ciModule;
  const project = new ci.Project({
    appid,
    privateKeyPath: credentials.privateKeyPath,
    projectPath: APP_ROOT,
    type: 'miniProgram',
  });
  const settings = { ...MINIPROGRAM_CI_SETTINGS };

  if (action === 'preview') {
    const previewDirectory = path.join(ARTIFACT_ROOT, 'preview');
    await (await import('node:fs/promises')).mkdir(previewDirectory, { recursive: true });
    const qrcodeOutputDest = path.join(previewDirectory, `${profile}.png`);

    await withRedactedConsole(secrets, () =>
      ci.preview({
        desc: `Automated ${profile} preview`,
        project,
        qrcodeFormat: 'image',
        qrcodeOutputDest,
        robot: credentials.robot,
        setting: settings,
      }),
    );

    return {
      action,
      artifact: path.relative(APP_ROOT, qrcodeOutputDest).replaceAll(path.sep, '/'),
      externalStateChanged: true,
      manifestDigest: sha256(JSON.stringify(buildResult.files)),
      profile,
    };
  }

  const metadata = resolveUploadMetadata(environment);
  await withRedactedConsole(secrets, () =>
    ci.upload({
      desc: metadata.description,
      onProgressUpdate: () => undefined,
      project,
      robot: credentials.robot,
      setting: settings,
      version: metadata.version,
    }),
  );

  return {
    action,
    externalStateChanged: true,
    manifestDigest: sha256(JSON.stringify(buildResult.files)),
    profile,
    version: metadata.version,
  };
}
