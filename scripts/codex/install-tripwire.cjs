'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const AUTHORIZATION_SCHEMA_VERSION = 2;
const MAX_AUTHORIZATION_MINUTES = 15;
const AUTHORIZATION_DIRECTORY = path.join('runtime', 'codex', 'authorizations');
const DEPENDENCY_MUTATIONS = new Set([
  'install',
  'i',
  'add',
  'remove',
  'rm',
  'update',
  'up',
  'fetch',
  'rebuild',
  'prune',
]);
const OPTIONS_WITH_VALUES = new Set([
  '--dir',
  '-c',
  '-C',
  '--filter',
  '-F',
  '--config',
  '--lockfile-dir',
  '--prefix',
  '--reporter',
  '--workspace-concurrency',
]);

function canonicalPath(value) {
  const resolved = path.resolve(value);
  let real = resolved;
  try {
    real = fs.realpathSync.native(resolved);
  } catch {
    // The target may not exist in an install guard test.
  }
  return process.platform === 'win32' ? real.toLocaleLowerCase('en-US') : real;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function firstCommandIndex(arguments_) {
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = String(arguments_[index]);
    if (argument === '--') return index + 1;
    if (!argument.startsWith('-')) return index;
    if (OPTIONS_WITH_VALUES.has(argument)) index += 1;
    else if (argument.startsWith('--') && !argument.includes('=')) {
      // Unknown long switches are treated as switches. A mutation is still found if
      // its subcommand appears after them.
    }
  }
  return -1;
}

function commandName(arguments_, index) {
  return String(arguments_[index] ?? '').toLocaleLowerCase('en-US');
}

function isDependencyMutation(arguments_) {
  const index = firstCommandIndex(arguments_);
  if (index < 0) return false;
  const command = commandName(arguments_, index);
  if (DEPENDENCY_MUTATIONS.has(command)) return true;
  return command === 'store' && commandName(arguments_, index + 1) === 'prune';
}

function readGitValue(cwd, arguments_) {
  return execFileSync('git', ['-C', cwd, ...arguments_], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
}

function resolveProjectHome(cwd) {
  const commonRaw = readGitValue(cwd, ['rev-parse', '--git-common-dir']);
  const common = path.isAbsolute(commonRaw) ? path.resolve(commonRaw) : path.resolve(cwd, commonRaw);
  return {
    commonDir: canonicalPath(common),
    projectHome: path.dirname(common),
  };
}

function currentPnpmVersion() {
  const userAgent = String(process.env.npm_config_user_agent ?? '');
  const match = userAgent.match(/(?:^|\s)pnpm\/([^\s]+)/u);
  return match?.[1];
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return undefined;
  }
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function authorizationFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(directory, entry.name));
}

function validAuthorization(filePath, record, context) {
  if (!record || record.schemaVersion !== AUTHORIZATION_SCHEMA_VERSION || record.singleUse !== true) return false;
  if (record.usedAt || typeof record.nonce !== 'string' || !/^[0-9a-f-]{36}$/iu.test(record.nonce)) return false;
  if (record.createdBy !== 'scripts/codex/dependency-maintenance.ps1') return false;
  if (record.commonDir !== context.commonDir || record.targetWorktree !== context.worktree) return false;
  if (record.command?.cwd !== context.worktree || !deepEqual(record.command?.args, context.arguments)) return false;
  if (record.targetStorePath !== context.targetStorePath) return false;
  if (record.lockfileSha256 !== sha256File(path.join(context.worktree, 'pnpm-lock.yaml'))) return false;
  if (record.nodeVersion !== process.version) return false;
  const actualPnpmVersion = currentPnpmVersion();
  if (!actualPnpmVersion || record.pnpmVersion !== actualPnpmVersion) return false;
  if (typeof record.reason !== 'string' || record.reason.trim() === '') return false;
  const createdAt = Date.parse(record.createdAt ?? '');
  const expiresAt = Date.parse(record.expiresAt ?? '');
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) return false;
  if (expiresAt <= Date.now() || expiresAt - createdAt > MAX_AUTHORIZATION_MINUTES * 60_000) return false;
  if (path.basename(filePath, '.json') !== record.nonce) return false;
  return true;
}

function claimAuthorization(filePath, record) {
  const claimPath = `${filePath}.claim`;
  let handle;
  try {
    handle = fs.openSync(claimPath, 'wx');
    fs.writeFileSync(handle, `${JSON.stringify({ nonce: record.nonce, pid: process.pid, claimedAt: new Date().toISOString() })}\n`, 'utf8');
    fs.closeSync(handle);
    return true;
  } catch (error) {
    if (handle !== undefined) fs.closeSync(handle);
    if (error?.code === 'EEXIST') return false;
    throw error;
  }
}

function assertInstallAuthorized({ cwd = process.cwd(), arguments_ = process.argv.slice(2) } = {}) {
  if (!isDependencyMutation(arguments_)) return { mutation: false, authorized: true };
  const { commonDir, projectHome } = resolveProjectHome(cwd);
  const worktree = canonicalPath(cwd);
  const targetStorePath = canonicalPath(path.join(projectHome, 'runtime', 'pnpm-store'));
  const context = { commonDir, projectHome, worktree, targetStorePath, arguments: arguments_.map(String) };
  const directory = path.join(projectHome, AUTHORIZATION_DIRECTORY);
  for (const filePath of authorizationFiles(directory)) {
    const record = readJson(filePath);
    if (!validAuthorization(filePath, record, context)) continue;
    if (!claimAuthorization(filePath, record)) continue;
    return { mutation: true, authorized: true, filePath, claimPath: `${filePath}.claim`, record };
  }
  throw new Error(
    '[schedule:install-tripwire] unauthorized dependency mutation; use scripts/codex/dependency-maintenance.ps1. ' +
    'The install was stopped before dependency resolution/import/link.',
  );
}

module.exports = {
  AUTHORIZATION_DIRECTORY,
  AUTHORIZATION_SCHEMA_VERSION,
  DEPENDENCY_MUTATIONS,
  MAX_AUTHORIZATION_MINUTES,
  assertInstallAuthorized,
  canonicalPath,
  isDependencyMutation,
  sha256File,
};
