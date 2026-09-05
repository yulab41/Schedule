import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import {
  APP_ROOT,
  ARTIFACT_ROOT,
  buildMiniProgram,
  createFileManifest,
  readProfileArgument,
  sha256,
} from './build-tools.mjs';
import {
  assertBuildProfileMatchesCandidate,
  allocateNextTrialVersion,
  bindTrialManifest,
  confirmTrialCandidate,
  inspectTrialCandidate,
  readBuildProfile,
  recordTrialAllocation,
  reserveTrialVersion,
  writeTrialReceipt,
  withTrialUploadLock,
} from './trial-lineage.mjs';
import { inspectReleaseCandidate } from '../../../scripts/codex/release-candidate-core.mjs';

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
  const description = resolveUploadDescription(environment);

  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('WECHAT_CI_VERSION must be a semantic version.');
  }

  if (description.length > 80) {
    throw new Error('WECHAT_CI_DESCRIPTION must not exceed 80 characters.');
  }

  return { description, version };
}

export function resolveUploadDescription(environment = process.env) {
  const description = requiredText(environment.WECHAT_CI_DESCRIPTION, 'WECHAT_CI_DESCRIPTION');
  if (description.length > 80) {
    throw new Error('WECHAT_CI_DESCRIPTION must not exceed 80 characters.');
  }
  return description;
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
  resolvePackage('@babel/preset-typescript/package.json');
  const dependencyRoot = path.dirname(path.dirname(packagePath));
  const existingEntries = (environment.NODE_PATH ?? '')
    .split(path.delimiter)
    .filter((entry) => entry.length > 0 && entry !== dependencyRoot);
  environment.NODE_PATH = [dependencyRoot, ...existingEntries].join(path.delimiter);
  // miniprogram-ci's worker thread replaces NODE_PATH with an npm-flat-layout path.
  // Running the official task inline keeps the validated dependency path in the Summer process.
  environment.__MINIPROGRAM_CI_TEST__ = 'true';
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

export function checkUploadCandidate(environment, output = {}) {
  return inspectReleaseCandidate({
    worktree: REPOSITORY_ROOT,
    runId: requiredText(environment.SCHEDULE_UPLOAD_RUN_ID, 'SCHEDULE_UPLOAD_RUN_ID'),
    leaseToken: requiredText(
      environment.SCHEDULE_WORKTREE_LEASE_TOKEN,
      'SCHEDULE_WORKTREE_LEASE_TOKEN',
    ),
    expectedCommit: requiredText(environment.SCHEDULE_UPLOAD_COMMIT, 'SCHEDULE_UPLOAD_COMMIT'),
    ...output,
  });
}

function verifyBuildManifest(buildResult, expected) {
  const actual = sha256(
    JSON.stringify(
      createFileManifest(buildResult.outputDirectory, new Set(['build-manifest.json'])),
    ),
  );
  if (actual !== expected) throw new Error('Upload output changed after build; manifest mismatch.');
}

export async function runCiCommand(options, environment = process.env, dependencyOverrides = {}) {
  if (options.action === 'upload-experience' && !options.dryRun) {
    await (dependencyOverrides.checkUploadCandidate ?? checkUploadCandidate)(environment);
    return (dependencyOverrides.withTrialUploadLock ?? withTrialUploadLock)(
      { repositoryRoot: REPOSITORY_ROOT, runId: environment.SCHEDULE_UPLOAD_RUN_ID },
      () => executeCiCommand(options, environment, dependencyOverrides),
    );
  }
  return executeCiCommand(options, environment, dependencyOverrides);
}

async function executeCiCommand(
  { action, dryRun, profile },
  environment = process.env,
  dependencyOverrides = {},
) {
  const dependencies = {
    assertBuildProfileMatchesCandidate,
    allocateNextTrialVersion,
    bindTrialManifest,
    buildMiniProgram,
    checkUploadCandidate,
    configureMiniprogramCiModulePath,
    confirmTrialCandidate,
    inspectTrialCandidate,
    loadCiModule: async () => {
      const ciModule = await import('miniprogram-ci');
      return ciModule.default ?? ciModule;
    },
    loadProjectIdentity,
    readBuildProfile,
    recordTrialAllocation,
    reserveTrialVersion,
    resolveCiCredentials,
    writeTrialReceipt,
    verifyBuildManifest,
    ...dependencyOverrides,
  };
  const isRealTrialUpload = action === 'upload-experience' && !dryRun;
  const metadata = isRealTrialUpload
    ? {
        description: resolveUploadDescription(environment),
        version: environment.WECHAT_CI_VERSION?.trim() || null,
      }
    : null;
  if (metadata !== null && metadata.version !== null) resolveUploadMetadata(environment);
  if (metadata !== null && metadata.version === null) {
    metadata.version = await dependencies.allocateNextTrialVersion({
      repositoryRoot: REPOSITORY_ROOT,
    });
  }
  const inspectedCandidate = isRealTrialUpload
    ? await dependencies.inspectTrialCandidate({
        description: metadata.description,
        profile,
        repositoryRoot: REPOSITORY_ROOT,
        version: metadata.version,
      })
    : null;
  if (inspectedCandidate !== null) await dependencies.recordTrialAllocation(inspectedCandidate);
  const buildResult = await dependencies.buildMiniProgram({
    ...(inspectedCandidate === null
      ? {}
      : {
          buildCommit: inspectedCandidate.shortHead,
          buildDescription: inspectedCandidate.description,
          buildDirty: false,
          buildVersion: inspectedCandidate.version,
        }),
    profile,
  });
  const manifestDigest = sha256(JSON.stringify(buildResult.files));

  if (dryRun) {
    return {
      action,
      externalStateChanged: false,
      manifestDigest,
      profile,
    };
  }

  const credentials = dependencies.resolveCiCredentials(environment);
  const { appid } = await dependencies.loadProjectIdentity();
  const secrets = [appid, credentials.privateKeyPath];
  dependencies.configureMiniprogramCiModulePath(environment);
  const ci = await dependencies.loadCiModule();
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
      manifestDigest,
      profile,
    };
  }

  const confirmedCandidate = await dependencies.confirmTrialCandidate(inspectedCandidate);
  const buildProfile = await dependencies.readBuildProfile(buildResult.outputDirectory);
  dependencies.assertBuildProfileMatchesCandidate(buildProfile, confirmedCandidate);
  await dependencies.checkUploadCandidate(environment, {
    forUpload: true,
    version: confirmedCandidate.version,
    outputDirectory: buildResult.outputDirectory,
  });
  await dependencies.verifyBuildManifest(buildResult, manifestDigest);
  await dependencies.bindTrialManifest({
    candidate: confirmedCandidate,
    manifestDigest,
    buildTime: buildProfile.buildTime,
  });
  const reservation = await dependencies.reserveTrialVersion({
    head: confirmedCandidate.head,
    repositoryRoot: confirmedCandidate.repositoryRoot,
    version: confirmedCandidate.version,
  });
  await withRedactedConsole(secrets, () =>
    ci.upload({
      desc: confirmedCandidate.description,
      onProgressUpdate: () => undefined,
      project,
      robot: credentials.robot,
      setting: settings,
      version: confirmedCandidate.version,
    }),
  );
  const receipt = await dependencies.writeTrialReceipt({
    buildTime: buildProfile.buildTime,
    candidate: confirmedCandidate,
    manifestDigest,
    reservation: reservation.reservation,
    uploadedAt: new Date().toISOString(),
  });

  return {
    action,
    externalStateChanged: true,
    manifestDigest,
    profile,
    receipt,
    version: confirmedCandidate.version,
  };
}
